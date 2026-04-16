import type { WorkerEnv } from '../env';
import { GoogleAuthError } from './errors';

export const DEFAULT_GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export type GoogleAuthConfig = {
	serviceAccountEmail: string;
	serviceAccountPrivateKey: string;
	tokenUri: string;
	gmailImpersonatedUser: string;
	calendarImpersonatedUser: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireGoogleEnv(env: WorkerEnv, key: keyof WorkerEnv): string {
	const value = env[key];
	if (!value) {
		throw new GoogleAuthError('MISSING_ENV_VAR', `Missing required env var: ${key}`, { key });
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new GoogleAuthError('INVALID_ENV_VAR', `Env var is empty: ${key}`, { key });
	}
	return trimmed;
}

function requireEmailEnv(env: WorkerEnv, key: keyof WorkerEnv): string {
	const value = requireGoogleEnv(env, key);
	if (!emailRegex.test(value)) {
		throw new GoogleAuthError('INVALID_ENV_VAR', `Invalid email in env var: ${key}`, {
			key,
			value
		});
	}
	return value;
}

export function parseGoogleAuthEnv(env: WorkerEnv): GoogleAuthConfig {
	const tokenUriRaw = env.GOOGLE_TOKEN_URI?.trim();
	const tokenUri = tokenUriRaw && tokenUriRaw.length > 0 ? tokenUriRaw : DEFAULT_GOOGLE_TOKEN_URI;

	let parsedTokenUri: URL;
	try {
		parsedTokenUri = new URL(tokenUri);
	} catch (error) {
		throw new GoogleAuthError(
			'INVALID_ENV_VAR',
			'GOOGLE_TOKEN_URI must be a valid URL',
			{ key: 'GOOGLE_TOKEN_URI', value: tokenUri },
			{ cause: error }
		);
	}

	if (parsedTokenUri.protocol !== 'https:') {
		throw new GoogleAuthError('INVALID_ENV_VAR', 'GOOGLE_TOKEN_URI must use https', {
			key: 'GOOGLE_TOKEN_URI',
			value: tokenUri
		});
	}

	return {
		serviceAccountEmail: requireEmailEnv(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL'),
		serviceAccountPrivateKey: requireGoogleEnv(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'),
		tokenUri,
		gmailImpersonatedUser: requireEmailEnv(env, 'GOOGLE_IMPERSONATED_USER'),
		calendarImpersonatedUser: requireEmailEnv(env, 'GOOGLE_CALENDAR_IMPERSONATED_USER')
	};
}
