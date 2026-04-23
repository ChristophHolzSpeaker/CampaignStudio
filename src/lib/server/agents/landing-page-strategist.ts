import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import {
	appendPromptLibraryGuidance,
	buildLandingPageStrategistSystemPrompt,
	landingPageStrategistUserPrompt
} from './prompts/landing-page';
import { buildSectionCatalog } from './section-catalog';
import { getSectionEligibility } from './section-eligibility';
import { resolvePromptGuidanceForCampaign } from './prompt-guidance';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import {
	landingPagePlanSchema,
	type LandingPagePlan,
	validateLandingPagePlanSections
} from './schemas/landing-page-plan';

function buildStrategistRepairPrompt(
	input: LandingPageGenerationInput,
	invalidResponse: unknown,
	issues: unknown,
	allowedSectionTypes: readonly string[],
	requiredSectionTypes: readonly string[]
): string {
	return `Your previous JSON failed validation. Return one corrected JSON object only.

Corrective rules:
- keep the same campaign intent and conversion goal
- keep a single-intent page plan aligned to the selected ad group
- use only these allowed section types: ${allowedSectionTypes.join(', ')}
- include these required section types: ${requiredSectionTypes.join(', ')}
- sectionPlan must not contain duplicate section types
- place seo as the first section in sectionPlan
- when immediate_authority_hero is selected, include assetPlan.hero.videoAssetId from input.assets.assetCatalog.heroVideos
- when hybrid_content_section is selected, include assetPlan.hybridContentSection.supportingImageAssetIds from input.assets.assetCatalog.hybridSupportingImages
- when hybrid_content_section is selected, prefer 3 supportingImageAssetIds mapped to distinct audience outcomes
- never invent media IDs or media URLs
- do not output commentary or markdown
- return JSON only

Landing page generation input:
${JSON.stringify(input, null, 2)}

Previous invalid JSON:
${JSON.stringify(invalidResponse, null, 2)}

Validation issues:
${JSON.stringify(issues, null, 2)}`;
}

export async function generateLandingPagePlan(
	input: LandingPageGenerationInput,
	traceContext: LlmTraceContext = {}
): Promise<LandingPagePlan> {
	const eligibility = getSectionEligibility(input);
	const sectionCatalog = buildSectionCatalog(eligibility.allowedSectionTypes);
	const promptContext = {
		allowedSectionTypes: eligibility.allowedSectionTypes,
		requiredSectionTypes: eligibility.requiredSectionTypes,
		sectionCatalog,
		disallowedReasonByType: eligibility.disallowedReasonByType
	};

	const userPrompt = landingPageStrategistUserPrompt(input, promptContext);
	const baseSystemPrompt = buildLandingPageStrategistSystemPrompt(promptContext);

	let systemPrompt = baseSystemPrompt;
	try {
		const guidance = await resolvePromptGuidanceForCampaign('intermediate', {
			name: input.campaign.name,
			audience: input.campaign.audience,
			format: input.campaign.format,
			topic: input.campaign.topic,
			language: input.campaign.language,
			geography: input.campaign.geography,
			notes: input.campaign.notes
		});

		systemPrompt = appendPromptLibraryGuidance(baseSystemPrompt, guidance.guidance);
		traceLlm(
			'agent_prompt_guidance',
			{ ...traceContext, stage: 'landing_page_strategist' },
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
		console.warn('Landing page strategist: prompt guidance lookup failed', message);
		traceLlm(
			'agent_prompt_guidance_error',
			{ ...traceContext, stage: 'landing_page_strategist' },
			{ message }
		);
	}

	let response;
	try {
		console.log('Landing page strategist: calling OpenRouter');
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'landing_page_strategist' },
			{
				model: 'google/gemini-3.1-flash-lite-preview'
			}
		);
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'landing_page_strategist' }
		});
		console.log('Landing page strategist: OpenRouter responded');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'landing_page_strategist' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Landing page strategist: OpenRouter error', message);
		traceLlm(
			'agent_stage_error',
			{ ...traceContext, stage: 'landing_page_strategist' },
			{ message }
		);
		throw new Error(`Landing page strategist failed: ${message}`);
	}

	const parsed = landingPagePlanSchema.safeParse(response);
	if (!parsed.success) {
		console.error('Landing page strategist: validation failed', parsed.error.format());
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_strategist' },
			{
				issues: parsed.error.issues
			}
		);

		let repairedResponse;
		try {
			console.log('Landing page strategist: requesting repair pass');
			repairedResponse = await callOpenRouter({
				model: 'google/gemini-3.1-flash-lite-preview',
				systemPrompt,
				userPrompt: buildStrategistRepairPrompt(
					input,
					response,
					parsed.error.issues,
					eligibility.allowedSectionTypes,
					eligibility.requiredSectionTypes
				),
				responseFormat: 'json_object',
				traceContext: { ...traceContext, stage: 'landing_page_strategist_repair' }
			});
			console.log('Landing page strategist: repair response received');
			traceLlm(
				'agent_stage_response',
				{ ...traceContext, stage: 'landing_page_strategist_repair' },
				{
					responsePreview: JSON.stringify(repairedResponse)
				}
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			traceLlm(
				'agent_stage_error',
				{ ...traceContext, stage: 'landing_page_strategist_repair' },
				{ message }
			);
			throw new Error(`Landing page strategist repair failed: ${message}`);
		}

		const repairedParsed = landingPagePlanSchema.safeParse(repairedResponse);
		if (!repairedParsed.success) {
			traceLlm(
				'agent_stage_validation_error',
				{ ...traceContext, stage: 'landing_page_strategist_repair' },
				{
					issues: repairedParsed.error.issues
				}
			);
			throw new Error(`Invalid strategist output after repair: ${repairedParsed.error.message}`);
		}

		validateLandingPagePlanSections(
			repairedParsed.data,
			eligibility.allowedSectionTypes,
			eligibility.requiredSectionTypes
		);

		console.log('Landing page strategist: repaired plan validated');
		return repairedParsed.data;
	}

	validateLandingPagePlanSections(
		parsed.data,
		eligibility.allowedSectionTypes,
		eligibility.requiredSectionTypes
	);

	console.log('Landing page strategist: plan validated');
	return parsed.data;
}
