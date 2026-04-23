import { landingPageDocumentSchema, type LandingPageDocument } from '$lib/page-builder/page';
import type { HybridSupportingVisualItem, PageSectionType } from '$lib/page-builder/sections';
import { callOpenRouter } from '$lib/server/openrouter/client';
import type { PageSection } from '$lib/page-builder/sections';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import type { ZodIssue } from 'zod';
import {
	buildLandingPageWriterSystemPrompt,
	landingPageWriterUserPrompt
} from './prompts/landing-page';
import { resolvePromptGuidanceForCampaign } from './prompt-guidance';
import { buildSectionCatalog } from './section-catalog';
import { getSectionEligibility } from './section-eligibility';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import type { LandingPagePlan } from './schemas/landing-page-plan';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function inferBenefitTitle(value: string, index: number): string {
	const [head] = value.split(/[.:,-]/);
	const candidate = head?.trim();
	if (candidate && candidate.length >= 6 && candidate.length <= 64) {
		return candidate;
	}

	return `Audience outcome ${index + 1}`;
}

type HybridTextItem = {
	title: string;
	body: string;
};

type HybridBenefitItem = HybridTextItem & {
	imageUrl: string;
};

const hybridBenefitImageFallbackUrl =
	'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40';

const inputFallbackBenefitBody =
	'Your audience leaves with practical outcomes they can apply immediately in their role.';

function pickImageUrl(imageUrls: string[], index: number): string {
	if (imageUrls.length === 0) {
		return hybridBenefitImageFallbackUrl;
	}

	return imageUrls[index % imageUrls.length] ?? hybridBenefitImageFallbackUrl;
}

function buildBenefitImagePool(
	input: LandingPageGenerationInput,
	selectedSupportingVisualItems: HybridSupportingVisualItem[],
	props: Record<string, unknown>
): string[] {
	const selectedUrls = selectedSupportingVisualItems
		.map((item) => getString(item.imageUrl))
		.filter((value): value is string => Boolean(value));
	if (selectedUrls.length > 0) {
		return selectedUrls;
	}

	const catalogUrls = input.assets.assetCatalog.hybridSupportingImages
		.map((item) => getString(item.imageUrl))
		.filter((value): value is string => Boolean(value));
	if (catalogUrls.length > 0) {
		return catalogUrls;
	}

	const rawSupportingVisualItems = Array.isArray(props.supportingVisualItems)
		? props.supportingVisualItems
		: [];
	const existingUrls = rawSupportingVisualItems
		.map((item) => (isRecord(item) ? getString(item.imageUrl) : undefined))
		.filter((value): value is string => Boolean(value));
	if (existingUrls.length > 0) {
		return existingUrls;
	}

	return [hybridBenefitImageFallbackUrl];
}

function buildHybridBenefitFallbacks(input: LandingPageGenerationInput): HybridTextItem[] {
	const audience = input.campaign.audience;
	const topic = input.campaign.topic;
	const format = input.campaign.format;

	return [
		{
			title: 'Decision-ready understanding',
			body: `${audience} leave this ${format} with a clear understanding of ${topic} and what matters most now.`
		},
		{
			title: 'Practical application playbook',
			body: `${audience} get concrete ways to apply ${topic} insights in the exact decisions and workflows this ${format} is designed to influence.`
		},
		{
			title: 'Immediate next actions',
			body: `${audience} walk away with specific next actions they can execute right after the ${format} to convert ${topic} into measurable progress.`
		}
	];
}

function normalizeBenefitsToThree(
	normalizedBenefits: HybridTextItem[],
	fallbackBenefits: HybridTextItem[],
	benefitImageUrls: string[]
): HybridBenefitItem[] {
	let resolvedTextBenefits: HybridTextItem[];

	if (normalizedBenefits.length >= 3) {
		resolvedTextBenefits = normalizedBenefits.slice(0, 3);
	} else if (normalizedBenefits.length === 0) {
		resolvedTextBenefits = fallbackBenefits;
	} else {
		const usedTitles = new Set(normalizedBenefits.map((benefit) => benefit.title));
		const result = [...normalizedBenefits];

		for (const fallback of fallbackBenefits) {
			if (result.length >= 3) {
				break;
			}

			if (usedTitles.has(fallback.title)) {
				continue;
			}

			result.push(fallback);
			usedTitles.add(fallback.title);
		}

		while (result.length < 3) {
			result.push({
				title: `Audience outcome ${result.length + 1}`,
				body: inputFallbackBenefitBody
			});
		}

		resolvedTextBenefits = result;
	}

	return resolvedTextBenefits.map((benefit, index) => ({
		...benefit,
		imageUrl: pickImageUrl(benefitImageUrls, index)
	}));
}

