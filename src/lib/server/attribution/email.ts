export function normalizeEmailAddress(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	const bracketMatch = trimmed.match(/<([^>]+)>/);
	const candidate = (bracketMatch?.[1] ?? trimmed).trim().toLowerCase();
	if (!candidate.includes('@')) {
		return null;
	}

	const [localPart, domain] = candidate.split('@');
	if (!localPart || !domain) {
		return null;
	}

	return `${localPart}@${domain}`;
}
