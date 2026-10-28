import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const claimsSchema = z.object({
	visitId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	expiresAt: z.number().int()
});

function signature(payload: string): string {
	const secret = env.ARTIFACT_PREVIEW_TOKEN_SECRET?.trim();
	if (!secret) throw new Error('ARTIFACT_PREVIEW_TOKEN_SECRET is not configured');
	return createHmac('sha256', secret).update(`visit-receipt:${payload}`).digest('base64url');
}

// Page-scoped proof held only in runtime memory, never a cookie or URL parameter.
export function createVisitReceipt(visitId: number, campaignPageId: number): string {
	const payload = Buffer.from(
		JSON.stringify({
			visitId,
			campaignPageId,
			expiresAt: Date.now() + 30 * 60 * 1000
		})
	).toString('base64url');
	return `${payload}.${signature(payload)}`;
}

export function verifyVisitReceipt(token: string, campaignPageId: number): number | null {
	try {
		const [payload, supplied, extra] = token.split('.');
		if (!payload || !supplied || extra !== undefined) return null;
		const expected = Buffer.from(signature(payload));
		const actual = Buffer.from(supplied);
		if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
		const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
		return claims.campaignPageId === campaignPageId && claims.expiresAt > Date.now()
			? claims.visitId
			: null;
	} catch {
		return null;
	}
}
