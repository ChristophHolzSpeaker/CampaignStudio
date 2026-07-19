import type { AttributionStatus } from '../../../../shared/event-types';
import { insertOne, selectOne } from '../db';
import type { WorkerEnv } from '../env';
import { parsePlusAddressFromRecipients } from '../attribution/plus-address';
import { persistWorkerJourneyAttributionSnapshot } from './attribution-persistence';
import {
	SPEAKER_HERO_MEDIA_EMAIL_ALIAS,
	SPEAKER_HERO_MEDIA_EXPERIMENT_KEY
} from '../../../../shared/experiments';

const CLOSED_STAGES = ['won', 'lost', 'cancelled', 'closed', 'disqualified', 'archived'] as const;
const JOURNEY_MATCH_WINDOW_DAYS = 30;

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

type LeadMessageThreadRow = {
	lead_journey_id: string;
};

type ExperimentRow = { id: string };
type ExperimentVariantRow = { id: string };

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

async function resolveCampaignFromPlusAddress(
	env: WorkerEnv,
	toRecipients: string[]
): Promise<{
	attribution_status: AttributionStatus;
	campaign_id: number | null;
	campaign_page_id: number | null;
	experiment_id: string | null;
	variant_id: string | null;
}> {
	const parsed = parsePlusAddressFromRecipients(toRecipients);
	if (parsed.status !== 'parsed' || !parsed.campaign_id || !parsed.campaign_page_id) {
		return {
			attribution_status: parsed.status,
			campaign_id: null,
			campaign_page_id: null,
			experiment_id: null,
			variant_id: null
		};
	}

	const campaignPageQuery = new URLSearchParams({
		select: 'id,campaign_id',
		id: `eq.${parsed.campaign_page_id}`,
		campaign_id: `eq.${parsed.campaign_id}`,
		limit: '1'
	});
	const campaignPage = await selectOne<CampaignPageRow>(env, 'campaign_pages', campaignPageQuery);

	if (!campaignPage) {
		return {
			attribution_status: 'unresolved_campaign_page',
			campaign_id: null,
			campaign_page_id: null,
			experiment_id: null,
			variant_id: null
		};
	}

	let experimentId: string | null = null;
	let variantId: string | null = null;
	if (parsed.experiment_alias === SPEAKER_HERO_MEDIA_EMAIL_ALIAS && parsed.variant_key) {
		const experiment = await selectOne<ExperimentRow>(
			env,
			'ab_experiments',
			new URLSearchParams({
				select: 'id',
				key: `eq.${SPEAKER_HERO_MEDIA_EXPERIMENT_KEY}`,
				limit: '1'
			})
		);

		if (experiment) {
			const variant = await selectOne<ExperimentVariantRow>(
				env,
				'ab_variants',
				new URLSearchParams({
					select: 'id',
					experiment_id: `eq.${experiment.id}`,
					key: `eq.${parsed.variant_key}`,
					limit: '1'
				})
			);
			experimentId = variant ? experiment.id : null;
			variantId = variant?.id ?? null;
		}
	}

	return {
		attribution_status: 'parsed',
		campaign_id: campaignPage.campaign_id,
		campaign_page_id: campaignPage.id,
		experiment_id: experimentId,
		variant_id: variantId
	};
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

export async function resolveInboundJourney(
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

	const plusResolution = await resolveCampaignFromPlusAddress(env, params.toRecipients);

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
