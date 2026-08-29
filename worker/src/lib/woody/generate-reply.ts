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
	const lowerHtml = bodyHtml.toLowerCase();
	if (!lowerHtml.includes('<ul') || !lowerHtml.includes('</ul>')) {
		throw new Error('Generated HTML must include a <ul> summary list');
	}

	const listItemMatches = bodyHtml.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
	if (listItemMatches.length !== 7) {
		throw new Error('Generated HTML summary list must contain exactly 7 list items');
	}
}

function getLocalizedSummaryLabels(language: string): readonly string[] {
	const normalized = language.trim().toLowerCase();
	if (normalized.startsWith('de') || normalized === 'german') {
		return [
			'Ort',
			'Datum und Uhrzeit',
			'Veranstaltungsname',
			'Publikum',
			'Thema',
			'Anfragender',
			'Organisation'
		];
	}
	if (normalized.startsWith('fr') || normalized === 'french') {
		return [
			'Lieu',
			'Date et heure',
			'Nom de l’événement',
			'Public',
			'Thème',
			'Demandeur',
			'Organisation'
		];
	}
	if (normalized.startsWith('es') || normalized === 'spanish') {
		return [
			'Lugar',
			'Fecha y hora',
			'Nombre del evento',
			'Público',
			'Tema',
			'Solicitante',
			'Organización'
		];
	}
	return [
		'Location',
		'Date and time',
		'Event name',
		'Audience',
		'Topic',
		'Requester',
		'Organization'
	];
}

function stripHtml(value: string): string {
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function validateSummaryOrder(input: {
	bodyHtml: string;
	bodyText: string;
	responseLanguage: string;
}): void {
	const labels = getLocalizedSummaryLabels(input.responseLanguage);
	const listItems = input.bodyHtml.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];

	for (const [index, label] of labels.entries()) {
		if (!stripHtml(listItems[index] ?? '').startsWith(`${label}:`)) {
			throw new Error(`Generated HTML summary item ${index + 1} must start with ${label}:`);
		}
	}

	let previousIndex = -1;
	for (const label of labels) {
		const labelIndex = input.bodyText.indexOf(`${label}:`, previousIndex + 1);
		if (labelIndex < 0) {
			throw new Error(`Generated text summary is missing ordered label ${label}:`);
		}
		previousIndex = labelIndex;
	}
}

function getBookingLinkLabel(language: string): string {
	const normalized = language.trim().toLowerCase();
	if (normalized.startsWith('de') || normalized === 'german') return 'Videoanruf planen';
	if (normalized.startsWith('fr') || normalized === 'french') return 'Planifier un appel vidéo';
	if (normalized.startsWith('es') || normalized === 'spanish') return 'Programar videollamada';
	return 'Schedule a video call';
}

function validateBookingLink(input: {
	bodyHtml: string;
	bodyText: string;
	bookingLink: string;
	responseLanguage: string;
}): void {
	const visibleHtml = stripHtml(input.bodyHtml);
	const linkLabel = getBookingLinkLabel(input.responseLanguage);
	if (!input.bodyHtml.includes(`href="${input.bookingLink}"`)) {
		throw new Error('Generated HTML must link to the provided booking URL');
	}
	if (!visibleHtml.includes(linkLabel) || !visibleHtml.includes(input.bookingLink)) {
		throw new Error('Generated HTML must include the booking label and visible fallback URL');
	}
	if (!input.bodyText.includes(linkLabel) || !input.bodyText.includes(input.bookingLink)) {
		throw new Error('Generated text must include the booking label and fallback URL');
	}
}

function hasForbiddenLeadWording(value: string): boolean {
	const normalized = value.toLowerCase();
	return (
		normalized.includes('lead call') ||
		normalized.includes('your lead call') ||
		normalized.includes('this lead call') ||
		normalized.includes('sales call')
	);
}

function validateNoForbiddenLeadWording(input: {
	subject: string;
	bodyHtml: string;
	bodyText: string;
}): void {
	if (
		hasForbiddenLeadWording(input.subject) ||
		hasForbiddenLeadWording(input.bodyHtml) ||
		hasForbiddenLeadWording(input.bodyText)
	) {
		throw new Error('Generated output contains forbidden lead-call wording');
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
			location: WOODY_TO_DETERMINE,
			date_time: WOODY_TO_DETERMINE,
			event_name: WOODY_TO_DETERMINE,
			audience: WOODY_TO_DETERMINE,
			topic: WOODY_TO_DETERMINE,
			requester: WOODY_TO_DETERMINE,
			organization: WOODY_TO_DETERMINE
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
		validateSummaryOrder({
			bodyHtml: modelOutput.body_html,
			bodyText: modelOutput.body_text,
			responseLanguage: languageResolution.resolved_language
		});
		validateBookingLink({
			bodyHtml: modelOutput.body_html,
			bodyText: modelOutput.body_text,
			bookingLink: parsedInput.booking_link,
			responseLanguage: languageResolution.resolved_language
		});
		validateNoForbiddenLeadWording({
			subject: modelOutput.subject,
			bodyHtml: modelOutput.body_html,
			bodyText: modelOutput.body_text
		});

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
