import type { AttributionStatus, LegacyEventType } from '../../../../shared/event-types';
import { insertOne, selectOne, updateMany, upsertOne } from '../db';
import type { WorkerEnv } from '../env';
import { isInternalSender } from '../email/internal-senders';
import { logLeadEvent } from '../analytics/lead-events';
import { evaluateInboundAutoResponseDecision } from '../inbound/autoresponse-decision';
import {
	classifyInboundMessage,
	type InboundClassificationResult
} from '../inbound/classify-message';
import { resolveInboundJourney } from '../journeys/resolve-inbound-journey';
import { runAutoresponsePipeline, type RunAutoresponseStatus } from '../inbound/run-autoresponse';
import type { GmailMessage } from './client';
import { gmailEnsureLabel, gmailModifyMessage } from './client';
import { normalizeGmailMessage } from './messages';

const WOODY_PROCESSED_LABEL_NAME = 'WOODY_PROCESSED';
const WOODY_RESPONDED_LABEL_NAME = 'WOODY_RESPONDED';
const ensuredLabelIdByUserAndName = new Map<string, string>();

type ExistingLeadMessageRow = {
	id: string;
	lead_journey_id: string;
	provider_message_id: string;
	provider_thread_id: string;
};

type CampaignLanguageRow = {
	language: string;
};

type MatchedBy = 'duplicate' | 'thread' | 'plus_address_email_campaign' | 'new_journey';

type AutoResponseDecision =
	| 'eligible_for_autoresponse'
	| 'do_not_autorespond_internal_sender'
	| 'do_not_autorespond_not_inquiry'
	| 'do_not_autorespond_uncertain'
	| 'do_not_autorespond_already_sent';

export type InboundProcessingStatus =
	| 'processed'
	| 'duplicate_ignored'
	| 'invalid_sender_email'
	| 'not_inbound'
	| 'invalid_message';

export type InboundMessageProcessingResult = {
	status: InboundProcessingStatus;
	lead_journey_id: string | null;
	lead_message_id: string | null;
	provider_message_id: string;
	provider_thread_id: string;
	attribution_status: AttributionStatus | null;
	campaign_id: number | null;
	campaign_page_id: number | null;
	created_new_journey: boolean;
	matched_by: MatchedBy | null;
	classification: InboundClassificationResult['classification'] | null;
	classification_confidence: number | null;
	auto_response_decision: AutoResponseDecision | null;
	eligible_for_autoresponse: boolean;
	skipped_reason: string | null;
	autoresponse_status: RunAutoresponseStatus | null;
	autoresponse_outbound_lead_message_id: string | null;
	autoresponse_provider_message_id: string | null;
	autoresponse_provider_thread_id: string | null;
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

async function resolveOrCreateLabelId(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		labelName: string;
	}
): Promise<string> {
	const cacheKey = `${params.gmailUser}:${params.labelName}`;
	const cached = ensuredLabelIdByUserAndName.get(cacheKey);
	if (cached) {
		return cached;
	}

	const label = await gmailEnsureLabel(env, {
		gmailUser: params.gmailUser,
		name: params.labelName
	});

	ensuredLabelIdByUserAndName.set(cacheKey, label.id);
	return label.id;
}

async function applyInboundProcessingLabels(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		providerMessageId: string;
		markResponded: boolean;
	}
): Promise<void> {
	const labelNames = params.markResponded
		? [WOODY_PROCESSED_LABEL_NAME, WOODY_RESPONDED_LABEL_NAME]
		: [WOODY_PROCESSED_LABEL_NAME];

	const addLabelIds: string[] = [];
	for (const labelName of labelNames) {
		const labelId = await resolveOrCreateLabelId(env, {
			gmailUser: params.gmailUser,
			labelName
		});
		addLabelIds.push(labelId);
	}

	await gmailModifyMessage(env, {
		gmailUser: params.gmailUser,
		messageId: params.providerMessageId,
		addLabelIds: [...new Set(addLabelIds)]
	});
}

async function applyInboundProcessingLabelsSafely(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		providerMessageId: string;
		markResponded: boolean;
	}
): Promise<void> {
	try {
		await applyInboundProcessingLabels(env, params);
	} catch (error) {
		console.warn('gmail_inbound_labeling_failed', {
			gmail_user: params.gmailUser,
			provider_message_id: params.providerMessageId,
			mark_responded: params.markResponded,
			error: error instanceof Error ? error.message : 'unknown'
		});
	}
}

