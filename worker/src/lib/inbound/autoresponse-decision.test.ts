import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	selectOne: vi.fn()
}));

import { selectOne } from '../db';
import { evaluateInboundAutoResponseDecision } from './autoresponse-decision';

const mockedSelectOne = vi.mocked(selectOne);

describe('autoresponse decision engine', () => {
	beforeEach(() => {
		mockedSelectOne.mockReset();
	});

	it('skips internal sender before other checks', async () => {
		mockedSelectOne.mockResolvedValue({
			id: 'journey-1',
			auto_response_sent_at: '2026-01-01T00:00:00Z',
			auto_response_message_id: null
		});

		const result = await evaluateInboundAutoResponseDecision(makeTestEnv(), {
			lead_journey_id: 'journey-1',
			lead_message_id: 'message-1',
			is_internal_sender: true,
			classification: {
				classification: 'speaking_inquiry',
				classification_confidence: 0.9,
				reason: 'test'
			}
		});

		expect(result.auto_response_decision).toBe('do_not_autorespond_internal_sender');
		expect(result.eligible_for_autoresponse).toBe(false);
	});

	it('skips when journey already auto-responded', async () => {
		mockedSelectOne.mockResolvedValue({
			id: 'journey-1',
			auto_response_sent_at: '2026-01-01T00:00:00Z',
			auto_response_message_id: null
		});

		const result = await evaluateInboundAutoResponseDecision(makeTestEnv(), {
			lead_journey_id: 'journey-1',
			lead_message_id: 'message-1',
			is_internal_sender: false,
			classification: {
				classification: 'speaking_inquiry',
				classification_confidence: 0.9,
				reason: 'test'
			}
		});

		expect(result.auto_response_decision).toBe('do_not_autorespond_already_sent');
	});

	it('skips uncertain classification', async () => {
		mockedSelectOne.mockResolvedValue({
			id: 'journey-1',
			auto_response_sent_at: null,
			auto_response_message_id: null
		});

		const result = await evaluateInboundAutoResponseDecision(makeTestEnv(), {
			lead_journey_id: 'journey-1',
			lead_message_id: 'message-1',
			is_internal_sender: false,
			classification: {
				classification: 'uncertain',
				classification_confidence: 0.5,
				reason: 'test'
			}
		});

		expect(result.auto_response_decision).toBe('do_not_autorespond_uncertain');
	});

	it('skips non-speaking inquiry', async () => {
		mockedSelectOne.mockResolvedValue({
			id: 'journey-1',
			auto_response_sent_at: null,
			auto_response_message_id: null
		});

		const result = await evaluateInboundAutoResponseDecision(makeTestEnv(), {
			lead_journey_id: 'journey-1',
			lead_message_id: 'message-1',
			is_internal_sender: false,
			classification: {
				classification: 'not_speaking_inquiry',
				classification_confidence: 0.8,
				reason: 'test'
			}
		});

		expect(result.auto_response_decision).toBe('do_not_autorespond_not_inquiry');
	});

	it('marks eligible only for first speaking inquiry', async () => {
		mockedSelectOne.mockResolvedValue({
			id: 'journey-1',
			auto_response_sent_at: null,
			auto_response_message_id: null
		});

		const result = await evaluateInboundAutoResponseDecision(makeTestEnv(), {
			lead_journey_id: 'journey-1',
			lead_message_id: 'message-1',
			is_internal_sender: false,
			classification: {
				classification: 'speaking_inquiry',
				classification_confidence: 0.9,
				reason: 'test'
			}
		});

		expect(result.auto_response_decision).toBe('eligible_for_autoresponse');
		expect(result.eligible_for_autoresponse).toBe(true);
	});
});
