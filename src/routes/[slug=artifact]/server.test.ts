import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	html: vi.fn(),
	config: vi.fn(),
	consent: vi.fn()
}));
vi.mock('$lib/server/artifacts/repository', () => ({
	getPublishedArtifactPage: mocks.page,
	readVerifiedArtifactHtml: mocks.html
}));
vi.mock('$lib/server/artifacts/storage', () => ({
	getArtifactAssetPublicOrigin: () => 'https://assets.example.com'
}));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/tracking/browser-consent', () => ({ readBrowserConsent: mocks.consent }));
import { GET } from './+server';

beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({
		campaignId: 41,
		campaignPageId: 99,
		versionNumber: 1,
		slug: 'example',
		runtimeVersion: 'v9',
		contentSha256: 'hash'
	});
	mocks.html.mockResolvedValue('<html><head></head><body><main>Page</main></body></html>');
	mocks.consent.mockReturnValue(null);
});
describe('published artifact consent links', () => {
	it('renders the campaign settings on the first response', async () => {
		mocks.config.mockResolvedValue({
			consent: {},
			consentBannerLinks: {
				privacyUrl: 'https://speaker.christophholz.com/datenschutz',
				imprintUrl: 'https://speaker.christophholz.com/impressum'
			}
		});
		const response = await GET({
			params: { slug: 'example' },
			request: new Request('https://example.com/example'),
			cookies: {}
		} as never);
		const html = await response.text();
		expect(mocks.config).toHaveBeenCalledWith(41);
		expect(html).toContain('href="https://speaker.christophholz.com/datenschutz"');
		expect(html).toContain('href="https://speaker.christophholz.com/impressum"');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});
	it('preserves the existing links when no override is configured', async () => {
		mocks.config.mockResolvedValue({ consent: {} });
		const response = await GET({
			params: { slug: 'example' },
			request: new Request('https://example.com/example'),
			cookies: {}
		} as never);
		expect(await response.text()).toContain(
			'href="https://www.christophholz.com/datenschutzerklarung"'
		);
	});
});
