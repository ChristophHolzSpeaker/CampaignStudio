import {
	landingPageDocumentSchema,
	parseLandingPageDocument,
	type LandingPageDocument
} from '$lib/page-builder/page';
import { pageSectionTypes } from '$lib/page-builder/sections';
import { callOpenRouter } from '$lib/server/openrouter/client';
import { db } from '$lib/server/db';
import {
	campaign_ad_groups,
	campaign_ad_packages,
	campaign_pages,
	campaigns
} from '$lib/server/db/schema';
import { createRunId, traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import { and, desc, eq } from 'drizzle-orm';
import type { ZodIssue } from 'zod';
import { loadLandingPageAssets } from './config/landing-page-assets-store';
import { persistGeneratedLandingPage } from './landing-page-pipeline';

const requiredSectionTypes = ['seo', 'compliance_transparency_footer'] as const;

function buildEditorSystemPrompt(): string {
	return `You are a strict JSON editor for Campaign Studio landing page documents.

You must update an existing landing page JSON document according to an edit request.

Rules:
- Return JSON only. No markdown, no commentary.
- Keep changes surgical and minimal relative to the request.
- Preserve schema validity at all times.
- Keep section props compatible with each section type contract.
- Keep exactly one seo section and it must stay first.
- Keep exactly one compliance_transparency_footer section.
- Do not use unknown section types.
- If media changes are requested, only use approved media URLs from the provided asset catalog.
- Do not invent media URLs, IDs, testimonials, or logos.

The output must be a valid landing page document object with this shape:
{
  "version": 1,
  "title": "string",
  "slug": "string (optional)",
  "sections": [
    {
      "type": "section_type",
      "props": { ... }
    }
  ]
}`;
}

function buildEditorUserPrompt(
	currentPage: LandingPageDocument,
	changePrompt: string,
	approvedHeroMedia: Array<{ id: string; videoEmbedUrl: string; videoThumbnailUrl: string }>,
	approvedHybridImages: Array<{ id: string; imageUrl: string }>
): string {
	return `Apply this request to the landing page JSON.

Request:
${changePrompt}

Current landing page JSON:
${JSON.stringify(currentPage, null, 2)}

Approved hero media options:
${JSON.stringify(approvedHeroMedia, null, 2)}

Approved hybrid supporting images:
${JSON.stringify(approvedHybridImages, null, 2)}

Return one valid updated landing page JSON object only.`;
}

function buildRepairPrompt(
	currentPage: LandingPageDocument,
	changePrompt: string,
	invalidResponse: unknown,
	issues: ZodIssue[],
	approvedHeroMedia: Array<{ id: string; videoEmbedUrl: string; videoThumbnailUrl: string }>,
	approvedHybridImages: Array<{ id: string; imageUrl: string }>
): string {
	return `Your previous JSON failed validation. Return a corrected JSON object only.

Request:
${changePrompt}

Current landing page JSON:
${JSON.stringify(currentPage, null, 2)}

Approved hero media options:
${JSON.stringify(approvedHeroMedia, null, 2)}

Approved hybrid supporting images:
${JSON.stringify(approvedHybridImages, null, 2)}

Previous invalid response:
${JSON.stringify(invalidResponse, null, 2)}

Validation issues:
${JSON.stringify(issues, null, 2)}

Return corrected JSON only.`;
}

function validateEditedPageGuardrails(
	input: LandingPageDocument,
	currentPage: LandingPageDocument,
	heroMedia: Array<{ videoEmbedUrl: string; videoThumbnailUrl: string }>,
	hybridImages: Array<{ imageUrl: string }>
): LandingPageDocument {
	const parsed = landingPageDocumentSchema.parse(input);

	if (parsed.sections[0]?.type !== 'seo') {
		throw new Error('Edited page must keep seo as the first section.');
	}

	for (const section of parsed.sections) {
		if (!pageSectionTypes.includes(section.type)) {
			throw new Error(`Edited page contains unsupported section type: ${section.type}`);
		}
	}

	for (const requiredType of requiredSectionTypes) {
		const count = parsed.sections.filter((section) => section.type === requiredType).length;
		if (count !== 1) {
			throw new Error(`Edited page must contain exactly one ${requiredType} section.`);
		}
	}

	const allowedHeroEmbedUrls = new Set(heroMedia.map((asset) => asset.videoEmbedUrl));
	const allowedHeroThumbnailUrls = new Set(heroMedia.map((asset) => asset.videoThumbnailUrl));
	for (const section of currentPage.sections) {
		if (section.type === 'immediate_authority_hero') {
			allowedHeroEmbedUrls.add(section.props.videoEmbedUrl);
			allowedHeroThumbnailUrls.add(section.props.videoThumbnailUrl);
		}
	}

	for (const section of parsed.sections) {
		if (section.type !== 'immediate_authority_hero') {
			continue;
		}

		if (!allowedHeroEmbedUrls.has(section.props.videoEmbedUrl)) {
			throw new Error('Edited page hero videoEmbedUrl is not in approved media assets.');
		}

		if (!allowedHeroThumbnailUrls.has(section.props.videoThumbnailUrl)) {
			throw new Error('Edited page hero videoThumbnailUrl is not in approved media assets.');
		}
	}

	const allowedHybridImageUrls = new Set(hybridImages.map((asset) => asset.imageUrl));
	for (const section of currentPage.sections) {
		if (section.type !== 'hybrid_content_section') {
			continue;
		}

		for (const item of section.props.supportingVisualItems ?? []) {
			allowedHybridImageUrls.add(item.imageUrl);
		}

		for (const item of section.props.benefits ?? []) {
			allowedHybridImageUrls.add(item.imageUrl);
		}
	}

	for (const section of parsed.sections) {
		if (section.type !== 'hybrid_content_section') {
			continue;
		}

		for (const item of section.props.supportingVisualItems ?? []) {
			if (!allowedHybridImageUrls.has(item.imageUrl)) {
				throw new Error('Edited page hybrid supporting image is not in approved media assets.');
			}
		}

		for (const item of section.props.benefits ?? []) {
			if (!allowedHybridImageUrls.has(item.imageUrl)) {
				throw new Error('Edited page hybrid benefit image is not in approved media assets.');
			}
		}
	}

	return parsed;
}

async function generateEditedLandingPageDocument(
	currentPage: LandingPageDocument,
	changePrompt: string,
	traceContext: LlmTraceContext = {}
): Promise<LandingPageDocument> {
	const assets = await loadLandingPageAssets();
	const approvedHeroMedia = assets.assetCatalog.heroVideos.map((asset) => ({
		id: asset.id,
		videoEmbedUrl: asset.videoEmbedUrl,
		videoThumbnailUrl: asset.videoThumbnailUrl
	}));
	const approvedHybridImages = assets.assetCatalog.hybridSupportingImages.map((asset) => ({
		id: asset.id,
		imageUrl: asset.imageUrl
	}));

	const userPrompt = buildEditorUserPrompt(
		currentPage,
		changePrompt,
		approvedHeroMedia,
		approvedHybridImages
	);

	let response;
	try {
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'landing_page_editor' },
			{
				model: 'google/gemini-3.1-flash-lite-preview'
			}
		);
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: buildEditorSystemPrompt(),
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_editor' }
		});
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_editor' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'landing_page_editor' }, { message });
		throw new Error(`Landing page editor failed: ${message}`);
	}

	const parsed = landingPageDocumentSchema.safeParse(response);
	if (!parsed.success) {
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_editor' },
			{
				issues: parsed.error.issues
			}
		);

		let repairedResponse;
		try {
			repairedResponse = await callOpenRouter({
				model: 'google/gemini-3.1-flash-lite-preview',
				systemPrompt: buildEditorSystemPrompt(),
				userPrompt: buildRepairPrompt(
					currentPage,
					changePrompt,
					response,
					parsed.error.issues,
					approvedHeroMedia,
					approvedHybridImages
				),
				responseFormat: 'json_object',
				traceContext: { ...traceContext, stage: 'landing_page_editor_repair' }
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			traceLlm(
				'agent_stage_error',
				{ ...traceContext, stage: 'landing_page_editor_repair' },
				{ message }
			);
			throw new Error(`Landing page editor repair failed: ${message}`);
		}

		const repairedParsed = landingPageDocumentSchema.safeParse(repairedResponse);
		if (!repairedParsed.success) {
			traceLlm(
				'agent_stage_validation_error',
				{ ...traceContext, stage: 'landing_page_editor_repair' },
				{ issues: repairedParsed.error.issues }
			);
			throw new Error(`Invalid edited landing page JSON: ${repairedParsed.error.message}`);
		}

		return validateEditedPageGuardrails(
			repairedParsed.data,
			currentPage,
			approvedHeroMedia,
			approvedHybridImages
		);
	}

	return validateEditedPageGuardrails(
		parsed.data,
		currentPage,
		approvedHeroMedia,
		approvedHybridImages
	);
}

