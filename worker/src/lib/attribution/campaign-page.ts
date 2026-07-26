import type { AttributionStatus } from '../../../../shared/event-types';
import {
	SPEAKER_HERO_MEDIA_EMAIL_ALIAS,
	SPEAKER_HERO_MEDIA_EXPERIMENT_KEY
} from '../../../../shared/experiments';
import { selectOne } from '../db';
import type { WorkerEnv } from '../env';
import { parsePlusAddressFromRecipients } from './plus-address';

type CampaignPageRow = {
	id: number;
	campaign_id: number;
};

type ExperimentRow = { id: string };
type ExperimentVariantRow = { id: string };

export type CampaignEmailAttribution = {
	attribution_status: AttributionStatus;
	campaign_id: number | null;
	campaign_page_id: number | null;
	experiment_id: string | null;
	variant_id: string | null;
};

export async function resolveCampaignEmailAttribution(
	env: WorkerEnv,
	toRecipients: string[]
): Promise<CampaignEmailAttribution> {
	const parsed = parsePlusAddressFromRecipients(toRecipients);
	if (parsed.status !== 'parsed' || !parsed.campaign_page_id) {
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
		limit: '1'
	});
	if (parsed.campaign_id) {
		campaignPageQuery.set('campaign_id', `eq.${parsed.campaign_id}`);
	}

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
