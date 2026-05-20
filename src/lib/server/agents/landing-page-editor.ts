import {
	landingPageDocumentSchema,
	parseLandingPageDocument,
	type LandingPageDocument
} from '$lib/page-builder/page';
import { pageSectionTypes, type PageSection } from '$lib/page-builder/sections';
import { callOpenRouter } from '$lib/server/openrouter/client';
import { db } from '$lib/server/db';
import {
	campaign_ad_groups,
	campaign_ad_packages,
	campaign_pages,
	campaigns,
	media_assets
} from '$lib/server/db/schema';
import { createRunId, traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { ZodIssue } from 'zod';
import { loadLandingPageAssets } from './config/landing-page-assets-store';
import { landingPageOperationsEnvelopeSchema } from './landing-page-operations';
import { applyLandingPageOperations } from './landing-page-patch-executor';
import { persistGeneratedLandingPage } from './landing-page-pipeline';
import { resolveEditorRequiredSectionTypes, resolvePageCapabilities } from './section-definitions';
import type { LandingPageOperation } from './landing-page-operations';

export type LandingPageEditPreview = {
	baseCampaignPageId: number;
	changePrompt: string;
	editedPage: LandingPageDocument;
	operationTypes: string[];
	changeSummary: {
		impactedSections: string[];
		contentChanges: string[];
		layoutChanges: string[];
		mediaChanges: string[];
		reorderedSections: string[];
		fieldDiffs: Array<{
			sectionType: string;
			field: string;
			before: string;
			after: string;
		}>;
	};
};

const sectionContractGuidance = `Valid section type names and required props (exact keys):
- immediate_authority_hero: headline, subheadline, primaryCtaLabel, videoEmbedUrl, heroImageUrl, heroImageAlt, videoThumbnailUrl, videoThumbnailAlt
- hero_large_email_cta: heading, labelText
- booklet_download_cta: labelText, heading, paragraph, buttonCtaText
- hybrid_content_section: title, intro, benefits, deepDiveTitle, deepDiveItems, primaryVisual, emailCtaTitle, layout

Common invalid aliases to NEVER use:
- booklet_cta_section -> use booklet_download_cta
- hero_email_capture or hero_email_capture_large -> use hero_large_email_cta

Hybrid image change rules:
- For hybrid primary image swaps, target field primaryVisual.imageUrl via replace_media.
- Keep primaryVisual.alt and primaryVisual.caption intact unless explicitly requested.`;

function promptWantsBookletSection(changePrompt: string): boolean {
	const normalized = changePrompt.toLowerCase();
	return normalized.includes('booklet');
}

function promptWantsLargeEmailHero(changePrompt: string): boolean {
	const normalized = changePrompt.toLowerCase();
	return normalized.includes('email') && normalized.includes('hero');
}

function buildEditorSystemPrompt(): string {
	return `You are a strict JSON editor for Campaign Studio landing page documents.

You must convert an edit request into deterministic edit operations.

Rules:
- Return JSON only. No markdown, no commentary.
- Keep changes surgical and minimal relative to the request.
- Use operation types only: update_section_content, update_section_layout, replace_media, reorder_section.
- Do not invent operation types or fields.
- sectionType values must match existing section types from current landing page.
- For update_section_content, always provide contentPatch as an object.
- For update_section_layout, always provide layoutPatch as an object.
- For hero orientation requests, use update_section_layout with layoutPatch.layout set to "left" or "right".
- Do not use orientation or imagePosition keys for hero orientation.
- If media changes are requested, only use approved media URLs from the provided asset catalog.
- For youtube_grid, only use video URLs from approved media assets entries marked for youtube_grid.
- Do not invent media URLs, IDs, testimonials, or logos.
- Preferred command mappings:
  - "move image left/right" -> update_section_layout on immediate_authority_hero with layoutPatch.layout = "left"|"right"
  - "make the hero more compact/spacious" -> update_section_layout on immediate_authority_hero with layoutPatch.density = "compact"|"spacious"
  - "make this more executive" -> update_section_content with concise tone adjustments
  - "shorten this section" -> update_section_content with reduced copy length

${sectionContractGuidance}

The output must be a valid JSON object with this shape:
{
  "operations": [
    {
      "type": "update_section_content | update_section_layout | replace_media | reorder_section",
      "sectionType": "string"
    }
  ]
}

Valid examples:
- { "operations": [{ "type": "update_section_content", "sectionType": "booklet_download_cta", "contentPatch": { "paragraph": "New paragraph" } }] }
- { "operations": [{ "type": "update_section_layout", "sectionType": "immediate_authority_hero", "layoutPatch": { "layout": "right" } }] }
- { "operations": [{ "type": "replace_media", "sectionType": "immediate_authority_hero", "field": "heroImageUrl", "value": "https://..." }] }
- { "operations": [{ "type": "reorder_section", "sectionType": "proof_of_performance", "moveAfterSectionType": "frictionless_funnel_booking" }] }`;
}

function tryBuildDeterministicOperations(
	currentPage: LandingPageDocument,
	changePrompt: string
): LandingPageOperation[] | null {
	const normalized = changePrompt.toLowerCase();
	const hasHero = currentPage.sections.some(
		(section) => section.type === 'immediate_authority_hero'
	);
	if (!hasHero) {
		return null;
	}

	if ((normalized.includes('move') || normalized.includes('put')) && normalized.includes('image')) {
		if (normalized.includes('left')) {
			return [
				{
					type: 'update_section_layout',
					sectionType: 'immediate_authority_hero',
					layoutPatch: { layout: 'left' }
				}
			];
		}

		if (normalized.includes('right')) {
			return [
				{
					type: 'update_section_layout',
					sectionType: 'immediate_authority_hero',
					layoutPatch: { layout: 'right' }
				}
			];
		}
	}

	if (normalized.includes('hero') && normalized.includes('compact')) {
		return [
			{
				type: 'update_section_layout',
				sectionType: 'immediate_authority_hero',
				layoutPatch: { density: 'compact' }
			}
		];
	}

	if (normalized.includes('hero') && normalized.includes('spacious')) {
		return [
			{
				type: 'update_section_layout',
				sectionType: 'immediate_authority_hero',
				layoutPatch: { density: 'spacious' }
			}
		];
	}

	return null;
}

function operationsTouchYoutubeGrid(operations: Array<{ sectionType: string }>): boolean {
	return operations.some((operation) => operation.sectionType === 'youtube_grid');
}

async function loadApprovedYoutubeGridVideosFromMediaAssets(): Promise<
	Array<{ id: string; title: string; videoEmbedUrl: string }>
> {
	const rows = await db
		.select({
			id: media_assets.id,
			title: media_assets.title,
			primaryUrl: media_assets.primary_url,
			sectionTypes: media_assets.section_types
		})
		.from(media_assets)
		.where(and(eq(media_assets.is_active, true), eq(media_assets.kind, 'video')))
		.orderBy(asc(media_assets.priority), asc(media_assets.id));

	return rows
		.filter((row) => row.sectionTypes.includes('youtube_grid'))
		.map((row) => ({
			id: row.id,
			title: row.title,
			videoEmbedUrl: row.primaryUrl
		}));
}

function normalizeOperationsResponse(input: unknown): unknown {
	if (typeof input !== 'object' || input === null) {
		return input;
	}

	const candidate = input as { operations?: unknown };
	if (!Array.isArray(candidate.operations)) {
		return input;
	}

	const operations = candidate.operations.map((operation) => {
		if (typeof operation !== 'object' || operation === null) {
			return operation;
		}

		const record = { ...(operation as Record<string, unknown>) };
		const operationType = typeof record.type === 'string' ? record.type : null;
		const sectionType = typeof record.sectionType === 'string' ? record.sectionType : null;

		if (operationType === 'update_section_content') {
			if (record.contentPatch === undefined) {
				if (typeof record.field === 'string' && 'value' in record) {
					record.contentPatch = { [record.field]: record.value };
				} else {
					record.contentPatch = {};
				}
			}
		}

		if (operationType === 'update_section_layout') {
			if (record.layoutPatch === undefined) {
				if (typeof record.field === 'string' && 'value' in record) {
					record.layoutPatch = { [record.field]: record.value };
				} else {
					record.layoutPatch = {};
				}
			}

			if (typeof record.layoutPatch === 'object' && record.layoutPatch !== null) {
				const layoutPatch = { ...(record.layoutPatch as Record<string, unknown>) };
				if (typeof layoutPatch.orientation === 'string' && layoutPatch.layout === undefined) {
					layoutPatch.layout = layoutPatch.orientation;
					delete layoutPatch.orientation;
				}
				if (typeof layoutPatch.imagePosition === 'string' && layoutPatch.layout === undefined) {
					layoutPatch.layout = layoutPatch.imagePosition;
					delete layoutPatch.imagePosition;
				}
				record.layoutPatch = layoutPatch;
			}
		}

		if (operationType === 'replace_media') {
			if (
				sectionType === 'hybrid_content_section' &&
				typeof record.field === 'string' &&
				record.field === 'imageUrl'
			) {
				record.field = 'primaryVisual.imageUrl';
			}
		}

		return record;
	});

	return {
		...input,
		operations
	};
}

function buildEditorUserPrompt(
	currentPage: LandingPageDocument,
	changePrompt: string,
	approvedHeroMedia: Array<{
		id: string;
		videoEmbedUrl: string;
		videoThumbnailUrl: string;
		heroImageUrl: string;
	}>,
	approvedHybridImages: Array<{ id: string; imageUrl: string }>,
	approvedYoutubeVideos: Array<{ id: string; title: string; videoEmbedUrl: string }>
): string {
	return `Apply this request to the landing page JSON using operations.

Request:
${changePrompt}

Current landing page JSON:
${JSON.stringify(currentPage, null, 2)}

Approved hero media options:
${JSON.stringify(approvedHeroMedia, null, 2)}

Approved hybrid supporting images:
${JSON.stringify(approvedHybridImages, null, 2)}

Approved youtube_grid video options (use only these URLs for youtube_grid videos):
${JSON.stringify(approvedYoutubeVideos, null, 2)}

${sectionContractGuidance}

Return one valid operations JSON object only.`;
}

function buildRepairPrompt(
	currentPage: LandingPageDocument,
	changePrompt: string,
	invalidResponse: unknown,
	issues: ZodIssue[],
	approvedHeroMedia: Array<{
		id: string;
		videoEmbedUrl: string;
		videoThumbnailUrl: string;
		heroImageUrl: string;
	}>,
	approvedHybridImages: Array<{ id: string; imageUrl: string }>,
	approvedYoutubeVideos: Array<{ id: string; title: string; videoEmbedUrl: string }>
): string {
	const mustIncludeBooklet = promptWantsBookletSection(changePrompt)
		? '- Because the request asks for booklet content, output must include exactly one section with type booklet_download_cta.'
		: '';
	const mustIncludeEmailHero = promptWantsLargeEmailHero(changePrompt)
		? '- Because the request asks for an email-focused hero, output must include exactly one section with type hero_large_email_cta.'
		: '';

	return `Your previous JSON failed validation. Return corrected operations JSON only.

Request:
${changePrompt}

Current landing page JSON:
${JSON.stringify(currentPage, null, 2)}

Approved hero media options:
${JSON.stringify(approvedHeroMedia, null, 2)}

Approved hybrid supporting images:
${JSON.stringify(approvedHybridImages, null, 2)}

Approved youtube_grid video options (use only these URLs for youtube_grid videos):
${JSON.stringify(approvedYoutubeVideos, null, 2)}

Previous invalid response:
${JSON.stringify(invalidResponse, null, 2)}

Validation issues:
${JSON.stringify(issues, null, 2)}

${sectionContractGuidance}
${mustIncludeBooklet}
${mustIncludeEmailHero}

Return corrected operations JSON only.`;
}

function validateEditedPageGuardrails(
	input: LandingPageDocument,
	currentPage: LandingPageDocument,
	heroMedia: Array<{ videoEmbedUrl: string; videoThumbnailUrl: string; heroImageUrl: string }>,
	hybridImages: Array<{ imageUrl: string }>,
	approvedYoutubeVideoUrls: string[],
	enforceYoutubeGridCatalog: boolean
): LandingPageDocument {
	const parsed = landingPageDocumentSchema.parse(input);
	const requiredSectionTypes = resolveEditorRequiredSectionTypes();

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

	const capabilityResolution = resolvePageCapabilities(parsed);
	if (capabilityResolution.missingRequiredCapabilities.length > 0) {
		throw new Error(
			`Edited page is missing required capabilities: ${capabilityResolution.missingRequiredCapabilities.join(', ')}`
		);
	}

	const allowedHeroEmbedUrls = new Set(heroMedia.map((asset) => asset.videoEmbedUrl));
	const allowedHeroThumbnailUrls = new Set(heroMedia.map((asset) => asset.videoThumbnailUrl));
	const allowedHeroImageUrls = new Set(heroMedia.map((asset) => asset.heroImageUrl));
	for (const section of currentPage.sections) {
		if (section.type === 'immediate_authority_hero') {
			allowedHeroEmbedUrls.add(section.props.videoEmbedUrl);
			allowedHeroThumbnailUrls.add(section.props.videoThumbnailUrl);
			if (section.props.heroImageUrl) {
				allowedHeroImageUrls.add(section.props.heroImageUrl);
			}
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

		if (!section.props.heroImageUrl || !allowedHeroImageUrls.has(section.props.heroImageUrl)) {
			throw new Error('Edited page hero heroImageUrl is not in approved media assets.');
		}
	}

	const allowedHybridImageUrls = new Set(hybridImages.map((asset) => asset.imageUrl));
	for (const section of currentPage.sections) {
		if (section.type !== 'hybrid_content_section') {
			continue;
		}
		const legacySupportingVisualItems = (
			section.props as { supportingVisualItems?: { imageUrl: string }[] }
		).supportingVisualItems;

		if (section.props.primaryVisual?.imageUrl) {
			allowedHybridImageUrls.add(section.props.primaryVisual.imageUrl);
		}

		for (const item of legacySupportingVisualItems ?? []) {
			allowedHybridImageUrls.add(item.imageUrl);
		}

		for (const item of section.props.benefits ?? []) {
			allowedHybridImageUrls.add(item.imageUrl);
		}
	}

	for (const section of parsed.sections) {
		if (enforceYoutubeGridCatalog && section.type === 'youtube_grid') {
			if (approvedYoutubeVideoUrls.length === 0) {
				throw new Error(
					'Edited page youtube_grid cannot be validated because no approved youtube_grid media assets are configured.'
				);
			}

			const allowedYoutubeUrls = new Set(approvedYoutubeVideoUrls);
			for (const video of section.props.videos) {
				if (!allowedYoutubeUrls.has(video.url)) {
					throw new Error(
						'Edited page youtube_grid video URL is not in approved media assets for youtube_grid.'
					);
				}
			}
		}

		if (section.type !== 'hybrid_content_section') {
			continue;
		}
		const legacySupportingVisualItems = (
			section.props as { supportingVisualItems?: { imageUrl: string }[] }
		).supportingVisualItems;

		if (
			section.props.primaryVisual?.imageUrl &&
			!allowedHybridImageUrls.has(section.props.primaryVisual.imageUrl)
		) {
			throw new Error('Edited page hybrid primary image is not in approved media assets.');
		}

		for (const item of legacySupportingVisualItems ?? []) {
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
): Promise<{ page: LandingPageDocument; operationTypes: string[] }> {
	const assets = await loadLandingPageAssets();
	const approvedHeroMedia = assets.assetCatalog.heroVideos.map((asset) => ({
		id: asset.id,
		videoEmbedUrl: asset.videoEmbedUrl,
		videoThumbnailUrl: asset.videoThumbnailUrl,
		heroImageUrl: asset.videoThumbnailUrl
	}));
	for (const asset of assets.assetCatalog.heroImages) {
		if (approvedHeroMedia.some((item) => item.id === asset.id)) {
			continue;
		}

		approvedHeroMedia.push({
			id: asset.id,
			videoEmbedUrl: assets.heroDefaults.videoEmbedUrl,
			videoThumbnailUrl: assets.heroDefaults.videoThumbnailUrl ?? asset.imageUrl,
			heroImageUrl: asset.imageUrl
		});
	}
	const approvedHybridImages = assets.assetCatalog.hybridSupportingImages.map((asset) => ({
		id: asset.id,
		imageUrl: asset.imageUrl
	}));
	const approvedYoutubeVideos = await loadApprovedYoutubeGridVideosFromMediaAssets();

	const userPrompt = buildEditorUserPrompt(
		currentPage,
		changePrompt,
		approvedHeroMedia,
		approvedHybridImages,
		approvedYoutubeVideos
	);

	const deterministicOperations = tryBuildDeterministicOperations(currentPage, changePrompt);
	if (deterministicOperations) {
		traceLlm('edit_operations_generated', traceContext, {
			operations: deterministicOperations,
			operationTypes: deterministicOperations.map((operation) => operation.type),
			source: 'deterministic_command_mapping'
		});

		const editedPage = applyLandingPageOperations(currentPage, deterministicOperations);
		const enforceYoutubeGridCatalog = operationsTouchYoutubeGrid(deterministicOperations);
		const validatedEditedPage = validateEditedPageGuardrails(
			editedPage,
			currentPage,
			approvedHeroMedia,
			approvedHybridImages,
			approvedYoutubeVideos.map((video) => video.videoEmbedUrl),
			enforceYoutubeGridCatalog
		);

		if (JSON.stringify(validatedEditedPage) === JSON.stringify(currentPage)) {
			throw new Error('No effective changes were applied from generated operations.');
		}

		return {
			page: validatedEditedPage,
			operationTypes: deterministicOperations.map((operation) => operation.type)
		};
	}

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
			model: 'google/gemini-3.1-flash-lite',
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

	const normalizedResponse = normalizeOperationsResponse(response);
	const parsed = landingPageOperationsEnvelopeSchema.safeParse(normalizedResponse);
	if (!parsed.success) {
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_editor' },
			{
				issues: parsed.error.issues
			}
		);
		traceLlm('edit_operations_validation_failed', traceContext, { issues: parsed.error.issues });

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
					approvedHybridImages,
					approvedYoutubeVideos
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

		const normalizedRepairedResponse = normalizeOperationsResponse(repairedResponse);
		const repairedParsed = landingPageOperationsEnvelopeSchema.safeParse(
			normalizedRepairedResponse
		);
		if (!repairedParsed.success) {
			traceLlm(
				'agent_stage_validation_error',
				{ ...traceContext, stage: 'landing_page_editor_repair' },
				{ issues: repairedParsed.error.issues }
			);
			traceLlm('edit_operations_validation_failed', traceContext, {
				issues: repairedParsed.error.issues
			});
			throw new Error(`Invalid landing page operations JSON: ${repairedParsed.error.message}`);
		}

		traceLlm('edit_operations_generated', traceContext, {
			operations: repairedParsed.data.operations,
			operationTypes: repairedParsed.data.operations.map((operation) => operation.type)
		});
		const enforceYoutubeGridCatalog = operationsTouchYoutubeGrid(repairedParsed.data.operations);

		const editedPage = applyLandingPageOperations(currentPage, repairedParsed.data.operations);
		traceLlm('edit_operations_applied', traceContext, {
			operationCount: repairedParsed.data.operations.length,
			operationTypes: repairedParsed.data.operations.map((operation) => operation.type)
		});

		const validatedEditedPage = validateEditedPageGuardrails(
			editedPage,
			currentPage,
			approvedHeroMedia,
			approvedHybridImages,
			approvedYoutubeVideos.map((video) => video.videoEmbedUrl),
			enforceYoutubeGridCatalog
		);
		if (JSON.stringify(validatedEditedPage) === JSON.stringify(currentPage)) {
			throw new Error('No effective changes were applied from generated operations.');
		}

		return {
			page: validatedEditedPage,
			operationTypes: repairedParsed.data.operations.map((operation) => operation.type)
		};
	}

	traceLlm('edit_operations_generated', traceContext, {
		operations: parsed.data.operations,
		operationTypes: parsed.data.operations.map((operation) => operation.type)
	});
	const enforceYoutubeGridCatalog = operationsTouchYoutubeGrid(parsed.data.operations);

	const editedPage = applyLandingPageOperations(currentPage, parsed.data.operations);
	traceLlm('edit_operations_applied', traceContext, {
		operationCount: parsed.data.operations.length,
		operationTypes: parsed.data.operations.map((operation) => operation.type)
	});

	const validatedEditedPage = validateEditedPageGuardrails(
		editedPage,
		currentPage,
		approvedHeroMedia,
		approvedHybridImages,
		approvedYoutubeVideos.map((video) => video.videoEmbedUrl),
		enforceYoutubeGridCatalog
	);
	if (JSON.stringify(validatedEditedPage) === JSON.stringify(currentPage)) {
		throw new Error('No effective changes were applied from generated operations.');
	}

	return {
		page: validatedEditedPage,
		operationTypes: parsed.data.operations.map((operation) => operation.type)
	};
}

function describeSectionMove(
	current: string[],
	next: string[],
	sectionType: string
): string | null {
	const fromIndex = current.indexOf(sectionType);
	const toIndex = next.indexOf(sectionType);
	if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
		return null;
	}

	const fromLabel = fromIndex === 0 ? 'start' : `position ${fromIndex + 1}`;
	const toLabel = toIndex === 0 ? 'start' : `position ${toIndex + 1}`;
	return `${sectionType}: ${fromLabel} -> ${toLabel}`;
}

function buildEditChangeSummary(
	currentPage: LandingPageDocument,
	editedPage: LandingPageDocument,
	operationTypes: string[]
): LandingPageEditPreview['changeSummary'] {
	const impactedSections = new Set<string>();
	const contentChanges = new Set<string>();
	const layoutChanges = new Set<string>();
	const mediaChanges = new Set<string>();
	const reorderedSections = new Set<string>();
	const fieldDiffs: LandingPageEditPreview['changeSummary']['fieldDiffs'] = [];

	const currentByType = new Map<string, PageSection>();
	for (const section of currentPage.sections) {
		if (!currentByType.has(section.type)) {
			currentByType.set(section.type, section);
		}
	}

	const editedByType = new Map<string, PageSection>();
	for (const section of editedPage.sections) {
		if (!editedByType.has(section.type)) {
			editedByType.set(section.type, section);
		}
	}

	for (const [sectionType, nextSection] of editedByType.entries()) {
		const currentSection = currentByType.get(sectionType);
		if (!currentSection) {
			impactedSections.add(sectionType);
			continue;
		}

		const currentProps = JSON.stringify(currentSection.props);
		const nextProps = JSON.stringify(nextSection.props);
		if (currentProps !== nextProps) {
			impactedSections.add(sectionType);

			const currentRecord = currentSection.props as unknown as Record<string, unknown>;
			const nextRecord = nextSection.props as unknown as Record<string, unknown>;
			const candidateKeys = new Set<string>([
				...Object.keys(currentRecord),
				...Object.keys(nextRecord)
			]);
			for (const key of candidateKeys) {
				const beforeValue = currentRecord[key];
				const afterValue = nextRecord[key];
				if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
					continue;
				}

				fieldDiffs.push({
					sectionType,
					field: key,
					before: JSON.stringify(beforeValue ?? null),
					after: JSON.stringify(afterValue ?? null)
				});
			}
		}
	}

	const currentOrder = currentPage.sections.map((section) => section.type);
	const nextOrder = editedPage.sections.map((section) => section.type);
	for (const sectionType of nextOrder) {
		const moveDescription = describeSectionMove(currentOrder, nextOrder, sectionType);
		if (!moveDescription) {
			continue;
		}

		reorderedSections.add(moveDescription);
		impactedSections.add(sectionType);
	}

	for (const operationType of operationTypes) {
		if (operationType === 'update_section_content') {
			contentChanges.add('Updated section copy/content fields.');
		}
		if (operationType === 'update_section_layout') {
			layoutChanges.add('Updated section layout/visual arrangement fields.');
		}
		if (operationType === 'replace_media') {
			mediaChanges.add('Replaced section media fields (images/videos).');
		}
		if (operationType === 'reorder_section') {
			reorderedSections.add('Section order changed.');
		}
	}

	return {
		impactedSections: Array.from(impactedSections),
		contentChanges: Array.from(contentChanges),
		layoutChanges: Array.from(layoutChanges),
		mediaChanges: Array.from(mediaChanges),
		reorderedSections: Array.from(reorderedSections),
		fieldDiffs: fieldDiffs.slice(0, 30)
	};
}

export async function buildLandingPageEditPreview(
	campaignPageId: number,
	changePrompt: string
): Promise<{ campaignId: number; preview: LandingPageEditPreview }> {
	const runId = createRunId('landing_page_edit_preview');
	const traceContext = { runId, campaignPageId, pipeline: 'landing_page_edit_preview' };
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
		throw new Error('Cannot edit landing page while campaign is published. Archive first.');
	}

	const currentPage = parseLandingPageDocument(pageRecord.structuredContentJson);
	const editResult = await generateEditedLandingPageDocument(
		currentPage,
		changePrompt,
		traceContext
	);

	const preview: LandingPageEditPreview = {
		baseCampaignPageId: campaignPageId,
		changePrompt,
		editedPage: editResult.page,
		operationTypes: editResult.operationTypes,
		changeSummary: buildEditChangeSummary(currentPage, editResult.page, editResult.operationTypes)
	};

	traceLlm('pipeline_success', traceContext, {
		campaignId: pageRecord.campaignId,
		previewOperationTypes: preview.operationTypes
	});

	return {
		campaignId: pageRecord.campaignId,
		preview
	};
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
		throw new Error('Cannot edit landing page while campaign is published. Archive first.');
	}

	const currentPage = parseLandingPageDocument(pageRecord.structuredContentJson);
	const editResult = await generateEditedLandingPageDocument(
		currentPage,
		changePrompt,
		traceContext
	);
	const editedPage = editResult.page;
	const normalizedPrompt = changePrompt.replace(/\s+/g, ' ').trim();
	const operationSummary = editResult.operationTypes.join(', ');
	const changeNote = `AI edit (${operationSummary}): ${normalizedPrompt.slice(0, 140)}${
		normalizedPrompt.length > 140 ? '...' : ''
	}`;

	const createdPage = await db.transaction(async (tx) => {
		const persisted = await persistGeneratedLandingPage(
			pageRecord.campaignId,
			editedPage,
			tx,
			changeNote
		);
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
		campaignPageId: createdPage.campaignPageId,
		operationTypes: editResult.operationTypes
	});
	traceLlm('edit_operations_persisted', traceContext, {
		campaignId: pageRecord.campaignId,
		campaignPageId: createdPage.campaignPageId,
		operationTypes: editResult.operationTypes
	});

	return {
		campaignId: pageRecord.campaignId,
		campaignPageId: createdPage.campaignPageId
	};
}
