import { db } from '$lib/server/db';
import { campaign_pages, campaigns, campaign_visit_metrics, profiles } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import {
	campaignVisitMetricsSchema,
	type CampaignVisitMetrics
} from '$lib/validation/campaign-visit-metrics';
import type {
	CampaignAd,
	CampaignAdGroupRecord,
	CampaignAdGroupWithDetails,
	CampaignAdPackage,
	CampaignAdPackageWithDetails,
	CampaignKeyword
} from './ads';
import {
	createAdGroup,
	createAdPackage,
	createCampaignAd,
	createKeyword,
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages
} from './ads';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';

export type CampaignStatus = 'draft' | 'published' | 'generated' | 'scheduled' | 'archived';

export interface CampaignRecord {
	id: number;
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string | null;
	status: CampaignStatus | string;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
	created_by_display_name?: string | null;
}

export interface CampaignRecordWithMetrics extends CampaignRecord {
	visitCount: number;
	uniqueVisitorCount: number;
	lastVisitedAt: Date | null;
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
	return await db.select().from(campaigns).orderBy(desc(campaigns.created_at));
}

function normalizeVisitMetrics(input: {
	campaignId: number | null;
	fallbackCampaignId: number;
	visitCount: number | null;
	uniqueVisitorCount: number | null;
	lastVisitedAt: Date | null;
}): CampaignVisitMetrics {
	return campaignVisitMetricsSchema.parse({
		campaignId: input.campaignId ?? input.fallbackCampaignId,
		visitCount: input.visitCount ?? 0,
		uniqueVisitorCount: input.uniqueVisitorCount ?? 0,
		lastVisitedAt: input.lastVisitedAt ?? null
	});
}

export async function listCampaignsWithMetrics(): Promise<CampaignRecordWithMetrics[]> {
	const rows = await db
		.select({
			id: campaigns.id,
			name: campaigns.name,
			audience: campaigns.audience,
			format: campaigns.format,
			topic: campaigns.topic,
			language: campaigns.language,
			geography: campaigns.geography,
			notes: campaigns.notes,
			status: campaigns.status,
			created_at: campaigns.created_at,
			updated_at: campaigns.updated_at,
			created_by: campaigns.created_by,
			created_by_display_name: profiles.display_name,
			campaignId: campaign_visit_metrics.campaign_id,
			visitCount: campaign_visit_metrics.visit_count,
			uniqueVisitorCount: campaign_visit_metrics.unique_visitor_count,
			lastVisitedAt: campaign_visit_metrics.last_visited_at
		})
		.from(campaigns)
		.leftJoin(profiles, sql`${campaigns.created_by} = ${profiles.id}::text`)
		.leftJoin(campaign_visit_metrics, eq(campaign_visit_metrics.campaign_id, campaigns.id))
		.orderBy(desc(campaigns.created_at));

	return rows.map((row) => {
		const metrics = normalizeVisitMetrics({
			campaignId: row.campaignId,
			fallbackCampaignId: row.id,
			visitCount: row.visitCount,
			uniqueVisitorCount: row.uniqueVisitorCount,
			lastVisitedAt: row.lastVisitedAt
		});

		return {
			id: row.id,
			name: row.name,
			audience: row.audience,
			format: row.format,
			topic: row.topic,
			language: row.language,
			geography: row.geography,
			notes: row.notes,
			status: row.status,
			created_at: row.created_at,
			updated_at: row.updated_at,
			created_by: row.created_by,
			created_by_display_name: row.created_by_display_name,
			visitCount: metrics.visitCount,
			uniqueVisitorCount: metrics.uniqueVisitorCount,
			lastVisitedAt: metrics.lastVisitedAt
		};
	});
}

export async function getCampaignById(id: number): Promise<CampaignRecord | null> {
	const [record] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
	return (record as CampaignRecord) ?? null;
}

export async function getCampaignVisitMetricsByCampaignId(
	campaignId: number
): Promise<CampaignVisitMetrics> {
	const [row] = await db
		.select({
			campaignId: campaign_visit_metrics.campaign_id,
			visitCount: campaign_visit_metrics.visit_count,
			uniqueVisitorCount: campaign_visit_metrics.unique_visitor_count,
			lastVisitedAt: campaign_visit_metrics.last_visited_at
		})
		.from(campaign_visit_metrics)
		.where(eq(campaign_visit_metrics.campaign_id, campaignId))
		.limit(1);

	if (!row) {
		return campaignVisitMetricsSchema.parse({
			campaignId,
			visitCount: 0,
			uniqueVisitorCount: 0,
			lastVisitedAt: null
		});
	}

	return normalizeVisitMetrics({ ...row, fallbackCampaignId: campaignId });
}

