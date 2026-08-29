import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/lead-events', () => ({
	logLeadEvent: vi.fn()
}));

vi.mock('$lib/server/attribution/lead-journeys', () => ({
	findOrCreateLeadJourneyFromInquiry: vi.fn()
}));

vi.mock('$lib/server/attribution/campaign-visits', () => ({
	resolveCampaignVisitId: vi.fn()
}));

vi.mock('$lib/server/bookings', () => ({
	classifyLeadBookingIntent: vi.fn(),
	isLeadBookingIntentApproved: vi.fn()
}));

vi.mock('$lib/server/bookings/woody-email-service', () => ({
	sendBookingLinkInviteEmailForLeadSubmission: vi.fn()
}));

vi.mock('$lib/server/notifications/booking-form-submission', () => ({
	notifyBookingFormSubmission: vi.fn()
}));

import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { resolveCampaignVisitId } from '$lib/server/attribution/campaign-visits';
import { classifyLeadBookingIntent, isLeadBookingIntentApproved } from '$lib/server/bookings';
import { sendBookingLinkInviteEmailForLeadSubmission } from '$lib/server/bookings/woody-email-service';
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import { submitLeadIntake } from './intake-service';

const mockedLogLeadEvent = vi.mocked(logLeadEvent);
const mockedFindOrCreateLeadJourney = vi.mocked(findOrCreateLeadJourneyFromInquiry);
const mockedResolveCampaignVisitId = vi.mocked(resolveCampaignVisitId);
const mockedClassifyLeadBookingIntent = vi.mocked(classifyLeadBookingIntent);
const mockedIsLeadBookingIntentApproved = vi.mocked(isLeadBookingIntentApproved);
const mockedSendBookingLinkInvite = vi.mocked(sendBookingLinkInviteEmailForLeadSubmission);
const mockedNotifyBookingFormSubmission = vi.mocked(notifyBookingFormSubmission);

describe('submitLeadIntake', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedNotifyBookingFormSubmission.mockResolvedValue(undefined);
		mockedResolveCampaignVisitId.mockResolvedValue(1020);
		mockedClassifyLeadBookingIntent.mockResolvedValue({
			decision: 'speaking_engagement',
			confidence: 1,
			reason: 'The request is for a keynote.'
		});
		mockedIsLeadBookingIntentApproved.mockReturnValue(true);
		mockedSendBookingLinkInvite.mockResolvedValue({
			status: 'sent',
			providerMessageId: 'gmail-message-1'
		});
	});

	it('records an identified lead for an artifact form matched to an existing journey', async () => {
		mockedFindOrCreateLeadJourney.mockResolvedValue({
			journey: {
				id: 'e0005383-dd54-4888-b5ed-5e92bc627428'
			},
			created: false
		} as never);

		await submitLeadIntake({
			intake: {
				email: 'lead@example.com',
				name: 'JP Live Test',
				phone: '+16126498745',
				company: 'Compote',
				scope: 'Wir suchen einen Keynote-Speaker für unsere Technologiekonferenz.'
			},
			campaignId: 38,
			campaignPageId: 197,
			visitorIdentifier: 'visitor-1',
			pageSlug: 'ki-keynote-speaker-buchen',
			pagePath: '/ki-keynote-speaker-buchen',
			surface: 'artifact_runtime',
			eventSource: 'sveltekit.artifact_lead_intake',
			formType: 'artifact_lead_intake',
			notificationFlow: 'inline_lead_intake',
			logJourneyCreated: true,
			cta: { key: 'booking-lead', section: 'artifact_form' }
		});

		expect(mockedLogLeadEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				leadJourneyId: 'e0005383-dd54-4888-b5ed-5e92bc627428',
				campaignVisitId: 1020,
				campaignId: 38,
				campaignPageId: 197,
				eventType: 'lead_identified',
				eventSource: 'sveltekit.artifact_lead_intake'
			})
		);
	});
});
