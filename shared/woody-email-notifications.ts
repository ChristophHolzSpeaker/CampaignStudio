export const woodyEmailIntents = ['booking_link_invite', 'booking_confirmed'] as const;

export type WoodyEmailIntent = (typeof woodyEmailIntents)[number];

export const woodyEmailBookingTypes = ['lead', 'general'] as const;
export type WoodyEmailBookingType = (typeof woodyEmailBookingTypes)[number];

export type WoodyEmailCampaignContext = {
	lead_journey_id?: string | null;
	campaign_id?: number | null;
	campaign_page_id?: number | null;
	booking_link_id?: string | null;
	page_slug?: string | null;
	page_path?: string | null;
};

export type WoodyEmailSummaryContext = {
	meeting_scope?: string | null;
	request_summary?: string | null;
	organization?: string | null;
	booking_mode?: WoodyEmailBookingType | null;
};

export type WoodyComposedEmail = {
	subject: string;
	body_text: string;
	body_html?: string;
};

export type BookingLinkInviteWoodyEmailRequest = {
	intent: 'booking_link_invite';
	recipient_email: string;
	recipient_name?: string | null;
	booking_type: 'lead';
	booking_link_url: string;
	campaign_context?: WoodyEmailCampaignContext | null;
	summary_context?: WoodyEmailSummaryContext | null;
	email_content: WoodyComposedEmail;
	metadata?: Record<string, unknown>;
};

export type BookingConfirmedWoodyEmailRequest = {
	intent: 'booking_confirmed';
	recipient_email: string;
	recipient_name?: string | null;
	booking_id: string;
	booking_type: WoodyEmailBookingType;
	confirmed_starts_at_iso: string;
	confirmed_ends_at_iso: string;
	calendar_event_url: string;
	campaign_context?: WoodyEmailCampaignContext | null;
	summary_context?: WoodyEmailSummaryContext | null;
	email_content: WoodyComposedEmail;
	metadata?: Record<string, unknown>;
};

export type WoodyEmailNotificationRequest =
	| BookingLinkInviteWoodyEmailRequest
	| BookingConfirmedWoodyEmailRequest;

export type WoodyEmailNotificationResponse = {
	ok: true;
	provider_message_id: string;
	provider_thread_id: string;
	lead_message_id?: string | null;
};
