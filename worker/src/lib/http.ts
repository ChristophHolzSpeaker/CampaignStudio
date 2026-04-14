import { ZodError } from 'zod';

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

export function badRequestFromZod(error: ZodError): Response {
	return json(
		{
			ok: false,
			error: 'Validation failed',
			details: error.flatten()
		},
		400
	);
}
