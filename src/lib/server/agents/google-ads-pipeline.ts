import { db } from '$lib/server/db';
import { getCampaignById } from '$lib/server/campaigns/client';
import {
	createAdPackage,
	createAdGroup,
	createCampaignAd,
	createKeyword
} from '$lib/server/campaigns/ads';
import type { CampaignBrief } from './schemas/campaign-brief';
import type { GoogleAdsPackageDraft } from './schemas/google-ads-package';
import { normalizeCampaignBrief } from './campaign-brief';
import { generateGoogleAdsStrategy } from './google-ads-strategist';
import { generateGoogleAdsPackage } from './google-ads-structurer';
import { createRunId, traceLlm } from '$lib/server/telemetry/llm-trace';

export async function persistGoogleAdsPackage(
	campaignId: number,
	draft: GoogleAdsPackageDraft
): Promise<{ adPackageId: number }> {
	return db.transaction(async (tx) => {
		const adPackage = await createAdPackage(
			{
				campaign_id: campaignId,
				version_number: draft.package.versionNumber,
				channel: draft.package.channel,
				status: draft.package.status,
				strategy_json: draft.package.strategyJson
			},
			tx
		);

		for (const group of draft.adGroups) {
			const adGroup = await createAdGroup(
				{
					ad_package_id: adPackage.id,
					campaign_page_id: group.campaignPageId ?? null,
					name: group.name,
					intent_summary: group.intentSummary,
					position: group.position
				},
				tx
			);

			for (const keyword of group.keywords) {
				await createKeyword(
					{
						ad_group_id: adGroup.id,
						keyword_text: keyword.keywordText,
						match_type: keyword.matchType,
						is_negative: keyword.isNegative,
						rationale: keyword.rationale,
						position: keyword.position
					},
					tx
				);
			}

			for (const ad of group.ads) {
				await createCampaignAd(
					{
						ad_group_id: adGroup.id,
						ad_type: ad.adType,
						headlines_json: ad.headlines,
						descriptions_json: ad.descriptions,
						path_1: ad.path1,
						path_2: ad.path2
					},
					tx
				);
			}
		}

		return { adPackageId: adPackage.id };
	});
}

export async function runGoogleAdsGenerationForCampaign(
	campaignId: number
): Promise<{ adPackageId: number; packageName: string }> {
	const runId = createRunId('google_ads');
	const traceContext = { runId, campaignId, pipeline: 'google_ads' };
	traceLlm('pipeline_start', traceContext);
	console.log(`Google Ads pipeline: start campaign ${campaignId}`);
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		traceLlm('pipeline_error', traceContext, { message: `Campaign ${campaignId} not found` });
		throw new Error(`Campaign ${campaignId} not found`);
	}

	const brief: CampaignBrief = normalizeCampaignBrief(campaign);
	traceLlm('pipeline_step', traceContext, { step: 'brief_normalized', brief });
	console.log('Google Ads pipeline: brief normalized');
	const strategy = await generateGoogleAdsStrategy(brief, traceContext);
	traceLlm('pipeline_step', traceContext, { step: 'strategy_generated', strategy });
	console.log('Google Ads pipeline: strategy generated');
	const draft = await generateGoogleAdsPackage(brief, strategy, traceContext);
	traceLlm('pipeline_step', traceContext, { step: 'draft_generated', draft });
	console.log('Google Ads pipeline: package draft generated');
	const result = await persistGoogleAdsPackage(campaignId, draft);
	traceLlm('pipeline_success', traceContext, { adPackageId: result.adPackageId });
	console.log(`Google Ads pipeline: persisted package ${result.adPackageId}`);

	return { adPackageId: result.adPackageId, packageName: strategy.packageName };
}
