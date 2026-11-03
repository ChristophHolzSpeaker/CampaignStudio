import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/dynamic/private', () => ({
	env: { ARTIFACT_PREVIEW_TOKEN_SECRET: 'unit-test-secret' }
}));
import {
	createFormAttributionReceipt,
	verifyFormAttributionReceipt
} from './form-attribution-receipt';

afterEach(() => vi.useRealTimers());
describe('form attribution receipt', () => {
	it('is bound to the exact page and cannot be tampered with', () => {
		const eventId = crypto.randomUUID();
		const receipt = createFormAttributionReceipt({
			formEventId: eventId,
			campaignPageId: 17,
			policyVersion: 'v1',
			evidenceRef: 'choice'
		});
		expect(verifyFormAttributionReceipt(receipt, 17)).toMatchObject({
			formEventId: eventId,
			policyVersion: 'v1',
			evidenceRef: 'choice'
		});
		expect(verifyFormAttributionReceipt(receipt, 18)).toBeNull();
		expect(verifyFormAttributionReceipt(receipt + 'x', 17)).toBeNull();
	});
	it('expires after 30 minutes', () => {
		vi.useFakeTimers();
		const receipt = createFormAttributionReceipt({
			formEventId: crypto.randomUUID(),
			campaignPageId: 17,
			policyVersion: 'v1',
			evidenceRef: null
		});
		vi.advanceTimersByTime(30 * 60_000);
		expect(verifyFormAttributionReceipt(receipt, 17)).toBeNull();
	});
});