export async function runLandingPageEditFromPrompt(
	campaignPageId: number,
	changePrompt: string
): Promise<{ campaignId: number; campaignPageId: number }> {
	const runId = createRunId('landing_page_edit');
	const traceContext = { runId, campaignPageId, pipeline: 'landing_page_edit' };
	traceLlm('pipeline_start', traceContext, { changePrompt });

	const [pageRecord] = await db
		.select({
			campaignId: campaign_pages.campaign_id,
			structuredContentJson: campaign_pages.structured_content_json,
			campaignStatus: campaigns.status
		})
		.from(campaign_pages)
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(eq(campaign_pages.id, campaignPageId))
		.limit(1);

	if (!pageRecord) {
		throw new Error(`Campaign page ${campaignPageId} not found.`);
	}

	if (pageRecord.campaignStatus === 'published') {
		throw new Error('Cannot edit landing page while campaign is published. Unpublish first.');
	}

	const currentPage = parseLandingPageDocument(pageRecord.structuredContentJson);
	const editedPage = await generateEditedLandingPageDocument(
		currentPage,
		changePrompt,
		traceContext
	);

	const createdPage = await db.transaction(async (tx) => {
		const persisted = await persistGeneratedLandingPage(pageRecord.campaignId, editedPage, tx);
		const [latestAdPackage] = await tx
			.select({ id: campaign_ad_packages.id })
			.from(campaign_ad_packages)
			.where(eq(campaign_ad_packages.campaign_id, pageRecord.campaignId))
			.orderBy(desc(campaign_ad_packages.version_number))
			.limit(1);

		if (latestAdPackage) {
			await tx
				.update(campaign_ad_groups)
				.set({ campaign_page_id: persisted.campaignPageId, updated_at: new Date() })
				.where(
					and(
						eq(campaign_ad_groups.campaign_page_id, campaignPageId),
						eq(campaign_ad_groups.ad_package_id, latestAdPackage.id)
					)
				);
		}

		return persisted;
	});

	traceLlm('pipeline_success', traceContext, {
		campaignId: pageRecord.campaignId,
		campaignPageId: createdPage.campaignPageId
	});

	return {
		campaignId: pageRecord.campaignId,
		campaignPageId: createdPage.campaignPageId
	};
}
