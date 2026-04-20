import {
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages,
	getCampaignById
} from '$lib/server/campaigns/client';
import { z } from 'zod';
import {
	landingPageGenerationInputSchema,
	type LandingPageGenerationInput
} from './schemas/landing-page-input';
import { loadLandingPageAssets } from './config/landing-page-assets-store';

const adPackageStrategySchema = z.object({
	targetingSummary: z.string(),
	messagingAngle: z.string(),
	conversionGoal: z.string()
});

export async function loadLandingPageGenerationInput(
	campaignId: number
): Promise<LandingPageGenerationInput> {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw new Error(`Campaign ${campaignId} not found`);
	}

	const adPackages = await getCampaignAdPackages(campaignId);
	const latestAdPackage = adPackages.at(-1);
	if (!latestAdPackage) {
		throw new Error(`No generated ad package found for campaign ${campaignId}`);
	}

	const adPackageWithDetails = await getCampaignAdPackageWithDetails(latestAdPackage.id);
	if (!adPackageWithDetails) {
		throw new Error(`Latest ad package ${latestAdPackage.id} could not be loaded`);
	}

	if (adPackageWithDetails.groups.length !== 1) {
		throw new Error(
			`Expected exactly one ad group in ad package ${adPackageWithDetails.id}, found ${adPackageWithDetails.groups.length}`
		);
	}

	const singleAdGroup = adPackageWithDetails.groups[0];
	if (!singleAdGroup) {
		throw new Error(`No ad group found in ad package ${adPackageWithDetails.id}`);
	}

	const parsedStrategy = adPackageStrategySchema.safeParse(adPackageWithDetails.strategy_json);
	if (!parsedStrategy.success) {
		throw new Error(`Invalid ad package strategy_json: ${parsedStrategy.error.message}`);
	}

	const landingPageAssets = await loadLandingPageAssets();

	const normalized = landingPageGenerationInputSchema.parse({
		campaign: {
			id: campaign.id,
			name: campaign.name,
			audience: campaign.audience,
			format: campaign.format,
			topic: campaign.topic,
			language: campaign.language,
			geography: campaign.geography,
			notes: campaign.notes ?? null
		},
		adPackage: {
			id: adPackageWithDetails.id,
			targetingSummary: parsedStrategy.data.targetingSummary,
			messagingAngle: parsedStrategy.data.messagingAngle,
			conversionGoal: parsedStrategy.data.conversionGoal
		},
		adGroup: {
			id: singleAdGroup.id,
			name: singleAdGroup.name,
			intentSummary: singleAdGroup.intent_summary ?? '',
			landingPageAngle: null,
			keywords: singleAdGroup.keywords.map((keyword) => ({
				keywordText: keyword.keyword_text,
				matchType: keyword.match_type,
				isNegative: keyword.is_negative,
				rationale: keyword.rationale ?? null
			})),
			ads: singleAdGroup.ads.map((ad) => ({
				headlines: ad.headlines_json,
				descriptions: ad.descriptions_json,
				path1: ad.path_1 ?? null,
				path2: ad.path_2 ?? null
			}))
		},
		assets: landingPageAssets
	});

	return normalized;
}
