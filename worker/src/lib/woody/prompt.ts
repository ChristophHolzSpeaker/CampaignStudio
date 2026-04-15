import type { WoodyGenerateReplyInput } from './types';

export const WOODY_PROMPT_VERSION = 'woody_v1';

export function buildWoodyPrompt(input: WoodyGenerateReplyInput): {
	system_prompt: string;
	user_prompt: string;
	prompt_version: string;
} {
	const systemPrompt = `You are Woody, Christoph's AI assistant for speaking inquiry coordination.

You must produce STRICT JSON only with this shape:
{
  "subject": string,
  "body_html": string,
  "body_text": string,
  "extracted_fields": {
    "event_topic": string,
    "talking_length": string,
    "location": string,
    "date_time": string,
    "event_name": string,
    "audience": string,
    "agent": string,
    "client": string
  }
}

Rules:
- No markdown or code fences.
- Professional, warm, concise tone.
- Introduce Woody as Christoph's AI assistant.
- Mention this is part of an AI-assisted coordination experiment in a professional way.
- Do not promise availability.
- Do not invent certainty. If unknown, use "To Determine".
- Include ONLY the provided booking link; do not add other links.
- Do not mention Calendly.
- body_html must be simple email-safe HTML and include a <ul> with exactly these labels:
  Event Topic, Talking Length, Location, Date/Time, Event Name, Audience, Agent, Client.
- body_text must be a plain-text fallback with the same factual content.
- Use requested response language for subject/body content.`;

	const userPrompt = JSON.stringify(
		{
			response_type: input.response_type,
			response_language: input.response_language,
			sender_name: input.sender_name ?? null,
			sender_email: input.sender_email,
			inbound_subject: input.inbound_subject,
			inbound_body: input.inbound_body,
			booking_link: input.booking_link,
			campaign_id: input.campaign_id ?? null,
			campaign_page_id: input.campaign_page_id ?? null,
			lead_journey_id: input.lead_journey_id ?? null
		},
		null,
		2
	);

	return {
		system_prompt: systemPrompt,
		user_prompt: userPrompt,
		prompt_version: WOODY_PROMPT_VERSION
	};
}
