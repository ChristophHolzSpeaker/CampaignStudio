export const bookingCalendarEventTypes = ['lead', 'general'] as const;
export type BookingCalendarEventType = (typeof bookingCalendarEventTypes)[number];

export type BookingCalendarLeadContext = {
	lead_journey_id?: string | null;
	campaign_id?: number | null;
	booking_link_id?: string | null;
};

export type CreateBookingCalendarEventRequest = {
	booking_id: string;
	booking_type: BookingCalendarEventType;
	attendee_email: string;
	attendee_name?: string | null;
	meeting_scope: string;
	starts_at_iso: string;
	ends_at_iso: string;
	reschedule_url: string;
	company?: string | null;
	is_repeat_interaction: boolean;
	lead_context?: BookingCalendarLeadContext | null;
};

export type CreateBookingCalendarEventResponse = {
	ok: true;
	event_id: string;
	html_link?: string;
};

export type UpdateBookingCalendarEventRequest = {
	booking_id: string;
	event_id: string;
	booking_type: BookingCalendarEventType;
	attendee_email: string;
	attendee_name?: string | null;
	meeting_scope: string;
	starts_at_iso: string;
	ends_at_iso: string;
	reschedule_url: string;
	company?: string | null;
	is_repeat_interaction: boolean;
	lead_context?: BookingCalendarLeadContext | null;
};

export type UpdateBookingCalendarEventResponse = {
	ok: true;
	event_id: string;
	html_link?: string;
};

export type FetchBookingCalendarBusyRequest = {
	range_starts_at_iso: string;
	range_ends_at_iso: string;
	calendar_id?: string;
};

export type BookingCalendarBusyInterval = {
	starts_at_iso: string;
	ends_at_iso: string;
	source: 'calendar';
};

export type FetchBookingCalendarBusyResponse = {
	ok: true;
	provider_name: string;
	intervals: BookingCalendarBusyInterval[];
};
