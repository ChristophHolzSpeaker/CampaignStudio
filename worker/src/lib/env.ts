export type WorkerEnv = {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	BOOKING_TOKEN_SECRET: string;
	BOOKING_BASE_URL?: string;
	BOOKING_LINK_TTL_SECONDS?: string;
};

export function requireEnv(env: WorkerEnv, key: keyof WorkerEnv): string {
	const value = env[key];
	if (!value) {
		throw new Error(`Missing required env var: ${key}`);
	}
	return value;
}
