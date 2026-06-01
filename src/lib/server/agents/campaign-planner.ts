import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import {
	campaignPlannerInputSchema,
	campaignPlannerOutputSchema,
	type CampaignPlannerInput,
	type CampaignPlannerOutput,
	type PlannerRequiredField
} from './schemas/campaign-planner';
import { campaignPlannerSystemPrompt, campaignPlannerUserPrompt } from './prompts/campaign-planner';

const channelLikeFormatPattern =
	/\b(linkedin|ads?|email|outreach|ppc|seo|instagram|facebook|google ads?|youtube ads?|display)\b/i;

function normalizePlannerOutput(output: CampaignPlannerOutput): CampaignPlannerOutput {
	const resolvedFields = { ...output.resolvedFields };
	const questions = [...output.questions];
	let missingFields = [...output.missingFields] as PlannerRequiredField[];

	if (!resolvedFields.attendeeAudience && resolvedFields.audience) {
		resolvedFields.attendeeAudience = resolvedFields.audience;
	}

	if (!resolvedFields.audience && resolvedFields.attendeeAudience) {
		resolvedFields.audience = resolvedFields.attendeeAudience;
	}

	if (resolvedFields.format && channelLikeFormatPattern.test(resolvedFields.format)) {
		if (!missingFields.includes('format')) {
			missingFields.push('format');
		}
		questions.push(
			'What is the event delivery format (for example: Keynote, Dinner speech, Workshop, Webinar)?'
		);
		const existingNotes = resolvedFields.notes?.trim() ?? '';
		resolvedFields.notes = [existingNotes, `Channel hint: ${resolvedFields.format}`]
			.filter((value) => value.length > 0)
			.join('\n');
		resolvedFields.format = undefined;
	}

	const dedupedMissing = [...new Set(missingFields)] as PlannerRequiredField[];
	const dedupedQuestions = [
		...new Set(questions.map((question) => question.trim()).filter(Boolean))
	];

	return {
		...output,
		resolvedFields,
		missingFields: dedupedMissing,
		questions: dedupedQuestions,
		readyToCreate: dedupedMissing.length === 0
	};
}

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
			model: 'google/gemini-3.1-flash-lite',
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

	return normalizePlannerOutput(parsedOutput.data);
}
