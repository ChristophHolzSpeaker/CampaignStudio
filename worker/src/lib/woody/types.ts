export const woodyResponseTypes = ['initial_speaking_inquiry_ack'] as const;

export type WoodyResponseType = (typeof woodyResponseTypes)[number];

export type WoodyExtractedFields = {
	event_topic: string;
	talking_length: string;
	location: string;
	date_time: string;
	event_name: string;
	audience: string;
	agent: string;
	client: string;
};

export type WoodyGenerateReplyInput = {
	sender_name?: string | null;
	sender_email: string;
	inbound_subject: string;
	inbound_body: string;
	response_language: string;
	booking_link: string;
	response_type: WoodyResponseType;
	campaign_id?: number | null;
	campaign_page_id?: number | null;
	lead_journey_id?: string | null;
};

export type WoodyGenerationStatus = 'success' | 'error';

export type WoodyGenerateReplyOutput = {
	subject: string;
	body_html: string;
	body_text: string;
	extracted_fields: WoodyExtractedFields;
	model: string;
	provider: 'openrouter';
	prompt_version: string;
	generation_status: WoodyGenerationStatus;
	raw_usage: unknown | null;
	raw_response: unknown | null;
};

export type WoodyProviderError = {
	provider: 'openrouter';
	status?: number;
	code: 'http_error' | 'timeout' | 'network_error' | 'invalid_provider_payload';
	message: string;
	body?: unknown;
};
