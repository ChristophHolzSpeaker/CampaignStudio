import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const claimsSchema = z.object({
	formEventId: z.uuid(),
	campaignPageId: z.number().int().positive(),
	policyVersion: z.string().min(1).max(80),
	evidenceRef: z.string().nullable(),
	expiresAt: z.number().int()
});

function signature(payload: string): string {
	const secret = env.ARTIFACT_PREVIEW_TOKEN_SECRET?.trim();
	if (!secret) throw new Error('ARTIFACT_PREVIEW_TOKEN_SECRET is not configured');
	return createHmac('sha256', secret).update(`form-attribution:${payload}`).digest('base64url');
}

// This bearer proof is short-lived, page-bound, and carries no submitted form data.
export function createFormAttributionReceipt(input: {
	formEventId: string;
	campaignPageId: number;
	policyVersion: string;
	evidenceRef: string | null;
}): string {
	const payload = Buffer.from(
		JSON.stringify({ ...input, expiresAt: Date.now() + 30 * 60_000 })
	).toString('base64url');
	return `${payload}.${signature(payload)}`;
}

export function verifyFormAttributionReceipt(
	token: string,
	campaignPageId: number
): z.infer<typeof claimsSchema> | null {
	try {
		const [payload, supplied, extra] = token.split('.');
		if (!payload || !supplied || extra !== undefined) return null;
		const expected = Buffer.from(signature(payload));
		const actual = Buffer.from(supplied);
		if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
		const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
		return claims.campaignPageId === campaignPageId && claims.expiresAt > Date.now()
			? claims
			: null;
	} catch {
		return null;
	}
}