function mapDecisionEventType(decision: AutoResponseDecision): LegacyEventType {
	switch (decision) {
		case 'eligible_for_autoresponse':
			return 'autoresponse_eligible';
		case 'do_not_autorespond_internal_sender':
			return 'autoresponse_skipped_internal_sender';
		case 'do_not_autorespond_not_inquiry':
			return 'autoresponse_skipped_not_inquiry';
		case 'do_not_autorespond_uncertain':
			return 'autoresponse_skipped_uncertain';
		case 'do_not_autorespond_already_sent':
			return 'autoresponse_skipped_already_sent';
	}
}

function normalizeLanguageTag(language: string | null | undefined): string | null {
	if (!language) {
		return null;
	}

	const normalized = language.trim().toLowerCase();
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith('de') || normalized === 'german') {
		return 'German';
	}

	if (normalized.startsWith('fr') || normalized === 'french') {
		return 'French';
	}

	if (normalized.startsWith('es') || normalized === 'spanish') {
		return 'Spanish';
	}

	if (normalized.startsWith('en') || normalized === 'english') {
		return 'English';
	}

	return null;
}

async function resolveCampaignLanguage(
	env: WorkerEnv,
	campaignId: number | null
): Promise<string | null> {
	if (campaignId === null) {
		return null;
	}

	const query = new URLSearchParams({
		select: 'language',
		id: `eq.${campaignId}`,
		limit: '1'
	});

	const campaign = await selectOne<CampaignLanguageRow>(env, 'campaigns', query);
	return normalizeLanguageTag(campaign?.language ?? null);
}

function readLanguageHeader(
	rawMetadata: Record<string, unknown>,
	headerName: string
): string | null {
	const gmail = rawMetadata.gmail;
	if (!gmail || typeof gmail !== 'object') {
		return null;
	}

	const headers = (gmail as { headers?: unknown }).headers;
	if (!Array.isArray(headers)) {
		return null;
	}

	for (const entry of headers) {
		if (!entry || typeof entry !== 'object') {
			continue;
		}

		const name = (entry as { name?: unknown }).name;
		const value = (entry as { value?: unknown }).value;
		if (typeof name !== 'string' || typeof value !== 'string') {
			continue;
		}

		if (name.trim().toLowerCase() === headerName.toLowerCase()) {
			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : null;
		}
	}

	return null;
}

function resolveLanguageFromHeaders(rawMetadata: Record<string, unknown>): string | null {
	const contentLanguage = readLanguageHeader(rawMetadata, 'Content-Language');
	const normalizedContentLanguage = normalizeLanguageTag(contentLanguage);
	if (normalizedContentLanguage) {
		return normalizedContentLanguage;
	}

	const acceptLanguage = readLanguageHeader(rawMetadata, 'Accept-Language');
	if (!acceptLanguage) {
		return null;
	}

	const primary = acceptLanguage.split(',')[0]?.trim() ?? '';
	return normalizeLanguageTag(primary);
}

function resolveLanguageFromMessageText(input: { subject: string; bodyText: string }): string {
	const sample = `${input.subject} ${input.bodyText}`.toLowerCase();

	const germanSignals = [' und ', ' der ', ' die ', ' das ', ' bitte ', ' fuer ', ' mit '];
	const frenchSignals = [' le ', ' la ', ' les ', ' bonjour ', ' merci ', ' pour ', ' avec '];
	const spanishSignals = [' el ', ' la ', ' los ', ' gracias ', ' para ', ' con ', ' por favor '];

	const score = (signals: string[]): number =>
		signals.reduce((count, token) => (sample.includes(token) ? count + 1 : count), 0);

	const germanScore = score(germanSignals);
	const frenchScore = score(frenchSignals);
	const spanishScore = score(spanishSignals);

	const maxScore = Math.max(germanScore, frenchScore, spanishScore);
	if (maxScore < 2) {
		return 'English';
	}

	if (germanScore === maxScore) {
		return 'German';
	}

	if (frenchScore === maxScore) {
		return 'French';
	}

	return 'Spanish';
}

