import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import {
	buildLandingPageStrategistSystemPrompt,
	landingPageStrategistUserPrompt
} from './prompts/landing-page';
import { buildSectionCatalog } from './section-catalog';
import { getSectionEligibility } from './section-eligibility';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import {
	landingPagePlanSchema,
	type LandingPagePlan,
	validateLandingPagePlanSections
} from './schemas/landing-page-plan';

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
			systemPrompt: buildLandingPageStrategistSystemPrompt(promptContext),
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
		throw new Error(`Invalid strategist output: ${parsed.error.message}`);
	}

	validateLandingPagePlanSections(
		parsed.data,
		eligibility.allowedSectionTypes,
		eligibility.requiredSectionTypes
	);

	console.log('Landing page strategist: plan validated');
	return parsed.data;
}
