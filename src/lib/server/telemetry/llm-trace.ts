import { env } from '$env/dynamic/private';

const TRACE_PREFIX = 'LLM_TRACE';
const TRACE_PREVIEW_LIMIT = 4_000;

export type LlmTraceContext = {
	runId?: string;
	pipeline?: string;
	stage?: string;
	campaignId?: number;
};

function isTraceEnabled(): boolean {
	const value = env.LLM_TRACE_ENABLED;
	if (!value) {
		return true;
	}

	const normalized = value.trim().toLowerCase();
	return !['0', 'false', 'off', 'no'].includes(normalized);
}

function truncateString(value: string): string {
	if (value.length <= TRACE_PREVIEW_LIMIT) {
		return value;
	}

	return `${value.slice(0, TRACE_PREVIEW_LIMIT)}...<truncated>`;
}

function sanitize(value: unknown): unknown {
	if (typeof value === 'string') {
		return truncateString(value);
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitize(item));
	}

	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>).map(([key, innerValue]) => {
			if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('apikey')) {
				return [key, '<redacted>'];
			}

			return [key, sanitize(innerValue)];
		});

		return Object.fromEntries(entries);
	}

	return value;
}

export function createRunId(prefix = 'run'): string {
	const random = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${Date.now()}_${random}`;
}

export function traceLlm(
	event: string,
	context: LlmTraceContext = {},
	details: Record<string, unknown> = {}
): void {
	if (!isTraceEnabled()) {
		return;
	}

	const payload = sanitize({
		timestamp: new Date().toISOString(),
		event,
		...context,
		...details
	});

	try {
		console.log(`${TRACE_PREFIX} ${JSON.stringify(payload)}`);
	} catch {
		console.log(
			`${TRACE_PREFIX} ${JSON.stringify({ timestamp: new Date().toISOString(), event })}`
		);
	}
}