function buildWhyChristophFallbacks(
	input: LandingPageGenerationInput,
	benefits: HybridTextItem[]
): HybridTextItem[] {
	const audience = input.campaign.audience;
	const topic = input.campaign.topic;
	const format = input.campaign.format;

	return [
		{
			title: 'Proven translator of complex AI',
			body: `Christoph has a track record of turning complex ${topic} shifts into clear decisions that ${audience} can act on immediately.`
		},
		{
			title: 'Built for this audience and format',
			body: `He structures each ${format} for ${audience}, balancing strategic perspective with practical guidance that can be used the same day.`
		},
		{
			title: 'Outcome-focused delivery',
			body: `His approach is designed to deliver outcomes like ${benefits[0]?.title?.toLowerCase() ?? 'clear next steps'}, not abstract theory.`
		}
	];
}

function resolveHeroVideoSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): LandingPageGenerationInput['assets']['assetCatalog']['heroVideos'][number] | null {
	const selectedId = plan.assetPlan?.hero?.videoAssetId;
	if (!selectedId) {
		return null;
	}

	const selected = input.assets.assetCatalog.heroVideos.find((asset) => asset.id === selectedId);
	if (!selected) {
		console.warn(
			`Landing page writer: hero asset selection '${selectedId}' not found in approved catalog; using fallback defaults.`
		);
		return null;
	}

	return selected;
}

function resolveHybridSupportingVisualSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): HybridSupportingVisualItem[] {
	const selectedIds = plan.assetPlan?.hybridContentSection?.supportingImageAssetIds;
	if (!selectedIds || selectedIds.length === 0) {
		return [];
	}

	const catalogById = new Map(
		input.assets.assetCatalog.hybridSupportingImages.map((asset) => [asset.id, asset])
	);
	const selectedItems: HybridSupportingVisualItem[] = [];

	for (const id of selectedIds) {
		const selected = catalogById.get(id);
		if (!selected) {
			console.warn(
				`Landing page writer: hybrid supporting image '${id}' not found in approved catalog; skipping this asset.`
			);
			continue;
		}

		selectedItems.push({
			imageUrl: selected.imageUrl,
			alt: selected.alt,
			caption: selected.caption
		});
	}

	return selectedItems;
}

