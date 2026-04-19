import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/attribution/lead-events', () => ({
	getLatestFormSubmissionEventForJourney: vi.fn()
}));

vi.mock('$lib/server/attribution/lead-journeys', () => ({
	getLeadJourneyById: vi.fn()
}));

import { getLatestFormSubmissionEventForJourney } from '$lib/server/attribution/lead-events';
import { getLeadJourneyById } from '$lib/server/attribution/lead-journeys';
import { resolveLeadBookingIntakeContext } from './lead-intake-context';

const mockedGetLatestFormSubmissionEventForJourney = vi.mocked(
	getLatestFormSubmissionEventForJourney
);
const mockedGetLeadJourneyById = vi.mocked(getLeadJourneyById);

describe('lead-intake-context', () => {
	beforeEach(() => {
		mockedGetLatestFormSubmissionEventForJourney.mockReset();
		mockedGetLeadJourneyById.mockReset();
	});

	it('resolves complete intake context from journey + latest form submission', async () => {
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: 'journey-1',
			contact_email: 'Lead@Example.com ',
			contact_name: 'Lead User'
		} as never);
		mockedGetLatestFormSubmissionEventForJourney.mockResolvedValueOnce({
			eventPayload: {
				form: {
					meeting_scope: 'Discuss campaign launch',
					organization: 'ACME'
				}
			},
			campaignId: 1,
			campaignPageId: 2,
			occurredAt: new Date('2026-04-18T00:00:00.000Z')
		});

		const result = await resolveLeadBookingIntakeContext({
			tokenContext: {
				bookingType: 'lead',
				token: 'token-1',
				bookingLinkId: 'link-1',
				leadJourneyId: 'journey-1',
				campaignId: 1,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});

		expect(result.isComplete).toBe(true);
		expect(result.values).toEqual({
			email: 'lead@example.com',
			scope: 'Discuss campaign launch',
			name: 'Lead User',
			company: 'ACME'
		});
		expect(result.summary).toEqual(
			expect.objectContaining({
				email: 'lead@example.com',
				requestSummary: 'Discuss campaign launch'
			})
		);
	});

	it('returns partial intake when required scope is missing', async () => {
		mockedGetLeadJourneyById.mockResolvedValueOnce({
			id: 'journey-2',
			contact_email: 'lead@example.com',
			contact_name: 'Lead User'
		} as never);
		mockedGetLatestFormSubmissionEventForJourney.mockResolvedValueOnce(null);

		const result = await resolveLeadBookingIntakeContext({
			tokenContext: {
				bookingType: 'lead',
				token: 'token-2',
				bookingLinkId: 'link-2',
				leadJourneyId: 'journey-2',
				campaignId: 2,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: null
			}
		});

		expect(result.isComplete).toBe(false);
		expect(result.values.email).toBe('lead@example.com');
		expect(result.missingRequiredFields).toEqual(['scope']);
		expect(result.summary).toBeNull();
	});

	it('falls back to booking link metadata when journey is unavailable', async () => {
		const result = await resolveLeadBookingIntakeContext({
			tokenContext: {
				bookingType: 'lead',
				token: 'token-3',
				bookingLinkId: 'link-3',
				leadJourneyId: null,
				campaignId: null,
				expiresAt: new Date('2026-06-01T00:00:00.000Z'),
				clickedAt: null,
				bookedAt: null,
				metadata: {
					email: 'fallback@example.com',
					name: 'Fallback User',
					scope: 'Review speaking engagement'
				}
			}
		});

		expect(result.isComplete).toBe(true);
		expect(result.values.email).toBe('fallback@example.com');
		expect(result.values.name).toBe('Fallback User');
		expect(result.values.scope).toBe('Review speaking engagement');
	});
});
