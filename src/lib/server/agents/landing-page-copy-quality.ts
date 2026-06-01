import type { LandingPageDocument } from '$lib/page-builder/page';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';

const moderateQualityThreshold = 70;

const metaLanguageWarning = 'Detected non-publishable meta/instructional copy in visible content.';
const languageMismatchWarning =
	'Detected visible-copy language mismatch against campaign.language.';

const defaultGenericPhrases = [
	'unlock your potential',
	'inspire innovation',
	'future-ready success',
	'this approach works',
	'strategic relevance'
];

const nonPublishableMetaPatterns: Array<{ label: string; pattern: RegExp }> = [
	{ label: 'this section will', pattern: /\bthis section will\b/i },
	{ label: 'this paragraph will', pattern: /\bthis paragraph will\b/i },
	{ label: 'should describe', pattern: /\bshould describe\b/i },
	{ label: 'placeholder', pattern: /\bplaceholder\b/i },
	{ label: 'tbd', pattern: /\btbd\b/i },
	{ label: 'the following section', pattern: /\bthe following (section|paragraph|content)\b/i },
	{ label: 'we will describe', pattern: /\bwe will (describe|outline|cover)\b/i }
];

function extractStrings(value: unknown, bucket: string[]): void {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed.length > 0) {
			bucket.push(trimmed);
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			extractStrings(item, bucket);
		}
		return;
	}

	if (value && typeof value === 'object') {
		for (const nested of Object.values(value)) {
			extractStrings(nested, bucket);
		}
	}
}

function normalizeForRepeatDetection(value: string): string {
	return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function candidateAudienceTokens(audience: string): string[] {
	const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your']);
	return audience
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 4 && !stopWords.has(token));
}

function detectLanguageMismatch(
	strings: string[],
	campaignLanguage: string
): { mismatch: boolean; detail: string } {
	const normalizedLanguage = campaignLanguage.toLowerCase().trim();
	const corpus = strings.join(' ').toLowerCase();

	if (normalizedLanguage.startsWith('de')) {
		const germanMarkers = [
			' und ',
			' mit ',
			' fuer ',
			' für ',
			' ihre ',
			' sie ',
			' keynote',
			' veranstaltung '
		];
		const englishMarkers = [
			' the ',
			' and ',
			' for ',
			' with ',
			' your ',
			' attendees ',
			' decision-makers '
		];

		const germanHits = germanMarkers.filter((marker) => corpus.includes(marker)).length;
		const englishHits = englishMarkers.filter((marker) => corpus.includes(marker)).length;
		const mismatch = englishHits >= 3 && englishHits > germanHits + 1;
		return {
			mismatch,
			detail: `de expected; germanMarkers=${germanHits}, englishMarkers=${englishHits}`
		};
	}

	return { mismatch: false, detail: 'language check skipped for non-de campaign language' };
}

export type LandingPageCopyQuality = {
	score: number;
	passed: boolean;
	warnings: string[];
	revisionSuggestions: string[];
	metaLanguageMatches?: string[];
};