function hydrateSectionWithAssets(
	section: PageSection,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): PageSection {
	const { assets } = input;

	switch (section.type) {
		case 'immediate_authority_hero': {
			const fallbackHeadline = `${plan.pageTitle}`;
			const fallbackSubheadline = input.adGroup.intentSummary || input.adPackage.messagingAngle;
			const selectedHeroVideo = resolveHeroVideoSelection(input, plan);
			const primaryCtaLabel =
				section.props.primaryCtaLabel?.trim() || assets.heroDefaults.primaryCtaLabelDefault;

			const ctaHref = section.props.primaryCtaHref ?? assets.heroDefaults.primaryCtaHref;
			const ctaAction = section.props.primaryCtaAction ?? assets.heroDefaults.primaryCtaAction;

			return {
				...section,
				props: {
					...section.props,
					headline: section.props.headline?.trim() || fallbackHeadline,
					subheadline: section.props.subheadline?.trim() || fallbackSubheadline,
					primaryCtaLabel,
					primaryCtaHref: ctaHref,
					primaryCtaAction: ctaAction,
					videoEmbedUrl:
						selectedHeroVideo?.videoEmbedUrl ??
						section.props.videoEmbedUrl ??
						assets.heroDefaults.videoEmbedUrl,
					videoThumbnailUrl:
						selectedHeroVideo?.videoThumbnailUrl ??
						section.props.videoThumbnailUrl ??
						assets.heroDefaults.videoThumbnailUrl,
					videoThumbnailAlt:
						selectedHeroVideo?.videoThumbnailAlt ||
						section.props.videoThumbnailAlt ||
						assets.heroDefaults.videoThumbnailAlt
				}
			};
		}

		case 'logos_of_trust_ribbon': {
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title ?? assets.fixedLogosRibbon.title,
					label: section.props.label ?? assets.fixedLogosRibbon.label,
					logos: assets.fixedLogosRibbon.logos
				}
			};
		}

		case 'proof_of_performance': {
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title ?? assets.fixedProofOfPerformance.title,
					testimonials: assets.fixedProofOfPerformance.testimonials
				}
			};
		}

		case 'hybrid_content_section': {
			const props: Record<string, unknown> = isRecord(section.props) ? section.props : {};
			const selectedSupportingVisualItems = resolveHybridSupportingVisualSelection(input, plan);
			const benefitImageUrls = buildBenefitImagePool(input, selectedSupportingVisualItems, props);
			const hybridBenefitFallbacks = buildHybridBenefitFallbacks(input);

			const rawBenefits: unknown[] = Array.isArray(props.benefits) ? props.benefits : [];
			const normalizedBenefits = rawBenefits
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Audience outcome ${index + 1}`;
						const body =
							getString(item.body) ??
							hybridBenefitFallbacks[index % hybridBenefitFallbacks.length]?.body ??
							inputFallbackBenefitBody;
						return { title, body };
					}

					if (typeof item === 'string') {
						const body = getString(item);
						if (!body) {
							return null;
						}

						return {
							title: inferBenefitTitle(body, index),
							body
						};
					}

					return null;
				})
				.filter(
					(item: { title: string; body: string } | null): item is { title: string; body: string } =>
						item !== null
				);

			const benefits = normalizeBenefitsToThree(
				normalizedBenefits,
				hybridBenefitFallbacks,
				benefitImageUrls
			);
			const deepDiveFallbacks = buildWhyChristophFallbacks(input, benefits);

			const rawDeepDiveItems: unknown[] = Array.isArray(props.deepDiveItems)
				? props.deepDiveItems
				: [];
			const normalizedDeepDiveItems = rawDeepDiveItems
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Detail ${index + 1}`;
						const body =
							getString(item.body) ?? deepDiveFallbacks[index % deepDiveFallbacks.length]?.body;
						if (!body) {
							return null;
						}

						return { title, body };
					}

					if (typeof item === 'string') {
						const body = getString(item);
						if (!body) {
							return null;
						}

						return {
							title: `Detail ${index + 1}`,
							body
						};
					}

					return null;
				})
				.filter(
					(item: { title: string; body: string } | null): item is { title: string; body: string } =>
						item !== null
				);

			const deepDiveItems =
				normalizedDeepDiveItems.length > 0 ? normalizedDeepDiveItems : deepDiveFallbacks;

			const title =
				getString(props.title) || 'What your audience will leave with from this session';

			const intro =
				getString(props.intro) ||
				`Most ${input.campaign.format} sessions stay abstract. This section clarifies what ${input.campaign.audience} will leave with on ${input.campaign.topic} and why those outcomes are achievable.`;

			const deepDiveTitle = getString(props.deepDiveTitle) || 'Why Christoph';

			return {
				...section,
				props: {
					...props,
					title,
					intro,
					benefits,
					deepDiveTitle,
					deepDiveItems,
					supportingVisualItems:
						selectedSupportingVisualItems.length > 0
							? selectedSupportingVisualItems
							: section.props.supportingVisualItems
				}
			};
		}

		case 'frictionless_funnel_booking': {
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title?.trim() || assets.bookingDefaults.defaultSectionTitle,
					description:
						section.props.description?.trim() || assets.bookingDefaults.defaultSectionDescription,
					primaryCtaLabel:
						section.props.primaryCtaLabel?.trim() || assets.bookingDefaults.primaryCtaLabelDefault,
					calendlyUrl: section.props.calendlyUrl ?? assets.bookingDefaults.calendlyUrl,
					trustNote: section.props.trustNote ?? assets.bookingDefaults.trustNote,
					formDisclaimer: section.props.formDisclaimer ?? assets.bookingDefaults.formDisclaimer
				}
			};
		}

		case 'compliance_transparency_footer': {
			return {
				...section,
				props: {
					...section.props,
					privacyPolicyUrl:
						section.props.privacyPolicyUrl ?? assets.complianceDefaults.privacyPolicyUrl,
					contactEmail: section.props.contactEmail ?? assets.complianceDefaults.contactEmail,
					businessAddress:
						section.props.businessAddress ?? assets.complianceDefaults.businessAddress,
					phone: section.props.phone ?? assets.complianceDefaults.phone,
					copyrightText: section.props.copyrightText ?? assets.complianceDefaults.copyrightText,
					additionalLinks:
						section.props.additionalLinks ?? assets.complianceDefaults.additionalLinks
				}
			};
		}

		default:
			return section;
	}
}

