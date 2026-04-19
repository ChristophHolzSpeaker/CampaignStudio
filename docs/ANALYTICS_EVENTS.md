# Analytics Event Foundation (Phase 1)

This document defines the canonical analytics event model used for attribution and journey reporting.

## Canonical event taxonomy

Canonical values are defined in `shared/event-types.ts` as `analyticsEventTypes`.

- Anonymous / web: `page_view`, `cta_impression`, `cta_click`, `form_started`, `form_submitted`
- Identity / journey: `lead_identified`, `journey_created`, `journey_matched_existing`
- Messaging: `message_received`, `message_classified`, `auto_reply_sent`, `manual_reply_sent`
- Booking: `booking_link_created`, `booking_link_sent`, `booking_link_clicked`, `booking_started`, `booking_completed`, `booking_rescheduled`, `booking_cancelled`
- Qualification / pipeline: `lead_qualified`, `lead_disqualified`

## Backwards compatibility

Legacy event names are still accepted through the broader `EventType` union.

- Legacy values remain in `shared/event-types.ts` as `legacyEventTypes`.
- `legacyToCanonicalEventType` maps supported legacy names to canonical names for future reporting normalization.
- New writes should use canonical names whenever practical.

## Lead event schema

Analytics events are persisted in `lead_events` with these attribution keys:

- `lead_journey_id`
- `campaign_id`
- `campaign_page_id`
- `event_source`
- `occurred_at`
- `event_payload` (jsonb)

Phase 1 adds stable CTA dimensions as first-class nullable columns:

- `cta_key` (stable internal identifier)
- `cta_label` (visible text)
- `cta_section` (section placement)
- `cta_variant` (variant/version)

The CTA columns are additive and nullable for historical compatibility.

## Event writing paths

- App server helper: `src/lib/server/attribution/lead-events.ts`
- Worker helper: `worker/src/lib/analytics/lead-events.ts`

Both helpers enforce a consistent write shape and keep event payloads extensible.

## page_view source of truth

`page_view` is sourced from `campaign_visits` in Phase 1/1.5.

- Insert path: `src/lib/server/attribution/campaign-visits.ts` (`logCampaignVisit`)
- Route usage: `src/routes/speaker/[slug]/+page.server.ts`
- Reason: `campaign_visits` already provides visit dedupe and UTM/referrer context, so we avoid duplicating page-view rows into `lead_events`.

When building funnel reporting, treat `campaign_visits` as the authoritative page-view dataset and `lead_events` as the canonical interaction/journey stream.

## Journey attribution persistence (Phase 2)

`lead_journeys` now stores durable first-touch and last-touch attribution snapshots.

- Snapshot fields include visit/campaign/page, UTM source/medium/campaign, referrer, CTA key, and seen-at timestamps.
- `attribution_model_version` is stored on the journey row (`journey_attribution_v1`).

### Resolution rules

- **First-touch**: earliest authoritative `campaign_visits` row linked by visitor identifier and campaign, bounded at or before journey observation time.
- **Last-touch**: latest authoritative `campaign_visits` row under the same linkage and time bound.
- **CTA key**: earliest/latest non-null `lead_events.cta_key` associated with the journey at or before observation time.
- **Fallback**: if no visit match exists, persist known campaign/page and seen-at time while leaving unavailable fields null.

### Update behavior

- **First-touch stability**: once set, first-touch is only replaced by a strictly earlier authoritative visit.
- **Last-touch evolution**: last-touch is updated only when a newer observation is processed.
- **No inference**: unknown dimensions remain null; values are not guessed.
