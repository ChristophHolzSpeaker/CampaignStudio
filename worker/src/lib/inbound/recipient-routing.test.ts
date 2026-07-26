import { describe, expect, it } from 'vitest';
import { isManagedSpeakerSender, resolveInboundRecipientRoute } from './recipient-routing';

describe('resolveInboundRecipientRoute', () => {
	it.each([
		['speaker@christophholz.com', 'speaker@christophholz.com'],
		['speakerwp@christophholz.com', 'speakerwp@christophholz.com'],
		['speakerlp@christophholz.com', 'speakerlp@christophholz.com'],
		['speakerlp+55@christophholz.com', 'speakerlp@christophholz.com']
	])('replies to %s from %s', (recipient, replyFrom) => {
		expect(resolveInboundRecipientRoute([recipient])).toEqual({
			action: 'process',
			reply_from_email: replyFrom
		});
	});

	it('ignores messages addressed to the CRM alias', () => {
		expect(resolveInboundRecipientRoute(['speakercr@christophholz.com'])).toEqual({
			action: 'ignore',
			reply_from_email: null
		});
	});

	it('gives the CRM ignore rule precedence over other recipients', () => {
		expect(
			resolveInboundRecipientRoute(['speaker@christophholz.com', 'speakercr@christophholz.com'])
		).toEqual({
			action: 'ignore',
			reply_from_email: null
		});
	});

	it('recognizes configured aliases as senders from the watched mailbox', () => {
		expect(isManagedSpeakerSender('speakerwp@christophholz.com', 'speaker@christophholz.com')).toBe(
			true
		);
		expect(isManagedSpeakerSender('external@example.com', 'speaker@christophholz.com')).toBe(false);
	});
});
