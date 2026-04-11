import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import {
	campaignPlannerInputSchema,
	campaignPlannerOutputSchema,
	type CampaignPlannerInput,
	type CampaignPlannerOutput
} from './schemas/campaign-planner';
import { campaignPlannerSystemPrompt, campaignPlannerUserPrompt } from './prompts/campaign-planner';

export async function runCampaignPlanner(
	input: CampaignPlannerInput,
	traceContext: LlmTraceContext = {}
): Promise<CampaignPlannerOutput> {
	const parsedInput = campaignPlannerInputSchema.safeParse(input);
	if (!parsedInput.success) {
		throw new Error(`Invalid planner input: ${parsedInput.error.message}`);
	}

	const userPrompt = campaignPlannerUserPrompt(parsedInput.data);

	let response;
	try {
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'campaign_planner' },
			{ model: 'google/gemini-3.1-flash-lite-preview' }
		);

		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: campaignPlannerSystemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'campaign_planner' }
		});

		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'campaign_planner' },
			{ responsePreview: JSON.stringify(response) }
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'campaign_planner' }, { message });
		throw new Error(`Campaign planner failed: ${message}`);
	}

	const parsedOutput = campaignPlannerOutputSchema.safeParse(response);
	if (!parsedOutput.success) {
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'campaign_planner' },
			{ issues: parsedOutput.error.issues }
		);
		throw new Error(`Invalid planner output: ${parsedOutput.error.message}`);
	}

	return parsedOutput.data;
}
