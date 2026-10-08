-- Drizzle source: src/lib/server/db/schema.ts. No historical journey is linked or rewritten.
CREATE TABLE public.email_visit_references (
 token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_visit_id integer NOT NULL REFERENCES public.campaign_visits(id) ON DELETE CASCADE,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_visit_references_visit_idx ON public.email_visit_references(campaign_visit_id);
ALTER TABLE public.email_visit_references ENABLE ROW LEVEL SECURITY;
-- Only server connections and the worker's service role may access these capabilities.
REVOKE ALL ON public.email_visit_references FROM anon, authenticated;
GRANT ALL ON public.email_visit_references TO service_role;
CREATE INDEX lead_events_native_outcome_idx ON public.lead_events(event_type, occurred_at, lead_journey_id);
