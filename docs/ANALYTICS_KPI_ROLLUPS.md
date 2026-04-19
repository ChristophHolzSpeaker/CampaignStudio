# Analytics KPI Rollup Views (Phase 4)

These views provide dashboard-ready KPI aggregates.

All rollups are built on top of Phase 3 base views:

- `vw_visit_enriched`
- `vw_lead_journey_enriched`
- `vw_lead_event_enriched`
- `vw_booking_enriched`

## `vw_funnel_daily`

Daily funnel snapshot (`report_date` grain).

Metrics:

- `visits`: count of rows in `vw_visit_enriched` for the day
- `unique_visitors`: distinct non-null `visitor_identifier`
- `journeys_created`: count of journeys by `journey_created_at`
- `identified_leads`: distinct `journey_id` with `event_type = 'lead_identified'`
- `inbound_messages`: count of `event_type = 'message_received'`
- `booking_link_clicked`: count of `event_type = 'booking_link_clicked'`
- `bookings_completed`: count of bookings with `booking_status = 'confirmed'` by `booking_updated_at`

Rates:

- `visit_to_lead_rate = identified_leads / visits`
- `lead_to_booking_rate = bookings_completed / identified_leads`
- `visit_to_booking_rate = bookings_completed / visits`

## `vw_campaign_conversion_summary`

Campaign-level scorecard (`campaign_id` grain).

Semantics are explicit to avoid attribution ambiguity:

- `visit_campaign_visits`: visits grouped by `vw_visit_enriched.campaign_id`
- `journey_campaign_leads`: journeys grouped by `journey_campaign_id`
- `first_touch_leads`: journeys grouped by `first_campaign_id`
- `first_touch_bookings`: confirmed bookings grouped by `first_campaign_id`

Rates include visit-to-journey, visit-to-first-touch-lead, and first-touch lead-to-booking conversions.

## `vw_source_medium_performance`

Source/medium performance (`utm_source`, `utm_medium` grain).

Semantics:

- top-funnel traffic uses visit-touch keys (`vw_visit_enriched.utm_*`)
- conversion metrics use first-touch journey attribution (`first_utm_*`)

Metrics:

- `visit_touch_visits`
- `first_touch_leads`
- `first_touch_bookings`
- conversion rates with explicit first-touch naming

## `vw_cta_performance`

CTA-level effectiveness (`cta_key` grain).

Metrics:

- `clicks`: count of canonical `cta_click` events
- `first_touch_leads`: journeys with `first_cta_key`
- `first_touch_bookings`: confirmed bookings with `first_cta_key`

Rates:

- `click_to_first_touch_lead_rate`
- `click_to_first_touch_booking_rate`

Notes:

- Impression metrics are intentionally omitted in this rollup phase.
- CTA label/section/variant are representative values from click events and may be null.

## Known compromises

- Booking completion timestamp is approximated as `booking_updated_at` for rows where status is `confirmed`.
- No ad-group/keyword/ad rollups are included because those attribution links are not yet a durable reporting truth.
