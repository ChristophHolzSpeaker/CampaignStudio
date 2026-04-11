export type MarkdownInlineToken =
	| { type: 'text'; text: string }
	| { type: 'strong'; text: string }
	| { type: 'em'; text: string }
	| { type: 'code'; text: string }
	| { type: 'link'; text: string; href: string };

export type MarkdownBlock =
	| { type: 'heading'; level: 1 | 2 | 3; tokens: MarkdownInlineToken[] }
	| { type: 'paragraph'; tokens: MarkdownInlineToken[] }
	| { type: 'ul'; items: MarkdownInlineToken[][] }
	| { type: 'ol'; items: MarkdownInlineToken[][] };

const INLINE_PATTERN = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const UNORDERED_PATTERN = /^[-*]\s+(.+)$/;
const ORDERED_PATTERN = /^\d+\.\s+(.+)$/;

function normalizeText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function sanitizeLink(href: string): string | null {
	try {
		const url = new URL(href);
		if (url.protocol === 'http:' || url.protocol === 'https:') {
			return url.toString();
		}
		return null;
	} catch {
		return null;
	}
}

export function parseInlineMarkdown(input: string): MarkdownInlineToken[] {
	const text = input.trim();
	if (!text) {
		return [];
	}

	const tokens: MarkdownInlineToken[] = [];
	let cursor = 0;

	for (const match of text.matchAll(INLINE_PATTERN)) {
		const full = match[0];
		const index = match.index ?? 0;

		if (index > cursor) {
			const raw = text.slice(cursor, index);
			if (raw) {
				tokens.push({ type: 'text', text: raw });
			}
		}

		const linkLabel = match[2];
		const linkHref = match[3];
		const codeValue = match[5];
		const strongValue = match[7];
		const emValue = match[9];

		if (linkLabel && linkHref) {
			const safeHref = sanitizeLink(linkHref.trim());
			if (safeHref) {
				tokens.push({ type: 'link', text: linkLabel.trim(), href: safeHref });
			} else {
				tokens.push({ type: 'text', text: full });
			}
		} else if (codeValue) {
			tokens.push({ type: 'code', text: codeValue });
		} else if (strongValue) {
			tokens.push({ type: 'strong', text: strongValue });
		} else if (emValue) {
			tokens.push({ type: 'em', text: emValue });
		} else {
			tokens.push({ type: 'text', text: full });
		}

		cursor = index + full.length;
	}

	if (cursor < text.length) {
		tokens.push({ type: 'text', text: text.slice(cursor) });
	}

	return tokens.filter((token) => token.text.length > 0);
}

export function parseMarkdown(content: string): MarkdownBlock[] {
	const normalized = content.replace(/\r\n/g, '\n').trim();
	if (!normalized) {
		return [];
	}

	const blocks: MarkdownBlock[] = [];
	const lines = normalized.split('\n');
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]?.trim() ?? '';

		if (!line) {
			index += 1;
			continue;
		}

		const headingMatch = line.match(HEADING_PATTERN);
		if (headingMatch) {
			const hashes = headingMatch[1] ?? '#';
			const headingText = normalizeText(headingMatch[2] ?? '');
			const level = Math.min(3, hashes.length) as 1 | 2 | 3;
			blocks.push({
				type: 'heading',
				level,
				tokens: parseInlineMarkdown(headingText)
			});
			index += 1;
			continue;
		}

		const unorderedItems: MarkdownInlineToken[][] = [];
		while (index < lines.length) {
			const current = lines[index]?.trim() ?? '';
			const match = current.match(UNORDERED_PATTERN);
			if (!match) {
				break;
			}
			unorderedItems.push(parseInlineMarkdown(normalizeText(match[1] ?? '')));
			index += 1;
		}
		if (unorderedItems.length > 0) {
			blocks.push({ type: 'ul', items: unorderedItems });
			continue;
		}

		const orderedItems: MarkdownInlineToken[][] = [];
		while (index < lines.length) {
			const current = lines[index]?.trim() ?? '';
			const match = current.match(ORDERED_PATTERN);
			if (!match) {
				break;
			}
			orderedItems.push(parseInlineMarkdown(normalizeText(match[1] ?? '')));
			index += 1;
		}
		if (orderedItems.length > 0) {
			blocks.push({ type: 'ol', items: orderedItems });
			continue;
		}

		const paragraphLines: string[] = [];
		while (index < lines.length) {
			const current = lines[index]?.trim() ?? '';
			if (!current) {
				break;
			}
			if (
				HEADING_PATTERN.test(current) ||
				UNORDERED_PATTERN.test(current) ||
				ORDERED_PATTERN.test(current)
			) {
				break;
			}
			paragraphLines.push(current);
			index += 1;
		}

		const paragraph = normalizeText(paragraphLines.join(' '));
		if (paragraph) {
			blocks.push({
				type: 'paragraph',
				tokens: parseInlineMarkdown(paragraph)
			});
		}
	}

	return blocks;
}
