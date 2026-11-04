import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), config: vi.fn() }));
vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 41 }] }) }) }),
		insert: () => ({
			values: (value: unknown) => ({
				onConflictDoUpdate: async (update: unknown) => mocks.upsert(value, update)
			})
		})
	}
}));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/public-api/http', () => ({
	requirePublicApiWriteRequest: async () => ({ ok: true, context: {} }),
	publicApiJson: (body: unknown, _context: unknown, init: ResponseInit = {}) =>
		Response.json(body, init)
}));
import { GET, PATCH, PUT } from './+server';
const base = {
	gtmContainerId: 'GTM-MCDDK28B',
	consent: {
		mode: 'advanced',
		policyVersion: 'cs-consent-v2',
		retentionDays: 180,
		ownMeasurement: 'statistics',
		missingOfflineConsent: 'DENIED'
	},
	mappings: [
		{ channel: 'browser', event: 'form_submit', conversionId: 'AW-123', conversionLabel: 'label' }
	]
};
const links = {
	privacyUrl: 'https://speaker.christophholz.com/datenschutz',
	imprintUrl: 'https://speaker.christophholz.com/impressum'
};
function call(method: string, body?: unknown) {
	return {
		params: { id: '41' },
		request: new Request('https://example.com/api/public/v1/campaigns/41/tracking', {
			method,
			...(body
				? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
				: {})
		})
	} as never;
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.config.mockResolvedValue(base);
});
it('preserves campaign tracking and consent settings when adding legal links', async () => {
	const read = await GET(call('GET'));
	const original = (await read.json()).data;
	const response = await PUT(call('PUT', { ...original, consentBannerLinks: links }));
	expect(response.status).toBe(200);
	const result = (await response.json()).data;
	expect(result).toEqual({ ...base, consentBannerLinks: links });
	expect(mocks.upsert).toHaveBeenCalledWith(
		expect.objectContaining({ campaign_id: 41, config: result }),
		expect.objectContaining({ set: expect.objectContaining({ config: result }) })
	);
});
it('rejects unsafe legal links without updating the campaign', async () => {
	const response = await PUT(
		call('PUT', { ...base, consentBannerLinks: { ...links, privacyUrl: 'javascript:alert(1)' } })
	);
	expect(response.status).toBe(400);
	expect(mocks.upsert).not.toHaveBeenCalled();
});
it('patches only the legal links without replacing the tracking configuration', async () => {
	mocks.config.mockResolvedValue({ ...base, consentBannerLinks: links });
	const response = await PATCH(call('PATCH', { consentBannerLinks: links }));
	expect(response.status).toBe(200);
	expect((await response.json()).data).toEqual({ ...base, consentBannerLinks: links });
	expect(mocks.upsert).toHaveBeenCalledWith(
		expect.objectContaining({ campaign_id: 41, config: { consentBannerLinks: links } }),
		expect.objectContaining({ set: expect.objectContaining({ config: expect.anything() }) })
	);
});
it('rejects unrelated fields and unsafe URLs in a narrow update', async () => {
	for (const body of [
		{ consentBannerLinks: links, consent: {} },
		{ consentBannerLinks: { ...links, privacyUrl: 'http://example.com' } }
	]) {
		const response = await PATCH(call('PATCH', body));
		expect(response.status).toBe(400);
	}
	expect(mocks.upsert).not.toHaveBeenCalled();
});
it('accepts a null update to restore the default links', async () => {
	const response = await PATCH(call('PATCH', { consentBannerLinks: null }));
	expect(response.status).toBe(200);
	expect(mocks.upsert).toHaveBeenCalledWith(
		expect.objectContaining({ campaign_id: 41, config: {} }),
		expect.anything()
	);
});
