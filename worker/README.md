Worker scaffold:

- worker/wrangler.toml
- worker/tsconfig.json
- worker/src/index.ts
- worker/src/routes/track-cta.ts
- worker/src/routes/email-inbound.ts
- worker/src/routes/booking-link.ts
- worker/src/routes/health.ts
- worker/src/lib/db.ts
- worker/src/lib/env.ts
- worker/src/lib/crypto.ts
- worker/src/lib/email.ts
- worker/src/lib/http.ts
- Env examples:
  - Updated .env.example with worker-related vars.
    Behavior highlights
- /track/cta (GET)
  - Validates type, campaign_id, campaign_page_id, optional lead_journey_id, session_id, anonymous_id.
  - Validates campaign/page pair exists.
  - Logs email_cta_click | booking_cta_click | form_cta_click in lead_events.
  - Never creates lead_journeys.
- /email/inbound (POST)
  - Parses and normalizes sender email.
  - Parses plus tag format cmp12_cp3.
  - Uses explicit attribution status enum.
  - Resolves campaign/page if parse succeeds; marks unresolved when lookup fails.
  - Reuses recent open journey under your exact rule; otherwise creates a new journey.
  - Logs email_received with attribution details.
- /booking/link (POST)
  - Validates input.
  - Resolves campaign_id from journey if available, or validates provided campaign_id matches journey.
  - Generates signed HMAC token with { lead_journey_id, campaign_id, iat, exp }.
  - Persists booking_links with expires_at.
  - Logs booking_link_generated.
- /health (GET)
  - Returns { ok: true }.

  At a high level

- It receives tracking or attribution-related requests.
- It validates input with Zod.
- It writes/read records in Supabase via the REST API (/rest/v1) using the service role key.
- It returns JSON responses.
  What each endpoint does
- /health
  - Simple health check: returns { ok: true }.
- /track/cta (GET)
  - Used when someone clicks a CTA button/link.
  - Validates: type, campaign_id, campaign_page_id (+ optional lead_journey_id, session_id, anonymous_id).
  - Confirms the campaign-page pair is valid.
  - Logs an event (email_cta_click, booking_cta_click, or form_cta_click) in lead_events.
  - Important: this endpoint is telemetry-only — it does not create a lead journey.
- /email/inbound (POST)
  - Used for inbound email webhook payloads (to, from, subject, body).
  - Parses plus-address attribution from recipient email, now in the format +cmp12_cp3.
  - Attribution status is explicit: parsed, missing_plus_address, malformed_plus_address, or unresolved_campaign_page.
  - Normalizes sender email (lowercase, trimmed), then tries to attach to a recent open journey:
    - same normalized contact_email
    - same campaign_id
    - non-closed stage
    - updated in last 30 days
  - If no match: creates a new journey.
  - Logs email_received in lead_events.
- /booking/link (POST)
  - Creates a signed booking link token.
  - Validates lead_journey_id and optional campaign_id.
  - Derives campaign_id from the journey when possible, or checks provided value matches.
  - Builds an HMAC-signed token containing:
    - lead_journey_id
    - campaign_id
    - iat (issued at)
    - exp (expiry)
  - Stores token row in booking_links with expires_at.
  - Logs booking_link_generated.
    How it talks to the DB
- It does not use direct Postgres connections.
- It calls Supabase REST endpoints using:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- Because it uses the service role key, it can perform server-side privileged reads/writes.
  Why this design is useful
- Keeps attribution logic centralized and lightweight.
- Supports anonymous pre-lead tracking (session_id / anonymous_id) for later joins.
- Treats email attribution as best-effort, while booking links are deterministic via signed tokens.
- Easy to run independently via Wrangler without coupling to SvelteKit runtime.
