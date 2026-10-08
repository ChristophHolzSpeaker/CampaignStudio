import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	issue: vi.fn(),
	visitor: vi.fn(),
	rate: vi.fn()
}));
vi.mock('$lib/server/attribution/campaign-context', () => ({
	resolvePublishedCampaignPageContext: mocks.page
}));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: mocks.visitor
}));
vi.mock('$lib/server/attribution/email-reference', () => ({
	issueEmailVisitReference: mocks.issue
}));
vi.mock('$lib/server/runtime/http', async (original) => ({
	...(await original<typeof import('$lib/server/runtime/http')>()),
	enforceRuntimeRateLimit: mocks.rate
}));
vi.mock('$lib/server/public-api/rate-limit', () => ({}));
import { POST } from './+server';
const call = (body: unknown = { campaignPageId: 287 }, origin = 'https://app.example') =>
	POST({
		request: new Request('https://app.example/api/runtime/v1/email-reference', {
			method: 'POST',
			headers: { Origin: origin },
			body: JSON.stringify(body)
		}),
		url: new URL('https://app.example/api/runtime/v1/email-reference'),
		cookies: {}
	} as Parameters<typeof POST>[0]);
beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({ campaignId: 39, campaignPageId: 287 });
	mocks.visitor.mockReturnValue('owner-cookie');
	mocks.issue.mockResolvedValue('Referenz: CS-00112233445546778899aabbccddeeff');
});
it('rejects cross-origin requests and browser-supplied identities', async () => {
	expect((await call(undefined, 'https://other.example')).status).toBe(403);
	expect((await call({ campaignPageId: 287, visitorIdentifier: 'victim' })).status).toBe(400);
	expect(mocks.issue).not.toHaveBeenCalled();
});
it('does not issue references for previews, missing cookies or missing visits', async () => {
	mocks.page.mockResolvedValueOnce(null);
	expect((await call()).status).toBe(404);
	mocks.visitor.mockReturnValueOnce(null);
	expect((await call()).status).toBe(409);
	mocks.issue.mockResolvedValueOnce(null);
	expect((await call()).status).toBe(409);
});
it('passes only the server-resolved campaign and cookie ownership and disables caching', async () => {
	const response = await call({ campaignPageId: 287, visitId: 42 });
	expect(response.status).toBe(200);
	expect(response.headers.get('cache-control')).toBe('private, no-store');
	expect(mocks.issue).toHaveBeenCalledWith({
		campaignId: 39,
		campaignPageId: 287,
		requestedVisitId: 42,
		visitorIdentifier: 'owner-cookie'
	});
	expect(await response.json()).toEqual({
		ok: true,
		data: { reference: 'Referenz: CS-00112233445546778899aabbccddeeff' }
	});
});
