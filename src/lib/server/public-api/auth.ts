import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export type PublicApiAuthResult =
	| { ok: true; tokenFingerprint: string }
	| { ok: false; status: 401 | 503; message: string };

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

export function authenticatePublicApiRequest(request: Request): PublicApiAuthResult {
	const configuredToken = env.LEAD_READ_API_TOKEN;
	if (!configuredToken) {
		return { ok: false, status: 503, message: 'Public API token is not configured' };
	}

	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	const [scheme, token] = authHeader.split(' ');
	if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	if (!constantTimeEquals(token, configuredToken)) {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	return { ok: true, tokenFingerprint: fingerprintToken(token) };
}
