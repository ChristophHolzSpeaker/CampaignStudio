export const telegramNotificationTypes = [
	'new_lead',
	'booking_confirmed',
	'booking_rescheduled'
] as const;

export type TelegramNotificationType = (typeof telegramNotificationTypes)[number];

export const telegramBookingTypes = ['lead', 'general'] as const;
export type TelegramBookingType = (typeof telegramBookingTypes)[number];

export type TelegramCampaignContext = {
	lead_journey_id?: string | null;
	campaign_id?: number | null;
	campaign_page_id?: number | null;
	booking_link_id?: string | null;
	page_slug?: string | null;
	page_path?: string | null;
};

export type TelegramUrls = {
	reschedule_url?: string | null;
	calendar_event_url?: string | null;
	booking_url?: string | null;
	campaign_page_url?: string | null;
};

export type TelegramAttendee = {
	attendee_name?: string | null;
	attendee_email?: string | null;
	company?: string | null;
};

export type TelegramTimeRange = {
	starts_at_iso: string;
	ends_at_iso: string;
};

export type NewLeadTelegramNotification = TelegramAttendee & {
	type: 'new_lead';
	lead_journey_id?: string | null;
	meeting_scope?: string | null;
	campaign_context?: TelegramCampaignContext | null;
	urls?: TelegramUrls | null;
	metadata?: Record<string, unknown>;
};

export type BookingConfirmedTelegramNotification = TelegramAttendee & {
	type: 'booking_confirmed';
	booking_id: string;
	booking_type: TelegramBookingType;
	meeting_scope?: string | null;
	booking_time: TelegramTimeRange;
	campaign_context?: TelegramCampaignContext | null;
	urls?: TelegramUrls | null;
	metadata?: Record<string, unknown>;
};

export type BookingRescheduledTelegramNotification = TelegramAttendee & {
	type: 'booking_rescheduled';
	booking_id: string;
	booking_type: TelegramBookingType;
	meeting_scope?: string | null;
	previous_booking_time: TelegramTimeRange;
	new_booking_time: TelegramTimeRange;
	campaign_context?: TelegramCampaignContext | null;
	urls?: TelegramUrls | null;
	metadata?: Record<string, unknown>;
};

export type TelegramNotificationRequest =
	| NewLeadTelegramNotification
	| BookingConfirmedTelegramNotification
	| BookingRescheduledTelegramNotification;

export type TelegramNotificationResponse = {
	ok: true;
	message_id?: number;
};
