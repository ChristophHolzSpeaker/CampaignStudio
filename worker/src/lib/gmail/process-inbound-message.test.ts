import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestEnv } from '../../test/helpers';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	selectOne: vi.fn(),
	updateMany: vi.fn(),
	upsertOne: vi.fn()
}));

vi.mock('../journeys/resolve-inbound-journey', () => ({
	resolveInboundJourney: vi.fn()
}));

vi.mock('./messages', () => ({
	normalizeGmailMessage: vi.fn()
}));

vi.mock('../email/internal-senders', () => ({
	isInternalSender: vi.fn()
}));

vi.mock('../inbound/classify-message', () => ({
	classifyInboundMessage: vi.fn()
}));

vi.mock('../inbound/autoresponse-decision', () => ({
	evaluateInboundAutoResponseDecision: vi.fn()
}));

vi.mock('../inbound/run-autoresponse', () => ({
	runAutoresponsePipeline: vi.fn()
}));

import { insertOne, selectOne, updateMany, upsertOne } from '../db';
import { resolveInboundJourney } from '../journeys/resolve-inbound-journey';
import { normalizeGmailMessage } from './messages';
import { isInternalSender } from '../email/internal-senders';
import { classifyInboundMessage } from '../inbound/classify-message';
import { evaluateInboundAutoResponseDecision } from '../inbound/autoresponse-decision';
import { runAutoresponsePipeline } from '../inbound/run-autoresponse';
import { processInboundGmailMessage } from './process-inbound-message';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectOne = vi.mocked(selectOne);
const mockedUpdateMany = vi.mocked(updateMany);
const mockedUpsertOne = vi.mocked(upsertOne);
const mockedResolveInboundJourney = vi.mocked(resolveInboundJourney);
const mockedNormalizeGmailMessage = vi.mocked(normalizeGmailMessage);
const mockedIsInternalSender = vi.mocked(isInternalSender);
const mockedClassifyInboundMessage = vi.mocked(classifyInboundMessage);
const mockedEvaluateInboundAutoResponseDecision = vi.mocked(evaluateInboundAutoResponseDecision);
const mockedRunAutoresponsePipeline = vi.mocked(runAutoresponsePipeline);

function sampleNormalizedInbound() {
	return {
		provider_message_id: 'msg_123',
		provider_thread_id: 'thread_456',
		from_email: 'jane@example.com',
		from_name: 'Jane',
		to_email: 'speaker+cmp12_cp3@christophholz.com',
		to_recipients: ['speaker+cmp12_cp3@christophholz.com'],
		subject: 'Speaking inquiry',
		body_text: 'Can Christoph speak at our conference?',
		body_html: '<p>Can Christoph speak at our conference?</p>',
		received_at: '2026-04-16T10:00:00.000Z',
		sent_at: null,
		raw_metadata: { gmail: { id: 'msg_123' } },
		contact_email: 'jane@example.com',
		direction: 'inbound' as const
	};
}

