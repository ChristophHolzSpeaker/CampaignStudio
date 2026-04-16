import type { WorkerEnv } from '../env';
import { parseGoogleAuthEnv } from '../google-auth/env';
import { getGoogleAccessToken } from '../google-auth/token';
import { GMAIL_DEFAULT_SCOPES } from '../google-auth/scopes';

export async function getGmailAccessToken(env: WorkerEnv, delegatedUser?: string): Promise<string> {
	const config = parseGoogleAuthEnv(env);
	const impersonatedUser = delegatedUser ?? config.gmailImpersonatedUser;
	return getGoogleAccessToken(env, GMAIL_DEFAULT_SCOPES, impersonatedUser);
}
