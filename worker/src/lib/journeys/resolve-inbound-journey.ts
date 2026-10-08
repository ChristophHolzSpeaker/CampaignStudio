import type { AttributionStatus } from '../../../../shared/event-types';
import { insertOne, selectOne } from '../db';
import type { WorkerEnv } from '../env';
import { resolveCampaignEmailAttribution } from '../attribution/campaign-page';
import { resolveEmailVisitReference } from '../attribution/email-reference';
import { parsePlusAddressFromRecipients } from '../attribution/plus-address';
import { persistWorkerJourneyAttributionSnapshot } from './attribution-persistence';

const CLOSED_STAGES = ['won', 'lost', 'cancelled', 'closed', 'disqualified', 'archived'] as const;
const JOURNEY_MATCH_WINDOW_DAYS = 30;

type LeadJourneyRow = {
	id: string;
	campaign_id: number | null;
	campaign_page_id: number | null;
	contact_email: string | null;
	updated_at: string;
};

type LeadMessageThreadRow = {
	lead_journey_id: string;
};

type MatchedBy = 'thread' | 'plus_address_email_campaign' | 'new_journey';

export type InboundJourneyResolutionResult = {
	lead_journey_id: string;
	campaign_id: number | null;
	campaign_page_id: number | null;
	experiment_id: string | null;
	variant_id: string | null;
	attribution_status: AttributionStatus | null;
	created_new_journey: boolean;
	matched_by: MatchedBy;
};

async function getJourneyById(env: WorkerEnv, journeyId: string): Promise<LeadJourneyRow | null> {
	const query = new URLSearchParams({
		select: 'id,campaign_id,campaign_page_id,contact_email,updated_at',
		id: `eq.${journeyId}`,
		limit: '1'
	});
	return selectOne<LeadJourneyRow>(env, 'lead_journeys', query);
}

async function findJourneyByThread(
	env: WorkerEnv,
	providerThreadId: string
): Promise<LeadJourneyRow | null> {
	const threadLookupQuery = new URLSearchParams({
		select: 'lead_journey_id',
		provider: 'eq.gmail',
		provider_thread_id: `eq.${providerThreadId}`,
		lead_journey_id: 'not.is.null',
		order: 'created_at.desc',
		limit: '1'
	});

	const threadMatch = await selectOne<LeadMessageThreadRow>(
		env,
		'lead_messages',
		threadLookupQuery
	);
	if (!threadMatch?.lead_journey_id) {
		return null;
	}

	return getJourneyById(env, threadMatch.lead_journey_id);
}

async function findRecentOpenJourneyByEmailAndCampaign(
	env: WorkerEnv,
	params: {
		normalizedSenderEmail: string;
		campaignId: number;
	}
): Promise<LeadJourneyRow | null> {
	const windowStart = new Date(
		Date.now() - JOURNEY_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
	).toISOString();

	const query = new URLSearchParams({
		select: 'id,campaign_id,campaign_page_id,contact_email,updated_at',
		contact_email: `eq.${params.normalizedSenderEmail}`,
		campaign_id: `eq.${params.campaignId}`,
		current_stage: `not.in.(${CLOSED_STAGES.join(',')})`,
		updated_at: `gte.${windowStart}`,
		order: 'updated_at.desc',
		limit: '1'
	});

	return selectOne<LeadJourneyRow>(env, 'lead_journeys', query);
}

async function createNewJourney(
	env: WorkerEnv,
	params: {
		normalizedSenderEmail: string;
		senderDisplayName: string | null;
		campaignId: number | null;
		campaignPageId: number | null;
	}
): Promise<LeadJourneyRow> {
	const nowIso = new Date().toISOString();
	return insertOne<LeadJourneyRow>(env, 'lead_journeys', {
		campaign_id: params.campaignId,
		campaign_page_id: params.campaignPageId,
		first_touch_type: 'email',
		first_touch_at: nowIso,
		contact_email: params.normalizedSenderEmail,
		contact_name: params.senderDisplayName,
		current_stage: 'new'
	});
}

