import type { LandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_ad_groups, campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js/session';
import { generateLandingPagePlan } from './landing-page-strategist';
import { loadLandingPageGenerationInput } from './landing-page-input';
import { generateLandingPageDocument } from './landing-page-writer';
import { createRunId, traceLlm } from '$lib/server/telemetry/llm-trace';

type DrizzleClient = typeof db | PostgresJsTransaction<any, any>;

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

	return slug.length > 0 ? slug : 'landing-page';
}

export async function persistGeneratedLandingPage(
	campaignId: number,
	page: LandingPageDocument,
	dbClient: DrizzleClient = db
): Promise<{ campaignPageId: number }> {
	const [latestVersion] = await dbClient
		.select({ versionNumber: campaign_pages.version_number })
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
	const baseSlug = slugify(page.slug ?? page.title);
	const slug = `${baseSlug}-c${campaignId}-v${nextVersionNumber}`;

	const [createdPage] = await dbClient
		.insert(campaign_pages)
		.values({
			campaign_id: campaignId,
			version_number: nextVersionNumber,
			structured_content_json: page,
			slug,
			is_published: false,
			published_at: null
		})
		.returning({ id: campaign_pages.id });

	if (!createdPage) {
		throw new Error(`Failed to persist generated landing page for campaign ${campaignId}`);
	}

	return { campaignPageId: createdPage.id };
}

export async function attachLandingPageToAdGroup(
	adGroupId: number,
	campaignPageId: number,
	dbClient: DrizzleClient = db
): Promise<void> {
	const updated = await dbClient
		.update(campaign_ad_groups)
		.set({ campaign_page_id: campaignPageId, updated_at: new Date() })
		.where(eq(campaign_ad_groups.id, adGroupId))
		.returning({ id: campaign_ad_groups.id });

	if (updated.length === 0) {
		throw new Error(`Failed to link ad group ${adGroupId} to campaign page ${campaignPageId}`);
	}
}

export async function runLandingPageGenerationForCampaign(
	campaignId: number
): Promise<{ campaignPageId: number }> {
	const runId = createRunId('landing_page');
	const traceContext = { runId, campaignId, pipeline: 'landing_page' };
	traceLlm('pipeline_start', traceContext);
	console.log(`Landing page pipeline: start campaign ${campaignId}`);
	const input = await loadLandingPageGenerationInput(campaignId);
	traceLlm('pipeline_step', traceContext, { step: 'input_normalized', input });
	console.log('Landing page pipeline: generation input normalized');

	const plan = await generateLandingPagePlan(input, traceContext);
	traceLlm('pipeline_step', traceContext, { step: 'plan_generated', plan });
	console.log('Landing page pipeline: plan generated');

	const pageDocument = await generateLandingPageDocument(input, plan, traceContext);
	traceLlm('pipeline_step', traceContext, { step: 'document_generated', pageDocument });
	console.log('Landing page pipeline: landing page document generated');

	const result = await db.transaction(async (tx) => {
		const persistedPage = await persistGeneratedLandingPage(campaignId, pageDocument, tx);
		await attachLandingPageToAdGroup(input.adGroup.id, persistedPage.campaignPageId, tx);

		return persistedPage;
	});

	traceLlm('pipeline_success', traceContext, { campaignPageId: result.campaignPageId });
	console.log(`Landing page pipeline: persisted page ${result.campaignPageId}`);
	return result;
}
