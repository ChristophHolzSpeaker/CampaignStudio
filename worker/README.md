# CampaignStudio Worker

Cloudflare Worker for attribution, Gmail ingest/sync, booking workflows, and internal notifications.

## Core behavior

- Uses Supabase REST (`/rest/v1`) with service-role credentials for server-side writes/reads.
- Uses Google service-account domain-wide delegation for Gmail/Calendar operations.
- Uses `INTERNAL_API_TOKEN` bearer auth for internal control/notification endpoints.

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

For staging and production, operate with a single mailbox identity:

- `GOOGLE_IMPERSONATED_USER=speaker@christophholz.com`

Operational guidance:

- Activate watch only for `speaker@christophholz.com`.
- Send outbound/autoresponse from `speaker@christophholz.com`.
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
