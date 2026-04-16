import { insertOne, selectOne, updateMany } from '../db';
import { requireEnv, type WorkerEnv } from '../env';
import { sendOutboundEmail } from '../gmail/send';
import { createBookingLinkForJourney } from '../booking/create-booking-link';
import { invokeWoodyAcknowledgement } from '../woody/invoke';

type JourneyStateRow = {
	id: string;
	campaign_id: number | null;
	campaign_page_id: number | null;
	auto_response_sent_at: string | null;
	auto_response_message_id: string | null;
};

type ExistingOutboundAutoresponseRow = {
	id: string;
	provider_message_id: string;
	provider_thread_id: string;
	sent_at: string | null;
};

type InboundHeader = {
	name?: string;
	value?: string;
};

export type RunAutoresponseStatus =
	| 'sent_successfully'
	| 'already_responded'
	| 'skipped_not_eligible'
	| 'booking_link_failed'
	| 'generation_failed'
	| 'send_failed';

export type RunAutoresponseResult = {
	status: RunAutoresponseStatus;
	lead_journey_id: string;
	inbound_lead_message_id: string;
	outbound_lead_message_id: string | null;
	booking_link_id: string | null;
	provider_message_id: string | null;
	provider_thread_id: string | null;
	skipped_reason: string | null;
	generation_status: 'success' | 'error' | null;
	send_status: 'sent' | 'failed' | null;
};

type RunAutoresponseInput = {
	lead_journey_id: string;
	inbound_lead_message_id: string;
	inbound_provider_message_id: string;
	inbound_provider_thread_id: string;
	sender_name: string | null;
	sender_email: string;
	inbound_subject: string;
	inbound_body: string;
	raw_metadata: Record<string, unknown>;
	response_language?: string | null;
	decision: {
		eligible_for_autoresponse: boolean;
		auto_response_decision: string;
		skipped_reason: string | null;
	};
	campaign_id: number | null;
	campaign_page_id: number | null;
};

function getHeaderValue(headers: InboundHeader[], name: string): string | null {
	const header = headers.find((item) => item.name?.toLowerCase() === name.toLowerCase());
	const value = header?.value?.trim();
	return value && value.length > 0 ? value : null;
}