export async function createCampaign(input: {
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string | null;
	created_by: string | null;
}): Promise<CampaignRecord> {
	const [created] = await db
		.insert(campaigns)
		.values({
			name: input.name,
			audience: input.audience,
			format: input.format,
			topic: input.topic,
			language: input.language,
			geography: input.geography,
			notes: input.notes,
			status: 'draft',
			created_by: input.created_by
		})
		.returning();

	if (!created) {
		throw new Error('Failed to create campaign');
	}

	return created as CampaignRecord;
}

export {
	createAdPackage,
	createAdGroup,
	createKeyword,
	createCampaignAd,
	getCampaignAdPackages,
	getCampaignAdPackageWithDetails
};

export type {
	CampaignAdPackage,
	CampaignAdPackageWithDetails,
	CampaignAdGroupRecord,
	CampaignAdGroupWithDetails,
	CampaignAd,
	CampaignKeyword
};
export async function setCampaignStatus(id: number, status: string): Promise<void> {
	await db.update(campaigns).set({ status, updated_at: new Date() }).where(eq(campaigns.id, id));
}

export async function duplicateCampaign(input: {
	sourceCampaignId: number;
	name: string;
	createdBy: string | null;
}): Promise<{ campaignId: number }> {
	const sourceCampaign = await getCampaignById(input.sourceCampaignId);
	if (!sourceCampaign) {
		throw new Error('Source campaign not found.');
	}

	const nextName = input.name.trim();
	if (!nextName.length) {
		throw new Error('Campaign name is required for duplication.');
	}

	const [latestCampaignPage] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			versionNumber: campaign_pages.version_number
		})
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, input.sourceCampaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	const adPackages = await getCampaignAdPackages(input.sourceCampaignId);
	const latestAdPackage = adPackages.at(-1);
	const latestAdPackageWithDetails = latestAdPackage
		? await getCampaignAdPackageWithDetails(latestAdPackage.id)
		: null;

	return db.transaction(async (tx) => {
		const [createdCampaign] = await tx
			.insert(campaigns)
			.values({
				name: nextName,
				audience: sourceCampaign.audience,
				format: sourceCampaign.format,
				topic: sourceCampaign.topic,
				language: sourceCampaign.language,
				geography: sourceCampaign.geography,
				notes: sourceCampaign.notes,
				status: 'draft',
				created_by: input.createdBy
			})
			.returning({ id: campaigns.id });

		if (!createdCampaign) {
			throw new Error('Failed to duplicate campaign metadata.');
		}

		let duplicatedCampaignPageId: number | null = null;
		if (latestCampaignPage) {
			const parsedLandingPage = parseLandingPageDocument(latestCampaignPage.structuredContentJson);
			const duplicatedLandingPage = await persistGeneratedLandingPage(
				createdCampaign.id,
				parsedLandingPage,
				tx,
				`Duplicated from campaign ${input.sourceCampaignId}`
			);
			duplicatedCampaignPageId = duplicatedLandingPage.campaignPageId;
		}

		if (latestAdPackageWithDetails) {
			const createdAdPackage = await createAdPackage(
				{
					campaign_id: createdCampaign.id,
					version_number: 1,
					channel: latestAdPackageWithDetails.channel,
					status: 'draft',
					strategy_json: latestAdPackageWithDetails.strategy_json
				},
				tx
			);

			for (const group of latestAdPackageWithDetails.groups) {
				const createdGroup = await createAdGroup(
					{
						ad_package_id: createdAdPackage.id,
						campaign_page_id: duplicatedCampaignPageId,
						name: group.name,
						intent_summary: group.intent_summary ?? undefined,
						position: group.position
					},
					tx
				);

				for (const keyword of group.keywords) {
					await createKeyword(
						{
							ad_group_id: createdGroup.id,
							keyword_text: keyword.keyword_text,
							match_type: keyword.match_type,
							is_negative: keyword.is_negative,
							rationale: keyword.rationale ?? undefined,
							position: keyword.position
						},
						tx
					);
				}

				for (const ad of group.ads) {
					await createCampaignAd(
						{
							ad_group_id: createdGroup.id,
							ad_type: ad.ad_type,
							headlines_json: ad.headlines_json,
							descriptions_json: ad.descriptions_json,
							path_1: ad.path_1 ?? undefined,
							path_2: ad.path_2 ?? undefined
						},
						tx
					);
				}
			}
		}

		return { campaignId: createdCampaign.id };
	});
}
