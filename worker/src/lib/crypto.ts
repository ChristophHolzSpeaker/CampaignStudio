const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toBase64UrlJson(value: unknown): string {
	const json = JSON.stringify(value);
	return toBase64Url(textEncoder.encode(json));
}

async function sign(message: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		textEncoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
	return toBase64Url(new Uint8Array(signature));
}

export type BookingTokenPayload = {
	lead_journey_id: string;
	campaign_id: number;
	iat: number;
	exp: number;
};

export async function createSignedBookingToken(
	payload: BookingTokenPayload,
	secret: string
): Promise<string> {
	const payloadEncoded = toBase64UrlJson(payload);
	const signature = await sign(payloadEncoded, secret);
	return `${payloadEncoded}.${signature}`;
}
