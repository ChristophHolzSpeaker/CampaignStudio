import { landingPageDocumentSchema, type LandingPageDocument } from '$lib/page-builder/page';
import { callOpenRouter } from '$lib/server/openrouter/client';
import type { PageSection } from '$lib/page-builder/sections';
import type { ZodIssue } from 'zod';
import { landingPageWriterSystemPrompt, landingPageWriterUserPrompt } from './prompts/landing-page';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import type { LandingPagePlan } from './schemas/landing-page-plan';

const allowedSectionTypes = new Set([
	'immediate_authority_hero',
	'logos_of_trust_ribbon',
	'hybrid_content_section',
	'proof_of_performance',
	'frictionless_funnel_booking',
	'compliance_transparency_footer'
]);

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

			const deepDiveTitle = getString(props.deepDiveTitle) || 'Why this approach works';

			return {
				...section,
				props: {
					...props,
					title,
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

function validateWithHydration(
	response: unknown,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
):
	| { success: true; data: LandingPageDocument }
	| { success: false; issues: ZodIssue[]; hydratedResponse: unknown } {
	const hydratedResponse = hydrateLandingPageWithAssets(response, input, plan);
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
	issues: ZodIssue[]
): string {
	return `Your previous JSON failed schema validation. Return a corrected JSON object only.

Corrective rules:
- Keep the same landing page intent and section narrative.
- Do not output commentary.
- Do not output markdown.
- Use assets from input.assets for proof, media, and compliance values.
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

	if (!Array.isArray(hydrated.sections)) {
		return hydrated;
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

	return {
		...hydrated,
		sections
	};
}

function validateLandingPageDocumentForMvp(page: LandingPageDocument): void {
	if (page.sections.length < 4 || page.sections.length > 6) {
		throw new Error('Landing page must include between 4 and 6 sections for this MVP.');
	}

	const sectionTypes = page.sections.map((section) => section.type);
	for (const sectionType of sectionTypes) {
		if (!allowedSectionTypes.has(sectionType)) {
			throw new Error(`Unsupported section type for MVP landing page: ${sectionType}`);
		}
	}

	if (!sectionTypes.includes('immediate_authority_hero')) {
		throw new Error('Landing page must include immediate_authority_hero section.');
	}

	if (!sectionTypes.includes('frictionless_funnel_booking')) {
		throw new Error('Landing page must include frictionless_funnel_booking section.');
	}

	if (!sectionTypes.includes('compliance_transparency_footer')) {
		throw new Error('Landing page must include compliance_transparency_footer section.');
	}
}

export async function generateLandingPageDocument(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): Promise<LandingPageDocument> {
	const userPrompt = landingPageWriterUserPrompt(input, plan);

	let response;
	try {
		console.log('Landing page writer: calling OpenRouter');
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: landingPageWriterSystemPrompt,
			userPrompt,
			responseFormat: 'json_object'
		});
		console.log('Landing page writer: OpenRouter responded');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Landing page writer: OpenRouter error', message);
		throw new Error(`Landing page writer failed: ${message}`);
	}

	const firstValidation = validateWithHydration(response, input, plan);
	if (firstValidation.success) {
		validateLandingPageDocumentForMvp(firstValidation.data);
		console.log('Landing page writer: document validated');
		return firstValidation.data;
	}

	console.error('Landing page writer: validation failed', firstValidation.issues);

	let repairedResponse;
	try {
		console.log('Landing page writer: requesting repair pass');
		repairedResponse = await callOpenRouter({
			model: 'nvidia/nemotron-3-super-120b-a12b:free',
			systemPrompt: landingPageWriterSystemPrompt,
			userPrompt: buildWriterRepairPrompt(
				input,
				plan,
				firstValidation.hydratedResponse,
				firstValidation.issues
			),
			responseFormat: 'json_object'
		});
		console.log('Landing page writer: repair response received');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Landing page writer repair failed: ${message}`);
	}

	const secondValidation = validateWithHydration(repairedResponse, input, plan);
	if (!secondValidation.success) {
		console.error('Landing page writer: repair validation failed', secondValidation.issues);
		throw new Error(
			`Invalid landing page document: ${JSON.stringify(secondValidation.issues, null, 2)}`
		);
	}

	validateLandingPageDocumentForMvp(secondValidation.data);
	console.log('Landing page writer: document validated');
	return secondValidation.data;
}
