import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	verify: vi.fn(),
	visitProof: vi.fn(),
	visitor: vi.fn(),
	page: vi.fn(),
	config: vi.fn(),
	choice: vi.fn(),
	statistics: vi.fn(),
	owned: vi.fn(),
	currentEvent: vi.fn(),
	consentRecord: vi.fn(),
	update: vi.fn(),
	persist: vi.fn()
}));
vi.mock('$lib/server/attribution/visit-receipt', () => ({ verifyVisitReceipt: mocks.visitProof }));
vi.mock('$lib/server/attribution/form-attribution-receipt', () => ({
	verifyFormAttributionReceipt: mocks.verify
}));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: mocks.visitor,
	resolveCampaignVisitId: mocks.owned
}));
vi.mock('$lib/server/attribution/journey-attribution', () => ({
	persistJourneyAttributionSnapshot: mocks.persist
}));
vi.mock('$lib/server/artifacts/repository', () => ({ getPublishedArtifactPageById: mocks.page }));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/tracking/browser-consent', () => ({
	browserStatisticsAllowed: mocks.statistics,
	readBrowserConsent: mocks.choice
}));
vi.mock('$lib/server/runtime/http', () => ({
	enforceSameOrigin: (request: Request, url: URL) =>
		request.headers.get('origin') === url.origin ? null : new Response(null, { status: 403 }),
	enforceRuntimeRateLimit: async () => null,
	readLimitedJson: (request: Request) => request.json()
}));
vi.mock('$lib/server/db', () => ({
	db: {
		select: (fields: Record<string, unknown>) => ({
			from: () => ({
				where: () => ({ limit: 'adUserData' in fields ? mocks.consentRecord : mocks.currentEvent })
			})
		}),
		update: () => ({ set: mocks.update })
	}
}));
import { POST } from './+server';

function call(body: Record<string, unknown> = {}, origin = 'https://app.example') {
	return POST({
		request: new Request('https://app.example/api/runtime/v1/forms/attribution', {
			method: 'POST',
			headers: { origin, 'content-type': 'application/json' },
			body: JSON.stringify({
				campaignPageId: 22,
				visitId: 17,
				visitReceipt: 'visit-proof',
				attributionReceipt: 'signed',
				...body
			})
		}),
		url: new URL('https://app.example/api/runtime/v1/forms/attribution'),
		cookies: {}
	} as never);
}
beforeEach(() => {
	vi.resetAllMocks();
	mocks.verify.mockReturnValue({
		formEventId: 'form-event-id',
		policyVersion: 'v1',
		evidenceRef: 'choice'
	});
	mocks.visitProof.mockReturnValue(17);
	mocks.visitor.mockReturnValue('browser-cookie');
	mocks.page.mockResolvedValue({ campaignId: 3, runtimeVersion: 'v8' });
	mocks.config.mockResolvedValue({
		consent: { ownMeasurement: 'statistics', policyVersion: 'v1' }
	});
	mocks.choice.mockReturnValue({ marketing: true, evidenceRef: 'choice' });
	mocks.statistics.mockReturnValue(false);
	mocks.owned.mockResolvedValue(17);
	mocks.consentRecord.mockResolvedValue([{ adUserData: 'GRANTED' }]);
	mocks.currentEvent.mockResolvedValue([{ journeyId: 'journey-id', visitId: null }]);
	mocks.update.mockReturnValue({
		where: () => ({ returning: async () => [{ id: 'form-event-id' }] })
	});
	mocks.persist.mockResolvedValue(undefined);
});
it('links only a verified browser-owned visit to the signed submission', async () => {
	expect((await call()).status).toBe(200);
	expect(mocks.owned).toHaveBeenCalledWith(
		expect.objectContaining({
			requestedVisitId: 17,
			visitorIdentifier: 'browser-cookie',
			campaignPageId: 22
		})
	);
	expect(mocks.update).toHaveBeenCalledWith({
		campaign_visit_id: 17,
		anonymous_id: 'browser-cookie'
	});
	expect(mocks.persist).toHaveBeenCalledWith(
		expect.objectContaining({ journeyId: 'journey-id', campaignId: 3 })
	);
});
it('rejects cross-origin requests, missing or forged proof, and a different browser', async () => {
	expect((await call({}, 'https://other.example')).status).toBe(403);
	mocks.verify.mockReturnValue(null);
	expect((await call()).status).toBe(403);
	mocks.verify.mockReturnValue({
		formEventId: 'form-event-id',
		policyVersion: 'v1',
		evidenceRef: 'choice'
	});
	mocks.owned.mockResolvedValue(null);
	expect((await call()).status).toBe(404);
	expect(mocks.update).not.toHaveBeenCalled();
});
it('does not attach a visit after denial or overwrite an existing attribution', async () => {
	mocks.choice.mockReturnValue({ marketing: false, evidenceRef: 'choice' });
	expect((await call()).status).toBe(403);
	mocks.choice.mockReturnValue({ marketing: true, evidenceRef: 'choice' });
	mocks.currentEvent.mockResolvedValue([{ journeyId: 'journey-id', visitId: 88 }]);
	expect((await call()).status).toBe(409);
	expect(mocks.update).not.toHaveBeenCalled();
});
it('accepts an idempotent retry without rewriting the event', async () => {
	mocks.currentEvent.mockResolvedValue([{ journeyId: 'journey-id', visitId: 17 }]);
	expect((await call()).status).toBe(200);
	expect(mocks.update).not.toHaveBeenCalled();
	expect(mocks.persist).toHaveBeenCalledTimes(1);
});

it('rejects a later regrant or changed policy instead of attributing retroactively', async () => {
	mocks.choice.mockReturnValue({ marketing: true, evidenceRef: 'different-choice' });
	expect((await call()).status).toBe(403);
	mocks.choice.mockReturnValue({ marketing: true, evidenceRef: 'choice' });
	mocks.config.mockResolvedValue({
		consent: { ownMeasurement: 'statistics', policyVersion: 'v2' }
	});
	expect((await call()).status).toBe(403);
	expect(mocks.update).not.toHaveBeenCalled();
});

it('rejects an unrelated or expired page visit receipt', async () => {
	mocks.visitProof.mockReturnValue(88);
	expect((await call()).status).toBe(403);
	mocks.visitProof.mockReturnValue(null);
	expect((await call()).status).toBe(403);
	expect(mocks.update).not.toHaveBeenCalled();
});

it('does not link when the submitted consent evidence was not recorded', async () => {
	mocks.consentRecord.mockResolvedValue([]);
	expect((await call()).status).toBe(403);
	mocks.consentRecord.mockResolvedValue([{ adUserData: 'DENIED' }]);
	expect((await call()).status).toBe(403);
	expect(mocks.update).not.toHaveBeenCalled();
});
