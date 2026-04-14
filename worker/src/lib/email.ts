import type { AttributionStatus } from '../../../shared/event-types';

const PLUS_PATTERN = /^cmp(?<campaign_id>\d+)_cp(?<campaign_page_id>\d+)$/i;

export function normalizeEmailAddress(input: string): string | null {
	const trimmed = input.trim();
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

export type ParsedAttribution = {
	status: AttributionStatus;
	campaign_id: number | null;
	campaign_page_id: number | null;
};

export function parsePlusAddressAttribution(toEmail: string): ParsedAttribution {
	const normalizedTo = normalizeEmailAddress(toEmail);
	if (!normalizedTo) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null
		};
	}

	const [localPart] = normalizedTo.split('@');
	if (!localPart) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null
		};
	}

	const plusIndex = localPart.indexOf('+');
	if (plusIndex < 0 || plusIndex === localPart.length - 1) {
		return {
			status: 'missing_plus_address',
			campaign_id: null,
			campaign_page_id: null
		};
	}

	const plusToken = localPart.slice(plusIndex + 1);
	const match = plusToken.match(PLUS_PATTERN);
	if (!match?.groups?.campaign_id || !match.groups.campaign_page_id) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null
		};
	}

	return {
		status: 'parsed',
		campaign_id: Number(match.groups.campaign_id),
		campaign_page_id: Number(match.groups.campaign_page_id)
	};
}
