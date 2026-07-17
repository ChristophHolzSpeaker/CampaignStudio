import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

type EmbedPreviewTokenInput = {
	campaignPageId: number;
	slug: string;
};

function getEmbedPreviewTokenSecret(): string | null {
	const secret = env.EMBED_PREVIEW_TOKEN_SECRET?.trim();
	return secret && secret.length > 0 ? secret : null;
}

function buildTokenPayload(input: EmbedPreviewTokenInput): string {
	return `${input.campaignPageId}:${input.slug}`;
}

export function createEmbedPreviewToken(input: EmbedPreviewTokenInput): string {
	const secret = getEmbedPreviewTokenSecret();
	if (!secret) {
		throw new Error('Embed preview token secret is not configured');
	}

	return createHmac('sha256', secret).update(buildTokenPayload(input)).digest('base64url');
}

export function verifyEmbedPreviewToken(
	input: EmbedPreviewTokenInput & { token: string | null }
): boolean {
	if (!input.token) {
		return false;
	}

	let expected: string;
	try {
		expected = createEmbedPreviewToken(input);
	} catch {
		return false;
	}

	const receivedBuffer = Buffer.from(input.token);
	const expectedBuffer = Buffer.from(expected);

	if (receivedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function buildEmbedPreviewUrl(origin: string, input: EmbedPreviewTokenInput): string {
	const embedUrl = new URL(`/embed/${input.slug}`, origin);
	embedUrl.searchParams.set('token', createEmbedPreviewToken(input));
	return embedUrl.href;
}
