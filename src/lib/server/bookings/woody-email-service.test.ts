import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/client', () => ({
	createBookingLink: vi.fn()
}));

vi.mock('$lib/server/attribution/lead-events', () => ({
	getLatestFormSubmissionEventForJourney: vi.fn()
}));

vi.mock('$lib/server/attribution/lead-journeys', () => ({
	getLeadJourneyById: vi.fn(),
	markLeadJourneyBookingLinkInviteEmailSent: vi.fn()
}));

vi.mock('$lib/server/bookings/repository', () => ({
	getBookingById: vi.fn(),
	markBookingConfirmationEmailSent: vi.fn()
}));

vi.mock('$lib/server/notifications/woody-email', () => ({
	sendBookingLinkInviteWoodyEmail: vi.fn(),
	sendBookingConfirmedWoodyEmail: vi.fn()
}));

import { createBookingLink } from '$lib/server/attribution/client';
import { getLatestFormSubmissionEventForJourney } from '$lib/server/attribution/lead-events';
import {
	getLeadJourneyById,
	markLeadJourneyBookingLinkInviteEmailSent
} from '$lib/server/attribution/lead-journeys';
import { getBookingById, markBookingConfirmationEmailSent } from '$lib/server/bookings/repository';
import {
	sendBookingLinkInviteWoodyEmail,
	sendBookingConfirmedWoodyEmail
} from '$lib/server/notifications/woody-email';
import {
	buildBookingConfirmedEmailContext,
	buildBookingLinkInviteEmailContext,
	composeBookingConfirmedEmail,
	composeBookingLinkInviteEmail,
	sendBookingConfirmedEmail,
	sendBookingLinkInviteEmailForLeadSubmission
} from './woody-email-service';

const mockedCreateBookingLink = vi.mocked(createBookingLink);
const mockedGetLatestFormSubmissionEventForJourney = vi.mocked(
	getLatestFormSubmissionEventForJourney
);
const mockedGetLeadJourneyById = vi.mocked(getLeadJourneyById);
const mockedMarkLeadJourneyBookingLinkInviteEmailSent = vi.mocked(
	markLeadJourneyBookingLinkInviteEmailSent
);
const mockedGetBookingById = vi.mocked(getBookingById);
const mockedMarkBookingConfirmationEmailSent = vi.mocked(markBookingConfirmationEmailSent);
const mockedSendBookingLinkInviteWoodyEmail = vi.mocked(sendBookingLinkInviteWoodyEmail);
const mockedSendBookingConfirmedWoodyEmail = vi.mocked(sendBookingConfirmedWoodyEmail);

