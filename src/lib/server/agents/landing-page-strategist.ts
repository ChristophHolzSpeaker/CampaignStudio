import { callOpenRouter } from '$lib/server/openrouter/client';
import {
	landingPageStrategistSystemPrompt,
	landingPageStrategistUserPrompt
} from './prompts/landing-page';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import { landingPagePlanSchema, type LandingPagePlan } from './schemas/landing-page-plan';

export async function generateLandingPagePlan(
	input: LandingPageGenerationInput
): Promise<LandingPagePlan> {
	const userPrompt = landingPageStrategistUserPrompt(input);

	let response;
	try {
		console.log('Landing page strategist: calling OpenRouter');
		response = await callOpenRouter({
			model: 'google/gemini-3.1-flash-lite-preview',
			systemPrompt: landingPageStrategistSystemPrompt,
			userPrompt,
			responseFormat: 'json_object'
		});
		console.log('Landing page strategist: OpenRouter responded');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Landing page strategist: OpenRouter error', message);
		throw new Error(`Landing page strategist failed: ${message}`);
	}

	const parsed = landingPagePlanSchema.safeParse(response);
	if (!parsed.success) {
		console.error('Landing page strategist: validation failed', parsed.error.format());
		throw new Error(`Invalid strategist output: ${parsed.error.message}`);
	}

	console.log('Landing page strategist: plan validated');
	return parsed.data;
}
