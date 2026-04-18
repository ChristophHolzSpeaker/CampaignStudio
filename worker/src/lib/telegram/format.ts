import type {
	BookingConfirmedTelegramNotification,
	BookingRescheduledTelegramNotification,
	NewLeadTelegramNotification,
	TelegramNotificationRequest,
	TelegramTimeRange
} from '../../../../shared/telegram-notifications';

function formatTimeRange(label: string, value: TelegramTimeRange): string {
	return `${label}: ${value.starts_at_iso} -> ${value.ends_at_iso}`;
}

function optionalLine(label: string, value?: string | number | null): string | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	return `${label}: ${value}`;
}

function campaignContextLines(
	input:
		| NewLeadTelegramNotification
		| BookingConfirmedTelegramNotification
		| BookingRescheduledTelegramNotification
): Array<string> {
	const campaignContext = input.campaign_context;
	if (!campaignContext) {
		return [];
	}

	return [
		optionalLine('Lead journey', campaignContext.lead_journey_id),
		optionalLine('Campaign ID', campaignContext.campaign_id),
		optionalLine('Campaign page ID', campaignContext.campaign_page_id),
		optionalLine('Booking link ID', campaignContext.booking_link_id),
		optionalLine('Page slug', campaignContext.page_slug),
		optionalLine('Page path', campaignContext.page_path)
	].filter((line): line is string => Boolean(line));
}

function urlLines(input: TelegramNotificationRequest): Array<string> {
	const urls = input.urls;
	if (!urls) {
		return [];
	}

	return [
		optionalLine('Reschedule URL', urls.reschedule_url),
		optionalLine('Calendar URL', urls.calendar_event_url),
		optionalLine('Booking URL', urls.booking_url),
		optionalLine('Campaign page URL', urls.campaign_page_url)
	].filter((line): line is string => Boolean(line));
}

function metadataLine(input: TelegramNotificationRequest): string | null {
	if (!input.metadata) {
		return null;
	}

	return optionalLine('Metadata', JSON.stringify(input.metadata));
}

function formatNewLead(input: NewLeadTelegramNotification): string {
	return [
		'[NEW LEAD]',
		optionalLine('Lead journey', input.lead_journey_id),
		optionalLine('Name', input.attendee_name),
		optionalLine('Email', input.attendee_email),
		optionalLine('Company', input.company),
		optionalLine('Meeting scope', input.meeting_scope),
		...campaignContextLines(input),
		...urlLines(input),
		metadataLine(input)
	]
		.filter((line): line is string => Boolean(line))
		.join('\n');
}

function formatBookingConfirmed(input: BookingConfirmedTelegramNotification): string {
	return [
		'[BOOKING CONFIRMED]',
		`Booking ID: ${input.booking_id}`,
		`Booking type: ${input.booking_type}`,
		optionalLine('Name', input.attendee_name),
		optionalLine('Email', input.attendee_email),
		optionalLine('Company', input.company),
		optionalLine('Meeting scope', input.meeting_scope),
		formatTimeRange('Confirmed time', input.booking_time),
		...campaignContextLines(input),
		...urlLines(input),
		metadataLine(input)
	]
		.filter((line): line is string => Boolean(line))
		.join('\n');
}

function formatBookingRescheduled(input: BookingRescheduledTelegramNotification): string {
	return [
		'[BOOKING RESCHEDULED]',
		`Booking ID: ${input.booking_id}`,
		`Booking type: ${input.booking_type}`,
		optionalLine('Name', input.attendee_name),
		optionalLine('Email', input.attendee_email),
		optionalLine('Company', input.company),
		optionalLine('Meeting scope', input.meeting_scope),
		formatTimeRange('Old time', input.previous_booking_time),
		formatTimeRange('New time', input.new_booking_time),
		...campaignContextLines(input),
		...urlLines(input),
		metadataLine(input)
	]
		.filter((line): line is string => Boolean(line))
		.join('\n');
}

export function formatTelegramNotification(input: TelegramNotificationRequest): string {
	if (input.type === 'new_lead') {
		return formatNewLead(input);
	}

	if (input.type === 'booking_confirmed') {
		return formatBookingConfirmed(input);
	}

	return formatBookingRescheduled(input);
}
