import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	visit: vi.fn(),
	journey: vi.fn(),
	insert: vi.fn(),
	values: vi.fn(),
	conflict: vi.fn(),
	origin: vi.fn(),
	rate: vi.fn()
}));
vi.mock('$lib/server/db', () => ({ db: { insert: mocks.insert } }));
vi.mock('$lib/server/attribution/campaign-context', () => ({
	resolvePublishedCampaignPageContext: mocks.page
}));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: () => 'visitor',
	resolveCampaignVisitId: mocks.visit
}));
vi.mock('$lib/server/tracking/attribution', () => ({ journeyForVisit: mocks.journey }));
vi.mock('$lib/server/runtime/http', () => ({
	enforceSameOrigin: mocks.origin,
	enforceRuntimeRateLimit: mocks.rate,
	readLimitedJson: (request: Request) => request.json()
}));
import { POST } from './+server';
const event = {
	id: 'b85cc6d2-207c-4a83-aaf9-c746c7e642a0',
	name: 'booking_confirmed',
	action: 'inline_booking_sequence'
};
function request(events: unknown[] = [event]) {
	return POST({
		request: new Request('https://example.com/api/runtime/v1/events', {
			method: 'POST',
			body: JSON.stringify({ campaignPageId: 269, visitId: 17, events })
		}),
		url: new URL('https://example.com/api/runtime/v1/events'),
		cookies: {}
	} as Parameters<typeof POST>[0]);
}
beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({ campaignId: 44, campaignPageId: 269 });
	mocks.visit.mockResolvedValue(17);
	mocks.journey.mockResolvedValue(null);
	mocks.insert.mockReturnValue({ values: mocks.values });
	mocks.values.mockReturnValue({ onConflictDoNothing: mocks.conflict });
});
it('records measurements for a published section page using server-resolved identity and visit ownership', async () => {
	expect((await request()).status).toBe(204);
	expect(mocks.page).toHaveBeenCalledWith({ campaignPageId: 269 });
	expect(mocks.visit).toHaveBeenCalledWith({
		campaignId: 44,
		campaignPageId: 269,
		visitorIdentifier: 'visitor',
		requestedVisitId: 17
	});
	expect(mocks.values).toHaveBeenCalledWith([
		expect.objectContaining({
			campaign_id: 44,
			campaign_page_id: 269,
			campaign_visit_id: 17,
			event_name: 'booking_confirmed',
			id: event.id
		})
	]);
	expect(mocks.conflict).toHaveBeenCalledOnce();
});
it('rejects unpublished pages before writing', async () => {
	mocks.page.mockResolvedValue(null);
	expect((await request()).status).toBe(404);
	expect(mocks.insert).not.toHaveBeenCalled();
});
it('rejects visits owned by another browser or campaign', async () => {
	mocks.visit.mockResolvedValue(null);
	expect((await request()).status).toBe(403);
	expect(mocks.insert).not.toHaveBeenCalled();
});
it('rejects arbitrary form values in measurements', async () => {
	expect((await request([{ ...event, email: 'private@example.com' }])).status).toBe(400);
	expect(mocks.insert).not.toHaveBeenCalled();
});
it('retains origin enforcement', async () => {
	mocks.origin.mockReturnValue(new Response(null, { status: 403 }));
	expect((await request()).status).toBe(403);
	expect(mocks.page).not.toHaveBeenCalled();
});
