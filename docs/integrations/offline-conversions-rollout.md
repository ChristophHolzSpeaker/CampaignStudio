# Automatic offline conversions and email attribution

The application now reconciles qualified campaign emails, successful Woody replies and confirmed email-link calendar bookings into the existing Google conversion queue. It uses the worker-held service account relay. Manual exact-visit conversions remain supported.

## Production rollout

1. Apply migration `048_email_references_native_conversions.sql` to the intended production project. It adds a server-only reference table and native-event index; it does not link or upload historical leads. Verify migration 047 is already applied.
2. Deploy the application and worker together. Keep `NATIVE_CONVERSIONS_START_AT` empty until the Google permission check and configuration are ready. Email reference issuance must not precede deployment of its worker resolver.
3. Configure Vercel `GOOGLE_DATA_MANAGER_WORKER_URL`, `GOOGLE_DATA_MANAGER_WORKER_TOKEN` and `CRON_SECRET`. The relay token must match the worker's dedicated `GOOGLE_DATA_MANAGER_TOKEN`. Preserve delegated Gmail/calendar credentials; conversion JWTs omit delegated `sub`.
4. Configure worker `CONVERSION_PROCESSOR_URL=https://speaker.christophholz.com/api/internal/conversions/process` and `CONVERSION_PROCESSOR_TOKEN` matching `CRON_SECRET`. Its existing 15-minute schedule reconciles and processes outcomes. Check any pre-existing manual queue before enabling processing.
5. Verify service-account permission on Ads customer `2354667197` with the protected `/google/conversions/validate` endpoint (`validateOnly`), not an audience-reading check. Do not upload synthetic conversions. Supply a manager login account only when its actual ID/access is known.
6. Set `NATIVE_CONVERSIONS_START_AT` to the exact UTC production go-live time. New events only: leave earlier events alone. Empty or invalid values disable reconciliation. Setting it empty later stops new native queue creation, but existing queued deliveries can still process.
7. Verify one real eligible inquiry: its mailto body reference resolves to a browser visit and Google click; qualification and Woody outcomes appear once; Google acceptance and final processing status are separate. Confirm Ads matching/reporting separately. Verify email-link bookings only after their calendar event is confirmed.

Default native actions are `7755647198` (qualified email), `7755799335` (Woody reply), and `7755799332` (confirmed calendar booking). Campaign offline mappings override these. Link opens, raw emails and drafts are not automatic conversions. Existing manual defaults remain `7755799338`.

## Email authoring contract

Author ordinary `mailto:speakerlp@christophholz.com` anchors; the platform supplies the short page alias once the finalized page ID is known. Existing correct page-specific anchors also work. Subject and body text are optional. Campaign Studio appends `Referenz: CS-<opaque-reference>` to the composed email body at runtime; authors must not create tokens or put them in recipient addresses. Keep the reference out of Google event parameters and logs. Existing CTA measurement attributes can remain.

The short address and copy-to-clipboard experience stay unchanged. Copied addresses, edited-away references and ambiguous references retain campaign attribution without guessed ad attribution. Only the owning browser cookie can issue a visit reference. The worker validates reference creation/visit time and campaign/page ownership before linking. Follow-up messages keep the existing Gmail-thread journey association.

Published section pages and all supported artifact runtime versions receive the helper. Artifact source and pinned runtime files do not change; the renderer revision invalidates the cached response shell. Preview performs no reference requests. Reference failure falls back to the original mailto.

## Queue diagnostics and recovery

Native reconciliation reports recorded/failed counts and sanitized failure reasons. Missing/expired clicks and explicit visitor denial are visible blocked records. Consent defaults to the owner-selected granted setting and reports `owner_default`; recorded visit evidence reports `visitor_record`, and denial wins. Denial is rechecked before upload.

POST `/api/public/v1/conversion-deliveries/{id}` with CRM-write authorization refreshes never-uploaded blocked eligibility at the original event time. It keeps the same transaction, hash, timestamp, destination and value. A remaining blocker stays blocked. Already accepted/delivered outcomes cannot refresh. Failed delivery retry behavior is unchanged.

## Local verification

Run tests with `CS_TEST_DATABASE_URL` pointing at local Postgres. The native email integration suite additionally needs local `CS_TEST_SUPABASE_URL` and `CS_TEST_SUPABASE_SERVICE_ROLE_KEY`. Both hosts must be localhost/127.0.0.1. The local service role needs its normal read/write permissions on the journey/event tables. Tests use the real worker REST resolution and mock Google delivery; they send no emails and create no external calendar events.

Run format, application check/build, worker check, and the conversion, email-reference, runtime-helper and local integration suites. Production activation, Google validation and real Ads reporting are deployment checks, not claimed by local tests.
