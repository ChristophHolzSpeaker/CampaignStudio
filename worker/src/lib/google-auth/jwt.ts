import { GoogleAuthError } from './errors';
import { normalizeGooglePrivateKey, pemToPkcs8 } from './private-key';

const textEncoder = new TextEncoder();

export type GoogleJwtClaims = {
	iss: string;
	scope: string;
	aud: string;
	iat: number;
	exp: number;
	sub: string;
};

export type CreateGoogleJwtAssertionInput = {
	serviceAccountEmail: string;
	impersonatedUser: string;
	privateKeyPem: string;
	tokenUri: string;
	scopes: readonly string[];
	nowMs?: number;
};

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

function normalizeScopes(scopes: readonly string[]): string {
	const cleanScopes = scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0);

	if (cleanScopes.length === 0) {
		throw new GoogleAuthError('INVALID_SCOPE', 'At least one Google OAuth scope is required');
	}

	return cleanScopes.join(' ');
}

async function signJwtRs256(assertionInput: string, privateKeyPem: string): Promise<string> {
	const normalizedPem = normalizeGooglePrivateKey(privateKeyPem);

	let key: CryptoKey;
	try {
		key = await crypto.subtle.importKey(
			'pkcs8',
			pemToPkcs8(normalizedPem),
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['sign']
		);
	} catch (error) {
		throw new GoogleAuthError(
			'JWT_SIGNING_FAILED',
			'Failed to import Google service-account private key',
			undefined,
			{ cause: error }
		);
	}

	try {
		const signature = await crypto.subtle.sign(
			'RSASSA-PKCS1-v1_5',
			key,
			textEncoder.encode(assertionInput)
		);
		return toBase64Url(new Uint8Array(signature));
	} catch (error) {
		throw new GoogleAuthError(
			'JWT_SIGNING_FAILED',
			'Failed to sign Google JWT assertion',
			undefined,
			{ cause: error }
		);
	}
}

export function createGoogleJwtClaims(input: {
	serviceAccountEmail: string;
	impersonatedUser: string;
	tokenUri: string;
	scopes: readonly string[];
	nowMs?: number;
}): GoogleJwtClaims {
	const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
	const iat = nowSeconds;
	const exp = nowSeconds + 3600;

	return {
		iss: input.serviceAccountEmail,
		scope: normalizeScopes(input.scopes),
		aud: input.tokenUri,
		iat,
		exp,
		sub: input.impersonatedUser
	};
}

export async function createGoogleJwtAssertion(
	input: CreateGoogleJwtAssertionInput
): Promise<string> {
	const header = encodeJsonBase64Url({ alg: 'RS256', typ: 'JWT' });
	const payload = encodeJsonBase64Url(
		createGoogleJwtClaims({
			serviceAccountEmail: input.serviceAccountEmail,
			impersonatedUser: input.impersonatedUser,
			tokenUri: input.tokenUri,
			scopes: input.scopes,
			nowMs: input.nowMs
		})
	);

	const unsignedAssertion = `${header}.${payload}`;
	const signature = await signJwtRs256(unsignedAssertion, input.privateKeyPem);
	return `${unsignedAssertion}.${signature}`;
}
