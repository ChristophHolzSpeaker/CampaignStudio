import type { WorkerEnv, WorkerExecutionContext } from '../lib/env';
import { vi } from 'vitest';

const TEST_ENV_BASE: WorkerEnv = {
	SUPABASE_URL: 'http://localhost:54321',
	SUPABASE_SERVICE_ROLE_KEY: 'test',
	BOOKING_TOKEN_SECRET: 'test',
	INTERNAL_API_TOKEN: 'test'
};

export function makeTestEnv(overrides?: Partial<WorkerEnv>): WorkerEnv {
	return {
		...TEST_ENV_BASE,
		...overrides
	};
}

export function makeTestExecutionContext(): {
	ctx: WorkerExecutionContext;
	waitUntilMock: ReturnType<typeof vi.fn>;
} {
	const waitUntilMock = vi.fn();
	return {
		ctx: {
			waitUntil: waitUntilMock
		},
		waitUntilMock
	};
}

export function encodeJsonBase64(value: unknown): string {
	return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

export function decodeBase64Url(value: string): string {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
	return Buffer.from(padded, 'base64').toString('utf8');
}
