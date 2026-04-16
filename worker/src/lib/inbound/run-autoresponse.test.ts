import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
	insertOne: vi.fn(),
	selectOne: vi.fn(),
	updateMany: vi.fn()
}));

vi.mock('../booking/create-booking-link', () => ({
	createBookingLinkForJourney: vi.fn()
}));

vi.mock('../woody/invoke', () => ({
	invokeWoodyAcknowledgement: vi.fn()
}));

vi.mock('../gmail/send', () => ({
	sendOutboundEmail: vi.fn()
}));

import { insertOne, selectOne, updateMany } from '../db';
import { createBookingLinkForJourney } from '../booking/create-booking-link';
import { invokeWoodyAcknowledgement } from '../woody/invoke';
import { sendOutboundEmail } from '../gmail/send';
import { runAutoresponsePipeline } from './run-autoresponse';
import { makeTestEnv } from '../../test/helpers';

const mockedInsertOne = vi.mocked(insertOne);
const mockedSelectOne = vi.mocked(selectOne);
const mockedUpdateMany = vi.mocked(updateMany);
const mockedCreateBookingLinkForJourney = vi.mocked(createBookingLinkForJourney);
const mockedInvokeWoodyAcknowledgement = vi.mocked(invokeWoodyAcknowledgement);
const mockedSendOutboundEmail = vi.mocked(sendOutboundEmail);

function baseInput() {
	return {
		lead_journey_id: 'journey_1',
		inbound_lead_message_id: 'inbound_msg_1',
		inbound_provider_message_id: 'provider_in_1',
		inbound_provider_thread_id: 'thread_1',
		sender_name: 'Jane',
		sender_email: 'jane@example.com',
		inbound_subject: 'Speaking inquiry',
		inbound_body: 'Can Christoph speak at our conference?',
		raw_metadata: {
			gmail: {
				headers: [
					{ name: 'Message-Id', value: '<m1@id>' },
					{ name: 'References', value: '<r1@id> <r2@id>' }
				]
			}
		},
		response_language: 'English',
		decision: {
			eligible_for_autoresponse: true,
			auto_response_decision: 'eligible_for_autoresponse',
			skipped_reason: null
		},
		campaign_id: 12,
		campaign_page_id: 3
	} as const;
}

