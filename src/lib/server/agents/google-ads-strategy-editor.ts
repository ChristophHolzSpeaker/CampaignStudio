import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import { adPackageStrategySchema, type AdPackageStrategy } from './schemas/ad-package-strategy';

const strategyEditorSystemPrompt = `You are a strict JSON editor for campaign strategy updates.

Your task is to update an existing campaign strategy object based on an instruction.

You must:
- preserve existing strategy fields unless the instruction requires changes
- apply the requested change with a minimal diff when possible
- keep wording commercially credible and concise

You must return exactly one valid JSON object with this shape:
{
  "targetingSummary": "string",
  "messagingAngle": "string",
  "conversionGoal": "string",
  "notes": ["string"]
}

Rules:
- return JSON only
- do not add extra fields
- do not return null for required fields
- notes is optional; include it only when useful
- if the request conflicts with current strategy, prioritize the user request while preserving other intent`;

export async function updateGoogleAdsStrategyFromPrompt(
	currentStrategy: AdPackageStrategy,
	changePrompt: string,
	traceContext: LlmTraceContext = {}
): Promise<AdPackageStrategy> {
	const userPrompt = `Update this strategy with the requested change.\n\nCurrent strategy JSON:\n${JSON.stringify(
		currentStrategy,
		null,
		2
	)}\n\nRequested change:\n${changePrompt}`;

	let response;
	try {
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'google_ads_strategy_editor' },
			{ model: 'google/gemini-3.1-flash-lite-preview' }
		);

		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: strategyEditorSystemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'google_ads_strategy_editor' }
		});

		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'google_ads_strategy_editor' },
			{ responsePreview: JSON.stringify(response) }
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		traceLlm(
			'agent_stage_error',
			{ ...traceContext, stage: 'google_ads_strategy_editor' },
			{ message }
		);
		throw new Error(`Google Ads strategy editor failed: ${message}`);
	}

	const parsed = adPackageStrategySchema.safeParse(response);
	if (!parsed.success) {
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'google_ads_strategy_editor' },
			{ issues: parsed.error.issues }
		);
		throw new Error(`Invalid strategy editor output: ${parsed.error.message}`);
	}

	return parsed.data;
}