async function resolveInboundJourneyContext(
	env: WorkerEnv,
	params: {
		providerThreadId: string;
		normalizedSenderEmail: string;
		senderDisplayName: string | null;
		toRecipients: string[];
	}
): Promise<InboundJourneyResolutionResult> {
	const threadJourney = await findJourneyByThread(env, params.providerThreadId);
	if (threadJourney) {
		await persistWorkerJourneyAttributionSnapshot(env, {
			journeyId: threadJourney.id,
			campaignId: threadJourney.campaign_id,
			campaignPageId: threadJourney.campaign_page_id
		});

		return {
			lead_journey_id: threadJourney.id,
			campaign_id: threadJourney.campaign_id,
			campaign_page_id: threadJourney.campaign_page_id,
			experiment_id: null,
			variant_id: null,
			attribution_status: null,
			created_new_journey: false,
			matched_by: 'thread'
		};
	}

	const plusResolution = await resolveCampaignEmailAttribution(env, params.toRecipients);

	if (plusResolution.campaign_id !== null) {
		const existingJourney = await findRecentOpenJourneyByEmailAndCampaign(env, {
			normalizedSenderEmail: params.normalizedSenderEmail,
			campaignId: plusResolution.campaign_id
		});

		if (existingJourney) {
			await persistWorkerJourneyAttributionSnapshot(env, {
				journeyId: existingJourney.id,
				campaignId: existingJourney.campaign_id,
				campaignPageId: existingJourney.campaign_page_id
			});

			return {
				lead_journey_id: existingJourney.id,
				campaign_id: existingJourney.campaign_id,
				campaign_page_id: existingJourney.campaign_page_id,
				experiment_id: plusResolution.experiment_id,
				variant_id: plusResolution.variant_id,
				attribution_status: plusResolution.attribution_status,
				created_new_journey: false,
				matched_by: 'plus_address_email_campaign'
			};
		}
	}

	const createdJourney = await createNewJourney(env, {
		normalizedSenderEmail: params.normalizedSenderEmail,
		senderDisplayName: params.senderDisplayName,
		campaignId: plusResolution.campaign_id,
		campaignPageId: plusResolution.campaign_page_id
	});

	await persistWorkerJourneyAttributionSnapshot(env, {
		journeyId: createdJourney.id,
		campaignId: createdJourney.campaign_id,
		campaignPageId: createdJourney.campaign_page_id
	});

	return {
		lead_journey_id: createdJourney.id,
		campaign_id: createdJourney.campaign_id,
		campaign_page_id: createdJourney.campaign_page_id,
		experiment_id: plusResolution.experiment_id,
		variant_id: plusResolution.variant_id,
		attribution_status: plusResolution.attribution_status,
		created_new_journey: true,
		matched_by: 'new_journey'
	};
}

export async function resolveInboundJourney(
	env: WorkerEnv,
	params: {
		providerThreadId: string;
		normalizedSenderEmail: string;
		senderDisplayName: string | null;
		toRecipients: string[];
		bodyText?: string;
		observedAt?: Date;
	}
): Promise<InboundJourneyResolutionResult & { campaign_visit_id: number | null }> {
	const result = await resolveInboundJourneyContext(env, params);
	const alias = parsePlusAddressFromRecipients(params.toRecipients);
	const observedAt = params.observedAt ?? new Date();
	const visitId = await resolveEmailVisitReference(env, {
		bodyText: params.bodyText ?? '',
		campaignId: result.campaign_id,
		campaignPageId: alias.campaign_page_id,
		observedAt
	});
	if (visitId !== null) {
		await persistWorkerJourneyAttributionSnapshot(env, {
			journeyId: result.lead_journey_id,
			campaignId: result.campaign_id,
			campaignPageId: alias.campaign_page_id,
			campaignVisitId: visitId,
			observedAt
		});
	}
	return {
		...result,
		campaign_visit_id: visitId,
		...(visitId !== null ? { campaign_page_id: alias.campaign_page_id } : {})
	};
}
