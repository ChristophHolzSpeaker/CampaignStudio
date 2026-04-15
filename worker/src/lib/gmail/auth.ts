import { requireEnv, type WorkerEnv } from '../env';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPE =
	'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send';

const textEncoder = new TextEncoder();

type CachedToken = {
	accessToken: string;
	expiresAtMs: number;
};

const tokenCache = new Map<string, CachedToken>();

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJsonBase64Url(value: unknown): string {
	return toBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function normalizePrivateKey(privateKey: string): string {
	return privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
}

async function signJwtAssertion(assertionInput: string, privateKeyPem: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'pkcs8',
		pemToPkcs8(normalizePrivateKey(privateKeyPem)),
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		textEncoder.encode(assertionInput)
	);
	return toBase64Url(new Uint8Array(signature));
}

function pemToPkcs8(pem: string): ArrayBuffer {
	const base64 = pem
		.replace('-----BEGIN PRIVATE KEY-----', '')
		.replace('-----END PRIVATE KEY-----', '')
		.replace(/\s+/g, '');
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

async function mintAccessToken(
	serviceAccountEmail: string,
	privateKeyPem: string,
	delegatedUser: string
): Promise<CachedToken> {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + 3600;

	const header = encodeJsonBase64Url({ alg: 'RS256', typ: 'JWT' });
	const payload = encodeJsonBase64Url({
		iss: serviceAccountEmail,
		sub: delegatedUser,
		aud: GOOGLE_TOKEN_URL,
		scope: GMAIL_SCOPE,
		iat: issuedAt,
		exp: expiresAt
	});

	const unsignedAssertion = `${header}.${payload}`;
	const signature = await signJwtAssertion(unsignedAssertion, privateKeyPem);
	const assertion = `${unsignedAssertion}.${signature}`;

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Failed to mint Gmail access token (${response.status}): ${body}`);
	}

	const tokenPayload = (await response.json()) as {
		access_token?: string;
		expires_in?: number;
	};

	if (!tokenPayload.access_token) {
		throw new Error('Token response missing access_token');
	}

	const ttlSeconds = tokenPayload.expires_in ?? 3600;
	const expiresAtMs = Date.now() + Math.max(1, ttlSeconds - 60) * 1000;

	return {
		accessToken: tokenPayload.access_token,
		expiresAtMs
	};
}

export async function getGmailAccessToken(env: WorkerEnv, delegatedUser?: string): Promise<string> {
	const serviceAccountEmail = requireEnv(env, 'GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL');
	const privateKeyPem = requireEnv(env, 'GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY');
	const effectiveDelegatedUser = delegatedUser ?? requireEnv(env, 'GMAIL_DELEGATED_ADMIN_EMAIL');

	const cacheKey = `${serviceAccountEmail}:${effectiveDelegatedUser}`;
	const cached = tokenCache.get(cacheKey);
	if (cached && cached.expiresAtMs > Date.now()) {
		return cached.accessToken;
	}

	const minted = await mintAccessToken(serviceAccountEmail, privateKeyPem, effectiveDelegatedUser);
	tokenCache.set(cacheKey, minted);
	return minted.accessToken;
}
