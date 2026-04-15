import type { WorkerEnv } from '../env';
import { buildWoodyPrompt } from './prompt';
import {
	WOODY_TO_DETERMINE,
	woodyGenerateReplyInputSchema,
	woodyGenerateReplyOutputSchema,
	woodyModelOutputSchema
} from './schemas';
import { callOpenRouterChat } from './openrouter-client';
import type { WoodyGenerateReplyInput, WoodyGenerateReplyOutput } from './types';

const DEFAULT_WOODY_MODEL = 'openai/gpt-4.1-mini';

function parseSupportedLanguages(env: WorkerEnv): Set<string> {
	const configured = env.WOODY_SUPPORTED_LANGUAGES;
	if (!configured) {
		return new Set(['english', 'en', 'german', 'de', 'french', 'fr', 'spanish', 'es']);
	}

	return new Set(
		configured
			.split(',')
			.map((value: string) => value.trim().toLowerCase())
			.filter((value: string) => value.length > 0)
	);
}

function resolveLanguage(
	env: WorkerEnv,
	requested: string
): {
	resolved_language: string;
	fallback_applied: boolean;
	requested_language: string;
} {
	const requestedNormalized = requested.trim().toLowerCase();
	const supported = parseSupportedLanguages(env);

	if (supported.has(requestedNormalized)) {
		return {
			resolved_language: requested,
			fallback_applied: false,
			requested_language: requested
		};
	}

	return {
		resolved_language: 'English',
		fallback_applied: true,
		requested_language: requested
	};
}

function parseModelJsonContent(content: string): unknown {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	const jsonCandidate = fenced ? fenced[1] : content;
	return JSON.parse(jsonCandidate);
}

function hasInvalidFormatting(value: string): boolean {
	return value.includes('```') || value.includes('~~~');
}

function validateHtmlShape(bodyHtml: string): void {
	const requiredLabels = [
		'Event Topic',
		'Talking Length',
		'Location',
		'Date/Time',
		'Event Name',
		'Audience',
		'Agent',
		'Client'
	];

	const lowerHtml = bodyHtml.toLowerCase();
	if (!lowerHtml.includes('<ul') || !lowerHtml.includes('</ul>')) {
		throw new Error('Generated HTML must include a <ul> summary list');
	}

	for (const label of requiredLabels) {
		if (!bodyHtml.includes(label)) {
			throw new Error(`Generated HTML is missing required summary label: ${label}`);
		}
	}
}

function fallbackErrorOutput(params: {
	model: string;
	promptVersion: string;
	error: string;
	rawResponse: unknown;
	requestedLanguage: string;
	resolvedLanguage: string;
	fallbackApplied: boolean;
}): WoodyGenerateReplyOutput {
	const output: WoodyGenerateReplyOutput = {
		subject: '',
		body_html: '',
		body_text: '',
		extracted_fields: {
			event_topic: WOODY_TO_DETERMINE,
			talking_length: WOODY_TO_DETERMINE,
			location: WOODY_TO_DETERMINE,
			date_time: WOODY_TO_DETERMINE,
			event_name: WOODY_TO_DETERMINE,
			audience: WOODY_TO_DETERMINE,
			agent: WOODY_TO_DETERMINE,
			client: WOODY_TO_DETERMINE
		},
		model: params.model,
		provider: 'openrouter',
		prompt_version: params.promptVersion,
		generation_status: 'error',
		raw_usage: null,
		raw_response: {
			error: params.error,
			raw_provider_response: params.rawResponse,
			requested_language: params.requestedLanguage,
			resolved_language: params.resolvedLanguage,
			fallback_applied: params.fallbackApplied
		}
	};

	return woodyGenerateReplyOutputSchema.parse(output);
}

export async function generateWoodyReply(
	env: WorkerEnv,
	input: WoodyGenerateReplyInput
): Promise<WoodyGenerateReplyOutput> {
	const parsedInput = woodyGenerateReplyInputSchema.parse(input);
	const model = env.WOODY_OPENROUTER_MODEL ?? DEFAULT_WOODY_MODEL;

	const languageResolution = resolveLanguage(env, parsedInput.response_language);
	const prompt = buildWoodyPrompt({
		...parsedInput,
		response_language: languageResolution.resolved_language
	});

	try {
		const providerResponse = await callOpenRouterChat(env, {
			model,
			system_prompt: prompt.system_prompt,
			user_prompt: prompt.user_prompt,
			response_format: 'json_object'
		});

		const parsedJson = parseModelJsonContent(providerResponse.content);
		const modelOutput = woodyModelOutputSchema.parse(parsedJson);

		if (
			hasInvalidFormatting(modelOutput.body_html) ||
			hasInvalidFormatting(modelOutput.body_text)
		) {
			throw new Error('Model output contains code-fence formatting');
		}

		validateHtmlShape(modelOutput.body_html);

		const output: WoodyGenerateReplyOutput = {
			subject: modelOutput.subject,
			body_html: modelOutput.body_html,
			body_text: modelOutput.body_text,
			extracted_fields: modelOutput.extracted_fields,
			model: providerResponse.model,
			provider: 'openrouter',
			prompt_version: prompt.prompt_version,
			generation_status: 'success',
			raw_usage: providerResponse.usage,
			raw_response: {
				provider_response: providerResponse.raw_response,
				requested_language: languageResolution.requested_language,
				resolved_language: languageResolution.resolved_language,
				fallback_applied: languageResolution.fallback_applied
			}
		};

		return woodyGenerateReplyOutputSchema.parse(output);
	} catch (error) {
		return fallbackErrorOutput({
			model,
			promptVersion: prompt.prompt_version,
			error: error instanceof Error ? error.message : 'Woody generation failed',
			rawResponse: error,
			requestedLanguage: languageResolution.requested_language,
			resolvedLanguage: languageResolution.resolved_language,
			fallbackApplied: languageResolution.fallback_applied
		});
	}
}
