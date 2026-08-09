import { describe, expect, it } from 'vitest';
import { isManagedSpeakerSender, resolveInboundRecipientRoute } from './recipient-routing';

describe('resolveInboundRecipientRoute', () => {
	it.each([
		['speaker+55@christophholz.com', 'speaker@christophholz.com'],
		['speakerwp@christophholz.com', 'speakerwp@christophholz.com'],
		['speakerlp@christophholz.com', 'speakerlp@christophholz.com'],
		['speakerlp+55@christophholz.com', 'speakerlp@christophholz.com']
	])('replies to %s from %s', (recipient, replyFrom) => {
		expect(resolveInboundRecipientRoute([recipient])).toEqual({
			action: 'process',
			reply_from_email: replyFrom
		});
	});

	it('temporarily ignores messages addressed directly to the primary speaker mailbox', () => {
		expect(resolveInboundRecipientRoute(['speaker@christophholz.com'])).toEqual({
			action: 'ignore',
			reply_from_email: null,
			skipped_reason: 'recipient_speaker'
		});
	});

	it('ignores messages addressed to the CRM alias', () => {
		expect(resolveInboundRecipientRoute(['speakercr@christophholz.com'])).toEqual({
			action: 'ignore',
			reply_from_email: null,
			skipped_reason: 'recipient_speakercr'
		});
	});

	it.each(['speaker@christophholz.com', 'speakercr@christophholz.com'])(
		'gives the %s ignore rule precedence over allowed recipients',
		(ignoredRecipient) => {
			expect(
				resolveInboundRecipientRoute(['speakerlp@christophholz.com', ignoredRecipient])
			).toMatchObject({ action: 'ignore', reply_from_email: null });
		}
	);

	it('recognizes configured aliases as senders from the watched mailbox', () => {
		expect(isManagedSpeakerSender('speakerwp@christophholz.com', 'speaker@christophholz.com')).toBe(
			true
		);
		expect(isManagedSpeakerSender('external@example.com', 'speaker@christophholz.com')).toBe(false);
	});
});
