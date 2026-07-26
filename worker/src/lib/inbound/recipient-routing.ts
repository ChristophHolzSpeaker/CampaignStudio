import {
	AUTORESPONSE_SPEAKER_SENDERS,
	MANAGED_SPEAKER_SENDERS,
	SPEAKER_EMAIL
} from '../../../../shared/speaker-email';
import { normalizeEmailAddress } from '../email';

export type InboundRecipientRoute =
	| {
			action: 'process';
			reply_from_email: string;
	  }
	| {
			action: 'ignore';
			reply_from_email: null;
	  };

function withoutPlusToken(email: string): string {
	const [localPart, domain] = email.split('@');
	const baseLocalPart = localPart?.split('+')[0] ?? '';
	return `${baseLocalPart}@${domain ?? ''}`;
}

export function isManagedSpeakerSender(email: string, gmailUser: string): boolean {
	const normalizedEmail = normalizeEmailAddress(email);
	const normalizedGmailUser = normalizeEmailAddress(gmailUser);
	if (!normalizedEmail) {
		return false;
	}

	if (normalizedEmail === normalizedGmailUser) {
		return true;
	}

	return MANAGED_SPEAKER_SENDERS.includes(
		withoutPlusToken(normalizedEmail) as (typeof MANAGED_SPEAKER_SENDERS)[number]
	);
}

export function resolveInboundRecipientRoute(toRecipients: string[]): InboundRecipientRoute {
	const baseRecipients = toRecipients
		.map((recipient) => normalizeEmailAddress(recipient))
		.filter((recipient): recipient is string => recipient !== null)
		.map(withoutPlusToken);

	if (baseRecipients.includes(SPEAKER_EMAIL.crm)) {
		return {
			action: 'ignore',
			reply_from_email: null
		};
	}

	const replyFrom = baseRecipients.find((recipient) =>
		AUTORESPONSE_SPEAKER_SENDERS.includes(
			recipient as (typeof AUTORESPONSE_SPEAKER_SENDERS)[number]
		)
	);

	return {
		action: 'process',
		reply_from_email: replyFrom ?? SPEAKER_EMAIL.primary
	};
}