async function resolveAutoresponseLanguage(
	env: WorkerEnv,
	input: {
		campaignId: number | null;
		rawMetadata: Record<string, unknown>;
		subject: string;
		bodyText: string;
	}
): Promise<string> {
	const headerLanguage = resolveLanguageFromHeaders(input.rawMetadata);
	if (headerLanguage) {
		return headerLanguage;
	}

	const inferredFromText = resolveLanguageFromMessageText({
		subject: input.subject,
		bodyText: input.bodyText
	});
	if (inferredFromText !== 'English') {
		return inferredFromText;
	}

	const campaignLanguage = await resolveCampaignLanguage(env, input.campaignId);
	if (campaignLanguage) {
		return campaignLanguage;
	}

	return inferredFromText;
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
			lead_message_id: null,
			provider_message_id: params.gmailMessage.id,
			provider_thread_id: params.gmailMessage.threadId,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null,
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			eligible_for_autoresponse: false,
			skipped_reason: 'invalid_message',
			autoresponse_status: null,
			autoresponse_outbound_lead_message_id: null,
			autoresponse_provider_message_id: null,
			autoresponse_provider_thread_id: null
		};
	}

	if (normalized.direction !== 'inbound') {
		return {
			status: 'not_inbound',
			lead_journey_id: null,
			lead_message_id: null,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null,
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			eligible_for_autoresponse: false,
			skipped_reason: 'not_inbound',
			autoresponse_status: null,
			autoresponse_outbound_lead_message_id: null,
			autoresponse_provider_message_id: null,
			autoresponse_provider_thread_id: null
		};
	}

	const existing = await findMessageByProviderId(env, normalized.provider_message_id);
	if (existing) {
		await applyInboundProcessingLabelsSafely(env, {
			gmailUser: params.gmailUser,
			providerMessageId: normalized.provider_message_id,
			markResponded: false
		});

		return {
			status: 'duplicate_ignored',
			lead_journey_id: existing.lead_journey_id,
			lead_message_id: existing.id,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: 'duplicate',
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			eligible_for_autoresponse: false,
			skipped_reason: 'duplicate',
			autoresponse_status: null,
			autoresponse_outbound_lead_message_id: null,
			autoresponse_provider_message_id: null,
			autoresponse_provider_thread_id: null
		};
	}

	if (!normalized.from_email) {
		return {
			status: 'invalid_sender_email',
			lead_journey_id: null,
			lead_message_id: null,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: null,
			campaign_id: null,
			campaign_page_id: null,
			created_new_journey: false,
			matched_by: null,
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			eligible_for_autoresponse: false,
			skipped_reason: 'invalid_sender_email',
			autoresponse_status: null,
			autoresponse_outbound_lead_message_id: null,
			autoresponse_provider_message_id: null,
			autoresponse_provider_thread_id: null
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
			lead_message_id: winner?.id ?? null,
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: journeyResolution.attribution_status,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			created_new_journey: false,
			matched_by: 'duplicate',
			classification: null,
			classification_confidence: null,
			auto_response_decision: null,
			eligible_for_autoresponse: false,
			skipped_reason: 'duplicate',
			autoresponse_status: null,
			autoresponse_outbound_lead_message_id: null,
			autoresponse_provider_message_id: null,
			autoresponse_provider_thread_id: null
		};
	}

	const isInternal = isInternalSender(env, normalized.from_email);
	const classification = isInternal
		? null
		: classifyInboundMessage({
				subject: normalized.subject,
				body_text: normalized.body_text
			});

	const decision = await evaluateInboundAutoResponseDecision(env, {
		lead_journey_id: journeyResolution.lead_journey_id,
		lead_message_id: persistedMessage.id,
		is_internal_sender: isInternal,
		classification
	});

	const updateQuery = new URLSearchParams({
		select: 'id',
		id: `eq.${persistedMessage.id}`,
		limit: '1'
	});

	await updateMany(env, 'lead_messages', updateQuery, {
		classification: decision.classification,
		classification_confidence: decision.classification_confidence,
		auto_response_decision: decision.auto_response_decision,
		auto_response_sent_at: null,
		raw_metadata: {
			...normalized.raw_metadata,
			inbound_processing: {
				matched_by: journeyResolution.matched_by,
				attribution_status: journeyResolution.attribution_status,
				campaign_id: journeyResolution.campaign_id,
				campaign_page_id: journeyResolution.campaign_page_id,
				created_new_journey: journeyResolution.created_new_journey,
				autoresponse: {
					classification: decision.classification,
					classification_confidence: decision.classification_confidence,
					auto_response_decision: decision.auto_response_decision,
					eligible_for_autoresponse: decision.eligible_for_autoresponse,
					skipped_reason: decision.skipped_reason
				}
			}
		},
		updated_at: new Date().toISOString()
	});

	await logLeadEvent(env, {
		lead_journey_id: journeyResolution.lead_journey_id,
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id,
		event_type: 'message_received',
		event_source: 'worker.gmail_sync',
		event_payload: {
			legacy_event_type: 'email_received',
			provider: 'gmail',
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			attribution_status: journeyResolution.attribution_status,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			matched_by: journeyResolution.matched_by
		}
	});

	if (classification) {
		await logLeadEvent(env, {
			lead_journey_id: journeyResolution.lead_journey_id,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			event_type: 'message_classified',
			event_source: 'worker.gmail_sync',
			event_payload: {
				legacy_event_type: 'inbound_message_classified',
				provider_message_id: normalized.provider_message_id,
				provider_thread_id: normalized.provider_thread_id,
				classification: classification.classification,
				classification_confidence: classification.classification_confidence,
				reason: classification.reason
			}
		});
	}

	if (decision.classification === 'speaking_inquiry') {
		await logLeadEvent(env, {
			lead_journey_id: journeyResolution.lead_journey_id,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			event_type: 'lead_qualified',
			event_source: 'worker.gmail_sync',
			event_payload: {
				qualification_reason: 'message_classification',
				classification: decision.classification,
				classification_confidence: decision.classification_confidence
			}
		});
	} else if (decision.classification === 'not_speaking_inquiry') {
		await logLeadEvent(env, {
			lead_journey_id: journeyResolution.lead_journey_id,
			campaign_id: journeyResolution.campaign_id,
			campaign_page_id: journeyResolution.campaign_page_id,
			event_type: 'lead_disqualified',
			event_source: 'worker.gmail_sync',
			event_payload: {
				disqualification_reason: 'message_classification',
				classification: decision.classification,
				classification_confidence: decision.classification_confidence
			}
		});
	}

	await logLeadEvent(env, {
		lead_journey_id: journeyResolution.lead_journey_id,
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id,
		event_type: mapDecisionEventType(decision.auto_response_decision),
		event_source: 'worker.gmail_sync',
		event_payload: {
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			auto_response_decision: decision.auto_response_decision,
			eligible_for_autoresponse: decision.eligible_for_autoresponse,
			skipped_reason: decision.skipped_reason,
			classification: decision.classification,
			classification_confidence: decision.classification_confidence
		}
	});

	const responseLanguage = await resolveAutoresponseLanguage(env, {
		campaignId: journeyResolution.campaign_id,
		rawMetadata: normalized.raw_metadata,
		subject: normalized.subject,
		bodyText: normalized.body_text
	});

	const autoresponse = await runAutoresponsePipeline(env, {
		lead_journey_id: journeyResolution.lead_journey_id,
		inbound_lead_message_id: persistedMessage.id,
		inbound_provider_message_id: normalized.provider_message_id,
		inbound_provider_thread_id: normalized.provider_thread_id,
		sender_name: normalized.from_name,
		sender_email: normalized.from_email,
		inbound_subject: normalized.subject,
		inbound_body: normalized.body_text,
		raw_metadata: normalized.raw_metadata,
		response_language: responseLanguage,
		decision: {
			eligible_for_autoresponse: decision.eligible_for_autoresponse,
			auto_response_decision: decision.auto_response_decision,
			skipped_reason: decision.skipped_reason
		},
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id
	});

	const markResponded =
		autoresponse.status === 'sent_successfully' ||
		autoresponse.status === 'already_responded' ||
		decision.auto_response_decision === 'do_not_autorespond_already_sent';

	await applyInboundProcessingLabelsSafely(env, {
		gmailUser: params.gmailUser,
		providerMessageId: normalized.provider_message_id,
		markResponded
	});

	return {
		status: 'processed',
		lead_journey_id: journeyResolution.lead_journey_id,
		lead_message_id: persistedMessage.id,
		provider_message_id: normalized.provider_message_id,
		provider_thread_id: normalized.provider_thread_id,
		attribution_status: journeyResolution.attribution_status,
		campaign_id: journeyResolution.campaign_id,
		campaign_page_id: journeyResolution.campaign_page_id,
		created_new_journey: journeyResolution.created_new_journey,
		matched_by: journeyResolution.matched_by,
		classification: decision.classification,
		classification_confidence: decision.classification_confidence,
		auto_response_decision: decision.auto_response_decision,
		eligible_for_autoresponse: decision.eligible_for_autoresponse,
		skipped_reason: decision.skipped_reason,
		autoresponse_status: autoresponse.status,
		autoresponse_outbound_lead_message_id: autoresponse.outbound_lead_message_id,
		autoresponse_provider_message_id: autoresponse.provider_message_id,
		autoresponse_provider_thread_id: autoresponse.provider_thread_id
	};
}
