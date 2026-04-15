import type { AttributionStatus } from '../../../../shared/event-types';
import { normalizeEmailAddress } from '../email/normalize';

const PLUS_PATTERN = /^cmp(?<campaign_id>\d+)_cp(?<campaign_page_id>\d+)$/i;

export type ParsedPlusAddress = {
	status: AttributionStatus;
	campaign_id: number | null;
	campaign_page_id: number | null;
	address: string | null;
};

export function parsePlusAddressAttribution(toEmail: string): ParsedPlusAddress {
	const normalizedTo = normalizeEmailAddress(toEmail);
	if (!normalizedTo) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: null
		};
	}

	const [localPart] = normalizedTo.split('@');
	if (!localPart) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: normalizedTo
		};
	}

	const plusIndex = localPart.indexOf('+');
	if (plusIndex < 0 || plusIndex === localPart.length - 1) {
		return {
			status: 'missing_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: normalizedTo
		};
	}

	const plusToken = localPart.slice(plusIndex + 1);
	const match = plusToken.match(PLUS_PATTERN);
	if (!match?.groups?.campaign_id || !match.groups.campaign_page_id) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: normalizedTo
		};
	}

	return {
		status: 'parsed',
		campaign_id: Number(match.groups.campaign_id),
		campaign_page_id: Number(match.groups.campaign_page_id),
		address: normalizedTo
	};
}

export function parsePlusAddressFromRecipients(toRecipients: string[]): ParsedPlusAddress {
	let sawMalformed = false;
	let sawMissing = false;

	for (const recipient of toRecipients) {
		const parsed = parsePlusAddressAttribution(recipient);
		if (parsed.status === 'parsed') {
			return parsed;
		}
		if (parsed.status === 'malformed_plus_address') {
			sawMalformed = true;
		}
		if (parsed.status === 'missing_plus_address') {
			sawMissing = true;
		}
	}

	if (sawMalformed) {
		return {
			status: 'malformed_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: null
		};
	}

	if (sawMissing) {
		return {
			status: 'missing_plus_address',
			campaign_id: null,
			campaign_page_id: null,
			address: null
		};
	}

	return {
		status: 'malformed_plus_address',
		campaign_id: null,
		campaign_page_id: null,
		address: null
	};
}