describe('runAutoresponsePipeline', () => {
	beforeEach(() => {
		mockedInsertOne.mockReset();
		mockedSelectOne.mockReset();
		mockedUpdateMany.mockReset();
		mockedCreateBookingLinkForJourney.mockReset();
		mockedInvokeWoodyAcknowledgement.mockReset();
		mockedSendOutboundEmail.mockReset();
	});

	it('skips ineligible message without generation/sending', async () => {
		const result = await runAutoresponsePipeline(makeTestEnv(), {
			...baseInput(),
			decision: {
				eligible_for_autoresponse: false,
				auto_response_decision: 'do_not_autorespond_not_inquiry',
				skipped_reason: 'not_speaking_inquiry'
			}
		});

		expect(result.status).toBe('skipped_not_eligible');
		expect(mockedCreateBookingLinkForJourney).not.toHaveBeenCalled();
		expect(mockedInvokeWoodyAcknowledgement).not.toHaveBeenCalled();
		expect(mockedSendOutboundEmail).not.toHaveBeenCalled();
	});

	it('skips already responded journey without generation/sending', async () => {
		mockedSelectOne.mockResolvedValueOnce({
			id: 'journey_1',
			campaign_id: 12,
			campaign_page_id: 3,
			auto_response_sent_at: '2026-01-01T00:00:00.000Z',
			auto_response_message_id: 'outbound_1'
		});

		const result = await runAutoresponsePipeline(makeTestEnv(), baseInput());

		expect(result.status).toBe('already_responded');
		expect(mockedCreateBookingLinkForJourney).not.toHaveBeenCalled();
	});

	it('returns booking_link_failed and does not mark journey responded', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey_1',
				campaign_id: 12,
				campaign_page_id: 3,
				auto_response_sent_at: null,
				auto_response_message_id: null
			})
			.mockResolvedValueOnce(null);
		mockedCreateBookingLinkForJourney.mockRejectedValue(new Error('booking fail'));

		const result = await runAutoresponsePipeline(makeTestEnv(), baseInput());

		expect(result.status).toBe('booking_link_failed');
		expect(mockedInvokeWoodyAcknowledgement).not.toHaveBeenCalled();
		expect(mockedSendOutboundEmail).not.toHaveBeenCalled();
		expect(mockedUpdateMany).not.toHaveBeenCalled();
	});

	it('returns generation_failed and does not send or update journey', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey_1',
				campaign_id: 12,
				campaign_page_id: 3,
				auto_response_sent_at: null,
				auto_response_message_id: null
			})
			.mockResolvedValueOnce(null);
		mockedCreateBookingLinkForJourney.mockResolvedValue({
			booking_link_id: 'booking_1',
			url: 'https://book.domain.com/?token=t1',
			token: 't1',
			expires_at: '2026-05-01T00:00:00.000Z',
			campaign_id: 12
		});
		mockedInvokeWoodyAcknowledgement.mockResolvedValue({
			subject: '',
			body_html: '',
			body_text: '',
			extracted_fields: {
				event_topic: 'To Determine',
				talking_length: 'To Determine',
				location: 'To Determine',
				date_time: 'To Determine',
				event_name: 'To Determine',
				audience: 'To Determine',
				agent: 'To Determine',
				client: 'To Determine'
			},
			model: 'openai/gpt-4.1-mini',
			provider: 'openrouter',
			prompt_version: 'woody_v1',
			generation_status: 'error',
			raw_usage: null,
			raw_response: { error: 'bad output' }
		});

		const result = await runAutoresponsePipeline(makeTestEnv(), baseInput());

		expect(result.status).toBe('generation_failed');
		expect(mockedSendOutboundEmail).not.toHaveBeenCalled();
		expect(mockedUpdateMany).not.toHaveBeenCalled();
	});

	it('returns send_failed when gmail send fails and does not update journey responded state', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey_1',
				campaign_id: 12,
				campaign_page_id: 3,
				auto_response_sent_at: null,
				auto_response_message_id: null
			})
			.mockResolvedValueOnce(null);
		mockedCreateBookingLinkForJourney.mockResolvedValue({
			booking_link_id: 'booking_1',
			url: 'https://book.domain.com/?token=t1',
			token: 't1',
			expires_at: '2026-05-01T00:00:00.000Z',
			campaign_id: 12
		});
		mockedInvokeWoodyAcknowledgement.mockResolvedValue({
			subject: 'Subject',
			body_html:
				'<p>Body</p><ul><li>Event Topic: To Determine</li><li>Talking Length: To Determine</li><li>Location: To Determine</li><li>Date/Time: To Determine</li><li>Event Name: To Determine</li><li>Audience: To Determine</li><li>Agent: To Determine</li><li>Client: To Determine</li></ul>',
			body_text: 'Body',
			extracted_fields: {
				event_topic: 'To Determine',
				talking_length: 'To Determine',
				location: 'To Determine',
				date_time: 'To Determine',
				event_name: 'To Determine',
				audience: 'To Determine',
				agent: 'To Determine',
				client: 'To Determine'
			},
			model: 'openai/gpt-4.1-mini',
			provider: 'openrouter',
			prompt_version: 'woody_v1',
			generation_status: 'success',
			raw_usage: null,
			raw_response: null
		});
		mockedSendOutboundEmail.mockRejectedValue(new Error('send fail'));

		const result = await runAutoresponsePipeline(
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' }),
			baseInput()
		);

		expect(result.status).toBe('send_failed');
		expect(mockedUpdateMany).not.toHaveBeenCalled();
	});

	it('runs full success pipeline and updates journey responded state', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey_1',
				campaign_id: 12,
				campaign_page_id: 3,
				auto_response_sent_at: null,
				auto_response_message_id: null
			})
			.mockResolvedValueOnce(null);
		mockedCreateBookingLinkForJourney.mockResolvedValue({
			booking_link_id: 'booking_1',
			url: 'https://book.domain.com/?token=t1',
			token: 't1',
			expires_at: '2026-05-01T00:00:00.000Z',
			campaign_id: 12
		});
		mockedInvokeWoodyAcknowledgement.mockResolvedValue({
			subject: 'Subject',
			body_html:
				'<p>Body</p><ul><li>Event Topic: To Determine</li><li>Talking Length: To Determine</li><li>Location: To Determine</li><li>Date/Time: To Determine</li><li>Event Name: To Determine</li><li>Audience: To Determine</li><li>Agent: To Determine</li><li>Client: To Determine</li></ul>',
			body_text: 'Body',
			extracted_fields: {
				event_topic: 'To Determine',
				talking_length: 'To Determine',
				location: 'To Determine',
				date_time: 'To Determine',
				event_name: 'To Determine',
				audience: 'To Determine',
				agent: 'To Determine',
				client: 'To Determine'
			},
			model: 'openai/gpt-4.1-mini',
			provider: 'openrouter',
			prompt_version: 'woody_v1',
			generation_status: 'success',
			raw_usage: null,
			raw_response: null
		});
		mockedSendOutboundEmail.mockResolvedValue({
			lead_message_id: 'outbound_1',
			provider_message_id: 'provider_out_1',
			provider_thread_id: 'thread_1'
		});

		const result = await runAutoresponsePipeline(
			makeTestEnv({ GOOGLE_IMPERSONATED_USER: 'speaker@christophholz.com' }),
			baseInput()
		);

		expect(result.status).toBe('sent_successfully');
		expect(result.outbound_lead_message_id).toBe('outbound_1');
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
		expect(mockedSendOutboundEmail).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({
				threadId: 'thread_1',
				inReplyTo: '<m1@id>',
				references: ['<r1@id>', '<r2@id>']
			})
		);
	});

	it('returns already_responded when outbound autoresponse exists from prior partial failure', async () => {
		mockedSelectOne
			.mockResolvedValueOnce({
				id: 'journey_1',
				campaign_id: 12,
				campaign_page_id: 3,
				auto_response_sent_at: null,
				auto_response_message_id: null
			})
			.mockResolvedValueOnce({
				id: 'outbound_1',
				provider_message_id: 'provider_out_1',
				provider_thread_id: 'thread_1',
				sent_at: '2026-04-15T10:00:00.000Z'
			});

		const result = await runAutoresponsePipeline(makeTestEnv(), baseInput());

		expect(result.status).toBe('already_responded');
		expect(result.outbound_lead_message_id).toBe('outbound_1');
		expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
		expect(mockedCreateBookingLinkForJourney).not.toHaveBeenCalled();
	});
});
