const MATCH_TYPE_MAP: Record<string, 'exact' | 'phrase' | 'broad' | 'broad_modifier'> = {
	exact: 'exact',
	phrase: 'phrase',
	broad: 'broad',
	phrase_match: 'phrase',
	exact_match: 'exact',
	broad_match: 'broad',
	broad_match_modifier: 'broad_modifier',
	bmm: 'broad_modifier',
	'broad modifier': 'broad_modifier',
	'broad-match-modifier': 'broad_modifier'
};

const normalizeMatchType = (
	matchType?: string
): 'exact' | 'phrase' | 'broad' | 'broad_modifier' | null => {
	if (!matchType) return null;
	const key = matchType.toLowerCase().replace(/\s+/g, ' ');
	return MATCH_TYPE_MAP[key] ?? null;
};

const formatBroadModifier = (keywordText: string) =>
	keywordText
		.trim()
		.split(/\s+/)
		.map((word) => (word.startsWith('+') ? word : `+${word}`))
		.join(' ');

export const formatAdwordsKeyword = (keywordText: string, matchType?: string): string => {
	const normalized = normalizeMatchType(matchType);
	const text = keywordText.trim();
	if (!text) return '';

	if (normalized === 'exact') {
		return `[${text}]`;
	}

	if (normalized === 'phrase') {
		return `"${text}"`;
	}

	if (normalized === 'broad_modifier') {
		return formatBroadModifier(text);
	}

	return text;
};
