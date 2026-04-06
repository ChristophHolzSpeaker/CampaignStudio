import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	campaign_ad_packages,
	campaign_ad_groups,
	campaign_keywords,
	campaign_ads
} from '$lib/server/db/schema';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js/session';

export interface CampaignAdPackage {
	id: number;
	campaign_id: number;
	version_number: number;
	channel: string;
	status: string;
	strategy_json: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
}

export interface CampaignAdGroupRecord {
	id: number;
	ad_package_id: number;
	campaign_page_id: number | null;
	name: string;
	intent_summary: string | null;
	position: number;
	created_at: Date;
	updated_at: Date;
}

export interface CampaignKeyword {
	id: number;
	ad_group_id: number;
	keyword_text: string;
	match_type: string;
	is_negative: boolean;
	rationale: string | null;
	position: number;
	created_at: Date;
	updated_at: Date;
}

export interface CampaignAd {
	id: number;
	ad_group_id: number;
	ad_type: string;
	headlines_json: string[];
	descriptions_json: string[];
	path_1: string | null;
	path_2: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface CampaignAdGroupWithDetails extends CampaignAdGroupRecord {
	keywords: CampaignKeyword[];
	ads: CampaignAd[];
}

export interface CampaignAdPackageWithDetails extends CampaignAdPackage {
	groups: CampaignAdGroupWithDetails[];
}

export interface CreateAdPackageInput {
	campaign_id: number;
	strategy_json?: Record<string, unknown>;
	version_number?: number;
	channel?: string;
	status?: string;
}

type DrizzleClient = typeof db | PostgresJsTransaction<any, any>;

export async function createAdPackage(
	input: CreateAdPackageInput,
	dbClient: DrizzleClient = db
): Promise<CampaignAdPackage> {
	const [created] = await dbClient
		.insert(campaign_ad_packages)
		.values({
			campaign_id: input.campaign_id,
			version_number: input.version_number ?? 1,
			channel: input.channel ?? 'google_ads_search',
			status: input.status ?? 'draft',
			strategy_json: input.strategy_json ?? {}
		})
		.returning();

	if (!created) throw new Error('Failed to create ad package');

	return created as CampaignAdPackage;
}

export interface CreateAdGroupInput {
	ad_package_id: number;
	campaign_page_id?: number | null;
	name: string;
	intent_summary?: string;
	position?: number;
}

export async function createAdGroup(
	input: CreateAdGroupInput,
	dbClient: DrizzleClient = db
): Promise<CampaignAdGroupRecord> {
	const [created] = await dbClient
		.insert(campaign_ad_groups)
		.values({
			ad_package_id: input.ad_package_id,
			campaign_page_id: input.campaign_page_id ?? null,
			name: input.name,
			intent_summary: input.intent_summary ?? null,
			position: input.position ?? 0
		})
		.returning();

	if (!created) throw new Error('Failed to create ad group');

	return created as CampaignAdGroupRecord;
}

export interface CreateKeywordInput {
	ad_group_id: number;
	keyword_text: string;
	match_type: string;
	is_negative?: boolean;
	rationale?: string;
	position?: number;
}

export async function createKeyword(
	input: CreateKeywordInput,
	dbClient: DrizzleClient = db
): Promise<CampaignKeyword> {
	const [created] = await dbClient
		.insert(campaign_keywords)
		.values({
			ad_group_id: input.ad_group_id,
			keyword_text: input.keyword_text,
			match_type: input.match_type,
			is_negative: input.is_negative ?? false,
			rationale: input.rationale ?? null,
			position: input.position ?? 0
		})
		.returning();

	if (!created) throw new Error('Failed to create keyword');

	return created as CampaignKeyword;
}

export interface CreateCampaignAdInput {
	ad_group_id: number;
	ad_type?: string;
	headlines_json?: string[];
	descriptions_json?: string[];
	path_1?: string;
	path_2?: string;
}

export async function createCampaignAd(
	input: CreateCampaignAdInput,
	dbClient: DrizzleClient = db
): Promise<CampaignAd> {
	const [created] = await dbClient
		.insert(campaign_ads)
		.values({
			ad_group_id: input.ad_group_id,
			ad_type: input.ad_type ?? 'responsive_search_ad',
			headlines_json: input.headlines_json ?? [],
			descriptions_json: input.descriptions_json ?? [],
			path_1: input.path_1 ?? null,
			path_2: input.path_2 ?? null
		})
		.returning();

	if (!created) throw new Error('Failed to create ad copy');

	return created as CampaignAd;
}

export async function getCampaignAdPackages(campaignId: number): Promise<CampaignAdPackage[]> {
	const rows = await db
		.select()
		.from(campaign_ad_packages)
		.where(eq(campaign_ad_packages.campaign_id, campaignId))
		.orderBy(asc(campaign_ad_packages.version_number));

	return rows as CampaignAdPackage[];
}

export async function getCampaignAdPackageWithDetails(
	adPackageId: number
): Promise<CampaignAdPackageWithDetails | null> {
	const [adPackage] = await db
		.select()
		.from(campaign_ad_packages)
		.where(eq(campaign_ad_packages.id, adPackageId))
		.limit(1);

	if (!adPackage) return null;

	const groups = await db
		.select()
		.from(campaign_ad_groups)
		.where(eq(campaign_ad_groups.ad_package_id, adPackageId))
		.orderBy(asc(campaign_ad_groups.position));

	const groupsWithDetails: CampaignAdGroupWithDetails[] = await Promise.all(
		groups.map(async (group) => {
			const keywords = await db
				.select()
				.from(campaign_keywords)
				.where(eq(campaign_keywords.ad_group_id, group.id))
				.orderBy(asc(campaign_keywords.position));

			const ads = await db
				.select()
				.from(campaign_ads)
				.where(eq(campaign_ads.ad_group_id, group.id));

			return {
				...(group as CampaignAdGroupRecord),
				keywords: keywords as CampaignKeyword[],
				ads: ads as CampaignAd[]
			};
		})
	);

	return {
		...(adPackage as CampaignAdPackage),
		groups: groupsWithDetails
	};
}