function removeHybridSections(response: unknown): { result: unknown; removed: boolean } {
	if (!isRecord(response) || !Array.isArray(response.sections)) {
		return { result: response, removed: false };
	}

	const filteredSections = response.sections.filter((section) => {
		if (!isRecord(section)) {
			return false;
		}

		return section.type !== 'hybrid_content_section';
	});

	const removed = filteredSections.length !== response.sections.length;
	if (!removed) {
		return { result: response, removed: false };
	}

	return {
		result: {
			...response,
			sections: filteredSections
		},
		removed: true
	};
}

function ensureSeoSection(
	sections: PageSection[],
	fallbackTitle: string,
	fallbackDescription: string
): PageSection[] {
	const seoIndex = sections.findIndex((section) => section.type === 'seo');
	const existingSeo = seoIndex >= 0 ? sections[seoIndex] : null;
	const existingSeoProps =
		existingSeo && isRecord(existingSeo.props)
			? existingSeo.props
			: ({} as Record<string, unknown>);

	const seoSection: PageSection = {
		type: 'seo',
		props: {
			title: getString(existingSeoProps.title) ?? fallbackTitle,
			description: getString(existingSeoProps.description) ?? fallbackDescription,
			canonicalUrl: getString(existingSeoProps.canonicalUrl),
			robots: getString(existingSeoProps.robots),
			ogImageUrl: getString(existingSeoProps.ogImageUrl),
			ogImageAlt: getString(existingSeoProps.ogImageAlt),
			ogType:
				existingSeoProps.ogType === 'website' || existingSeoProps.ogType === 'article'
					? existingSeoProps.ogType
					: undefined,
			twitterCard:
				existingSeoProps.twitterCard === 'summary' ||
				existingSeoProps.twitterCard === 'summary_large_image'
					? existingSeoProps.twitterCard
					: undefined,
			twitterSite: getString(existingSeoProps.twitterSite)
		}
	};

	const withoutSeo = sections.filter((section) => section.type !== 'seo');
	return [seoSection, ...withoutSeo];
}

function normalizeRootResponse(response: unknown): unknown {
	if (Array.isArray(response)) {
		const sectionCandidates = response
			.filter((item): item is Record<string, unknown> => isRecord(item))
			.filter((item) => typeof item.type === 'string')
			.map((item) => {
				if (isRecord(item.props)) {
					return {
						type: item.type,
						props: item.props
					};
				}

				const { type, ...rest } = item;
				return {
					type,
					props: rest
				};
			});

		if (sectionCandidates.length > 0) {
			traceLlm(
				'writer_normalized_shape',
				{ stage: 'landing_page_writer' },
				{
					inputShape: 'array_of_sections',
					sectionCount: sectionCandidates.length
				}
			);
			return {
				version: 1,
				sections: sectionCandidates
			};
		}

		traceLlm(
			'writer_normalized_shape',
			{ stage: 'landing_page_writer' },
			{
				inputShape: 'array_non_section',
				sectionCount: 0
			}
		);
		return {};
	}

	return response;
}

function validateWithHydration(
	response: unknown,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
):
	| { success: true; data: LandingPageDocument }
	| { success: false; issues: ZodIssue[]; hydratedResponse: unknown } {
	const normalizedResponse = normalizeRootResponse(response);
	const hydratedResponse = hydrateLandingPageWithAssets(normalizedResponse, input, plan);
	const parsed = landingPageDocumentSchema.safeParse(hydratedResponse);
	if (parsed.success) {
		return { success: true, data: parsed.data };
	}

	const withoutHybrid = removeHybridSections(hydratedResponse);
	if (withoutHybrid.removed) {
		const parsedWithoutHybrid = landingPageDocumentSchema.safeParse(withoutHybrid.result);
		if (parsedWithoutHybrid.success) {
			return { success: true, data: parsedWithoutHybrid.data };
		}
	}

	return {
		success: false,
		issues: parsed.error.issues,
		hydratedResponse
	};
}

