import { GoogleAuthError } from './errors';

const PEM_BEGIN = '-----BEGIN PRIVATE KEY-----';
const PEM_END = '-----END PRIVATE KEY-----';

export function normalizeGooglePrivateKey(privateKey: string): string {
	const normalized = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
	const trimmed = normalized.trim();

	if (!trimmed.includes(PEM_BEGIN) || !trimmed.includes(PEM_END)) {
		throw new GoogleAuthError(
			'INVALID_PRIVATE_KEY',
			'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be a valid PKCS#8 PEM private key'
		);
	}

	return trimmed;
}

export function pemToPkcs8(pem: string): ArrayBuffer {
	const base64 = pem.replace(PEM_BEGIN, '').replace(PEM_END, '').replace(/\s+/g, '');
	if (base64.length === 0) {
		throw new GoogleAuthError('INVALID_PRIVATE_KEY', 'Google private key PEM payload is empty');
	}

	let binary: string;
	try {
		binary = atob(base64);
	} catch (error) {
		throw new GoogleAuthError(
			'INVALID_PRIVATE_KEY',
			'Google private key PEM payload is not valid base64',
			undefined,
			{ cause: error }
		);
	}

	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes.buffer;
}
