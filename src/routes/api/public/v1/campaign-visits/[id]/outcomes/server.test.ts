import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), record: vi.fn() }));
vi.mock('$lib/server/public-api/http', () => ({
	requireCrmWriteRequest: mocks.auth,
	publicApiJson: (data: unknown, _context: unknown, init: ResponseInit) => Response.json(data, init)
}));
vi.mock('$lib/server/tracking/outcomes', async () => ({
	recordVisitOutcome: mocks.record,
	deliveryView: (r: unknown) => r,
	...(await import('$lib/server/tracking/errors'))
}));
import { POST } from './+server';
import { OutcomeError } from '$lib/server/tracking/errors';
const input = {
	externalEventId: 'crm:company-identified:visit:42',
	name: 'company_identified',
	occurredAt: '2026-09-09T00:00:00Z',
	adUserDataConsent: 'GRANTED'
};
const call = (id = '42', body: unknown = input) =>
	POST({
		params: { id },
		request: new Request('https://app.example/api/public/v1/campaign-visits/' + id + '/outcomes', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as Parameters<typeof POST>[0]);
beforeEach(() => {
	vi.resetAllMocks();
	mocks.auth.mockResolvedValue({ ok: true, context: {} });
});
it('requires CRM write scope before any mutation', async () => {
	mocks.auth.mockResolvedValue({
		ok: false,
		response: Response.json({ ok: false }, { status: 401 })
	});
	expect((await call()).status).toBe(401);
	expect(mocks.record).not.toHaveBeenCalled();
});
it('rejects ad-click UUIDs and arbitrary consent fields', async () => {
	expect((await call('d625b4be-12c3-46f1-9588-49de30e2585c')).status).toBe(400);
	expect((await call('42', { ...input, companyName: 'example' })).status).toBe(400);
	expect(mocks.record).not.toHaveBeenCalled();
});
it('returns the existing pollable delivery without claiming Google success', async () => {
	mocks.record.mockResolvedValue({ id: 'delivery', status: 'pending' });
	const response = await call();
	expect(response.status).toBe(202);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(await response.json()).toEqual({ ok: true, data: { id: 'delivery', status: 'pending' } });
	expect(mocks.record).toHaveBeenCalledWith(42, input);
});
it('returns machine-readable readiness failures', async () => {
	mocks.record.mockRejectedValue(new OutcomeError(422, 'Visit is not ready', ['missing_click_id']));
	const response = await call();
	expect(response.status).toBe(422);
	expect(await response.json()).toMatchObject({ reasons: ['missing_click_id'] });
});
