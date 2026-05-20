import type { LandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_ad_groups, campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js/session';
import { generateLandingPagePlan } from './landing-page-strategist';
import { loadLandingPageGenerationInput } from './landing-page-input';
import { generateLandingPageDocument } from './landing-page-writer';
import {
	createLandingMediaPlan,
	createLandingPageArchitecture,
	createLandingStrategy,
	validateLandingMediaPlan,
	validateLandingPageArchitecture,
	validateLandingStrategy,
	validateLandingCritique
} from './artifacts/landing-artifacts';
import { assembleLandingPageDocument } from './landing-page-assembler';
import { critiqueLandingPageDocument } from './landing-page-critic';
import { createRunId, traceLlm } from '$lib/server/telemetry/llm-trace';
import {
	completeGenerationJob,
	createGenerationJob,
	failGenerationJob,
	markGenerationJobStage
} from '$lib/server/generation-jobs';

type DrizzleClient = typeof db | PostgresJsTransaction<any, any>;

function isMissingChangeNoteColumnError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return message.includes('change_note') && message.includes('does not exist');
}

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
	dbClient: DrizzleClient = db,
	changeNote?: string
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

	let createdPage:
		| {
				id: number;
		  }
		| undefined;

	try {
		[createdPage] = await dbClient
			.insert(campaign_pages)
			.values({
				campaign_id: campaignId,
				version_number: nextVersionNumber,
				structured_content_json: page,
				change_note: changeNote?.trim() || null,
				slug,
				is_published: false,
				published_at: null
			})
			.returning({ id: campaign_pages.id });
	} catch (error) {
		if (!isMissingChangeNoteColumnError(error)) {
			throw error;
		}

		[createdPage] = await dbClient
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
	}

	if (!createdPage) {
		throw new Error(`Failed to persist generated landing page for campaign ${campaignId}`);
	}

	traceLlm(
		'publish_action',
		{ pipeline: 'landing_page', campaignId },
		{
			action: 'persist_generated_landing_page_version',
			campaignPageId: createdPage.id,
			versionNumber: nextVersionNumber,
			slug
		}
	);

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

	traceLlm(
		'ad_group_relink_action',
		{ pipeline: 'landing_page' },
		{
			action: 'attach_landing_page_to_ad_group',
			adGroupId,
			campaignPageId
		}
	);
}

export async function runLandingPageGenerationForCampaign(
	campaignId: number,
	options?: { jobId?: number; runId?: string }
): Promise<{ campaignPageId: number }> {
	const runId = options?.runId ?? createRunId('landing_page');
	const traceContext = { runId, campaignId, pipeline: 'landing_page' };
	const jobId =
		options?.jobId ??
		(
			await createGenerationJob({
				campaignId,
				runId,
				pipeline: 'landing_page',
				inputPayload: { campaignId }
			})
		).id;

	await markGenerationJobStage({
		jobId,
		stage: 'strategy',
		status: 'processing',
		message: 'Landing page generation started.'
	});

	traceLlm('pipeline_start', traceContext);
	console.log(`Landing page pipeline: start campaign ${campaignId}`);

	try {
		const input = await loadLandingPageGenerationInput(campaignId);
		traceLlm('pipeline_step', traceContext, { step: 'input_normalized', input });
		console.log('Landing page pipeline: generation input normalized');

		const plan = await generateLandingPagePlan(input, traceContext);
		traceLlm('pipeline_step', traceContext, { step: 'plan_generated', plan });
		console.log('Landing page pipeline: plan generated');
		await markGenerationJobStage({
			jobId,
			stage: 'strategy',
			status: 'processing',
			message: 'Strategy and plan generated.'
		});

		const strategy = validateLandingStrategy(createLandingStrategy(input, plan));
		traceLlm('artifact_strategy', traceContext, { strategy });

		const architecture = validateLandingPageArchitecture(createLandingPageArchitecture(plan));
		traceLlm('artifact_architecture', traceContext, { architecture });
		await markGenerationJobStage({
			jobId,
			stage: 'architecture',
			status: 'processing',
			message: 'Architecture artifact validated.'
		});

		const mediaPlan = validateLandingMediaPlan(createLandingMediaPlan(plan));
		traceLlm('artifact_media_plan', traceContext, { mediaPlan });
		await markGenerationJobStage({
			jobId,
			stage: 'media',
			status: 'processing',
			message: 'Media plan artifact validated.'
		});

		const pageDocument = await generateLandingPageDocument(input, plan, traceContext);
		traceLlm('pipeline_step', traceContext, { step: 'document_generated', pageDocument });
		console.log('Landing page pipeline: landing page document generated');
		await markGenerationJobStage({
			jobId,
			stage: 'content',
			status: 'processing',
			message: 'Content document generated.'
		});

		const assembledPageDocument = assembleLandingPageDocument(pageDocument);
		traceLlm('pipeline_step', traceContext, {
			step: 'document_assembled',
			pageDocument: assembledPageDocument
		});
		await markGenerationJobStage({
			jobId,
			stage: 'assembly',
			status: 'processing',
			message: 'Document assembled deterministically.'
		});

		const critique = validateLandingCritique(
			critiqueLandingPageDocument(assembledPageDocument, architecture)
		);
		traceLlm('artifact_critique', traceContext, { critique });
		await markGenerationJobStage({
			jobId,
			stage: 'critique',
			status: 'processing',
			message: 'Critique artifact validated.'
		});

		const result = await db.transaction(async (tx) => {
			const persistedPage = await persistGeneratedLandingPage(
				campaignId,
				assembledPageDocument,
				tx,
				'Initial generation'
			);
			await attachLandingPageToAdGroup(input.adGroup.id, persistedPage.campaignPageId, tx);

			return persistedPage;
		});

		await markGenerationJobStage({
			jobId,
			stage: 'assembly',
			status: 'completed',
			message: `Landing page persisted as version ${result.campaignPageId}.`,
			level: 'success',
			meta: { campaignPageId: result.campaignPageId }
		});
		await completeGenerationJob({
			jobId,
			outputPayload: {
				artifacts: { strategy, architecture, mediaPlan, critique },
				campaignPageId: result.campaignPageId
			}
		});

		traceLlm('pipeline_success', traceContext, { campaignPageId: result.campaignPageId });
		console.log(`Landing page pipeline: persisted page ${result.campaignPageId}`);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await failGenerationJob({
			jobId,
			errorMessage: message,
			stage: 'assembly'
		});
		throw error;
	}
}
