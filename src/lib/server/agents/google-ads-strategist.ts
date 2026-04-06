import { callOpenRouter } from '$lib/server/openrouter/client';
import { googleAdsStrategySchema } from './schemas/google-ads-strategy';
import type { CampaignBrief } from './schemas/campaign-brief';
import type { GoogleAdsStrategy } from './schemas/google-ads-strategy';
import {
	googleAdsStrategistSystemPrompt,
	googleAdsStrategistUserPrompt
} from './prompts/google-ads';

export async function generateGoogleAdsStrategy(brief: CampaignBrief): Promise<GoogleAdsStrategy> {
	const userPrompt = googleAdsStrategistUserPrompt(brief);
	let response;
	try {
		console.log('Google Ads strategist: calling OpenRouter');
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: googleAdsStrategistSystemPrompt,
			userPrompt,
			responseFormat: 'json_object'
		});
		console.log('Google Ads strategist: OpenRouter responded');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Google Ads strategist: OpenRouter error', message);
		throw new Error(`Google Ads strategist failed: ${message}`);
	}

	const parsed = googleAdsStrategySchema.safeParse(response);
	if (!parsed.success) {
		console.error('Google Ads strategist: validation failed', parsed.error.format());
		throw new Error(`Invalid strategist output: ${parsed.error.message}`);
	}
	console.log('Google Ads strategist: strategy validated');

	return parsed.data;
}
