import { callOpenRouter } from '$lib/server/openrouter/client';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import type { CampaignBrief } from './schemas/campaign-brief';
import type { GoogleAdsStrategy } from './schemas/google-ads-strategy';
import {
	googleAdsStructurerSystemPrompt,
	googleAdsStructurerUserPrompt
} from './prompts/google-ads';
import { googleAdsPackageDraftSchema } from './schemas/google-ads-package';
import type { GoogleAdsPackageDraft } from './schemas/google-ads-package';

export async function generateGoogleAdsPackage(
	brief: CampaignBrief,
	strategy: GoogleAdsStrategy,
	traceContext: LlmTraceContext = {}
): Promise<GoogleAdsPackageDraft> {
	const userPrompt = googleAdsStructurerUserPrompt(brief, strategy);
	let response;
	try {
		console.log('Google Ads structurer: calling OpenRouter');
		traceLlm(
			'agent_stage_start',
			{ ...traceContext, stage: 'google_ads_structurer' },
			{
				model: 'google/gemini-3.1-flash-lite-preview'
			}
		);
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: googleAdsStructurerSystemPrompt,
			userPrompt,
			responseFormat: 'json_object',
			traceContext: { ...traceContext, stage: 'google_ads_structurer' }
		});
		console.log('Google Ads structurer: OpenRouter responded');
		traceLlm(
			'agent_stage_response',
			{ ...traceContext, stage: 'google_ads_structurer' },
			{
				responsePreview: JSON.stringify(response)
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Google Ads structurer: OpenRouter error', message);
		traceLlm('agent_stage_error', { ...traceContext, stage: 'google_ads_structurer' }, { message });
		throw new Error(`Google Ads structurer failed: ${message}`);
	}

	const parsed = googleAdsPackageDraftSchema.safeParse(response);
	if (!parsed.success) {
		console.error('Google Ads structurer: validation failed', parsed.error.format());
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'google_ads_structurer' },
			{
				issues: parsed.error.issues
			}
		);
		throw new Error(`Invalid package draft: ${parsed.error.message}`);
	}
	console.log('Google Ads structurer: package draft validated');

	return parsed.data;
}
