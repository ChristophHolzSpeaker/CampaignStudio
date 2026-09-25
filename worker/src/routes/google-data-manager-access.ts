import { GoogleAuthError } from '../lib/google-auth/errors';
import { z } from 'zod';
import type { WorkerEnv } from '../lib/env';
import { requireInternalAuth } from '../lib/auth';
import { createGoogleJwtAssertion } from '../lib/google-auth/jwt';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ACCOUNT_URL =
	'https://datamanager.googleapis.com/v1/accountTypes/GOOGLE_ADS/accounts/2354667197/userLists?pageSize=1';
const failureSchema = z.object({
	error: z.object({
		status: z.string().optional(),
		details: z
			.array(
				z.object({
					reason: z.string().optional(),
					metadata: z
						.object({ service: z.string().optional(), consumer: z.string().optional() })
						.optional()
				})
			)
			.optional()
	})
});

export async function handleGoogleDataManagerAccess(
	request: Request,
	env: WorkerEnv
): Promise<Response> {
	const reply = (body: unknown, status = 200) =>
		Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
	if (
		!requireInternalAuth(request, {
			...env,
			INTERNAL_API_TOKEN: env.GOOGLE_DIAGNOSTICS_TOKEN || env.INTERNAL_API_TOKEN
		})
	)
		return reply({ ok: false, error: 'Unauthorized' }, 401);
	const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
	const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	const project = email?.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1] ?? null;
	const identity = {
		serviceAccountEmail: email ?? null,
		projectId: project,
		customerId: '2354667197'
	};
	if (!email || !privateKey)
		return reply({
			ok: false,
			...identity,
			stage: 'credentials',
			error: 'service_account_not_configured'
		});
	let stage = 'signing';
	try {
		// Authenticate as the service account itself. Do not inherit Gmail's delegated user.
		const assertion = await createGoogleJwtAssertion({
			serviceAccountEmail: email,
			privateKeyPem: privateKey,
			tokenUri: TOKEN_URL,
			scopes: ['https://www.googleapis.com/auth/datamanager']
		});
		stage = 'token';
		const tokenResponse = await fetch(TOKEN_URL, {
			method: 'POST',
			redirect: 'manual',
			signal: AbortSignal.timeout(10000),
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion
			})
		});
		if (!tokenResponse.ok)
			return reply({ ok: false, ...identity, stage: 'token', httpStatus: tokenResponse.status });
		stage = 'token_response';
		const token = z.object({ access_token: z.string().min(1) }).parse(await tokenResponse.json());
		stage = 'account_access';
		const response = await fetch(ACCOUNT_URL, {
			headers: { Authorization: `Bearer ${token.access_token}` },
			redirect: 'manual',
			signal: AbortSignal.timeout(15000)
		});
		if (!response.ok) {
			const parsed = failureSchema.safeParse(await response.json());
			return reply({
				ok: false,
				...identity,
				stage: 'account_access',
				tokenMinted: true,
				httpStatus: response.status,
				googleStatus: parsed.success ? parsed.data.error.status : null,
				reasons: parsed.success
					? (parsed.data.error.details?.map((d) => ({
							reason: d.reason,
							service: d.metadata?.service,
							consumer: d.metadata?.consumer
						})) ?? [])
					: []
			});
		}
		// Do not expose audience names or any Google account data from this diagnostic.
		await response.body?.cancel();
		return reply({
			ok: true,
			...identity,
			stage: 'account_access',
			tokenMinted: true,
			httpStatus: response.status,
			accountReadAccess: true,
			conversionUploadTested: false
		});
	} catch (error) {
		return reply({
			ok: false,
			...identity,
			stage,
			error:
				error instanceof GoogleAuthError
					? error.code
					: error instanceof Error
						? error.name
						: 'google_access_check_failed'
		});
	}
}
