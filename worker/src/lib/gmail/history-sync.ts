import { insertOne, selectMany, selectOne, updateMany, upsertOne } from '../db';
import type { WorkerEnv } from '../env';
import { normalizeEmailAddress, parsePlusAddressAttribution } from '../email';
import {
	type GmailMessage,
	gmailGetMessage,
	gmailListHistory,
	isHistoryCursorStale
} from './client';
import { normalizeGmailMessage, type NormalizedGmailMessage } from './messages';

const OPEN_STAGES_FILTER = 'not.in.(won,lost,disqualified,archived)';
const JOURNEY_MATCH_WINDOW_DAYS = 30;

type MailboxCursorRow = {
	id: string;
	gmail_user: string;
	last_processed_history_id: string;
	watch_expiration: string;
	sync_status: string;
};

type LeadJourneyRow = {
	id: string;
	campaign_id: number | null;
	campaign_page_id: number | null;
	contact_email: string | null;
	updated_at: string;
};

type CampaignPageRow = {
	id: number;
	campaign_id: number;
};

type LeadMessageRow = {
	id: string;
	provider_message_id: string;
	lead_journey_id: string;
};

type SyncOutcome = {
	ok: boolean;
	status: 'active' | 'sync_failed' | 'resync_required';
	processed_messages: number;
	last_history_id: string;
};

function compareHistoryIds(left: string, right: string): number {
	try {
		const leftValue = BigInt(left);
		const rightValue = BigInt(right);
		if (leftValue === rightValue) return 0;
		return leftValue > rightValue ? 1 : -1;
	} catch {
		if (left === right) return 0;
		return left > right ? 1 : -1;
	}
}

function maxHistoryId(current: string, candidate: string | null | undefined): string {
	if (!candidate) {
		return current;
	}
	return compareHistoryIds(candidate, current) > 0 ? candidate : current;
}

async function updateCursor(
	env: WorkerEnv,
	gmailUser: string,
	values: Record<string, unknown>
): Promise<void> {
	const query = new URLSearchParams({
		select: 'id',
		gmail_user: `eq.${gmailUser}`,
		limit: '1'
	});
	await updateMany(env, 'mailbox_cursors', query, values);
}

async function getMailboxCursor(
	env: WorkerEnv,
	gmailUser: string
): Promise<MailboxCursorRow | null> {
	const query = new URLSearchParams({
		select: 'id,gmail_user,last_processed_history_id,watch_expiration,sync_status',
		gmail_user: `eq.${gmailUser}`,
		limit: '1'
	});
	return selectOne<MailboxCursorRow>(env, 'mailbox_cursors', query);
}

async function resolveCampaignForInbound(
	env: WorkerEnv,
	toEmailHeader: string
): Promise<{ campaign_id: number | null; campaign_page_id: number | null }> {
	const firstRecipient = toEmailHeader
		.split(',')
		.map((value) => value.trim())
		.find((value) => value.length > 0);

	if (!firstRecipient) {
		return { campaign_id: null, campaign_page_id: null };
	}

	const parsed = parsePlusAddressAttribution(firstRecipient);
	if (parsed.status !== 'parsed' || !parsed.campaign_id || !parsed.campaign_page_id) {
		return { campaign_id: null, campaign_page_id: null };
	}

	const query = new URLSearchParams({
		select: 'id,campaign_id',
		id: `eq.${parsed.campaign_page_id}`,
		campaign_id: `eq.${parsed.campaign_id}`,
		limit: '1'
	});
	const campaignPage = await selectOne<CampaignPageRow>(env, 'campaign_pages', query);
	if (!campaignPage) {
		return { campaign_id: null, campaign_page_id: null };
	}

	return {
		campaign_id: campaignPage.campaign_id,
		campaign_page_id: campaignPage.id
	};
}

