import type { PageSectionType } from '$lib/page-builder/sections';
import type { SectionCatalogItem } from '../section-catalog';
import type { LandingPageGenerationInput } from '../schemas/landing-page-input';
import type { LandingPagePlan } from '../schemas/landing-page-plan';

type PromptContext = {
	allowedSectionTypes: PageSectionType[];
	requiredSectionTypes: PageSectionType[];
	sectionCatalog: SectionCatalogItem[];
	disallowedReasonByType?: Partial<Record<PageSectionType, string>>;
};

function buildGlobalCopyQualityRulesBlock(): string {
	return [
		'* section specs are binding writing constraints at generation time, not optional context',
		'* internal strategy fields are planning inputs, not publishable copy',
		'* do not copy targetingSummary, messagingAngle, intentSummary, landingPageAngle, section purpose, or contentDirection verbatim into visible copy',
		'* if strategy language is reused, rewrite it naturally for human readers and section context',
		'* avoid repeating the same sentence or near-identical phrase across headline, subheadline, intro, benefits, deep-dive items, and booking copy',
		'* every section must add distinct information and advance the conversion narrative',
		'* visible copy must not read like SEO metadata, ad targeting logic, or search strategy notes',
		'* avoid abstract filler and meta-marketing phrasing such as "searchers looking for", "this approach works", "strategic relevance", or similarly generic language'
	].join('\n');
}

function formatGuidanceList(lines: string[]): string {
	if (lines.length === 0) {
		return '\t- none';
	}

	return lines.map((line) => `\t- ${line}`).join('\n');
}

function buildSelectedSectionGuidanceBlock(
	context: PromptContext,
	selectedSectionTypes: readonly string[]
): string {
	const catalogByType = new Map(context.sectionCatalog.map((item) => [item.type, item]));
	const uniqueSelectedSectionTypes = [...new Set(selectedSectionTypes)];

	if (uniqueSelectedSectionTypes.length === 0) {
		return '* no selected section guidance available';
	}

	return uniqueSelectedSectionTypes
		.map((sectionType) => {
			const section = catalogByType.get(sectionType as PageSectionType);
			if (!section) {
				return [
					`Section ${sectionType}:`,
					'\t- no catalog guidance available for this section type'
				]
					.join('\n')
					.trim();
			}

			return [
				`Section ${section.type} (${section.label}):`,
				`\t- Description: ${section.description}`,
				'\t- When to use:',
				formatGuidanceList(section.whenToUse),
				'\t- When not to use:',
				formatGuidanceList(section.whenNotToUse),
				'\t- Content guidance:',
				formatGuidanceList(section.contentGuidance)
			].join('\n');
		})
		.join('\n\n');
}

function serializeContext(context: PromptContext): string {
	return JSON.stringify(
		{
			allowedSectionTypes: context.allowedSectionTypes,
			requiredSectionTypes: context.requiredSectionTypes,
			disallowedReasonByType: context.disallowedReasonByType,
			sectionCatalog: context.sectionCatalog
		},
		null,
		2
	);
}

export const buildLandingPageStrategistSystemPrompt = (context: PromptContext) =>
	`You are a senior landing page strategist for premium professional services campaigns.

Your task is to take a campaign brief, a generated Google Ads package, and the single selected ad group, and produce a strategic landing page plan for Campaign Studio.

You are NOT generating final render JSON.
You are NOT generating HTML.
You are NOT generating database records.

This is a single-intent MVP pipeline.
You must design exactly one focused landing page aligned to the single ad group.

Your priorities are:

* strong alignment between keyword intent, ad concept, and landing page
* premium, credible positioning
* clear conversion path
* message match with the ad group
* restraint and specificity over generic marketing fluff

Section catalog and runtime constraints:
${serializeContext(context)}

Rules:

* use only section types from allowedSectionTypes
* include every type in requiredSectionTypes
* place seo as the first section in sectionPlan
* include at least requiredSectionTypes.length sections
* section selection must actively follow section catalog guidance (description, whenToUse, whenNotToUse, contentGuidance)
* avoid selecting adjacent sections that do the same job or repeat the same narrative function
* section purpose and contentDirection are internal planning artifacts, not final customer-facing copy
* contentDirection must describe what unique job each section must accomplish in the conversion narrative
* when immediate_authority_hero is selected, choose exactly one hero video from input.assets.assetCatalog.heroVideos by ID
* when hybrid_content_section is selected, choose 1-3 supporting images from input.assets.assetCatalog.hybridSupportingImages by ID
* when hybrid_content_section is selected, prefer selecting 3 supporting images that map clearly to intended audience outcomes
* use only IDs that exist in input.assets.assetCatalog
* never invent media IDs or media URLs
* section order should reflect a strong conversion narrative
* avoid bloated or repetitive pages
* maintain message match with ad intent without collapsing multiple sections into one repeated line
* keep the page premium, specific, and commercially credible
* do not invent fake claims, fake client names, fake testimonials, fake metrics, or fake credentials
* return JSON only

Return exactly one valid JSON object with this shape:
{
  "pageTitle": "string",
  "conversionGoal": "string",
  "messagingAngle": "string",
  "sectionPlan": [
    {
      "type": "section_type",
      "purpose": "string",
      "contentDirection": "string"
    }
  ],
  "assetPlan": {
    "hero": {
      "videoAssetId": "string",
      "rationale": "string"
    },
    "hybridContentSection": {
      "supportingImageAssetIds": ["string"],
      "rationale": "string"
    }
  }
}`;

