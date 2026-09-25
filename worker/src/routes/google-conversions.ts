import { z } from 'zod';
import type { WorkerEnv } from '../lib/env';
import { requireInternalAuth } from '../lib/auth';
import { createGoogleJwtAssertion } from '../lib/google-auth/jwt';
const account = z
	.object({ accountType: z.literal('GOOGLE_ADS'), accountId: z.string().regex(/^\d{10}$/) })
	.strict();
const identifiers = z
	.object({
		gclid: z.string().min(1).max(512).optional(),
		gbraid: z.string().min(1).max(512).optional(),
		wbraid: z.string().min(1).max(512).optional()
	})
	.strict()
	.refine((v) => Object.values(v).filter(Boolean).length === 1);
const payloadSchema = z
	.object({
		destinations: z
			.array(
				z
					.object({
						operatingAccount: account,
						loginAccount: account.optional(),
						productDestinationId: z.string().regex(/^\d+$/)
					})
					.strict()
			)
			.length(1),
		events: z
			.array(
				z
					.object({
						transactionId: z.string().min(1).max(128),
						eventSource: z
							.enum(['WEB', 'APP', 'IN_STORE', 'PHONE', 'MESSAGE', 'OTHER'])
							.default('OTHER'),
						eventTimestamp: z.iso.datetime({ offset: true }),
						adIdentifiers: identifiers,
						consent: z.object({ adUserData: z.literal('CONSENT_GRANTED') }).strict(),
						conversionValue: z.number().finite().nonnegative().optional(),
						currency: z
							.string()
							.regex(/^[A-Z]{3}$/)
							.optional()
					})
					.strict()
					.refine((e) => (e.conversionValue !== undefined) === (e.currency !== undefined))
			)
			.length(1)
	})
	.strict();
const statusSchema = z.object({ requestId: z.string().min(1).max(512) }).strict();
const statusResponse = z.object({
	requestStatusPerDestination: z.array(
		z.object({
			requestStatus: z.string(),
			errorInfo: z.unknown().optional(),
			warningInfo: z.unknown().optional()
		})
	)
});

// Return only a bounded, redacted message to the authenticated operator. Never proxy
// raw Google responses (which can echo click identifiers) or OAuth token errors.
async function googleFailure(response: Response, payload: unknown, accessToken: string) {
	const schema = z.object({
		error: z.object({
			status: z
				.string()
				.regex(/^[A-Z_]+$/)
				.optional(),
			message: z.string().optional(),
			details: z.array(z.unknown()).optional()
		})
	});
	const parsed = schema.safeParse(await response.json().catch(() => null));
	if (!parsed.success) return {};
	let message = parsed.data.error.message ?? '';
	let details = JSON.stringify(parsed.data.error.details ?? []);
	const sensitive: string[] = [accessToken];
	const collect = (value: unknown, key = '') => {
		if (
			typeof value === 'string' &&
			['gclid', 'gbraid', 'wbraid', 'transactionId', 'requestId'].includes(key)
		)
			sensitive.push(value);
		else if (Array.isArray(value)) value.forEach((v) => collect(v));
		else if (value && typeof value === 'object')
			Object.entries(value).forEach(([k, v]) => collect(v, k));
	};
	collect(payload);
	for (const value of sensitive)
		if (value) {
			message = message.replaceAll(value, '[redacted]');
			details = details.replaceAll(value, '[redacted]');
		}
	message = message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
	details = details.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
	return {
		googleStatus: parsed.data.error.status,
		googleMessage: message.slice(0, 500),
		googleDetails: details.slice(0, 2000)
	};
}

export async function handleGoogleConversions(request: Request, env: WorkerEnv): Promise<Response> {
	const reply = (body: unknown, status = 200) =>
		Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
	if (!env.GOOGLE_DATA_MANAGER_TOKEN) return reply({ error: 'google_relay_not_configured' }, 503);
	if (!requireInternalAuth(request, { ...env, INTERNAL_API_TOKEN: env.GOOGLE_DATA_MANAGER_TOKEN }))
		return reply({ error: 'Unauthorized' }, 401);
	if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
	const operation = new URL(request.url).pathname.split('/').at(-1);
	if (!['ingest', 'validate', 'status'].includes(operation ?? ''))
		return reply({ error: 'Not found' }, 404);
	if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
		return reply({ error: 'google_credentials_not_configured' }, 503);
	let body: unknown;
	try {
		if (Number(request.headers.get('content-length') ?? 0) > 16384)
			return reply({ error: 'Payload too large' }, 413);
		const bytes = await request.arrayBuffer();
		if (bytes.byteLength > 16384) return reply({ error: 'Payload too large' }, 413);
		body = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return reply({ error: 'Invalid JSON' }, 400);
	}
	const payload =
		operation === 'status' ? statusSchema.safeParse(body) : payloadSchema.safeParse(body);
	if (!payload.success) return reply({ error: 'Invalid conversion request' }, 400);
	try {
		const assertion = await createGoogleJwtAssertion({
			serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
			privateKeyPem: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
			tokenUri: 'https://oauth2.googleapis.com/token',
			scopes: ['https://www.googleapis.com/auth/datamanager']
		});
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			redirect: 'manual',
			signal: AbortSignal.timeout(10000),
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion
			})
		});
		if (!tokenResponse.ok) return reply({ error: `oauth_http_${tokenResponse.status}` }, 502);
		const token = z.object({ access_token: z.string().min(1) }).parse(await tokenResponse.json());
		const status = operation === 'status';
		const path = status
			? '/requestStatus:retrieve?requestId=' +
				encodeURIComponent(statusSchema.parse(payload.data).requestId)
			: '/events:ingest';
		const response = await fetch('https://datamanager.googleapis.com/v1' + path, {
			method: status ? 'GET' : 'POST',
			redirect: 'manual',
			signal: AbortSignal.timeout(15000),
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json'
			},
			...(!status
				? { body: JSON.stringify({ ...payload.data, validateOnly: operation === 'validate' }) }
				: {})
		});
		if (!response.ok)
			return reply(
				{
					error: `google_http_${response.status}`,
					...(await googleFailure(response, payload.data, token.access_token))
				},
				response.status >= 400 ? response.status : 502
			);
		const data: unknown = await response.json();
		if (operation === 'validate') return reply({ validated: true });
		if (!status) return reply(z.object({ requestId: z.string().min(1) }).parse(data));
		return reply({
			requestStatusPerDestination: statusResponse
				.parse(data)
				.requestStatusPerDestination.map((s) => ({
					requestStatus: s.requestStatus,
					...(s.errorInfo ? { errorInfo: true } : {}),
					...(s.warningInfo ? { warningInfo: true } : {})
				}))
		});
	} catch {
		return reply({ error: 'google_request_failed' }, 502);
	}
}
