import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import { googleAdsStrategySchema } from './schemas/google-ads-strategy';
import type { CampaignBrief } from './schemas/campaign-brief';
import type { GoogleAdsStrategy } from './schemas/google-ads-strategy';
import type { AdPackageStrategy } from './schemas/ad-package-strategy';
import {
	googleAdsStrategistSystemPrompt,
	googleAdsStrategistUserPrompt
} from './prompts/google-ads';

export async function generateGoogleAdsStrategy(
	brief: CampaignBrief,
	traceContext: LlmTraceContext = {},
	overrides?: AdPackageStrategy
): Promise<GoogleAdsStrategy> {
	const userPrompt = googleAdsStrategistUserPrompt(brief, overrides);
	let response;
	try {
		console.log('Google Ads strategist: calling OpenRouter');
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'google_ads_strategist' },
			{
				model: 'google/gemini-3.1-flash-lite-preview'
			}
		);
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: googleAdsStrategistSystemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'google_ads_strategist' }
		});
		console.log('Google Ads strategist: OpenRouter responded');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'google_ads_strategist' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Google Ads strategist: OpenRouter error', message);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'google_ads_strategist' }, { message });
		throw new Error(`Google Ads strategist failed: ${message}`);
	}

	const parsed = googleAdsStrategySchema.safeParse(response);
	if (!parsed.success) {
		console.error('Google Ads strategist: validation failed', parsed.error.format());
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'google_ads_strategist' },
			{
				issues: parsed.error.issues
			}
		);
		throw new Error(`Invalid strategist output: ${parsed.error.message}`);
	}
	console.log('Google Ads strategist: strategy validated');

	if (!overrides) {
		return parsed.data;
	}

	return {
		...parsed.data,
		targetingSummary: overrides.targetingSummary,
		messagingAngle: overrides.messagingAngle,
		conversionGoal: overrides.conversionGoal
	};
}
