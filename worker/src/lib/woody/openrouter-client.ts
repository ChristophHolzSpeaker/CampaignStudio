import type { WorkerEnv } from '../env';
import type { WoodyProviderError } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export type OpenRouterChatRequest = {
	model: string;
	system_prompt: string;
	user_prompt: string;
	response_format?: 'json_object' | 'text';
	timeout_ms?: number;
};

export type OpenRouterChatSuccess = {
	content: string;
	model: string;
	usage: unknown | null;
	raw_response: unknown;
};

type OpenRouterApiError = WoodyProviderError & {
	provider: 'openrouter';
};

function getTimeoutMs(env: WorkerEnv, override?: number): number {
	if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
		return Math.floor(override);
	}

	const configured = env.WOODY_OPENROUTER_TIMEOUT_MS;
	if (!configured) {
		return DEFAULT_TIMEOUT_MS;
	}

	const parsed = Number(configured);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_TIMEOUT_MS;
	}

	return Math.floor(parsed);
}

function parseApiError(status: number, body: string): OpenRouterApiError {
	let parsedBody: unknown = body;
	let message = `OpenRouter API error (${status})`;

	try {
		const asJson = JSON.parse(body) as {
			error?: {
				message?: string;
				code?: string;
			};
		};
		parsedBody = asJson;
		message = asJson.error?.message ?? message;
	} catch {
		message = `${message}: ${body}`;
	}

	return {
		provider: 'openrouter',
		status,
		code: 'http_error',
		message,
		body: parsedBody
	};
}

async function callOnce(
	env: WorkerEnv,
	request: OpenRouterChatRequest
): Promise<OpenRouterChatSuccess> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw {
			provider: 'openrouter',
			code: 'network_error',
			message: 'OPENROUTER_API_KEY is not set'
		} satisfies OpenRouterApiError;
	}

	const timeoutMs = getTimeoutMs(env, request.timeout_ms);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: request.model,
				messages: [
					{ role: 'system', content: request.system_prompt },
					{ role: 'user', content: request.user_prompt }
				],
				response_format: { type: request.response_format ?? 'json_object' }
			}),
			signal: controller.signal
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw parseApiError(response.status, errorBody);
		}

		const raw = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
			model?: string;
			usage?: unknown;
		};

		const content = raw.choices?.[0]?.message?.content;
		if (!content || typeof content !== 'string') {
			throw {
				provider: 'openrouter',
				code: 'invalid_provider_payload',
				message: 'OpenRouter response missing choices[0].message.content',
				body: raw
			} satisfies OpenRouterApiError;
		}

		return {
			content,
			model: raw.model ?? request.model,
			usage: raw.usage ?? null,
			raw_response: raw
		};
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw {
				provider: 'openrouter',
				code: 'timeout',
				message: `OpenRouter request timed out after ${timeoutMs}ms`
			} satisfies OpenRouterApiError;
		}

		if (
			typeof error === 'object' &&
			error !== null &&
			'provider' in error &&
			(error as { provider: string }).provider === 'openrouter'
		) {
			throw error;
		}

		throw {
			provider: 'openrouter',
			code: 'network_error',
			message: error instanceof Error ? error.message : 'Unknown network error'
		} satisfies OpenRouterApiError;
	} finally {
		clearTimeout(timeout);
	}
}

export async function callOpenRouterChat(
	env: WorkerEnv,
	request: OpenRouterChatRequest
): Promise<OpenRouterChatSuccess> {
	let lastError: OpenRouterApiError | null = null;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		try {
			return await callOnce(env, request);
		} catch (error) {
			const asProviderError = error as OpenRouterApiError;
			lastError = asProviderError;

			const status = asProviderError.status;
			const retriable =
				asProviderError.code === 'timeout' ||
				asProviderError.code === 'network_error' ||
				(typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status));

			if (!retriable || attempt === MAX_ATTEMPTS) {
				throw asProviderError;
			}
		}
	}

	throw (
		lastError ?? {
			provider: 'openrouter',
			code: 'network_error',
			message: 'OpenRouter request failed unexpectedly'
		}
	);
}