export const appendPromptLibraryGuidance = (
	basePrompt: string,
	promptLibraryGuidance?: string
): string => {
	const guidance = promptLibraryGuidance?.trim();
	if (!guidance) {
		return basePrompt;
	}

	return `${basePrompt}

Prompt library guidance:

${guidance}`;
};

export const landingPageStrategistUserPrompt = (
	input: LandingPageGenerationInput,
	context: PromptContext
) =>
	`Generate a landing page plan for this single-intent campaign input.

Context:
${serializeContext(context)}

Landing page generation input:
${JSON.stringify(input, null, 2)}`;

export const buildLandingPageWriterSystemPrompt = (
	context: PromptContext,
	selectedSectionTypes: readonly string[] = [],
	promptLibraryGuidance?: string
) => {
	const sectionTypesForGuidance =
		selectedSectionTypes.length > 0 ? selectedSectionTypes : context.allowedSectionTypes;

	const basePrompt = `You are a strict landing page JSON writer for Campaign Studio.

Your task is to convert a landing page generation input and a strategic landing page plan into the exact final landing page document required by the application.

You are NOT writing commentary.
You are NOT writing markdown.
You are NOT generating HTML.
You must return exactly one valid JSON object.

This is a single-intent MVP pipeline.
You must generate exactly one landing page document aligned to the single ad group.

Section catalog and runtime constraints:
${serializeContext(context)}

General requirements:

* use only section types in allowedSectionTypes
* include every section type in requiredSectionTypes
* place seo as the first section
* use section props exactly as required by each section contract
* preserve message match with ad group and strategy
* section catalog rules are binding generation constraints, including whenNotToUse and contentGuidance
* return JSON only

Global copy quality rules:

${buildGlobalCopyQualityRulesBlock()}

Selected section guidance (binding for this page plan):

${buildSelectedSectionGuidanceBlock(context, sectionTypesForGuidance)}

Asset usage requirements:

* landing page generation input includes input.assets with pre-approved media, proof, and compliance records
* for logos_of_trust_ribbon, use input.assets.fixedLogosRibbon.logos
* for proof_of_performance, use input.assets.fixedProofOfPerformance.testimonials
* for hero media, resolve the selected ID from plan.assetPlan.hero.videoAssetId against input.assets.assetCatalog.heroVideos
* for hybrid supporting visuals, resolve IDs from plan.assetPlan.hybridContentSection.supportingImageAssetIds against input.assets.assetCatalog.hybridSupportingImages
* for compliance footer fields, use input.assets.complianceDefaults
* use only approved assets listed in input.assets
* do not invent assets outside input.assets

Hybrid section contract requirements:

* if hybrid_content_section is included, props.intro is required
* if hybrid_content_section is included, write intro as a bridge from audience pain to practical outcomes for this campaign topic and format
* if hybrid_content_section is included, props.benefits must be [{ "title": "string", "body": "string", "imageUrl": "string" }]
* if hybrid_content_section is included, aim for exactly 3 benefits
* if hybrid_content_section is included, every benefit must state what the audience will leave with and explicitly connect audience + topic + format
* if hybrid_content_section is included, each benefit imageUrl must come from plan.assetPlan.hybridContentSection.supportingImageAssetIds resolved against input.assets.assetCatalog.hybridSupportingImages (re-use is allowed if fewer than 3 images are selected)
* if hybrid_content_section is included, props.deepDiveTitle is required
* if hybrid_content_section is included, strongly bias props.deepDiveTitle to "Why Christoph"
* if hybrid_content_section is included, props.deepDiveItems must be [{ "title": "string", "body": "string" }]
* if hybrid_content_section is included, deepDiveItems should justify why Christoph is qualified to deliver the promised outcomes (proof, lived experience, delivery fit, practical execution)`;

	return appendPromptLibraryGuidance(basePrompt, promptLibraryGuidance);
};

export const landingPageWriterUserPrompt = (
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	context: PromptContext
) =>
	`Convert this landing page generation input and strategic page plan into the exact final landing page document JSON required by the application.

Context:
${serializeContext(context)}

Landing page generation input:
${JSON.stringify(input, null, 2)}

Landing page plan:
${JSON.stringify(plan, null, 2)}`;