function parseHeaderTokens(value: string | null): string[] {
	if (!value) {
		return [];
	}
	return value
		.split(/[\s,]+/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function getInboundHeaders(rawMetadata: Record<string, unknown>): InboundHeader[] {
	const gmailValue = rawMetadata.gmail;
	if (!gmailValue || typeof gmailValue !== 'object') {
		return [];
	}

	const headers = (gmailValue as { headers?: unknown }).headers;
	if (!Array.isArray(headers)) {
		return [];
	}

	return headers.filter(
		(value): value is InboundHeader => typeof value === 'object' && value !== null
	);
}

async function loadJourneyState(
	env: WorkerEnv,
	leadJourneyId: string
): Promise<JourneyStateRow | null> {
	const query = new URLSearchParams({
		select: 'id,campaign_id,campaign_page_id,auto_response_sent_at,auto_response_message_id',
		id: `eq.${leadJourneyId}`,
		limit: '1'
	});
	return selectOne<JourneyStateRow>(env, 'lead_journeys', query);
}

async function loadExistingOutboundAutoresponse(
	env: WorkerEnv,
	leadJourneyId: string
): Promise<ExistingOutboundAutoresponseRow | null> {
	const query = new URLSearchParams({
		select: 'id,provider_message_id,provider_thread_id,sent_at',
		lead_journey_id: `eq.${leadJourneyId}`,
		direction: 'eq.outbound',
		auto_response_decision: 'eq.autoresponse_sent',
		order: 'sent_at.desc',
		limit: '1'
	});
	return selectOne<ExistingOutboundAutoresponseRow>(env, 'lead_messages', query);
}

async function updateJourneyAsResponded(
	env: WorkerEnv,
	params: {
		lead_journey_id: string;
		outbound_lead_message_id: string | null;
		timestamp: string;
	}
): Promise<void> {
	const query = new URLSearchParams({
		select: 'id',
		id: `eq.${params.lead_journey_id}`,
		limit: '1'
	});

	await updateMany(env, 'lead_journeys', query, {
		auto_response_sent_at: params.timestamp,
		auto_response_message_id: params.outbound_lead_message_id,
		updated_at: params.timestamp
	});
}

export async function runAutoresponsePipeline(
	env: WorkerEnv,
	input: RunAutoresponseInput
): Promise<RunAutoresponseResult> {
	if (!input.decision.eligible_for_autoresponse) {
		return {
			status: 'skipped_not_eligible',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: null,
			booking_link_id: null,
			provider_message_id: null,
			provider_thread_id: null,
			skipped_reason: input.decision.skipped_reason ?? input.decision.auto_response_decision,
			generation_status: null,
			send_status: null
		};
	}

	const journeyState = await loadJourneyState(env, input.lead_journey_id);
	if (!journeyState) {
		throw new Error(`Lead journey not found: ${input.lead_journey_id}`);
	}

	if (journeyState.auto_response_sent_at || journeyState.auto_response_message_id) {
		return {
			status: 'already_responded',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: journeyState.auto_response_message_id,
			booking_link_id: null,
			provider_message_id: null,
			provider_thread_id: input.inbound_provider_thread_id,
			skipped_reason: 'already_responded',
			generation_status: null,
			send_status: null
		};
	}

	const existingOutbound = await loadExistingOutboundAutoresponse(env, input.lead_journey_id);
	if (existingOutbound) {
		const sentAt = existingOutbound.sent_at ?? new Date().toISOString();
		await updateJourneyAsResponded(env, {
			lead_journey_id: input.lead_journey_id,
			outbound_lead_message_id: existingOutbound.id,
			timestamp: sentAt
		});

		return {
			status: 'already_responded',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: existingOutbound.id,
			booking_link_id: null,
			provider_message_id: existingOutbound.provider_message_id,
			provider_thread_id: existingOutbound.provider_thread_id,
			skipped_reason: 'already_responded',
			generation_status: null,
			send_status: null
		};
	}

	let bookingLink: {
		booking_link_id: string;
		url: string;
		campaign_id: number;
	} | null = null;

	try {
		bookingLink = await createBookingLinkForJourney(env, {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			event_source: 'worker.autoresponse'
		});
	} catch (error) {
		await insertOne(env, 'lead_events', {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			campaign_page_id: input.campaign_page_id,
			event_type: 'autoresponse_send_failed',
			event_source: 'worker.autoresponse',
			event_payload: {
				stage: 'booking_link_generation',
				inbound_lead_message_id: input.inbound_lead_message_id,
				provider_message_id: input.inbound_provider_message_id,
				provider_thread_id: input.inbound_provider_thread_id,
				error: error instanceof Error ? error.message : 'unknown'
			}
		});

		return {
			status: 'booking_link_failed',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: null,
			booking_link_id: null,
			provider_message_id: null,
			provider_thread_id: input.inbound_provider_thread_id,
			skipped_reason: 'booking_link_failed',
			generation_status: null,
			send_status: null
		};
	}

	const woodyResult = await invokeWoodyAcknowledgement(env, {
		sender_name: input.sender_name,
		sender_email: input.sender_email,
		inbound_subject: input.inbound_subject,
		inbound_body: input.inbound_body,
		response_language: input.response_language ?? 'English',
		booking_link: bookingLink.url,
		response_type: 'initial_speaking_inquiry_ack',
		campaign_id: input.campaign_id,
		campaign_page_id: input.campaign_page_id,
		lead_journey_id: input.lead_journey_id
	});

	if (woodyResult.generation_status !== 'success') {
		await insertOne(env, 'lead_events', {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			campaign_page_id: input.campaign_page_id,
			event_type: 'woody_reply_generation_failed',
			event_source: 'worker.autoresponse',
			event_payload: {
				inbound_lead_message_id: input.inbound_lead_message_id,
				provider_message_id: input.inbound_provider_message_id,
				provider_thread_id: input.inbound_provider_thread_id,
				booking_link_id: bookingLink.booking_link_id,
				raw_response: woodyResult.raw_response
			}
		});

		return {
			status: 'generation_failed',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: null,
			booking_link_id: bookingLink.booking_link_id,
			provider_message_id: null,
			provider_thread_id: input.inbound_provider_thread_id,
			skipped_reason: 'generation_failed',
			generation_status: 'error',
			send_status: null
		};
	}

	await insertOne(env, 'lead_events', {
		lead_journey_id: input.lead_journey_id,
		campaign_id: input.campaign_id,
		campaign_page_id: input.campaign_page_id,
		event_type: 'woody_reply_generated',
		event_source: 'worker.autoresponse',
		event_payload: {
			inbound_lead_message_id: input.inbound_lead_message_id,
			provider_message_id: input.inbound_provider_message_id,
			provider_thread_id: input.inbound_provider_thread_id,
			booking_link_id: bookingLink.booking_link_id,
			model: woodyResult.model,
			prompt_version: woodyResult.prompt_version
		}
	});

	await insertOne(env, 'lead_events', {
		lead_journey_id: input.lead_journey_id,
		campaign_id: input.campaign_id,
		campaign_page_id: input.campaign_page_id,
		event_type: 'autoresponse_send_attempted',
		event_source: 'worker.autoresponse',
		event_payload: {
			inbound_lead_message_id: input.inbound_lead_message_id,
			provider_message_id: input.inbound_provider_message_id,
			provider_thread_id: input.inbound_provider_thread_id,
			booking_link_id: bookingLink.booking_link_id
		}
	});

	const headers = getInboundHeaders(input.raw_metadata);
	const inReplyTo = getHeaderValue(headers, 'Message-Id');
	const references = parseHeaderTokens(getHeaderValue(headers, 'References'));

	try {
		const sendResult = await sendOutboundEmail(env, {
			leadJourneyId: input.lead_journey_id,
			gmailUser: requireEnv(env, 'GOOGLE_IMPERSONATED_USER'),
			to: [input.sender_email],
			subject: woodyResult.subject,
			bodyText: woodyResult.body_text,
			bodyHtml: woodyResult.body_html,
			threadId: input.inbound_provider_thread_id,
			inReplyTo: inReplyTo ?? undefined,
			references: references.length > 0 ? references : undefined,
			autoResponseDecision: 'autoresponse_sent',
			campaignId: input.campaign_id,
			campaignPageId: input.campaign_page_id,
			rawMetadata: {
				autoresponse: {
					inbound_lead_message_id: input.inbound_lead_message_id,
					inbound_provider_message_id: input.inbound_provider_message_id,
					woody_model: woodyResult.model,
					woody_prompt_version: woodyResult.prompt_version,
					booking_link_id: bookingLink.booking_link_id
				}
			}
		});

		const sentAt = new Date().toISOString();
		await updateJourneyAsResponded(env, {
			lead_journey_id: input.lead_journey_id,
			outbound_lead_message_id: sendResult.lead_message_id,
			timestamp: sentAt
		});

		await insertOne(env, 'lead_events', {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			campaign_page_id: input.campaign_page_id,
			event_type: 'autoresponse_sent',
			event_source: 'worker.autoresponse',
			event_payload: {
				inbound_lead_message_id: input.inbound_lead_message_id,
				outbound_lead_message_id: sendResult.lead_message_id,
				provider_message_id: sendResult.provider_message_id,
				provider_thread_id: sendResult.provider_thread_id,
				booking_link_id: bookingLink.booking_link_id
			}
		});

		return {
			status: 'sent_successfully',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: sendResult.lead_message_id,
			booking_link_id: bookingLink.booking_link_id,
			provider_message_id: sendResult.provider_message_id,
			provider_thread_id: sendResult.provider_thread_id,
			skipped_reason: null,
			generation_status: 'success',
			send_status: 'sent'
		};
	} catch (error) {
		await insertOne(env, 'lead_events', {
			lead_journey_id: input.lead_journey_id,
			campaign_id: input.campaign_id,
			campaign_page_id: input.campaign_page_id,
			event_type: 'autoresponse_send_failed',
			event_source: 'worker.autoresponse',
			event_payload: {
				stage: 'gmail_send',
				inbound_lead_message_id: input.inbound_lead_message_id,
				provider_message_id: input.inbound_provider_message_id,
				provider_thread_id: input.inbound_provider_thread_id,
				booking_link_id: bookingLink.booking_link_id,
				error: error instanceof Error ? error.message : 'unknown'
			}
		});

		return {
			status: 'send_failed',
			lead_journey_id: input.lead_journey_id,
			inbound_lead_message_id: input.inbound_lead_message_id,
			outbound_lead_message_id: null,
			booking_link_id: bookingLink.booking_link_id,
			provider_message_id: null,
			provider_thread_id: input.inbound_provider_thread_id,
			skipped_reason: 'send_failed',
			generation_status: 'success',
			send_status: 'failed'
		};
	}
}