function truncateSnippet(value: string, maxLength = 120): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 3)}...`;
}

function detectMetaLanguage(strings: string[]): { hits: string[]; matchedSnippets: string[] } {
	const hitLabels = new Set<string>();
	const matchedSnippets = new Set<string>();

	for (const text of strings) {
		for (const matcher of nonPublishableMetaPatterns) {
			if (!matcher.pattern.test(text)) {
				continue;
			}

			hitLabels.add(matcher.label);
			matchedSnippets.add(truncateSnippet(text));
		}
	}

	return {
		hits: [...hitLabels],
		matchedSnippets: [...matchedSnippets].slice(0, 5)
	};
}

export function evaluateLandingPageCopyQuality(
	page: LandingPageDocument,
	input: LandingPageGenerationInput
): LandingPageCopyQuality {
	const strings: string[] = [];
	for (const section of page.sections) {
		extractStrings(section.props, strings);
	}

	const lowerCorpus = strings.join(' ').toLowerCase();
	const warnings: string[] = [];
	const revisionSuggestions: string[] = [];
	let score = 100;
	const metaLanguage = detectMetaLanguage(strings);
	if (metaLanguage.hits.length > 0) {
		score -= 35;
		warnings.push(metaLanguageWarning);
		warnings.push(`Meta phrasing hits: ${metaLanguage.hits.join(', ')}.`);
		revisionSuggestions.push(
			'Rewrite flagged lines as final customer-facing prose instead of instructions or placeholders.'
		);
	}

	const languageMismatch = detectLanguageMismatch(strings, input.campaign.language);
	if (languageMismatch.mismatch) {
		score -= 25;
		warnings.push(languageMismatchWarning);
		warnings.push(`Language detail: ${languageMismatch.detail}`);
		revisionSuggestions.push(
			`Rewrite visible copy to consistently match campaign.language (${input.campaign.language}).`
		);
	}

	const repeatedMap = new Map<string, number>();
	for (const value of strings) {
		const normalized = normalizeForRepeatDetection(value);
		if (normalized.length < 40) {
			continue;
		}
		repeatedMap.set(normalized, (repeatedMap.get(normalized) ?? 0) + 1);
	}
	const repeatedCount = [...repeatedMap.values()].filter((count) => count > 1).length;
	if (repeatedCount > 0) {
		score -= Math.min(20, repeatedCount * 8);
		warnings.push('Detected repeated long-form copy across sections.');
		revisionSuggestions.push(
			'Make each section introduce distinct copy and avoid reusing similar paragraphs.'
		);
	}

	const bannedPhrases = [
		...new Set([...defaultGenericPhrases, ...input.messageMap.bannedGenericPhrases])
	];
	const genericHits = bannedPhrases.filter((phrase) => lowerCorpus.includes(phrase.toLowerCase()));
	if (genericHits.length > 0) {
		score -= Math.min(24, genericHits.length * 6);
		warnings.push(`Detected generic phrasing: ${genericHits.join(', ')}.`);
		revisionSuggestions.push(
			'Replace generic phrases with campaign-specific language and concrete outcomes.'
		);
	}

	const audienceTokens = candidateAudienceTokens(input.campaign.audience);
	const audienceMentions = audienceTokens.filter((token) => lowerCorpus.includes(token)).length;
	if (audienceTokens.length > 0 && audienceMentions === 0) {
		score -= 15;
		warnings.push('Copy does not clearly reference the intended audience context.');
		revisionSuggestions.push(
			'Anchor hero and outcomes copy to audience-specific context and constraints.'
		);
	}

	const proofAnchors = input.messageMap.proofAnchors.filter((anchor) => anchor.trim().length >= 8);
	if (proofAnchors.length > 0) {
		const proofMatches = proofAnchors.filter((anchor) =>
			lowerCorpus.includes(anchor.toLowerCase().slice(0, 24))
		).length;
		if (proofMatches === 0) {
			score -= 12;
			warnings.push('Copy lacks concrete proof anchors from campaign context.');
			revisionSuggestions.push(
				'Include at least one concrete proof point that matches campaign notes or approved evidence.'
			);
		}
	}

	if (warnings.length === 0) {
		revisionSuggestions.push('Copy quality passed with moderate threshold.');
	}

	const boundedScore = Math.max(0, Math.min(100, score));
	return {
		score: boundedScore,
		passed: boundedScore >= moderateQualityThreshold,
		warnings,
		revisionSuggestions,
		metaLanguageMatches: metaLanguage.matchedSnippets
	};
}

export function hasMetaLanguageWarning(copyQuality: LandingPageCopyQuality): boolean {
	return copyQuality.warnings.includes(metaLanguageWarning);
}

export function hasLanguageMismatchWarning(copyQuality: LandingPageCopyQuality): boolean {
	return copyQuality.warnings.includes(languageMismatchWarning);
}
