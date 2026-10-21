import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	record: vi.fn(),
	visitor: vi.fn(),
	rate: vi.fn(),
	setCookie: vi.fn()
}));
vi.mock('$lib/server/attribution/campaign-context', () => ({
	resolvePublishedCampaignPageContext: mocks.page
}));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: mocks.visitor
}));
vi.mock('$lib/server/tracking/visits', () => ({ recordVisitConsent: mocks.record }));
vi.mock('$lib/server/runtime/http', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/runtime/http')>()),
	enforceRuntimeRateLimit: mocks.rate
}));
// Keep the real origin/body checks without initializing the public rate-limit database.
vi.mock('$lib/server/public-api/rate-limit', () => ({}));
import { POST } from './+server';
const input = {
	visitId: 42,
	campaignPageId: 274,
	adUserDataConsent: 'DENIED',
	evidenceRef: 'cmp:choice:1',
	policyVersion: 'ads-v1'
};
const call = (origin = 'https://app.example', body: unknown = input) =>
	POST({
		request: new Request('https://app.example/api/runtime/v1/consent', {
			method: 'POST',
			headers: { Origin: origin },
			body: JSON.stringify(body)
		}),
		url: new URL('https://app.example/api/runtime/v1/consent'),
		cookies: { set: mocks.setCookie }
	} as unknown as Parameters<typeof POST>[0]);
beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({ campaignId: 62, campaignPageId: 274 });
	mocks.visitor.mockReturnValue('owner-cookie');
	mocks.record.mockResolvedValue({ adUserDataConsent: 'DENIED' });
});
it('rejects cross-origin consent changes', async () => {
	expect((await call('https://other.example')).status).toBe(403);
	expect(mocks.record).not.toHaveBeenCalled();
});
it('requires a browser cookie, not a CRM claim', async () => {
	mocks.visitor.mockReturnValue(null);
	expect((await call()).status).toBe(400);
	expect(mocks.record).not.toHaveBeenCalled();
});
it('rejects unpublished pages and arbitrary metadata', async () => {
	mocks.page.mockResolvedValue(null);
	expect((await call()).status).toBe(404);
	expect((await call('https://app.example', { ...input, company: 'test' })).status).toBe(400);
	expect(mocks.record).not.toHaveBeenCalled();
});
it('passes the owning browser context and explicit denial to the service', async () => {
	const response = await call();
	expect(response.status).toBe(200);
	expect(mocks.record).toHaveBeenCalledWith(
		42,
		{ adUserDataConsent: 'DENIED', evidenceRef: 'cmp:choice:1', policyVersion: 'ads-v1' },
		{ visitorIdentifier: 'owner-cookie', campaignPageId: 274 }
	);
});

it('retains browser ownership to the original expiry when a v6 choice is persisted or restored', async () => {
	const expiresAt = new Date(Date.now() + 180 * 86400000);
	mocks.record.mockResolvedValue({ adUserDataConsent: 'DENIED', expiresAt });
	const body = { ...input, expiresAt: expiresAt.toISOString() };
	expect((await call(undefined, body)).status).toBe(200);
	expect((await call(undefined, body)).status).toBe(200);
	expect(mocks.setCookie).toHaveBeenCalledTimes(2);
	for (const call of mocks.setCookie.mock.calls)
		expect(call).toEqual([
			'cs_vid',
			'owner-cookie',
			{ path: '/', httpOnly: true, sameSite: 'lax', secure: true, expires: expiresAt }
		]);
});
