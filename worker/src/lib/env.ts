export type WorkerEnv = {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	BOOKING_TOKEN_SECRET: string;
	INTERNAL_API_TOKEN: string;
	BOOKING_BASE_URL?: string;
	BOOKING_LINK_TTL_SECONDS?: string;
	GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
	GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
	GOOGLE_TOKEN_URI?: string;
	GOOGLE_IMPERSONATED_USER?: string;
	GOOGLE_CALENDAR_IMPERSONATED_USER?: string;
	GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL?: string;
	GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
	GMAIL_DELEGATED_ADMIN_EMAIL?: string;
	GMAIL_PUBSUB_TOPIC_NAME?: string;
	GMAIL_PUSH_VERIFICATION_TOKEN?: string;
	GMAIL_WATCH_RENEWAL_BUFFER_SECONDS?: string;
	GMAIL_WATCH_LABEL_IDS?: string;
	GMAIL_WATCH_LABEL_FILTER_ACTION?: 'include' | 'exclude';
	INTERNAL_TEAM_EMAIL_DOMAINS?: string;
	OPENROUTER_API_KEY?: string;
	WOODY_OPENROUTER_MODEL?: string;
	WOODY_OPENROUTER_TIMEOUT_MS?: string;
	WOODY_SUPPORTED_LANGUAGES?: string;
	GMAIL_RECONCILE_PUSH_STALE_SECONDS?: string;
	GMAIL_RECONCILE_SYNC_STALE_SECONDS?: string;
	GMAIL_RECONCILE_RETRY_COOLDOWN_SECONDS?: string;
};

export type WorkerExecutionContext = {
	waitUntil(promise: Promise<unknown>): void;
};

export type WorkerScheduledEvent = {
	readonly cron: string;
	readonly scheduledTime: number;
};

export function requireEnv(env: WorkerEnv, key: keyof WorkerEnv): string {
	const value = env[key];
	if (!value) {
		throw new Error(`Missing required env var: ${key}`);
	}
	return value;
}
