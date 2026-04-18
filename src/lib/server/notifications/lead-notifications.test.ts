import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/notifications/telegram', () => ({
	notifyNewLead: vi.fn()
}));

import { notifyNewLead } from '$lib/server/notifications/telegram';
import { notifyLeadCreated } from './lead-notifications';

const mockedNotifyNewLead = vi.mocked(notifyNewLead);

describe('notifyLeadCreated', () => {
	beforeEach(() => {
		mockedNotifyNewLead.mockReset();
	});

	it('sends telegram notification when lead journey is newly created', async () => {
		mockedNotifyNewLead.mockResolvedValueOnce({ ok: true });

		await notifyLeadCreated({
			created: true,
			leadJourneyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			attendeeName: 'Lead User',
			attendeeEmail: 'lead@example.com',
			company: 'ACME',
			meetingScope: 'Discuss campaign goals and launch plan',
			campaignId: 7,
			campaignPageId: 11,
			pageSlug: 'speaker-landing',
			pagePath: '/speaker/christoph'
		});

		expect(mockedNotifyNewLead).toHaveBeenCalledWith(
			expect.objectContaining({
				lead_journey_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
				attendee_email: 'lead@example.com',
				campaign_context: expect.objectContaining({
					campaign_id: 7,
					campaign_page_id: 11
				})
			})
		);
	});

	it('does not send telegram notification when lead journey already exists', async () => {
		await notifyLeadCreated({
			created: false,
			leadJourneyId: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			attendeeName: 'Lead User',
			attendeeEmail: 'lead@example.com',
			company: 'ACME',
			meetingScope: 'Discuss campaign goals and launch plan',
			campaignId: 7,
			campaignPageId: 11,
			pagePath: '/speaker/christoph'
		});

		expect(mockedNotifyNewLead).not.toHaveBeenCalled();
	});
});
