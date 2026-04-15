import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerEnv } from '../env';

vi.mock('./openrouter-client', () => ({
	callOpenRouterChat: vi.fn()
}));

import { callOpenRouterChat } from './openrouter-client';
import { generateWoodyReply } from './generate-reply';

const mockedCallOpenRouterChat = vi.mocked(callOpenRouterChat);

function makeEnv(overrides?: Partial<WorkerEnv>): WorkerEnv {
	return {
		SUPABASE_URL: 'http://localhost:54321',
		SUPABASE_SERVICE_ROLE_KEY: 'test',
		BOOKING_TOKEN_SECRET: 'test',
		INTERNAL_API_TOKEN: 'test',
		OPENROUTER_API_KEY: 'test-key',
		WOODY_OPENROUTER_MODEL: 'openai/gpt-4.1-mini',
		...overrides
	};
}

function validModelContent(): string {
	return JSON.stringify({
		subject: 'Thanks for reaching out',
		body_html:
			'<p>Hello</p><ul><li>Event Topic: Product Launch</li><li>Talking Length: 45 minutes</li><li>Location: Berlin</li><li>Date/Time: To Determine</li><li>Event Name: Innovation Summit</li><li>Audience: Founders</li><li>Agent: To Determine</li><li>Client: To Determine</li></ul><p>Please book here: https://book.domain.com/example</p>',
		body_text:
			'Hello\nEvent Topic: Product Launch\nTalking Length: 45 minutes\nLocation: Berlin\nDate/Time: To Determine\nEvent Name: Innovation Summit\nAudience: Founders\nAgent: To Determine\nClient: To Determine\nPlease book here: https://book.domain.com/example',
		extracted_fields: {
			event_topic: 'Product Launch',
			talking_length: '45 minutes',
			location: 'Berlin',
			date_time: '',
			event_name: 'Innovation Summit',
			audience: 'Founders',
			agent: '',
			client: ''
		}
	});
}

describe('generate woody reply', () => {
	beforeEach(() => {
		mockedCallOpenRouterChat.mockReset();
	});

	it('returns structured success output when model response is valid', async () => {
		mockedCallOpenRouterChat.mockResolvedValue({
			content: validModelContent(),
			model: 'openai/gpt-4.1-mini',
			usage: { total_tokens: 500 },
			raw_response: { id: 'resp_1' }
		});

		const result = await generateWoodyReply(makeEnv(), {
			sender_name: 'Jane',
			sender_email: 'jane@example.com',
			inbound_subject: 'Speaking inquiry',
			inbound_body: 'Can Christoph speak at our event?',
			response_language: 'English',
			booking_link: 'https://book.domain.com/example',
			response_type: 'initial_speaking_inquiry_ack',
			campaign_id: 1,
			campaign_page_id: 2,
			lead_journey_id: null
		});

		expect(result.generation_status).toBe('success');
		expect(result.provider).toBe('openrouter');
		expect(result.extracted_fields.date_time).toBe('To Determine');
		expect(result.extracted_fields.agent).toBe('To Determine');
	});

	it('falls back unsupported language to english explicitly', async () => {
		mockedCallOpenRouterChat.mockResolvedValue({
			content: validModelContent(),
			model: 'openai/gpt-4.1-mini',
			usage: null,
			raw_response: { id: 'resp_2' }
		});

		const env = makeEnv({ WOODY_SUPPORTED_LANGUAGES: 'english,en,german,de' });
		const result = await generateWoodyReply(env, {
			sender_name: null,
			sender_email: 'jane@example.com',
			inbound_subject: 'Hola',
			inbound_body: 'Necesitamos un ponente',
			response_language: 'Spanish',
			booking_link: 'https://book.domain.com/example',
			response_type: 'initial_speaking_inquiry_ack',
			campaign_id: null,
			campaign_page_id: null,
			lead_journey_id: null
		});

		expect(mockedCallOpenRouterChat).toHaveBeenCalledTimes(1);
		const callArgs = mockedCallOpenRouterChat.mock.calls[0]?.[1];
		expect(callArgs?.user_prompt).toContain('"response_language": "English"');
		expect(result.generation_status).toBe('success');
		expect(result.raw_response).toMatchObject({
			requested_language: 'Spanish',
			resolved_language: 'English',
			fallback_applied: true
		});
	});

	it('returns controlled error output for malformed model json', async () => {
		mockedCallOpenRouterChat.mockResolvedValue({
			content: '{"subject": "broken"',
			model: 'openai/gpt-4.1-mini',
			usage: null,
			raw_response: { id: 'resp_3' }
		});

		const result = await generateWoodyReply(makeEnv(), {
			sender_name: null,
			sender_email: 'jane@example.com',
			inbound_subject: 'Inquiry',
			inbound_body: 'Please share details',
			response_language: 'English',
			booking_link: 'https://book.domain.com/example',
			response_type: 'initial_speaking_inquiry_ack',
			campaign_id: null,
			campaign_page_id: null,
			lead_journey_id: null
		});

		expect(result.generation_status).toBe('error');
		expect(result.subject).toBe('');
		expect(result.extracted_fields.event_topic).toBe('To Determine');
	});

	it('returns controlled error when html summary list labels are missing', async () => {
		mockedCallOpenRouterChat.mockResolvedValue({
			content: JSON.stringify({
				subject: 'Hello',
				body_html: '<p>No summary list</p><ul><li>Only one item</li></ul>',
				body_text: 'Hello',
				extracted_fields: {
					event_topic: 'To Determine',
					talking_length: 'To Determine',
					location: 'To Determine',
					date_time: 'To Determine',
					event_name: 'To Determine',
					audience: 'To Determine',
					agent: 'To Determine',
					client: 'To Determine'
				}
			}),
			model: 'openai/gpt-4.1-mini',
			usage: null,
			raw_response: { id: 'resp_4' }
		});

		const result = await generateWoodyReply(makeEnv(), {
			sender_name: null,
			sender_email: 'jane@example.com',
			inbound_subject: 'Inquiry',
			inbound_body: 'Please share details',
			response_language: 'English',
			booking_link: 'https://book.domain.com/example',
			response_type: 'initial_speaking_inquiry_ack',
			campaign_id: null,
			campaign_page_id: null,
			lead_journey_id: null
		});

		expect(result.generation_status).toBe('error');
	});
});
