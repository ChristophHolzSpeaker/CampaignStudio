import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export type PublicApiAuthResult =
	| { ok: true; tokenFingerprint: string }
	| { ok: false; status: 401 | 503; message: string };

export type PublicApiTokenScope = 'lead-read' | 'campaign-write';

function getConfiguredToken(scope: PublicApiTokenScope): string | undefined {
	if (scope === 'campaign-write') {
		return env.CAMPAIGN_WRITE_API_TOKEN;
	}

	return env.LEAD_READ_API_TOKEN;
}

function readBearerToken(request: Request): string | null {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return null;
	}

	const [scheme, token] = authHeader.split(' ');
	if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
		return null;
	}

	return token;
}

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}

	return timingSafeEqual(leftBuffer, rightBuffer);
}

export function fingerprintToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function authenticatePublicApiRequest(
	request: Request,
	scope: PublicApiTokenScope = 'lead-read'
): PublicApiAuthResult {
	return authenticateAnyPublicApiRequest(request, [scope]);
}

export function authenticateAnyPublicApiRequest(
	request: Request,
	scopes: PublicApiTokenScope[]
): PublicApiAuthResult {
	const configuredTokens = scopes
		.map((scope) => getConfiguredToken(scope))
		.filter((token): token is string => typeof token === 'string' && token.length > 0);

	if (configuredTokens.length === 0) {
		return { ok: false, status: 503, message: 'Public API token is not configured' };
	}

	const token = readBearerToken(request);
	if (!token) {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	if (!configuredTokens.some((configuredToken) => constantTimeEquals(token, configuredToken))) {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	return { ok: true, tokenFingerprint: fingerprintToken(token) };
}
