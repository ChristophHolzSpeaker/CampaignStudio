import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	config: vi.fn(),
	allowed: vi.fn(),
	visitor: vi.fn(),
	log: vi.fn(),
	rate: vi.fn()
}));
vi.mock('$lib/server/artifacts/repository', () => ({ getPublishedArtifactPageById: mocks.page }));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/tracking/browser-consent', () => ({
	browserStatisticsAllowed: mocks.allowed,
	readBrowserConsent: () => null
}));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	getOrCreateVisitorIdentifier: mocks.visitor,
	logCampaignVisit: mocks.log
}));
vi.mock('$env/dynamic/private', () => ({ env: { ARTIFACT_PREVIEW_TOKEN_SECRET: 'test-secret' } }));
vi.mock('$lib/server/runtime/http', async (original) => ({
	...(await original<typeof import('$lib/server/runtime/http')>()),
	enforceRuntimeRateLimit: mocks.rate
}));
vi.mock('$lib/server/public-api/rate-limit', () => ({}));
import { POST } from './+server';
import { createVisitReceipt, verifyVisitReceipt } from '$lib/server/attribution/visit-receipt';
const call = (body: Record<string, unknown> = {}, origin = 'https://example.com') =>
	POST({
		request: new Request('https://example.com/api/runtime/v1/visits', {
			method: 'POST',
			headers: { origin, 'x-forwarded-for': '203.0.113.12' },
			body: JSON.stringify({
				campaignPageId: 222,
				pageUrl: '/landing?utm_source=test&gclid=ignored',
				...body
			})
		}),
		url: new URL('https://example.com/api/runtime/v1/visits'),
		cookies: {}
	} as unknown as Parameters<typeof POST>[0]);
beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({
		campaignId: 38,
		campaignPageId: 222,
		slug: 'landing',
		runtimeVersion: 'v6'
	});
	mocks.config.mockResolvedValue({ consent: { ownMeasurement: 'statistics' } });
	mocks.allowed.mockReturnValue(false);
	mocks.visitor.mockReturnValue('owner');
	mocks.log.mockResolvedValue({ logged: true, visitId: 17 });
});
it('records a baseline without consent or visitor cookie and never captures advertising', async () => {
	const response = await call({ baselineOnly: true });
	expect(response.status).toBe(200);
	expect(mocks.visitor).not.toHaveBeenCalled();
	expect(mocks.log).toHaveBeenCalledWith(
		expect.objectContaining({ visitorIdentifier: null, consentOnly: false, captureAds: false })
	);
	const result = await response.json();
	expect(verifyVisitReceipt(result.data.visitReceipt, 222)).toBe(17);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('claims the same visit after consent with a verified receipt', async () => {
	mocks.allowed.mockReturnValue(true);
	expect((await call({ visitReceipt: createVisitReceipt(17, 222) })).status).toBe(200);
	expect(mocks.log).toHaveBeenCalledWith(
		expect.objectContaining({ receiptVisitId: 17, visitorIdentifier: 'owner', captureAds: false })
	);
});
it('rejects tampered, expired and wrong-page receipts', async () => {
	const token = createVisitReceipt(17, 222);
	for (const receipt of [token + 'x', createVisitReceipt(17, 223)]) {
		expect((await call({ baselineOnly: true, visitReceipt: receipt })).status).toBe(403);
	}
	vi.useFakeTimers();
	try {
		vi.setSystemTime(Date.now() + 31 * 60000);
		expect(verifyVisitReceipt(token, 222)).toBeNull();
	} finally {
		vi.useRealTimers();
	}
	expect(mocks.log).not.toHaveBeenCalled();
});
it('keeps normal optional visits gated and validates page and origin', async () => {
	expect((await call()).status).toBe(403);
	expect((await call({ baselineOnly: true }, 'https://other.example')).status).toBe(403);
	expect((await call({ baselineOnly: true, pageUrl: '/wrong' })).status).toBe(400);
	mocks.page.mockResolvedValue(null);
	expect((await call({ baselineOnly: true })).status).toBe(404);
	expect(mocks.log).not.toHaveBeenCalled();
});
