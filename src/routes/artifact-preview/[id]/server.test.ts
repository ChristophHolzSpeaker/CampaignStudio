import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ page: vi.fn(), html: vi.fn(), config: vi.fn() }));
vi.mock('$lib/server/artifacts/preview-token', () => ({ verifyArtifactPreviewToken: () => true }));
vi.mock('$lib/server/artifacts/widget-token', () => ({ createBookingWidgetToken: () => 'test' }));
vi.mock('$lib/server/artifacts/repository', () => ({
	getArtifactPageById: mocks.page,
	readVerifiedArtifactHtml: mocks.html
}));
vi.mock('$lib/server/artifacts/storage', () => ({
	getArtifactAssetPublicOrigin: () => 'https://assets.example.com'
}));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
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
	mocks.config.mockResolvedValue({
		consentBannerLinks: {
			privacyUrl: 'https://speaker.christophholz.com/datenschutz',
			imprintUrl: 'https://speaker.christophholz.com/impressum'
		}
	});
});
it('shows the campaign legal links in a tokenized preview', async () => {
	const response = await GET({
		params: { id: '99' },
		url: new URL('https://example.com/artifact-preview/99?token=test')
	} as never);
	const html = await response.text();
	expect(mocks.config).toHaveBeenCalledWith(41);
	expect(html).toContain('href="https://speaker.christophholz.com/datenschutz"');
	expect(html).toContain('href="https://speaker.christophholz.com/impressum"');
	expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
});
