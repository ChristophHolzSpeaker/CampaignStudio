const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export type NormalizedEmailIdentity = {
	email: string;
	display_name: string | null;
};

function stripWrappingQuotes(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1).trim();
	}
	return value;
}

function extractCandidateEmail(input: string): {
	emailCandidate: string;
	displayName: string | null;
} {
	const trimmed = input.trim();
	const angleMatch = trimmed.match(/^(?<display>.*?)<(?<email>[^<>]+)>$/);
	if (angleMatch?.groups?.email) {
		const display = stripWrappingQuotes(angleMatch.groups.display.trim());
		return {
			emailCandidate: angleMatch.groups.email.trim(),
			displayName: display.length > 0 ? display : null
		};
	}

	return {
		emailCandidate: stripWrappingQuotes(trimmed),
		displayName: null
	};
}

export function normalizeEmailIdentity(input: string): NormalizedEmailIdentity | null {
	const { emailCandidate, displayName } = extractCandidateEmail(input);
	if (!emailCandidate) {
		return null;
	}

	const normalized = emailCandidate
		.trim()
		.toLowerCase()
		.replace(/^mailto:/, '');
	if (!EMAIL_PATTERN.test(normalized)) {
		return null;
	}

	return {
		email: normalized,
		display_name: displayName
	};
}

export function normalizeEmailAddress(input: string): string | null {
	return normalizeEmailIdentity(input)?.email ?? null;
}