function buildWriterRepairPrompt(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	invalidResponse: unknown,
	issues: ZodIssue[],
	allowedSectionTypes: readonly PageSectionType[],
	requiredSectionTypes: readonly PageSectionType[]
): string {
	return `Your previous JSON failed schema validation. Return a corrected JSON object only.

Corrective rules:
- Keep the same landing page intent and section narrative.
- Do not output commentary.
- Do not output markdown.
- Use assets from input.assets for proof, media, and compliance values.
- For hero media, use plan.assetPlan.hero.videoAssetId with input.assets.assetCatalog.heroVideos.
- For hybrid supporting visuals, use plan.assetPlan.hybridContentSection.supportingImageAssetIds with input.assets.assetCatalog.hybridSupportingImages.
- Never invent media IDs or media URLs.
- Use only these allowed section types: ${allowedSectionTypes.join(', ')}.
- Include these required section types: ${requiredSectionTypes.join(', ')}.
- Top-level JSON must be a single object, never an array.
- Place seo as the first section.
- Root title is required.
- seo.props.title and seo.props.description are required.
- For hybrid_content_section, intro is required.
- For hybrid_content_section, benefits must be an array of objects with title, body, and imageUrl fields.
- For hybrid_content_section, benefits should contain exactly 3 items aligned to what the audience will leave with.
- For hybrid_content_section, each benefit imageUrl must resolve from plan.assetPlan.hybridContentSection.supportingImageAssetIds against input.assets.assetCatalog.hybridSupportingImages.
- For hybrid_content_section, deepDiveTitle and deepDiveItems are required.
- For hybrid_content_section, bias deepDiveTitle to "Why Christoph" and focus deepDiveItems on qualification proof.

Landing page generation input:
${JSON.stringify(input, null, 2)}

Landing page plan:
${JSON.stringify(plan, null, 2)}

Previous invalid JSON:
${JSON.stringify(invalidResponse, null, 2)}

Validation errors:
${JSON.stringify(issues, null, 2)}`;
}

function hydrateLandingPageWithAssets(
	response: unknown,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): unknown {
	if (!isRecord(response)) {
		return response;
	}

	const hydrated = { ...response };
	if (hydrated.version === undefined) {
		hydrated.version = 1;
	}

	const fallbackPageTitle = getString(hydrated.title) ?? plan.pageTitle ?? input.campaign.name;
	hydrated.title = fallbackPageTitle;

	const fallbackSeoDescription =
		input.adGroup.intentSummary ||
		plan.messagingAngle ||
		input.adPackage.messagingAngle ||
		input.adPackage.targetingSummary ||
		input.campaign.topic;

	if (!Array.isArray(hydrated.sections)) {
		return {
			...hydrated,
			sections: ensureSeoSection([], fallbackPageTitle, fallbackSeoDescription)
		};
	}

	const sections = hydrated.sections
		.filter((section): section is PageSection => {
			if (!isRecord(section)) {
				return false;
			}

			if (typeof section.type !== 'string') {
				return false;
			}

			if (!isRecord(section.props)) {
				section.props = {};
			}

			return true;
		})
		.map((section) => hydrateSectionWithAssets(section, input, plan));

	const sectionsWithSeo = ensureSeoSection(sections, fallbackPageTitle, fallbackSeoDescription);

	return {
		...hydrated,
		sections: sectionsWithSeo
	};
}

function validateLandingPageDocumentForMvp(
	page: LandingPageDocument,
	allowedSectionTypes: readonly PageSectionType[],
	requiredSectionTypes: readonly PageSectionType[]
): void {
	const minSections = requiredSectionTypes.length;

	if (page.sections.length < minSections) {
		throw new Error(`Landing page must include at least ${minSections} sections for this MVP.`);
	}

	const allowedTypes = new Set<string>(allowedSectionTypes);
	const sectionTypes = page.sections.map((section) => section.type);
	for (const sectionType of sectionTypes) {
		if (!allowedTypes.has(sectionType)) {
			throw new Error(`Unsupported section type for MVP landing page: ${sectionType}`);
		}
	}

	for (const requiredSectionType of requiredSectionTypes) {
		if (!sectionTypes.includes(requiredSectionType)) {
			throw new Error(`Landing page must include ${requiredSectionType} section.`);
		}
	}

	if (sectionTypes[0] !== 'seo') {
		throw new Error('Landing page must place seo as the first section.');
	}
}

