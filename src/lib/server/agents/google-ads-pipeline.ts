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
import { adPackageStrategySchema } from './schemas/ad-package-strategy';
import { updateGoogleAdsStrategyFromPrompt } from './google-ads-strategy-editor';
import { runLandingPageGenerationForCampaign } from './landing-page-pipeline';
import {
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages
} from '$lib/server/campaigns/client';

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

export async function runCampaignRegenerationFromStrategyPrompt(
	campaignId: number,
	strategyChangePrompt: string
): Promise<{ adPackageId: number; campaignPageId: number }> {
	const runId = createRunId('campaign_regeneration');
	const traceContext = { runId, campaignId, pipeline: 'campaign_regeneration' };
	traceLlm('pipeline_start', traceContext, { strategyChangePrompt });

	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		traceLlm('pipeline_error', traceContext, { message: `Campaign ${campaignId} not found` });
		throw new Error(`Campaign ${campaignId} not found`);
	}

	const adPackages = await getCampaignAdPackages(campaignId);
	const latestAdPackage = adPackages.at(-1);
	if (!latestAdPackage) {
		throw new Error(`No ad package found for campaign ${campaignId}`);
	}

	const latestAdPackageDetails = await getCampaignAdPackageWithDetails(latestAdPackage.id);
	if (!latestAdPackageDetails) {
		throw new Error(`Could not load latest ad package ${latestAdPackage.id}`);
	}

	const parsedCurrentStrategy = adPackageStrategySchema.safeParse(
		latestAdPackageDetails.strategy_json
	);
	if (!parsedCurrentStrategy.success) {
		throw new Error(`Invalid current strategy JSON: ${parsedCurrentStrategy.error.message}`);
	}

	const updatedStrategy = await updateGoogleAdsStrategyFromPrompt(
		parsedCurrentStrategy.data,
		strategyChangePrompt,
		traceContext
	);
	traceLlm('pipeline_step', traceContext, { step: 'strategy_updated', updatedStrategy });

	const brief: CampaignBrief = normalizeCampaignBrief(campaign);
	const strategy = await generateGoogleAdsStrategy(brief, traceContext, updatedStrategy);
	traceLlm('pipeline_step', traceContext, { step: 'strategy_regenerated', strategy });

	const draft = await generateGoogleAdsPackage(brief, strategy, traceContext);
	traceLlm('pipeline_step', traceContext, { step: 'draft_generated', draft });

	const nextVersionNumber = (latestAdPackage.version_number ?? 0) + 1;
	const draftWithVersion: GoogleAdsPackageDraft = {
		...draft,
		package: {
			...draft.package,
			versionNumber: nextVersionNumber,
			strategyJson: {
				...draft.package.strategyJson,
				targetingSummary: updatedStrategy.targetingSummary,
				messagingAngle: updatedStrategy.messagingAngle,
				conversionGoal: updatedStrategy.conversionGoal,
				notes: updatedStrategy.notes ?? draft.package.strategyJson.notes
			}
		}
	};

	const adResult = await persistGoogleAdsPackage(campaignId, draftWithVersion);
	traceLlm('pipeline_step', traceContext, {
		step: 'ad_package_persisted',
		adPackageId: adResult.adPackageId
	});

	const pageResult = await runLandingPageGenerationForCampaign(campaignId);
	traceLlm('pipeline_success', traceContext, {
		adPackageId: adResult.adPackageId,
		campaignPageId: pageResult.campaignPageId
	});

	return {
		adPackageId: adResult.adPackageId,
		campaignPageId: pageResult.campaignPageId
	};
}
