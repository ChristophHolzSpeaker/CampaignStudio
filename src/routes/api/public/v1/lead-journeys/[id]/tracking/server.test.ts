import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ journey: vi.fn(), consent: vi.fn(), select: vi.fn() }));
vi.mock('$lib/server/tracking/attribution', () => ({ journeyClicks: mocks.journey }));
vi.mock('$lib/server/tracking/form-consent-evidence', () => ({
	latestFormConsentEvidence: mocks.consent
}));
vi.mock('$lib/server/tracking/outcomes', () => ({ deliveryView: (v: unknown) => v }));
vi.mock('$lib/server/db', () => ({ db: { select: mocks.select } }));
vi.mock('$lib/server/public-api/http', () => ({
	requirePublicApiRequest: async () => ({ ok: true, context: {} }),
	publicApiJson: (data: unknown, _context: unknown, options: ResponseInit) =>
		Response.json(data, options),
	parsePositiveInt: () => 100,
	parseOptionalDate: () => null
}));
import { GET } from './+server';
const id = '4f8d12ec-8d8d-4e4e-9111-126b68f06ac5';
function call() {
	return GET({
		request: new Request(`https://example.com/api/public/v1/lead-journeys/${id}/tracking`),
		params: { id },
		url: new URL(`https://example.com/api/public/v1/lead-journeys/${id}/tracking`)
	} as never);
}
beforeEach(() => {
	vi.resetAllMocks();
	mocks.journey.mockResolvedValue({
		journey: { first_visit_id: null, last_visit_id: null },
		clicks: []
	});
	mocks.select.mockReturnValueOnce({ from: () => ({ where: async () => [] }) });
	mocks.select.mockReturnValueOnce({
		from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) })
	});
});
it('distinguishes an explicit denial from unknown evidence', async () => {
	mocks.consent.mockResolvedValue({
		source: 'browser_reported',
		marketingAllowed: false,
		policyVersion: 'v1'
	});
	const body = await (await call()).json();
	expect(body.data).toMatchObject({
		consentEvidenceStatus: 'recorded',
		consentAtLatestSubmission: { marketingAllowed: false }
	});
});
it('keeps journey reporting available if evidence storage is unavailable', async () => {
	mocks.consent.mockRejectedValue(Error('unavailable'));
	const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	const response = await call();
	expect(response.status).toBe(200);
	expect((await response.json()).data).toMatchObject({
		consentEvidenceStatus: 'unavailable',
		consentAtLatestSubmission: null
	});
	log.mockRestore();
});
it('reports missing evidence as unknown, never as denial', async () => {
	mocks.consent.mockResolvedValue(null);
	const body = await (await call()).json();
	expect(body.data).toMatchObject({
		consentEvidenceStatus: 'unknown',
		consentAtLatestSubmission: null
	});
});
