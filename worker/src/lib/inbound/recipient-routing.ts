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
			skipped_reason: 'recipient_speaker' | 'recipient_speakercr' | 'recipient_keynote';
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
	const normalizedRecipients = toRecipients
		.map((recipient) => normalizeEmailAddress(recipient))
		.filter((recipient): recipient is string => recipient !== null);
	const baseRecipients = normalizedRecipients.map(withoutPlusToken);

	if (normalizedRecipients.includes(SPEAKER_EMAIL.primary)) {
		return {
			action: 'ignore',
			reply_from_email: null,
			skipped_reason: 'recipient_speaker'
		};
	}

	if (baseRecipients.includes(SPEAKER_EMAIL.crm)) {
		return {
			action: 'ignore',
			reply_from_email: null,
			skipped_reason: 'recipient_speakercr'
		};
	}

	if (baseRecipients.includes(SPEAKER_EMAIL.keynote)) {
		return {
			action: 'ignore',
			reply_from_email: null,
			skipped_reason: 'recipient_keynote'
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
