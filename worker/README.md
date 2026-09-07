# CampaignStudio Worker

Cloudflare Worker for attribution, Gmail ingest/sync, booking workflows, and internal notifications.

## Core behavior

- Uses Supabase REST (`/rest/v1`) with service-role credentials for server-side writes/reads.
- Uses Google service-account domain-wide delegation for Gmail/Calendar operations.
- Uses `INTERNAL_API_TOKEN` bearer auth for internal control/notification endpoints.

## CTA contract deployment

`shared/event-types.ts` is bundled separately into the SvelteKit app and this Worker. Changes to accepted CTA types or their canonical event mapping require deploying both services; deploying a new artifact runtime does not update the Worker.

For confirmed video playback, the Worker must accept `type=video` and persist `event_type=cta_click` with `event_payload.cta_type=video`. `legacy_event_type=video_cta_click` is payload metadata, not a separate database event type. Run `pnpm exec vitest run src/routes/track-cta.test.ts` from `worker/` before releasing a CTA contract change. Verify the active Worker version and a persisted event with the correct campaign/page/visit after deployment; the app's HTTP response alone is not proof of persistence.

## Routes

### Public

- `GET /health`
  - Health check, returns `{ ok: true }`.
- `POST /gmail/push`
  - Gmail Pub/Sub push webhook endpoint.
  - Validates envelope, extracts `emailAddress` and `historyId`, touches cursor, triggers async sync.

### Internal (Bearer auth required)

- `GET /track/cta`
  - Telemetry-only CTA event logging.
- `POST /email/inbound`
  - Inbound email attribution and journey processing.
- `POST /booking/link`
  - Booking token creation.
- `POST /booking/calendar-event`
- `POST /booking/calendar-event/update`
- `POST /booking/calendar-busy`
- `POST /notifications/telegram`
- `POST /notifications/woody-email`
- `POST /gmail/watch/activate`
  - Calls Gmail `users.watch` and upserts `mailbox_cursors`.
  - When a cursor already exists, backfills recent inbox messages before advancing its history ID.
- `POST /gmail/watch/stop`
  - Calls Gmail `users.stop` for the given mailbox.

## Gmail watch control

Both endpoints require:

- `Authorization: Bearer <INTERNAL_API_TOKEN>`
- `Content-Type: application/json`

Activate watch:

```bash
curl -X POST "https://campaignstudio-attribution-worker.speaker.workers.dev/gmail/watch/activate" \
  -H "Authorization: Bearer <INTERNAL_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"gmail_user":"speaker@christophholz.com"}'
```

Stop watch (unsubscribe mailbox):

```bash
curl -X POST "https://campaignstudio-attribution-worker.speaker.workers.dev/gmail/watch/stop" \
  -H "Authorization: Bearer <INTERNAL_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"gmail_user":"podcast@christophholz.com"}'
```

Notes:

- `watch/stop` disables Gmail push at source for that mailbox.
- Deleting `mailbox_cursors` rows alone does not unsubscribe Gmail push.

## `mailbox_cursors` table purpose

`mailbox_cursors` stores local sync state per mailbox (not Gmail registration source of truth):

- `gmail_user`
- `last_processed_history_id`
- `watch_expiration`
- `last_push_received_at`
- `last_watch_renewed_at`
- `sync_status`

If Gmail push arrives for a mailbox that has no local cursor row, `/gmail/push` acknowledges the message and logs a cursor-missing path.

When Gmail rejects a history cursor as stale, scheduled reconciliation automatically creates a fresh watch, backfills recent inbox messages through the idempotent inbound processor, and advances the cursor only after that backfill succeeds. `GMAIL_RECOVERY_LOOKBACK_DAYS` controls the recovery window and defaults to 30 days.

## Gmail push setup order

1. Create Pub/Sub topic: `projects/<project-id>/topics/<topic-id>`.
2. Grant Gmail publisher principal on topic:
   - `serviceAccount:gmail-api-push@system.gserviceaccount.com`
3. Create push subscription to:
   - `https://<worker-domain>/gmail/push`
   - If verification token is enabled:
   - `https://<worker-domain>/gmail/push?token=<GMAIL_PUSH_VERIFICATION_TOKEN>`
4. Configure worker env vars (`GOOGLE_WATCH_TOPIC` or `GMAIL_PUBSUB_TOPIC_NAME`, optional label filters).
5. Call `/gmail/watch/activate` per mailbox.
6. Verify cursor row exists.
7. Confirm push logs and sync activity.

## Environment policy

For staging and production, operate with a single delegated mailbox identity:

- `GOOGLE_IMPERSONATED_USER=speaker@christophholz.com`

Operational guidance:

- Activate watch only for `speaker@christophholz.com`.
- Configure `speakerlp@christophholz.com`, `speakerwp@christophholz.com`, and `speakercr@christophholz.com` as Gmail aliases of the delegated mailbox.
- Reply to qualifying messages from the address they reached: `speaker@`, `speakerlp@`, or `speakerwp@`.
- Ignore messages delivered to `speakercr@`, even when another managed address is also present.
- Gmail routing considers `To`, `Cc`, `Delivered-To`, `X-Original-To`, and `Envelope-To` so CC and BCC delivery is handled consistently.
- Stop watches for non-operational mailboxes and remove their cursor rows.

## Local development

1. Copy local vars file:

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

2. Set required secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOKING_TOKEN_SECRET`
- `INTERNAL_API_TOKEN`

3. Keep app token aligned:

- `ATTRIBUTION_INTERNAL_TOKEN` (app) must match `INTERNAL_API_TOKEN` (worker).

4. Run worker:

```bash
pnpm worker:dev
```

## Deploy

- Staging: `pnpm worker:deploy:staging`
- Production: `pnpm worker:deploy:production`

## Worker checks

```bash
pnpm --filter campaignstudio-worker run check
pnpm --filter campaignstudio-worker run test
```

### CRM conversion queue

The existing 15-minute scheduled handler also triggers the app's durable conversion queue when configured. Set `CONVERSION_PROCESSOR_URL` to the HTTPS app URL ending `/api/internal/conversions/process`; set the Worker secret `CONVERSION_PROCESSOR_TOKEN` to the app's `CRON_SECRET`. The app owns Google Data Manager OAuth credentials. Missing processor settings disable this task. Deploy both app and Worker for this feature; see `src/lib/artifacts/tracking-guide.md` in the application for full setup and diagnostics.
