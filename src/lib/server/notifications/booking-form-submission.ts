import { sendFormSubmissionNotificationViaWorker } from '$lib/server/notifications/form-submission-worker-client';

type BookingFormSubmissionInput = {
	flow:
		| 'inline_lead_sequence'
		| 'inline_lead_sequence_hero'
		| 'book_l_new'
		| 'book_l_existing'
		| 'book_g';
	email: string;
	name?: string | null;
	phone?: string | null;
	company?: string | null;
	scope: string;
	campaignId?: number | null;
	campaignPageId?: number | null;
	pageSlug?: string | null;
	pagePath: string;
};

const INTERNAL_BOOKING_EMAIL = 'speaker@christophholz.com';

function line(label: string, value: string | number | null | undefined): string {
	return `${label}: ${value ?? ''}`;
}

export async function notifyBookingFormSubmission(
	input: BookingFormSubmissionInput
): Promise<void> {
	const subject = `Booking form submission - ${input.flow} - ${input.email}`;
	const bodyText = [
		'New booking form submission received.',
		'',
		line('Flow', input.flow),
		line('Email', input.email),
		line('Name', input.name ?? null),
		line('Phone', input.phone ?? null),
		line('Company', input.company ?? null),
		line('Campaign ID', input.campaignId ?? null),
		line('Campaign Page ID', input.campaignPageId ?? null),
		line('Page Slug', input.pageSlug ?? null),
		line('Page Path', input.pagePath),
		'',
		'Scope:',
		input.scope
	].join('\n');

	await sendFormSubmissionNotificationViaWorker({
		to_email: INTERNAL_BOOKING_EMAIL,
		subject,
		body_text: bodyText,
		metadata: {
			flow: input.flow,
			email: input.email,
			campaign_id: input.campaignId ?? null,
			campaign_page_id: input.campaignPageId ?? null,
			page_slug: input.pageSlug ?? null,
			page_path: input.pagePath
		}
	});
}
