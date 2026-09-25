# Manual visit conversion rollout

This change adds exact-visit outcomes and readiness. It does not deploy the unfinished automatic native-outcome reconciler from the older work-in-progress branch.

## Deployment order

1. Apply `supabase/migrations/047_visit_conversion_attribution.sql` to the same Supabase database used by the app and worker. Migration 046 must already exist. Do this **before** deploying the application: visit capture now writes the provenance table. The migration adds two tables and an index, enables RLS, and does not modify historical rows. Apply through the project's migration workflow so its migration ledger stays consistent.
2. Configure a dedicated worker secret `GOOGLE_DATA_MANAGER_TOKEN`. Use the existing worker-held Google service account; do not replace Gmail/Calendar credentials. Deploy the worker. The existing protected `/google/data-manager/access` diagnostic is preserved.
3. Configure Vercel's `CRM_WRITE_API_TOKEN`, `GOOGLE_DATA_MANAGER_WORKER_URL=https://campaignstudio-attribution-worker.speaker.workers.dev`, and `GOOGLE_DATA_MANAGER_WORKER_TOKEN` matching the worker's dedicated token. Configure or reuse the app's `CRON_SECRET`. Secrets must not enter commits or browser bundles. The external dashboard needs CRM-write and lead-read tokens on its server only.
4. Configure worker `CONVERSION_PROCESSOR_URL=https://speaker.christophholz.com/api/internal/conversions/process` and `CONVERSION_PROCESSOR_TOKEN` matching the app's `CRON_SECRET`. Coordinate scheduler activation with queue inspection: configuring delivery credentials can make previously queued journey outcomes eligible for processing. Do not activate a second scheduler or upload synthetic outcomes.
5. Publish the app through the existing Git/Vercel deployment flow. Confirm OpenAPI version 2.3.0, both visit routes, and the updated `/llms-full.txt`. The manual defaults map `company_identified` and `lead_marked_eligible` to customer `2354667197`, action `7755799338`. Existing per-campaign overrides win. This does not change Ads bidding/goal settings.
6. With the relay credential, POST a representative destination/event body to worker `/google/conversions/validate`. The worker forces `validateOnly: true`. Google validation success proves request validation, not matched/counted conversions. Never use `/ingest` for a synthetic click.
7. Read readiness for a newly captured real visit, then coordinate one explicit real manual decision. Submit once, repeat the exact body to verify the same `data.id`, and poll the delivery until diagnosed. Check Google reporting separately. Do not report the same decision under both manual event names or both visit and journey endpoints.

## Historical visits

There is intentionally no automatic backfill: the old cookie-level click table cannot prove exactly which visit observed a click. New captures populate `visit_ad_clicks` after resolving the visit, including deduplicated visits. Redacting the two IP-related visit fields leaves this direct relationship intact. Unlinked historical visits remain `missing_click_id`; do not infer links from company enrichment or an approximate timestamp.

## Consent

The owner requested all advertising consent granted by default. Visit readiness exposes `GRANTED` with `source: owner_default`, not fabricated visitor evidence. An explicit browser denial overrides the default and is rechecked before a pending upload. There is no new banner. A platform integration can use the same-origin, cookie-owned consent API to record an explicit choice.

## Validation performed locally

- Applied migration 047 to local Supabase and tested real database writes and redaction.
- Real HTTP smoke: bad read token 401; lead-read token cannot write (401); readiness 200 with owner-default provenance; outcome 202; identical retry returns the same ID; changed payload 409; delivery read returns pending; no lead journey created. Local fixtures were deleted and Google ingestion was not called.
- Unit/integration tests cover exact visit selection, legacy unlinked clicks, concurrent retries, missing mappings, explicit denial/withdrawal, service-account JWT identity, relay authentication, validate-only requests and accepted-versus-delivered states.
- The wider suite has 11 existing failures across booking/rescheduling and Telegram tests. The same 11 failures were reproduced against the unchanged repository baseline in an isolated checkout.

See [the tracking guide](../../src/lib/artifacts/tracking-guide.md) for the dashboard contract and [Google's ingestion API](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest) for validation semantics.

## Live worker validation — 2026-09-25

The service-account relay was deployed to the production worker and returned HTTP 200 with `validated: true` from Google for Ads customer `2354667197`, action `7755799338`, using validation-only mode. Initial validation exposed a required `event_source` field; CRM outcomes now send `OTHER`, and the relay defaults older payloads to `OTHER`. This verifies request validation/access, not real attribution or counting. No synthetic conversion was ingested.

App activation still requires the Vercel settings in step 3. Prepared values are in the local, git-ignored `.secrets.manual-visit-conversions.env` file; do not publish that file. The repository owner confirmed that the Git deployment pipeline also applies Supabase migrations. Confirm migration 047 completion before treating the new routes as live.