describe('woody-email-service', () => {
	beforeEach(() => {
		mockedCreateBookingLink.mockReset();
		mockedGetLatestFormSubmissionEventForJourney.mockReset();
		mockedGetLeadJourneyById.mockReset();
		mockedMarkLeadJourneyBookingLinkInviteEmailSent.mockReset();
		mockedGetBookingById.mockReset();
		mockedMarkBookingConfirmationEmailSent.mockReset();
		mockedSendBookingLinkInviteWoodyEmail.mockReset();
		mockedSendBookingConfirmedWoodyEmail.mockReset();
	});

	it('buildBookingLinkInviteEmailContext builds DB-backed invite context', async () => {
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			campaign_id: 7,
			campaign_page_id: 11,
			contact_email: 'lead@example.com',
			contact_name: 'Lead User'
		} as never);
		mockedGetLatestFormSubmissionEventForJourney.mockResolvedValueOnce({
			eventPayload: {
				form: {
					organization: 'ACME',
					meeting_scope: 'Discuss launch strategy'
				},
				attribution: {
					page_slug: 'speaker-landing',
					page_path: '/speaker/christoph'
				}
			},
			campaignId: 7,
			campaignPageId: 11,
			occurredAt: new Date('2026-04-18T00:00:00.000Z')
		});

		const context = await buildBookingLinkInviteEmailContext({
			leadJourneyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			bookingLinkUrl: 'https://book.example.com/book/l/token-1',
			bookingLinkToken: 'token-1'
		});

		expect(context).toEqual(
			expect.objectContaining({
				recipientEmail: 'lead@example.com',
				meetingScope: 'Discuss launch strategy',
				bookingLinkUrl: 'https://book.example.com/book/l/token-1'
			})
		);
	});

	it('buildBookingConfirmedEmailContext builds DB-backed booking summary context', async () => {
		mockedGetBookingById.mockResolvedValueOnce({
			id: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
			booking_type: 'lead',
			lead_journey_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			email: 'lead@example.com',
			name: 'Lead User',
			company: 'ACME',
			scope: 'Discuss launch strategy',
			starts_at: new Date('2026-06-01T10:00:00.000Z'),
			ends_at: new Date('2026-06-01T10:30:00.000Z')
		} as never);
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			campaign_id: 7,
			campaign_page_id: 11
		} as never);

		const context = await buildBookingConfirmedEmailContext({
			bookingId: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
			calendarEventUrl: 'https://calendar.google.com/event?eid=evt_1'
		});

		expect(context).toEqual(
			expect.objectContaining({
				bookingId: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
				meetingScope: 'Discuss launch strategy',
				calendarEventUrl: 'https://calendar.google.com/event?eid=evt_1'
			})
		);
	});

	it('composeBookingLinkInviteEmail includes tokenized booking link', () => {
		const composed = composeBookingLinkInviteEmail({
			intent: 'booking_link_invite',
			recipientEmail: 'lead@example.com',
			recipientName: 'Lead User',
			leadJourneyId: 'journey-1',
			campaignId: 7,
			campaignPageId: 11,
			bookingType: 'lead',
			meetingScope: 'Discuss launch strategy',
			requestSummary: 'Discuss launch strategy',
			organization: 'ACME',
			bookingLinkUrl: 'https://book.example.com/book/l/token-1',
			bookingLinkToken: 'token-1',
			pagePath: '/speaker/christoph',
			pageSlug: 'speaker-landing'
		});

		expect(composed.bodyText).toContain('https://book.example.com/book/l/token-1');
	});

	it('composeBookingConfirmedEmail includes confirmation language and calendar URL', () => {
		const composed = composeBookingConfirmedEmail({
			intent: 'booking_confirmed',
			recipientEmail: 'lead@example.com',
			recipientName: 'Lead User',
			leadJourneyId: 'journey-1',
			campaignId: 7,
			campaignPageId: 11,
			bookingId: 'booking-1',
			bookingType: 'lead',
			meetingScope: 'Discuss launch strategy',
			requestSummary: 'Discuss launch strategy',
			organization: 'ACME',
			confirmedStartsAt: new Date('2026-06-01T10:00:00.000Z'),
			confirmedEndsAt: new Date('2026-06-01T10:30:00.000Z'),
			calendarEventUrl: 'https://calendar.google.com/event?eid=evt_1'
		});

		expect(composed.bodyText.toLowerCase()).toContain('locked in');
		expect(composed.bodyText).toContain('https://calendar.google.com/event?eid=evt_1');
	});

	it('sendBookingLinkInviteEmailForLeadSubmission triggers worker invocation with expected payload', async () => {
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			campaign_id: 7,
			campaign_page_id: 11,
			contact_email: 'lead@example.com',
			contact_name: 'Lead User',
			booking_link_invite_email_sent_at: null
		} as never);
		mockedCreateBookingLink.mockResolvedValueOnce({
			ok: true,
			url: 'https://book.example.com/book/l/token-1',
			token: 'token-1',
			expires_at: '2026-06-01T00:00:00.000Z'
		});
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			campaign_id: 7,
			campaign_page_id: 11,
			contact_email: 'lead@example.com',
			contact_name: 'Lead User'
		} as never);
		mockedGetLatestFormSubmissionEventForJourney.mockResolvedValueOnce({
			eventPayload: {
				form: {
					meeting_scope: 'Discuss launch strategy'
				}
			},
			campaignId: 7,
			campaignPageId: 11,
			occurredAt: new Date('2026-04-18T00:00:00.000Z')
		});
		mockedSendBookingLinkInviteWoodyEmail.mockResolvedValueOnce({
			ok: true,
			provider_message_id: 'gmail-message-1',
			provider_thread_id: 'thread-1'
		});

		await sendBookingLinkInviteEmailForLeadSubmission({
			leadJourneyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d'
		});

		expect(mockedSendBookingLinkInviteWoodyEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				intent: 'booking_link_invite',
				booking_link_url: 'https://book.example.com/book/l/token-1'
			})
		);
		expect(mockedMarkLeadJourneyBookingLinkInviteEmailSent).toHaveBeenCalledWith(
			expect.objectContaining({
				journeyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d'
			})
		);
	});

	it('sendBookingConfirmedEmail triggers worker invocation for confirmed booking', async () => {
		mockedGetBookingById.mockResolvedValueOnce({
			id: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
			status: 'confirmed',
			booking_confirmation_email_sent_at: null,
			email: 'lead@example.com'
		} as never);
		mockedGetBookingById.mockResolvedValueOnce({
			id: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
			booking_type: 'lead',
			lead_journey_id: 'journey-1',
			email: 'lead@example.com',
			name: 'Lead User',
			company: 'ACME',
			scope: 'Discuss launch strategy',
			starts_at: new Date('2026-06-01T10:00:00.000Z'),
			ends_at: new Date('2026-06-01T10:30:00.000Z')
		} as never);
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: 'journey-1',
			campaign_id: 7,
			campaign_page_id: 11
		} as never);
		mockedSendBookingConfirmedWoodyEmail.mockResolvedValueOnce({
			ok: true,
			provider_message_id: 'gmail-message-2',
			provider_thread_id: 'thread-2'
		});

		await sendBookingConfirmedEmail({
			bookingId: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a',
			calendarEventUrl: 'https://calendar.google.com/event?eid=evt_1'
		});

		expect(mockedSendBookingConfirmedWoodyEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				intent: 'booking_confirmed',
				calendar_event_url: 'https://calendar.google.com/event?eid=evt_1'
			})
		);
		expect(mockedMarkBookingConfirmationEmailSent).toHaveBeenCalledWith(
			expect.objectContaining({
				bookingId: '2dd66b8f-0bd5-45f6-8d6b-7fd90d0ddf9a'
			})
		);
	});

	it('duplicate-send protection skips invite when already sent', async () => {
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: 'journey-1',
			booking_link_invite_email_sent_at: new Date('2026-04-18T00:00:00.000Z')
		} as never);

		const result = await sendBookingLinkInviteEmailForLeadSubmission({
			leadJourneyId: 'journey-1'
		});

		expect(result).toEqual({ status: 'skipped', reason: 'already_sent' });
		expect(mockedSendBookingLinkInviteWoodyEmail).not.toHaveBeenCalled();
	});

	it('duplicate-send protection skips booking confirmation when already sent', async () => {
		mockedGetBookingById.mockResolvedValueOnce({
			id: 'booking-1',
			status: 'confirmed',
			email: 'lead@example.com',
			booking_confirmation_email_sent_at: new Date('2026-04-18T00:00:00.000Z')
		} as never);

		const result = await sendBookingConfirmedEmail({
			bookingId: 'booking-1',
			calendarEventUrl: 'https://calendar.google.com/event?eid=evt_1'
		});

		expect(result).toEqual({ status: 'skipped', reason: 'already_sent' });
		expect(mockedSendBookingConfirmedWoodyEmail).not.toHaveBeenCalled();
	});
});
