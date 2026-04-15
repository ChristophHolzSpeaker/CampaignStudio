Worker scaffold:

- worker/wrangler.toml
- worker/tsconfig.json
- worker/src/index.ts
- worker/src/routes/track-cta.ts
- worker/src/routes/email-inbound.ts
- worker/src/routes/booking-link.ts
- worker/src/routes/health.ts
- worker/src/routes/gmail-push.ts
- worker/src/lib/db.ts
- worker/src/lib/env.ts
- worker/src/lib/crypto.ts
- worker/src/lib/email.ts
- worker/src/lib/http.ts
- worker/src/lib/gmail/auth.ts
- worker/src/lib/gmail/client.ts
- worker/src/lib/gmail/history-sync.ts
- worker/src/lib/gmail/messages.ts
- worker/src/lib/gmail/watch.ts
- worker/src/lib/gmail/send.ts
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
- /gmail/push (POST)
  - Accepts Google Pub/Sub Gmail push envelopes.
  - Decodes message data, updates mailbox cursor push timestamp, and triggers async sync.
  - Returns quickly with accepted status.

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

# Change log

What I changed

- worker/src/index.ts
  - Preserved existing routes: /health, /track/cta, /email/inbound, /booking/link.
  - Added POST /gmail/push dispatch to handleGmailPush.
  - Added scheduled(...) handler that runs Gmail watch renewal via renewGmailWatches(...) using ctx.waitUntil(...).
- worker/src/routes/gmail-push.ts
  - New Gmail Pub/Sub intake route with Zod validation.
  - Validates envelope shape, decodes base64/base64url Pub/Sub message.data, parses JSON safely.
  - Extracts mailbox (emailAddress) and historyId from payload (with attribute fallback).
  - Updates cursor push timestamp through touchMailboxPush(...).
  - Triggers async mailbox sync via ctx.waitUntil(syncMailboxHistory(...)).
  - Returns fast success JSON (accepted, sync_triggered) and handles malformed payloads defensively.
  - Optional verification token support using GMAIL_PUSH_VERIFICATION_TOKEN query param check.
- worker/src/lib/gmail/auth.ts
  - New isolated service-account delegated auth layer.
  - Builds/signs JWT assertion with RS256 and exchanges for Google OAuth access token.
  - Supports runtime token caching per delegated user.
- worker/src/lib/gmail/client.ts
  - New Gmail API client boundary (single fetch abstraction).
  - Added typed helpers for:
    - users.history.list
    - users.messages.get
    - users.messages.send
    - users.watch
  - Added GmailApiError + stale cursor detection helper (isHistoryCursorStale).
- worker/src/lib/gmail/messages.ts
  - New Gmail message normalization/parsing module.
  - Extracts headers (From, To, Subject), decodes body parts (text/plain, text/html), computes direction (inbound/outbound), derives contact email, and prepares raw_metadata.
- worker/src/lib/gmail/history-sync.ts
  - New reusable mailbox sync service.
  - Loads cursor from mailbox_cursors, reads last_processed_history_id, paginates history in order, collects messagesAdded, fetches full messages, normalizes, persists to lead_messages, and writes lead_events.
  - Dedupes using provider_message_id (pre-check + unique key protection).
  - Advances cursor only after successful processing.
  - Updates last_sync_at and sync_status.
  - Explicit stale/invalid cursor handling sets sync_status = 'resync_required' (no silent continuation).
  - General failures set sync_status = 'sync_failed'.
  - Includes push-touch helper for last_push_received_at.
- worker/src/lib/gmail/watch.ts
  - New scheduled watch renewal service.
  - Reads mailboxes from mailbox_cursors, renews watches before expiration buffer, persists watch_expiration + last_watch_renewed_at.
  - Sets sync_status = 'active' on success, sync_status = 'renewal_failed' on failure.
- worker/src/lib/gmail/send.ts
  - New outbound Gmail sending foundation.
  - Builds MIME (plain or multipart alternative), supports threaded replies (threadId, In-Reply-To, References), sends via Gmail API.
  - Persists outbound messages to lead_messages and writes lead_events (email_sent).
  - Returns provider ids (provider_message_id, provider_thread_id).
- worker/src/lib/db.ts
  - Extended DB REST helpers with insertMany, upsertMany, upsertOne for idempotent persistence patterns.
- worker/src/lib/env.ts
  - Added Gmail-related env typings and execution/scheduled context types used by Worker handlers.
- worker/wrangler.toml
  - Added cron schedule:
    - [triggers]
    - crons = ["*/15 * * * *"]
- .env.example
  - Added Gmail-related configuration placeholders.
- worker/README.md
  - Updated Worker structure list and behavior notes for new Gmail route/services.

---

How /gmail/push works

- Receives Pub/Sub push (POST /gmail/push).
- Validates envelope with Zod.
- Decodes message.data, parses JSON, extracts mailbox + optional history id (with attribute fallback).
- Touches mailbox_cursors.last_push_received_at (and bootstraps cursor if needed and history id exists).
- Triggers mailbox sync asynchronously using ctx.waitUntil(...).
- Returns immediately with success JSON; malformed payloads return controlled 400 responses.

---

How sync is triggered

- Primary trigger: POST /gmail/push -> syncMailboxHistory(...) in background.
- Sync pipeline:
  - users.history.list(startHistoryId, paginated)
  - gather messagesAdded
  - users.messages.get per message
  - normalize and persist to lead_messages
  - write minimal lead_events
  - update cursor/status fields

---

How watch renewal is scheduled

- Cron runs via Worker scheduled handler (worker/src/index.ts).
- Calls renewGmailWatches(...).
- Renews only mailboxes due within renewal buffer.
- Persists watch_expiration, last_watch_renewed_at, and status transitions (active / renewal_failed).

---

How outbound sending is structured

- No public arbitrary-send route added.
- Reusable service in worker/src/lib/gmail/send.ts handles:
  - MIME creation
  - Gmail send call
  - optional thread/reply headers
  - persistence to lead_messages
  - lead event logging
- Designed as internal foundation for later Woody orchestration.


Exact journey resolution order implemented
1. Check duplicate message by provider_message_id (stop early if duplicate).
2. Resolve by Gmail provider_thread_id mapping from existing lead_messages.
3. If no thread match, parse plus-address from recipients (cmpX_cpY), then validate campaign/page in DB.
4. If campaign resolved, find recent open journey by normalized sender email + campaign_id (last 30 days, non-closed stages, newest first).
5. If none found, create new journey (first_touch_type: 'email', current_stage: 'new', resolved campaign/page when available).
How duplicates are prevented
- Pre-processing dedupe query on lead_messages.provider_message_id.
- Write path uses conflict-safe upsert on provider_message_id with duplicate-ignore semantics, so repeated delivery/race conditions do not create duplicates.
- Duplicate outcomes return structured status duplicate_ignored with matched_by: 'duplicate'.
How malformed plus-addresses are handled
- Parser returns explicit status:
  - missing_plus_address when no +... token exists
  - malformed_plus_address when token exists but is invalid
  - unresolved_campaign_page when token parses but campaign/page pair cannot be resolved in campaign_pages
- Status is propagated into the resolver result and event payload; nothing is silently swallowed.