import type { AttributionStatus } from '../../../../shared/event-types';
import { insertOne, selectOne, upsertOne } from '../db';
import type { WorkerEnv } from '../env';
import { resolveInboundJourney } from '../journeys/resolve-inbound-journey';
import { normalizeGmailMessage } from './messages';
import type { GmailMessage } from './client';

type ExistingLeadMessageRow = {
	id: string;
	lead_journey_id: string;
	provider_message_id: string;
	provider_thread_id: string;
};

type MatchedBy = 'duplicate' | 'thread' | 'plus_address_email_campaign' | 'new_journey';

export type InboundProcessingStatus =
	| 'processed'
	| 'duplicate_ignored'
	| 'invalid_sender_email'
	| 'not_inbound'
	| 'invalid_message';

export type InboundMessageProcessingResult = {
	status: InboundProcessingStatus;
	lead_journey_id: string | null;
	provider_message_id: string;
	provider_thread_id: string;
	attribution_status: AttributionStatus | null;
	campaign_id: number | null;
	campaign_page_id: number | null;
	created_new_journey: boolean;
	matched_by: MatchedBy | null;
};

async function findMessageByProviderId(
	env: WorkerEnv,
	providerMessageId: string
): Promise<ExistingLeadMessageRow | null> {
	const query = new URLSearchParams({
		select: 'id,lead_journey_id,provider_message_id,provider_thread_id',
		provider_message_id: `eq.${providerMessageId}`,
		limit: '1'
	});

	return selectOne<ExistingLeadMessageRow>(env, 'lead_messages', query);
}

export async function processInboundGmailMessage(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		gmailMessage: GmailMessage;
	}
): Promise<InboundMessageProcessingResult> {
	const normalized = normalizeGmailMessage(params.gmailMessage, params.gmailUser);
	if (!normalized) {
		return {
			status: 'invalid_message',
			lead_journey_id: null,
			provider_message_id: params.gmailMessage.id,
			provider_thread_id: params.gmailMessage.threadId,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null
		};
	}

	if (normalized.direction !== 'inbound') {
		return {
			status: 'not_inbound',
			lead_journey_id: null,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null
		};
	}

	const existing = await findMessageByProviderId(env, normalized.provider_message_id);
	if (existing) {
		return {
			status: 'duplicate_ignored',
			lead_journey_id: existing.lead_journey_id,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: 'duplicate'
		};
	}

	if (!normalized.from_email) {
		return {
			status: 'invalid_sender_email',
			lead_journey_id: null,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null
		};
	}

	const journeyResolution = await resolveInboundJourney(env, {
		providerThreadId: normalized.provider_thread_id,
		normalizedSenderEmail: normalized.from_email,
		senderDisplayName: normalized.from_name,
		toRecipients: normalized.to_recipients
	});

	const persistedMessage = await upsertOne<{ id: string }>(
		env,
		'lead_messages',
		{
			lead_journey_id: journeyResolution.lead_journey_id,
			direction: 'inbound',
			provider: 'gmail',
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			from_email: normalized.from_email,
			to_email: normalized.to_email,
			subject: normalized.subject,
			body_text: normalized.body_text,
			body_html: normalized.body_html,
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			auto_response_sent_at: null,
			received_at: normalized.received_at ?? new Date().toISOString(),
			sent_at: null,
			raw_metadata: {
				...normalized.raw_metadata,
				inbound_processing: {
					matched_by: journeyResolution.matched_by,
					attribution_status: journeyResolution.attribution_status,
					campaign_id: journeyResolution.campaign_id,
					campaign_page_id: journeyResolution.campaign_page_id,
					created_new_journey: journeyResolution.created_new_journey
				}
			},
			updated_at: new Date().toISOString()
		},
		{
			onConflict: 'provider_message_id',
			ignoreDuplicates: true
		}
	);

	if (!persistedMessage) {
		const winner = await findMessageByProviderId(env, normalized.provider_message_id);
		return {
			status: 'duplicate_ignored',
			lead_journey_id: winner?.lead_journey_id ?? journeyResolution.lead_journey_id,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: journeyResolution.attribution_status,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			created_new_journey: false,
			matched_by: 'duplicate'
		};
	}

	await insertOne(env, 'lead_events', {
		lead_journey_id: journeyResolution.lead_journey_id,
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id,
		event_type: 'email_received',
		event_source: 'worker.gmail_sync',
		event_payload: {
			provider: 'gmail',
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: journeyResolution.attribution_status,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			matched_by: journeyResolution.matched_by
		}
	});

	return {
		status: 'processed',
		lead_journey_id: journeyResolution.lead_journey_id,
		provider_message_id: normalized.provider_message_id,
		provider_thread_id: normalized.provider_thread_id,
		attribution_status: journeyResolution.attribution_status,
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id,
		created_new_journey: journeyResolution.created_new_journey,
		matched_by: journeyResolution.matched_by
	};
}
