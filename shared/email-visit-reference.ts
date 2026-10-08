// A random capability identifies a recorded visit, never a sequential public visit ID.
export function emailReferenceLine(token: string): string {
	return `Referenz: CS-${token.replaceAll('-', '')}`;
}

export function parseEmailVisitReference(body: string): string | null {
	const tokens = new Set(
		Array.from(body.matchAll(/\bReferenz:\s*CS-([a-f0-9]{32})\b/gi), (match) =>
			match[1].toLowerCase()
		)
	);
	if (tokens.size !== 1) return null;
	const token = [...tokens][0];
	return `${token.slice(0, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}-${token.slice(16, 20)}-${token.slice(20)}`;
}
