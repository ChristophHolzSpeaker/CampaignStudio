import { landingPageDocumentSchema, type LandingPageDocument } from '$lib/page-builder/page';
import type { PageSectionType } from '$lib/page-builder/sections';
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

	return `Benefit ${index + 1}`;
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
					videoEmbedUrl: section.props.videoEmbedUrl ?? assets.heroDefaults.videoEmbedUrl,
					videoThumbnailUrl:
						section.props.videoThumbnailUrl ?? assets.heroDefaults.videoThumbnailUrl,
					videoThumbnailAlt:
						section.props.videoThumbnailAlt || assets.heroDefaults.videoThumbnailAlt
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

			const rawBenefits: unknown[] = Array.isArray(props.benefits) ? props.benefits : [];
			const normalizedBenefits = rawBenefits
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Benefit ${index + 1}`;
						const body = getString(item.body) ?? input.adPackage.messagingAngle;
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

			const fallbackBenefits =
				normalizedBenefits.length > 0
					? normalizedBenefits
					: [
							{
								title: 'Strategic relevance',
								body: input.adGroup.intentSummary || input.adPackage.messagingAngle
							}
						];

			const rawDeepDiveItems: unknown[] = Array.isArray(props.deepDiveItems)
				? props.deepDiveItems
				: [];
			const normalizedDeepDiveItems = rawDeepDiveItems
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Detail ${index + 1}`;
						const body = getString(item.body) ?? fallbackBenefits[index]?.body;
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
				normalizedDeepDiveItems.length > 0
					? normalizedDeepDiveItems
					: fallbackBenefits.map((benefit: { title: string; body: string }) => ({
							title: benefit.title,
							body: benefit.body
						}));

			const title = getString(props.title) || 'Why this approach fits your event goals';

			const intro =
				getString(props.intro) ||
				'Most talks stay abstract. This section translates AI shifts into practical competitive moves your audience can execute.';

			const deepDiveTitle = getString(props.deepDiveTitle) || 'Why this approach works';

			return {
				...section,
				props: {
					...props,
					title,
					intro,
					benefits: fallbackBenefits,
					deepDiveTitle,
					deepDiveItems
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
- Use only these allowed section types: ${allowedSectionTypes.join(', ')}.
- Include these required section types: ${requiredSectionTypes.join(', ')}.
- Top-level JSON must be a single object, never an array.
- Place seo as the first section.
- Root title is required.
- seo.props.title and seo.props.description are required.
- For hybrid_content_section, intro is required.
- For hybrid_content_section, benefits must be an array of objects with title and body fields.
- For hybrid_content_section, deepDiveTitle and deepDiveItems are required.

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