describe('processInboundGmailMessage', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectOne.mockReset();
		mockedUpdateMany.mockReset();
		mockedUpsertOne.mockReset();
		mockedResolveInboundJourney.mockReset();
		mockedNormalizeGmailMessage.mockReset();
		mockedIsInternalSender.mockReset();
		mockedClassifyInboundMessage.mockReset();
		mockedEvaluateInboundAutoResponseDecision.mockReset();
		mockedRunAutoresponsePipeline.mockReset();
		mockedRunAutoresponsePipeline.mockResolvedValue({
			status: 'skipped_not_eligible',
			lead_journey_id: 'journey_1',
			inbound_lead_message_id: 'lead_message_1',
			outbound_lead_message_id: null,
			booking_link_id: null,
			provider_message_id: null,
			provider_thread_id: null,
			skipped_reason: 'not_eligible',
			generation_status: null,
			send_status: null
		});
	});

	it('returns invalid_message when normalization fails', async () => {
		mockedNormalizeGmailMessage.mockReturnValue(null);

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('invalid_message');
		expect(mockedSelectOne).not.toHaveBeenCalled();
	});

	it('returns not_inbound for outbound messages', async () => {
		mockedNormalizeGmailMessage.mockReturnValue({
			...sampleNormalizedInbound(),
			direction: 'outbound'
		});

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('not_inbound');
		expect(mockedSelectOne).not.toHaveBeenCalled();
	});

	it('returns duplicate_ignored when provider_message_id already exists', async () => {
		mockedNormalizeGmailMessage.mockReturnValue(sampleNormalizedInbound());
		mockedSelectOne.mockResolvedValue({
			id: 'lead_message_1',
			lead_journey_id: 'journey_1',
			provider_message_id: 'msg_123',
			provider_thread_id: 'thread_456'
		});

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('duplicate_ignored');
		expect(result.matched_by).toBe('duplicate');
		expect(mockedResolveInboundJourney).not.toHaveBeenCalled();
	});

	it('returns invalid_sender_email when sender is missing', async () => {
		mockedNormalizeGmailMessage.mockReturnValue({
			...sampleNormalizedInbound(),
			from_email: ''
		});
		mockedSelectOne.mockResolvedValue(null);

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('invalid_sender_email');
		expect(mockedResolveInboundJourney).not.toHaveBeenCalled();
	});

	it('returns duplicate_ignored when upsert loses race', async () => {
		mockedNormalizeGmailMessage.mockReturnValue(sampleNormalizedInbound());
		mockedSelectOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 'lead_message_winner',
			lead_journey_id: 'journey_1',
			provider_message_id: 'msg_123',
			provider_thread_id: 'thread_456'
		});
		mockedResolveInboundJourney.mockResolvedValue({
			lead_journey_id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 3,
			attribution_status: 'parsed',
			created_new_journey: false,
			matched_by: 'thread'
		});
		mockedUpsertOne.mockResolvedValue(null);

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('duplicate_ignored');
		expect(result.lead_message_id).toBe('lead_message_winner');
	});

	it('processes inbound message and logs classification + decision events', async () => {
		mockedNormalizeGmailMessage.mockReturnValue(sampleNormalizedInbound());
		mockedSelectOne.mockResolvedValue(null);
		mockedResolveInboundJourney.mockResolvedValue({
			lead_journey_id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 3,
			attribution_status: 'parsed',
			created_new_journey: false,
			matched_by: 'thread'
		});
		mockedUpsertOne.mockResolvedValue({ id: 'lead_message_1' });
		mockedIsInternalSender.mockReturnValue(false);
		mockedClassifyInboundMessage.mockReturnValue({
			classification: 'speaking_inquiry',
			classification_confidence: 0.9,
			reason: 'strong_positive_signals'
		});
		mockedEvaluateInboundAutoResponseDecision.mockResolvedValue({
			classification: 'speaking_inquiry',
			classification_confidence: 0.9,
			auto_response_decision: 'eligible_for_autoresponse',
			eligible_for_autoresponse: true,
			skipped_reason: null,
			lead_journey_id: 'journey_1',
			lead_message_id: 'lead_message_1'
		});

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('processed');
		expect(result.eligible_for_autoresponse).toBe(true);
		expect(mockedRunAutoresponsePipeline).toHaveBeenCalledTimes(1);
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
		expect(mockedInsertOne).toHaveBeenCalledTimes(4);

		const eventTypes = mockedInsertOne.mock.calls.map(
			(call) => (call[2] as { event_type?: string }).event_type
		);
		expect(eventTypes).toContain('message_received');
		expect(eventTypes).toContain('message_classified');
		expect(eventTypes).toContain('lead_qualified');
		expect(eventTypes).toContain('autoresponse_eligible');
	});

	it('skips classifier for internal sender and logs only decision + receipt events', async () => {
		mockedNormalizeGmailMessage.mockReturnValue(sampleNormalizedInbound());
		mockedSelectOne.mockResolvedValue(null);
		mockedResolveInboundJourney.mockResolvedValue({
			lead_journey_id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 3,
			attribution_status: 'parsed',
			created_new_journey: false,
			matched_by: 'thread'
		});
		mockedUpsertOne.mockResolvedValue({ id: 'lead_message_1' });
		mockedIsInternalSender.mockReturnValue(true);
		mockedEvaluateInboundAutoResponseDecision.mockResolvedValue({
			classification: null,
			classification_confidence: null,
			auto_response_decision: 'do_not_autorespond_internal_sender',
			eligible_for_autoresponse: false,
			skipped_reason: 'internal_sender',
			lead_journey_id: 'journey_1',
			lead_message_id: 'lead_message_1'
		});

		const result = await processInboundGmailMessage(makeTestEnv(), {
			gmailUser: 'speaker@christophholz.com',
			gmailMessage: { id: 'msg_1', threadId: 'thread_1' }
		} as never);

		expect(result.status).toBe('processed');
		expect(result.auto_response_decision).toBe('do_not_autorespond_internal_sender');
		expect(mockedClassifyInboundMessage).not.toHaveBeenCalled();
		expect(mockedRunAutoresponsePipeline).toHaveBeenCalledTimes(1);

		const eventTypes = mockedInsertOne.mock.calls.map(
			(call) => (call[2] as { event_type?: string }).event_type
		);
		expect(eventTypes).toContain('message_received');
		expect(eventTypes).toContain('autoresponse_skipped_internal_sender');
		expect(eventTypes).not.toContain('message_classified');
	});
});
