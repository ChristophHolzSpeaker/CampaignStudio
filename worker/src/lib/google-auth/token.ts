import type { WorkerEnv } from '../env';
import { parseGoogleAuthEnv } from './env';
import { GoogleAuthError } from './errors';
import { createGoogleJwtAssertion } from './jwt';
import { CALENDAR_DEFAULT_SCOPES, GMAIL_DEFAULT_SCOPES } from './scopes';

type CachedToken = {
	accessToken: string;
	expiresAtMs: number;
};

const tokenCache = new Map<string, CachedToken>();

export type GoogleTokenResponse = {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope?: string;
};

function validateImpersonatedUser(impersonatedUser: string): string {
	const value = impersonatedUser.trim();
	if (!value) {
		throw new GoogleAuthError('INVALID_ENV_VAR', 'Impersonated user is required');
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(value)) {
		throw new GoogleAuthError('INVALID_ENV_VAR', 'Invalid impersonated user email', {
			impersonatedUser: value
		});
	}

	return value;
}

function normalizeScopes(scopes: readonly string[]): string[] {
	const cleanScopes = scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0);

	if (cleanScopes.length === 0) {
		throw new GoogleAuthError('INVALID_SCOPE', 'At least one Google OAuth scope is required');
	}

	return cleanScopes;
}

function cacheKey(
	serviceAccountEmail: string,
	impersonatedUser: string,
	tokenUri: string,
	scopes: readonly string[]
): string {
	return `${serviceAccountEmail}:${impersonatedUser}:${tokenUri}:${[...scopes].sort().join(' ')}`;
}

function safeParseResponseBody(rawBody: string): unknown {
	try {
		return JSON.parse(rawBody);
	} catch {
		return rawBody;
	}
}

export async function exchangeGoogleJwtForAccessToken(
	tokenUri: string,
	assertion: string
): Promise<GoogleTokenResponse> {
	const response = await fetch(tokenUri, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion
		})
	});

	const rawBody = await response.text();
	const parsedBody = safeParseResponseBody(rawBody);

	if (!response.ok) {
		throw new GoogleAuthError(
			'TOKEN_EXCHANGE_FAILED',
			`Google token endpoint request failed (${response.status})`,
			{
				status: response.status,
				response: parsedBody
			}
		);
	}

	if (typeof parsedBody !== 'object' || parsedBody === null) {
		throw new GoogleAuthError(
			'INVALID_TOKEN_RESPONSE',
			'Google token endpoint response must be a JSON object',
			{ response: parsedBody }
		);
	}

	const tokenPayload = parsedBody as Partial<GoogleTokenResponse>;
	if (
		typeof tokenPayload.access_token !== 'string' ||
		tokenPayload.access_token.length === 0 ||
		typeof tokenPayload.expires_in !== 'number' ||
		!Number.isFinite(tokenPayload.expires_in) ||
		typeof tokenPayload.token_type !== 'string' ||
		tokenPayload.token_type.length === 0
	) {
		throw new GoogleAuthError('INVALID_TOKEN_RESPONSE', 'Google token response is missing fields', {
			response: parsedBody
		});
	}

	return {
		access_token: tokenPayload.access_token,
		expires_in: tokenPayload.expires_in,
		token_type: tokenPayload.token_type,
		scope: tokenPayload.scope
	};
}

export async function getGoogleAccessToken(
	env: WorkerEnv,
	scopes: readonly string[],
	impersonatedUser: string
): Promise<string> {
	const config = parseGoogleAuthEnv(env);
	const cleanScopes = normalizeScopes(scopes);
	const effectiveImpersonatedUser = validateImpersonatedUser(impersonatedUser);

	const key = cacheKey(
		config.serviceAccountEmail,
		effectiveImpersonatedUser,
		config.tokenUri,
		cleanScopes
	);
	const cached = tokenCache.get(key);
	if (cached && cached.expiresAtMs > Date.now()) {
		return cached.accessToken;
	}

	const assertion = await createGoogleJwtAssertion({
		serviceAccountEmail: config.serviceAccountEmail,
		impersonatedUser: effectiveImpersonatedUser,
		privateKeyPem: config.serviceAccountPrivateKey,
		tokenUri: config.tokenUri,
		scopes: cleanScopes
	});

	const token = await exchangeGoogleJwtForAccessToken(config.tokenUri, assertion);
	const expiresAtMs = Date.now() + Math.max(1, Math.floor(token.expires_in) - 60) * 1000;

	tokenCache.set(key, {
		accessToken: token.access_token,
		expiresAtMs
	});

	return token.access_token;
}

export async function getGmailAccessToken(env: WorkerEnv): Promise<string> {
	const config = parseGoogleAuthEnv(env);
	return getGoogleAccessToken(env, GMAIL_DEFAULT_SCOPES, config.gmailImpersonatedUser);
}

export async function getCalendarAccessToken(env: WorkerEnv): Promise<string> {
	const config = parseGoogleAuthEnv(env);
	return getGoogleAccessToken(env, CALENDAR_DEFAULT_SCOPES, config.calendarImpersonatedUser);
}

export function clearGoogleTokenCacheForTests(): void {
	tokenCache.clear();
}
