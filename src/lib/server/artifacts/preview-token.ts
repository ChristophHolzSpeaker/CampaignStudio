import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

type ArtifactPreviewClaims = { campaignPageId: number; expiresAt: number };

function secret(): string {
	const value = env.ARTIFACT_PREVIEW_TOKEN_SECRET?.trim();
	if (!value) throw new Error('ARTIFACT_PREVIEW_TOKEN_SECRET is not configured');
	return value;
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createArtifactPreviewToken(campaignPageId: number, ttlSeconds = 60 * 60): string {
	const claims: ArtifactPreviewClaims = {
		campaignPageId,
		expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds
	};
	const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
	return `${payload}.${sign(payload)}`;
}

export function verifyArtifactPreviewToken(token: string | null, campaignPageId: number): boolean {
	if (!token) return false;
	const [payload, signature] = token.split('.');
	if (!payload || !signature) return false;
	let expected: string;
	try {
		expected = sign(payload);
	} catch {
		return false;
	}
	const received = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer))
		return false;
	try {
		const claims = JSON.parse(
			Buffer.from(payload, 'base64url').toString()
		) as Partial<ArtifactPreviewClaims>;
		return (
			claims.campaignPageId === campaignPageId &&
			typeof claims.expiresAt === 'number' &&
			claims.expiresAt >= Math.floor(Date.now() / 1000)
		);
	} catch {
		return false;
	}
}
