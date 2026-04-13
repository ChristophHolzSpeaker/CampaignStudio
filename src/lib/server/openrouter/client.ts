import { env } from '$env/dynamic/private';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';

export type OpenRouterResponseFormat = 'json_object' | 'txt';

export interface OpenRouterRequest {
	model: string;
	systemPrompt: string;
	userPrompt: string;
	responseFormat?: OpenRouterResponseFormat;
	traceContext?: LlmTraceContext;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1_200, 2_500] as const;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const fallbackModelsByPrimary: Record<string, string[]> = {
	'google/gemini-3.1-flash-lite-preview': ['google/gemini-2.5-flash']
};

class OpenRouterHttpError extends Error {
	status: number;
	body: string;

	constructor(status: number, body: string) {
		super(`OpenRouter API error (${status}): ${body}`);
		this.name = 'OpenRouterHttpError';
		this.status = status;
		this.body = body;
	}
}

class OpenRouterJsonParseError extends Error {
	rawContent: string;

	constructor(message: string, rawContent: string) {
		super(message);
		this.name = 'OpenRouterJsonParseError';
		this.rawContent = rawContent;
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		const cause =
			typeof error.cause === 'string'
				? error.cause
				: error.cause instanceof Error
					? error.cause.message
					: '';
		return cause ? `${error.message} (cause: ${cause})` : error.message;
	}

	return String(error);
}

function isRetriableError(error: unknown): boolean {
	if (error instanceof OpenRouterHttpError) {
		return RETRYABLE_STATUS_CODES.has(error.status);
	}

	if (error instanceof OpenRouterJsonParseError) {
		return true;
	}

	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return true;
		}

		const message = error.message.toLowerCase();
		return (
			message.includes('fetch failed') ||
			message.includes('network') ||
			message.includes('timeout') ||
			message.includes('socket') ||
			message.includes('econnreset') ||
			message.includes('etimedout')
		);
	}

	return false;
}

function getRetryDelayMs(attempt: number): number {
	const baseDelay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)] ?? 2_500;
	const jitter = Math.floor(Math.random() * 300);
	return baseDelay + jitter;
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouterOnce({
	apiKey,
	model,
	systemPrompt,
	userPrompt,
	responseFormat,
	traceContext
}: {
	apiKey: string;
	model: string;
	systemPrompt: string;
	userPrompt: string;
	responseFormat: OpenRouterResponseFormat;
	traceContext: LlmTraceContext;
}) {
	const requestStart = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(OPENROUTER_URL, {
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
			}),
			signal: controller.signal
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new OpenRouterHttpError(response.status, errorBody);
		}

		const data = await response.json();
		const content = data?.choices?.[0]?.message?.content;
		if (!content || typeof content !== 'string') {
			throw new Error('No content returned from OpenRouter');
		}

		if (responseFormat === 'txt') {
			return {
				parsed: content,
				rawContent: content,
				durationMs: Date.now() - requestStart
			};
		}

		const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		const jsonString = jsonMatch ? jsonMatch[1] : content;

		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonString);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OpenRouterJsonParseError(`Invalid JSON from model: ${message}`, content);
		}

		return {
			parsed,
			rawContent: content,
			durationMs: Date.now() - requestStart
		};
	} finally {
		clearTimeout(timeout);
	}
}

export async function callOpenRouter({
	model,
	systemPrompt,
	userPrompt,
	responseFormat = 'json_object',
	traceContext = {}
}: OpenRouterRequest) {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY is not set');
	}

	const modelsToTry = [model, ...(fallbackModelsByPrimary[model] ?? [])];
	let lastRetriableError: unknown = null;

	for (const modelToTry of modelsToTry) {
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			try {
				traceLlm('openrouter_attempt_start', traceContext, {
					model: modelToTry,
					attempt,
					maxAttempts: MAX_ATTEMPTS,
					responseFormat,
					systemPromptLength: systemPrompt.length,
					userPromptLength: userPrompt.length
				});

				if (attempt > 1) {
					console.warn(
						`OpenRouter retry attempt ${attempt}/${MAX_ATTEMPTS} using model ${modelToTry}`
					);
				}

				const result = await callOpenRouterOnce({
					apiKey,
					model: modelToTry,
					systemPrompt,
					userPrompt,
					responseFormat,
					traceContext
				});

				traceLlm('openrouter_attempt_success', traceContext, {
					model: modelToTry,
					attempt,
					durationMs: result.durationMs,
					rawContentPreview: result.rawContent,
					parsedPreview: JSON.stringify(result.parsed)
				});

				return result.parsed;
			} catch (error) {
				const retriable = isRetriableError(error);
				const finalAttempt = attempt === MAX_ATTEMPTS;
				const parseErrorRawContentPreview =
					error instanceof OpenRouterJsonParseError ? error.rawContent : undefined;

				traceLlm('openrouter_attempt_error', traceContext, {
					model: modelToTry,
					attempt,
					retriable,
					finalAttempt,
					error: getErrorMessage(error),
					parseErrorRawContentPreview
				});

				if (!retriable) {
					throw new Error(
						`OpenRouter request failed for model ${modelToTry} (non-retriable): ${getErrorMessage(error)}`
					);
				}

				lastRetriableError = error;

				if (finalAttempt) {
					break;
				}

				await sleep(getRetryDelayMs(attempt));
			}
		}

		if (modelToTry !== modelsToTry.at(-1)) {
			console.warn(`OpenRouter switching to fallback model after failures: ${modelToTry}`);
			traceLlm('openrouter_switch_fallback_model', traceContext, {
				failedModel: modelToTry,
				nextModel: modelsToTry[modelsToTry.indexOf(modelToTry) + 1] ?? null
			});
		}
	}

	throw new Error(
		`OpenRouter request failed after retries and fallback models (${modelsToTry.join(', ')}): ${getErrorMessage(lastRetriableError)}`
	);
}