async function resolveLeadJourneyId(
	env: WorkerEnv,
	message: NormalizedGmailMessage
): Promise<LeadJourneyRow> {
	const normalizedContactEmail = normalizeEmailAddress(message.contact_email ?? '');
	const nowIso = new Date().toISOString();

	let campaignId: number | null = null;
	let campaignPageId: number | null = null;

	if (message.direction === 'inbound') {
		const inboundCampaign = await resolveCampaignForInbound(env, message.to_email);
		campaignId = inboundCampaign.campaign_id;
		campaignPageId = inboundCampaign.campaign_page_id;
	}

	if (normalizedContactEmail) {
		const windowStart = new Date(
			Date.now() - JOURNEY_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
		).toISOString();

		const query = new URLSearchParams({
			select: 'id,campaign_id,campaign_page_id,contact_email,updated_at',
			contact_email: `eq.${normalizedContactEmail}`,
			current_stage: OPEN_STAGES_FILTER,
			updated_at: `gte.${windowStart}`,
			order: 'updated_at.desc',
			limit: '1'
		});
		const existingJourney = await selectOne<LeadJourneyRow>(env, 'lead_journeys', query);
		if (existingJourney) {
			return existingJourney;
		}
	}

	return insertOne<LeadJourneyRow>(env, 'lead_journeys', {
		campaign_id: campaignId,
		campaign_page_id: campaignPageId,
		first_touch_type: 'email',
		first_touch_at: nowIso,
		contact_email: normalizedContactEmail,
		contact_name: null,
		current_stage: 'new'
	});
}

async function persistMessage(
	env: WorkerEnv,
	gmailUser: string,
	gmailMessage: GmailMessage
): Promise<boolean> {
	const normalized = normalizeGmailMessage(gmailMessage, gmailUser);
	if (!normalized) {
		return false;
	}

	const existingQuery = new URLSearchParams({
		select: 'id,provider_message_id,lead_journey_id',
		provider_message_id: `eq.${normalized.provider_message_id}`,
		limit: '1'
	});
	const existingMessage = await selectOne<LeadMessageRow>(env, 'lead_messages', existingQuery);
	if (existingMessage) {
		return false;
	}

	const journey = await resolveLeadJourneyId(env, normalized);

	await upsertOne(
		env,
		'lead_messages',
		{
			lead_journey_id: journey.id,
			direction: normalized.direction,
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
			received_at: normalized.received_at,
			sent_at: normalized.sent_at,
			raw_metadata: normalized.raw_metadata,
			updated_at: new Date().toISOString()
		},
		{
			onConflict: 'provider_message_id',
			ignoreDuplicates: false
		}
	);

	await insertOne(env, 'lead_events', {
		lead_journey_id: journey.id,
		campaign_id: journey.campaign_id,
		campaign_page_id: journey.campaign_page_id,
		event_type: normalized.direction === 'inbound' ? 'email_received' : 'email_sent',
		event_source: 'worker.gmail_sync',
		event_payload: {
			provider: 'gmail',
			provider_message_id: normalized.provider_message_id,
			provider_thread_id: normalized.provider_thread_id,
			direction: normalized.direction,
			subject: normalized.subject
		}
	});

	return true;
}

async function collectHistoryMessageIds(
	env: WorkerEnv,
	gmailUser: string,
	startHistoryId: string
): Promise<{ messageIds: string[]; lastHistoryId: string }> {
	const collected = new Set<string>();
	let nextPageToken: string | undefined;
	let latestHistoryId = startHistoryId;

	do {
		const response = await gmailListHistory(env, {
			gmailUser,
			startHistoryId,
			pageToken: nextPageToken
		});

		for (const historyItem of response.history ?? []) {
			latestHistoryId = maxHistoryId(latestHistoryId, historyItem.id);
			for (const added of historyItem.messagesAdded ?? []) {
				const messageId = added.message?.id;
				if (messageId) {
					collected.add(messageId);
				}
			}
		}

		latestHistoryId = maxHistoryId(latestHistoryId, response.historyId);
		nextPageToken = response.nextPageToken;
	} while (nextPageToken);

	return {
		messageIds: [...collected],
		lastHistoryId: latestHistoryId
	};
}

