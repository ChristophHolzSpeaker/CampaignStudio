import { notifyNewLead } from '$lib/server/notifications/telegram';

export async function notifyLeadCreated(input: {
	created: boolean;
	leadJourneyId: string;
	attendeeName: string;
	attendeeEmail: string;
	company: string;
	meetingScope: string;
	campaignId: number;
	campaignPageId: number;
	pageSlug?: string;
	pagePath: string;
}): Promise<void> {
	if (!input.created) {
		return;
	}

	await notifyNewLead({
		lead_journey_id: input.leadJourneyId,
		attendee_name: input.attendeeName,
		attendee_email: input.attendeeEmail,
		company: input.company,
		meeting_scope: input.meetingScope,
		campaign_context: {
			lead_journey_id: input.leadJourneyId,
			campaign_id: input.campaignId,
			campaign_page_id: input.campaignPageId,
			page_slug: input.pageSlug ?? null,
			page_path: input.pagePath
		}
	});
}
