import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { ArtifactPageRecord } from './repository';

export type BookingWidgetClaims = {
	widget: 'booking-calendar';
	campaignId: number;
	campaignPageId: number;
	versionNumber: number;
	preview: boolean;
	expiresAt: number;
};
function secret(): string {
	const value = env.ARTIFACT_PREVIEW_TOKEN_SECRET?.trim();
	if (!value) throw new Error('ARTIFACT_PREVIEW_TOKEN_SECRET is not configured');
	return value;
}
function sign(payload: string): string {
	return createHmac('sha256', secret()).update(`widget:${payload}`).digest('base64url');
}
export function createBookingWidgetToken(
	page: ArtifactPageRecord,
	preview: boolean,
	ttlSeconds = 15 * 60
): string {
	const claims: BookingWidgetClaims = {
		widget: 'booking-calendar',
		campaignId: page.campaignId,
		campaignPageId: page.campaignPageId,
		versionNumber: page.versionNumber,
		preview,
		expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds
	};
	const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
	return `${payload}.${sign(payload)}`;
}
export function verifyBookingWidgetToken(token: string | null): BookingWidgetClaims | null {
	if (!token) return null;
	const [payload, signature] = token.split('.');
	if (!payload || !signature) return null;
	let expected: string;
	try {
		expected = sign(payload);
	} catch {
		return null;
	}
	const left = Buffer.from(signature);
	const right = Buffer.from(expected);
	if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
	try {
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as BookingWidgetClaims;
		return claims.widget === 'booking-calendar' &&
			Number.isInteger(claims.campaignId) &&
			Number.isInteger(claims.campaignPageId) &&
			claims.expiresAt >= Math.floor(Date.now() / 1000)
			? claims
			: null;
	} catch {
		return null;
	}
}