export async function syncMailboxHistory(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		hintedHistoryId?: string | null;
	}
): Promise<SyncOutcome> {
	const nowIso = new Date().toISOString();
	const cursor = await getMailboxCursor(env, params.gmailUser);
	if (!cursor) {
		throw new Error(`Mailbox cursor not found for user: ${params.gmailUser}`);
	}

	const startHistoryId = cursor.last_processed_history_id;

	try {
		const historyResult = await collectHistoryMessageIds(env, params.gmailUser, startHistoryId);
		let processed = 0;

		for (const messageId of historyResult.messageIds) {
			const gmailMessage = await gmailGetMessage(env, {
				gmailUser: params.gmailUser,
				messageId
			});
			const inserted = await persistMessage(env, params.gmailUser, gmailMessage);
			if (inserted) {
				processed += 1;
			}
		}

		const nextHistoryId = maxHistoryId(
			historyResult.lastHistoryId,
			params.hintedHistoryId ?? cursor.last_processed_history_id
		);

		await updateCursor(env, params.gmailUser, {
			last_processed_history_id: nextHistoryId,
			last_sync_at: nowIso,
			sync_status: 'active',
			updated_at: nowIso
		});

		return {
			ok: true,
			status: 'active',
			processed_messages: processed,
			last_history_id: nextHistoryId
		};
	} catch (error) {
		if (isHistoryCursorStale(error)) {
			await updateCursor(env, params.gmailUser, {
				sync_status: 'resync_required',
				last_sync_at: nowIso,
				updated_at: nowIso
			});

			console.error('gmail_sync_resync_required', {
				gmail_user: params.gmailUser,
				error: error instanceof Error ? error.message : 'unknown'
			});

			return {
				ok: false,
				status: 'resync_required',
				processed_messages: 0,
				last_history_id: startHistoryId
			};
		}

		await updateCursor(env, params.gmailUser, {
			sync_status: 'sync_failed',
			last_sync_at: nowIso,
			updated_at: nowIso
		});

		console.error('gmail_sync_failed', {
			gmail_user: params.gmailUser,
			error: error instanceof Error ? error.message : 'unknown'
		});

		return {
			ok: false,
			status: 'sync_failed',
			processed_messages: 0,
			last_history_id: startHistoryId
		};
	}
}

export async function touchMailboxPush(
	env: WorkerEnv,
	params: {
		gmailUser: string;
		historyId?: string | null;
	}
): Promise<MailboxCursorRow | null> {
	const nowIso = new Date().toISOString();
	const existing = await getMailboxCursor(env, params.gmailUser);

	if (!existing) {
		if (!params.historyId) {
			return null;
		}

		await insertOne(env, 'mailbox_cursors', {
			gmail_user: params.gmailUser,
			last_processed_history_id: params.historyId,
			watch_expiration: nowIso,
			last_watch_renewed_at: null,
			last_push_received_at: nowIso,
			last_sync_at: null,
			sync_status: 'active'
		});

		return getMailboxCursor(env, params.gmailUser);
	}

	const latestHistoryId = maxHistoryId(existing.last_processed_history_id, params.historyId);

	await updateCursor(env, params.gmailUser, {
		last_push_received_at: nowIso,
		last_processed_history_id: existing.last_processed_history_id,
		updated_at: nowIso
	});

	return {
		...existing,
		last_processed_history_id: latestHistoryId
	};
}

export async function listMailboxCursors(env: WorkerEnv): Promise<MailboxCursorRow[]> {
	const query = new URLSearchParams({
		select: 'id,gmail_user,last_processed_history_id,watch_expiration,sync_status',
		order: 'gmail_user.asc'
	});
	return selectMany<MailboxCursorRow>(env, 'mailbox_cursors', query);
}
