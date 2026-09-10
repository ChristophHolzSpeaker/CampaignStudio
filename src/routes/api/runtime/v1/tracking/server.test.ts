import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ page: vi.fn(), config: vi.fn() }));
vi.mock('$lib/server/attribution/campaign-context', () => ({
	resolvePublishedCampaignPageContext: mocks.page
}));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
import { GET } from './+server';
const request = (id: string) =>
	GET({ url: new URL('https://example.com/api/runtime/v1/tracking?pageId=' + id) } as Parameters<
		typeof GET
	>[0]);
beforeEach(() => {
	vi.resetAllMocks();
});
it('exposes only browser configuration for published section pages', async () => {
	mocks.page.mockResolvedValue({ campaignId: 44, campaignPageId: 269 });
	mocks.config.mockResolvedValue({
		gtmContainerId: 'GTM-MCDDK28B',
		mappings: [
			{ channel: 'browser', event: 'booking_confirmed' },
			{ channel: 'offline', event: 'lead_marked_eligible' }
		]
	});
	const response = await request('269');
	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(mocks.config).toHaveBeenCalledWith(44);
	expect(await response.json()).toEqual({
		ok: true,
		data: {
			gtmContainerId: 'GTM-MCDDK28B',
			mappings: [{ channel: 'browser', event: 'booking_confirmed' }]
		}
	});
});
it('does not expose preview configuration', async () => {
	mocks.page.mockResolvedValue(null);
	expect((await request('269')).status).toBe(404);
	expect(mocks.config).not.toHaveBeenCalled();
});
it('rejects invalid page IDs before lookup', async () => {
	expect((await request('invalid')).status).toBe(400);
	expect(mocks.page).not.toHaveBeenCalled();
});
