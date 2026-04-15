import type { WorkerEnv } from '../env';

function normalizeDomain(value: string): string {
	return value.trim().toLowerCase().replace(/^@+/, '');
}

function parseSenderDomain(email: string): string | null {
	const atIndex = email.lastIndexOf('@');
	if (atIndex < 0 || atIndex === email.length - 1) {
		return null;
	}
	return normalizeDomain(email.slice(atIndex + 1));
}

function getInternalDomains(env: WorkerEnv): Set<string> {
	const configured = env.INTERNAL_TEAM_EMAIL_DOMAINS;
	if (!configured) {
		return new Set();
	}

	return new Set(
		configured
			.split(',')
			.map((value: string) => normalizeDomain(value))
			.filter((value: string) => value.length > 0)
	);
}

export function isInternalSender(env: WorkerEnv, normalizedSenderEmail: string): boolean {
	const senderDomain = parseSenderDomain(normalizedSenderEmail);
	if (!senderDomain) {
		return false;
	}

	const domains = getInternalDomains(env);
	if (domains.size === 0) {
		return false;
	}

	return domains.has(senderDomain);
}
