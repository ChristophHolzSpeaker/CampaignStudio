import { requireEnv, type WorkerEnv } from './env';

const encoder = new TextEncoder();

function constantTimeEquals(left: string, right: string): boolean {
	const leftBytes = encoder.encode(left);
	const rightBytes = encoder.encode(right);
	if (leftBytes.length !== rightBytes.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		diff |= leftBytes[index] ^ rightBytes[index];
	}

	return diff === 0;
}

export function requireInternalAuth(request: Request, env: WorkerEnv): boolean {
	const configuredToken = requireEnv(env, 'INTERNAL_API_TOKEN');
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return false;
	}

	const [scheme, token] = authHeader.split(' ');
	if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
		return false;
	}

	return constantTimeEquals(token, configuredToken);
}
