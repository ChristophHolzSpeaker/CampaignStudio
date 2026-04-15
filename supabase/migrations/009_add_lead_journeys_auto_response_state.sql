-- Add journey-level autoresponse state for respond-once enforcement

alter table lead_journeys
add column auto_response_sent_at timestamp with time zone;
