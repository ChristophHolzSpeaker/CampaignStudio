# Analytics Base Views (Phase 3)

These views form the SQL reporting foundation for Campaign Studio analytics.

They are intentionally base-layer views:

- they remove repeated join logic from reporting queries
- they preserve nullability from source tables
- they do not implement KPI aggregations or rollups

## `vw_visit_enriched`

Purpose: normalized visit reporting shape.

- Base table: `campaign_visits`
- Joins: `campaigns`, `campaign_pages`
- Key output: visit timestamp, campaign/page context, visitor identifier, UTM/referrer/user-agent fields

Use this view as the page-view diagnostic source (`page_view` source of truth remains `campaign_visits`).

## `vw_lead_journey_enriched`

Purpose: journey attribution and lifecycle spine.

- Base table: `lead_journeys`
- Joins: campaign/page for canonical journey fields and first/last attribution campaign/page names
- Key output: explicit journey campaign/page, persisted first-touch snapshot, persisted last-touch snapshot, attribution model version

This is the primary attribution spine for downstream rollups.

## `vw_lead_event_enriched`

Purpose: event stream normalized with journey context.

- Base table: `lead_events`
- Joins: `lead_journeys`, `campaigns`, `campaign_pages`
- Key output: event metadata (including CTA fields), event campaign/page context, journey campaign/page context, resolved campaign/page fallback fields

`resolved_campaign_id` / `resolved_page_id` are deterministic fallbacks using event-level values first, then journey values.

## `vw_booking_enriched`

Purpose: booking outcomes tied to journey attribution context.

- Base table: `bookings`
- Joins: `lead_journeys`, `campaigns`, `campaign_pages`
- Key output: booking lifecycle fields plus journey first/last attribution snapshots

This view does not infer a synthetic `booking_link_id` because `bookings` has no direct authoritative link-id column.

## Notes for Phase 4+

- Build KPI rollups/materialized views from these base views rather than rejoining raw operational tables repeatedly.
- Keep naming explicit (`journey_*`, `first_*`, `last_*`, `resolved_*`) to avoid campaign attribution ambiguity.

Phase 4 KPI rollups built on top of these views are documented in `docs/ANALYTICS_KPI_ROLLUPS.md`.
