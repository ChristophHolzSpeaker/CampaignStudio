import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	page: vi.fn(),
	submit: vi.fn(),
	receipt: vi.fn(),
	visitor: vi.fn(),
	config: vi.fn(),
	choice: vi.fn(),
	statistics: vi.fn(),
	evidence: vi.fn()
}));
vi.mock('$lib/server/artifacts/repository', () => ({ getPublishedArtifactPageById: mocks.page }));
vi.mock('$lib/server/attribution/campaign-visits', () => ({
	readVisitorIdentifier: mocks.visitor
}));
vi.mock('$lib/server/attribution/form-attribution-receipt', () => ({
	createFormAttributionReceipt: mocks.receipt
}));
vi.mock('$lib/server/tracking/form-consent-evidence', () => ({
	recordFormConsentEvidence: mocks.evidence
}));
vi.mock('$lib/server/tracking/config', () => ({ getTrackingConfig: mocks.config }));
vi.mock('$lib/server/tracking/browser-consent', () => ({
	readBrowserConsent: mocks.choice,
	browserStatisticsAllowed: mocks.statistics
}));
vi.mock('$lib/server/leads/intake-service', () => ({ submitLeadIntake: mocks.submit }));
vi.mock('$lib/server/runtime/http', () => ({
	enforceSameOrigin: () => null,
	enforceRuntimeRateLimit: async () => null,
	readLimitedJson: (request: Request) => request.json()
}));
import { POST } from './+server';
function call() {
	return POST({
		request: new Request('https://app.example/api/runtime/v1/forms/lead-intake', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				campaignPageId: 22,
				fields: { email: 'test@example.com', scope: 'Keynote inquiry' }
			})
		}),
		url: new URL('https://app.example/api/runtime/v1/forms/lead-intake'),
		cookies: {}
	} as never);
}
beforeEach(() => {
	vi.resetAllMocks();
	mocks.page.mockResolvedValue({
		campaignId: 3,
		campaignPageId: 22,
		slug: 'test',
		runtimeVersion: 'v8'
	});
	mocks.visitor.mockReturnValue(null);
	mocks.submit.mockResolvedValue({
		journeyId: 'journey',
		intentApproved: true,
		formEventId: crypto.randomUUID()
	});
	mocks.receipt.mockReturnValue('signed-receipt');
	mocks.config.mockResolvedValue({ consent: { policyVersion: 'v1' } });
	mocks.choice.mockReturnValue({
		marketing: true,
		evidenceRef: 'choice',
		policyVersion: 'v1',
		expiresAt: Date.now() + 60000
	});
	mocks.evidence.mockResolvedValue(undefined);
	mocks.statistics.mockReturnValue(false);
});
it('returns a page-bound receipt after the lead is saved', async () => {
	const response = await call();
	expect(response.status).toBe(200);
	expect((await response.json()).data.attributionReceipt).toBe('signed-receipt');
	expect(mocks.receipt).toHaveBeenCalledWith(
		expect.objectContaining({
			formEventId: expect.any(String),
			campaignPageId: 22,
			policyVersion: 'v1',
			evidenceRef: 'choice'
		})
	);
});
it('preserves form consent evidence and attribution receipts for v9', async () => {
	mocks.page.mockResolvedValue({
		campaignId: 3,
		campaignPageId: 22,
		slug: 'test',
		runtimeVersion: 'v9'
	});
	const response = await call();
	expect(response.status).toBe(200);
	expect((await response.json()).data.attributionReceipt).toBe('signed-receipt');
	expect(mocks.evidence).toHaveBeenCalled();
});
it('preserves a successful submission even if receipt creation fails', async () => {
	mocks.receipt.mockImplementation(() => {
		throw Error('not configured');
	});
	const response = await call();
	expect(response.status).toBe(200);
	expect((await response.json()).data.attributionReceipt).toBeUndefined();
});
it('does not change the response for pinned v7 pages', async () => {
	mocks.page.mockResolvedValue({
		campaignId: 3,
		campaignPageId: 22,
		slug: 'test',
		runtimeVersion: 'v7'
	});
	const response = await call();
	expect(response.status).toBe(200);
	expect(mocks.receipt).not.toHaveBeenCalled();
	expect((await response.json()).data.attributionReceipt).toBeUndefined();
});

it('does not issue an attribution receipt without permission at submission', async () => {
	mocks.choice.mockReturnValue(null);
	const response = await call();
	expect(response.status).toBe(200);
	expect((await response.json()).data.attributionReceipt).toBeUndefined();
	expect(mocks.receipt).not.toHaveBeenCalled();
});

it('records an explicit denial without issuing attribution or stopping the form', async () => {
	mocks.choice.mockReturnValue({
		marketing: false,
		evidenceRef: 'denial',
		policyVersion: 'v1',
		expiresAt: Date.now() + 60000
	});
	const response = await call();
	expect(response.status).toBe(200);
	expect(mocks.evidence).toHaveBeenCalledWith(
		expect.any(String),
		expect.objectContaining({ marketing: false, evidenceRef: 'denial' })
	);
	expect(mocks.receipt).not.toHaveBeenCalled();
});
it('does not turn an absent choice into a denial', async () => {
	mocks.choice.mockReturnValue(null);
	expect((await call()).status).toBe(200);
	expect(mocks.evidence).not.toHaveBeenCalled();
});
it('does not fail a saved lead when choice recording fails', async () => {
	mocks.evidence.mockRejectedValue(Error('unavailable'));
	const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	expect((await call()).status).toBe(200);
	expect(mocks.receipt).toHaveBeenCalled();
	log.mockRestore();
});

it('returns the saved lead if optional consent evidence stalls', async () => {
	vi.useFakeTimers();
	try {
		mocks.evidence.mockImplementation(() => new Promise(() => {}));
		const pending = call();
		await vi.advanceTimersByTimeAsync(1000);
		const response = await pending;
		expect(response.status).toBe(200);
		expect((await response.json()).data.attributionReceipt).toBeUndefined();
	} finally {
		vi.useRealTimers();
	}
});
