import { env } from '$env/dynamic/private';

export type OpenRouterResponseFormat = 'json_object' | 'txt';

export interface OpenRouterRequest {
	model: string;
	systemPrompt: string;
	userPrompt: string;
	responseFormat?: OpenRouterResponseFormat;
}

export async function callOpenRouter({
	model,
	systemPrompt,
	userPrompt,
	responseFormat = 'json_object'
}: OpenRouterRequest) {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY is not set');
	}

	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			response_format: { type: responseFormat }
		})
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
	}

	const data = await response.json();
	const content = data?.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error('No content returned from OpenRouter');
	}

	const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	const jsonString = jsonMatch ? jsonMatch[1] : content;

	return JSON.parse(jsonString);
}