export async function generateLandingPageDocument(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	traceContext: LlmTraceContext = {}
): Promise<LandingPageDocument> {
	const eligibility = getSectionEligibility(input);
	const sectionCatalog = buildSectionCatalog(eligibility.allowedSectionTypes);
	const promptContext = {
		allowedSectionTypes: eligibility.allowedSectionTypes,
		requiredSectionTypes: eligibility.requiredSectionTypes,
		sectionCatalog,
		disallowedReasonByType: eligibility.disallowedReasonByType
	};

	const userPrompt = landingPageWriterUserPrompt(input, plan, promptContext);
	const selectedSectionTypes = plan.sectionPlan.map((section) => section.type);

	let promptLibraryGuidance = '';
	try {
		const guidance = await resolvePromptGuidanceForCampaign('final', {
			name: input.campaign.name,
			audience: input.campaign.audience,
			format: input.campaign.format,
			topic: input.campaign.topic,
			language: input.campaign.language,
			geography: input.campaign.geography,
			notes: input.campaign.notes
		});
		promptLibraryGuidance = guidance.guidance;
		traceLlm(
			'agent_prompt_guidance',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				found: guidance.matchedPromptId !== null,
				promptId: guidance.matchedPromptId,
				promptName: guidance.matchedPromptName,
				audience: guidance.matchedAudience,
				format: guidance.matchedFormat
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('Landing page writer: prompt guidance lookup failed', message);
		traceLlm(
			'agent_prompt_guidance_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				message
			}
		);
	}

	const systemPrompt = buildLandingPageWriterSystemPrompt(
		promptContext,
		selectedSectionTypes,
		promptLibraryGuidance
	);

	let response;
	try {
		console.log('Landing page writer: calling OpenRouter');
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				model: 'google/gemini-3.1-flash-lite-preview'
			}
		);
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_writer' }
		});
		console.log('Landing page writer: OpenRouter responded');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Landing page writer: OpenRouter error', message);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'landing_page_writer' }, { message });
		throw new Error(`Landing page writer failed: ${message}`);
	}

	const firstValidation = validateWithHydration(response, input, plan);
	if (firstValidation.success) {
		validateLandingPageDocumentForMvp(
			firstValidation.data,
			eligibility.allowedSectionTypes,
			eligibility.requiredSectionTypes
		);
		console.log('Landing page writer: document validated');
		return firstValidation.data;
	}

	console.error('Landing page writer: validation failed', firstValidation.issues);
	traceLlm(
		'agent_stage_validation_error',
		{ ...traceContext, stage: 'landing_page_writer' },
		{
			issues: firstValidation.issues,
			phase: 'initial_validation'
		}
	);

	let repairedResponse;
	try {
		console.log('Landing page writer: requesting repair pass');
		repairedResponse = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt,
			userPrompt: buildWriterRepairPrompt(
				input,
				plan,
				firstValidation.hydratedResponse,
				firstValidation.issues,
				eligibility.allowedSectionTypes,
				eligibility.requiredSectionTypes
			),
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_writer_repair' }
		});
		console.log('Landing page writer: repair response received');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_writer_repair' },
			{
				responsePreview: JSON.stringify(repairedResponse)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		traceLlm(
			'agent_stage_error',
			{ ...traceContext, stage: 'landing_page_writer_repair' },
			{ message }
		);
		throw new Error(`Landing page writer repair failed: ${message}`);
	}

	const secondValidation = validateWithHydration(repairedResponse, input, plan);
	if (!secondValidation.success) {
		console.error('Landing page writer: repair validation failed', secondValidation.issues);
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: secondValidation.issues,
				phase: 'repair_validation'
			}
		);
		throw new Error(
			`Invalid landing page document: ${JSON.stringify(secondValidation.issues, null, 2)}`
		);
	}

	validateLandingPageDocumentForMvp(
		secondValidation.data,
		eligibility.allowedSectionTypes,
		eligibility.requiredSectionTypes
	);
	console.log('Landing page writer: document validated');
	return secondValidation.data;
}
