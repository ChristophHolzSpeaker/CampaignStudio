## Runtime v5: events, Google Tag Manager, and CRM conversions

Runtime v5 adds dynamic measurement to artifacts. v1–v4 remain immutable. Upload/finalize a new version, preview, then publish to adopt v5. Do not add authored JavaScript, GTM snippets, iframe code, credentials, Google labels, or platform IDs to artifact HTML. Preview emits no measurement, loads no GTM, and submits no leads.

### Authoring attributes

```html
<section data-cs-section="booklet" data-cs-track-view="booklet_visible">
	<a href="#intake" data-cs-track="download_booklet" data-cs-event="booklet_interest"
		>Get the booklet</a
	>
</section>
<form data-cs-form="lead-intake" data-cs-form-key="booklet_request" data-cs-section="booklet">
	<!-- Use the documented lead-intake fields. Never put their values in tracking attributes. -->
</form>
```

- `data-cs-track`: stable action identifier on an interactive element. New sections/actions need no runtime or GTM changes.
- `data-cs-event`: optional custom click event name. This describes a click, not proof of a completed download, payment, or booking.
- `data-cs-section`: stable section identifier, inherited by descendants.
- `data-cs-track-view`: records `section_view` once when at least 25% of the element is visible. Put it on a compact heading/card for very tall sections.
- `data-cs-track-ignore`: suppresses generic click/input tracking in a subtree. Do not attach legacy CTA markers there if you also want to suppress legacy CS tracking.
- Event names: lowercase letter followed by lowercase letters, digits or underscores; max 40 characters. Action/section IDs: start with lowercase letter; then letters, digits, underscore or hyphen; max 64 characters. Keep IDs stable across edits. Never encode email, form text, IP addresses or other personal data in these identifiers.

Automatic events: `page_view`, `button_click`, `navigation_click`, `video_play`, `audio_play`, `booking_confirmed`, `form_start`, `form_input`, `form_submit`, `scroll_depth`, `active_time`, `section_view`, `page_exit`. Native links/buttons are detected even without attributes. Without a declared identifier, action can be absent; the runtime never scrapes visible text or URL queries for analytics. Custom attributes extend supported interactions; they do not introduce arbitrary new executable widget behavior.

YouTube `video_play` means the player confirmed PLAYING, once per widget per page load, never on load/pause/resume. Its default action is `video-<YouTubeId>`. Use the native inline YouTube widget. Do not wrap it in another tracked click target. Lead-intake `form_submit` fires only after the server accepts the submission. `form_input` is once per field per page load and contains no field value. The same-origin booking widget forwards button/link/form interactions and emits `booking_confirmed` only after its server submission succeeds. The parent checks both message origin and the specific widget iframe. Native HTML video/audio emit one confirmed play per element. Payment confirmation belongs to a confirmed CRM outcome, not a payment-link click. Avoid mapping the same booking both in the browser and via CRM to prevent double counting.

Scroll events fire once at 25/50/75/90/100%, using action `percent_25`, etc. Active time counts only while the document is visible, at 10/30/60/120 seconds, with action `seconds_10`, etc. `cs_metric` carries the milestone. `page_exit` carries visible time in milliseconds and is best-effort. Browser crashes/blocked scripts can lose exit signals; derive bounce from absence of engagement, not an authoritative "bounce conversion". These runtime page views are per document; legacy CS visits remain deduplicated for 30 minutes.

### One-time Google container setup and per-campaign registration

Register the owner-approved container `GTM-MCDDK28B` separately for every campaign through the campaign tracking API below. There is no global default or inheritance: missing configuration defaults to `gtmContainerId: null` and loads no GTM. All artifact versions in a campaign share these settings. Creating or republishing an artifact does not configure them. Read first, preserve all mappings, and save the container ID; Google Ads OAuth is not needed for this API operation. Do not overwrite a different container or deliberately disabled tracking without confirming intent.

Configure the container once, including the existing Google tag and Conversion Linker. Campaign Studio loads the configured container itself on published v5 artifacts. The platform CSP permits Google tag destinations; authored scripts remain prohibited. Test the actual container for additional vendor domains before deployment.

1. Create one Custom Event trigger matching exactly `cs_event`.
2. Create Data Layer Variables for `cs_event_name`, `cs_event_id`, `cs_campaign_id`, `cs_page_id`, `cs_action`, `cs_section`, `cs_metric`, `cs_ads_conversion_id`, `cs_ads_conversion_label`, `cs_value`, `cs_currency`.
3. Create one GA4 Event tag: Event Name = `{{cs_event_name}}`; map campaign/page/action/section/metric parameters to the corresponding variables. Trigger on `cs_event`. Register needed custom dimensions in GA4 for reporting. Avoid enabling overlapping automatic GA4 form/scroll/video events that would duplicate these measurements.
4. Create one Google Ads Conversion Tracking tag: Conversion ID = `{{cs_ads_conversion_id}}`, Conversion Label = `{{cs_ads_conversion_label}}`, Value = `{{cs_value}}`, Currency = `{{cs_currency}}`, Transaction ID = `{{cs_event_id}}`. Use a `cs_event` trigger filtered by `cs_ads_conversion_id` matching RegEx `^[0-9]+$` AND `cs_ads_conversion_label` matching RegEx `^[A-Za-z0-9_-]+$`. The data-layer conversion ID is digits only because this GTM tag adds `AW-` itself. Campaign configuration still stores the full `AW-...` ID; the runtime removes the prefix at the GTM boundary. This single tag routes all mapped browser events.
5. Owner-selected behavior: published v5 pages initialize `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization` as `granted` before loading GTM. There is no consent prompt or CMP integration. These are configured Google defaults, not evidence of a visitor's consent and not a GDPR-compliance claim. Do not manufacture visitor consent records from these defaults. For manual visit outcomes, the owner has separately selected a GRANTED default; readiness exposes its source as `owner_default`, and explicit visitor denial overrides it. Preview initializes no Google consent state and emits no measurement. In Tag Assistant, check for any existing container tags that override these defaults.
6. Preview with Tag Assistant and check the destination network requests and Ads diagnostics. A dataLayer push or our HTTP 204 only confirms our side, not Google receipt. Do not import the same GA4 outcome into Ads while also reporting it directly unless deduplication has been explicitly designed.

Every push uses `event: "cs_event"` plus the fields above. Optional fields are explicitly cleared to null on each push, preventing a previous conversion label/value from leaking to the next interaction. Unknown/unmapped events still reach GA4; they do not fire the Ads conversion tag. No new GTM tag or trigger is needed for new event names or sections.

### Campaign mapping API (for Claude and the marketing team)

Use `Authorization: Bearer <CAMPAIGN_WRITE_API_TOKEN>` server-side:

- `GET /api/public/v1/campaigns/{id}/tracking`: current configuration.
- `PUT /api/public/v1/campaigns/{id}/tracking`: replace the complete configuration. Read first and preserve unrelated mappings. An empty mappings array removes mappings; `gtmContainerId: null` disables container injection on subsequent loads.

```json
{
	"gtmContainerId": "GTM-MCDDK28B",
	"mappings": [
		{
			"event": "video_play",
			"channel": "browser",
			"conversionId": "AW-123456789",
			"conversionLabel": "ExampleLabel"
		},
		{
			"event": "booklet_interest",
			"action": "download_booklet",
			"channel": "browser",
			"conversionId": "AW-123456789",
			"conversionLabel": "AnotherLabel"
		},
		{
			"event": "sale_won",
			"channel": "offline",
			"customerId": "1234567890",
			"conversionActionId": "987654321"
		}
	]
}
```

IDs above are illustrative except the existing container ID; never copy example Ads IDs as real configuration. Optional `value` and `currency` must be provided together. An exact event/action mapping overrides the event-only fallback. Duplicate event/action/channel mappings are rejected. Changes apply on next page load without artifact republishing. Google destination labels are public identifiers; OAuth credentials and API tokens are never browser data.

Claude can create/select Google conversion actions through its separately authorized Google Ads integration, then register the returned identifiers here. Browser mappings use the Google tag's AW conversion ID and label. Offline mappings use the conversion-owning Ads customer ID (10 digits, no hyphens) and numeric conversion action ID, NOT its label. Use an eligible `UPLOAD_CLICKS` action for offline delivery. CS does not create Google accounts or actions, and does not set primary/secondary status, campaign goals, values, or bidding policy for the team. A new distinct Ads action still must exist in Google Ads; generic event names cannot create one automatically.

### CRM integration and click attribution

The existing read API remains compatible. Use the same journey UUID already received by the CRM; never infer a click or merge identities using reverse IP/company enrichment. A human may use a displayed company name to choose an exact visit; the visit API uses only click provenance recorded for that visit. The platform captures `gclid`, `gbraid`, and `wbraid` on visits and preserves their original capture times, including repeat arrivals in the same 30-minute visit. Direct returns do not erase these clicks. Known journey visits link to browser identifiers; no IP fingerprinting or automatic cross-device identity merge is introduced. Deleted cookies/new devices need an explicit known journey link. No historical click IDs can be recovered if they were never recorded.

`GET /api/public/v1/lead-journeys/{id}/tracking` uses `LEAD_READ_API_TOKEN` and returns click history, runtime/CRM events, and associated delivery status. `limit` defaults to 100 (max 200); pass the returned `pagination.nextCursor` as `cursor` to read older events without skipping timestamp ties. `GET /api/public/v1/campaigns/{id}/tracking/events` uses the same read token and pagination to expose all campaign measurements, including anonymous activity for the CRM dashboard. This is private data, not an endpoint for artifact JavaScript.

`POST /api/public/v1/lead-journeys/{id}/outcomes` requires a separate `CRM_WRITE_API_TOKEN`. Existing read tokens do not gain write privileges.

```json
{
	"externalEventId": "crm:sale:order-123:won",
	"name": "sale_won",
	"occurredAt": "2026-09-07T15:30:00Z",
	"value": 7500,
	"currency": "EUR",
	"adUserDataConsent": "GRANTED"
}
```

The owner-selected API default is `GRANTED` when `adUserDataConsent` is omitted. Send `DENIED` for an explicit denial. This default is configuration, not a recorded visitor choice; do not describe it as visitor evidence. Do not send personal data in event names or the external event ID. Time must include timezone and cannot be in the future. For appointments use a separately mapped name such as `appointment_confirmed`. CS does not change CRM sales stages when receiving these events.

The stable external event ID is idempotent within a journey. Repeating the same body returns the existing delivery; changing the body under that ID returns 409. Do not generate a new external ID on retry. The delivery snapshots the mapping/click/value at creation so retries cannot change destinations. Outcome value/currency override the mapping defaults. Missing journey returns 404; missing mapping returns 422 and should be configured before retry. HTTP 202 means recorded/queued, not Google delivery.

Offline attribution selects the most recent captured Google click linked to that journey at or before the outcome time. CS keeps all captured clicks for analysis. Missing/expired click IDs or denied consent produce a stored `blocked` outcome with the reason; they are not silently discarded. GCLID imports are subject to Google's 90-day limit and the configured conversion window. Older sales remain in CS reporting even when Google cannot attribute them.

`GET /api/public/v1/conversion-deliveries/{id}` polls one delivery with the read token. `POST` to the same URL with the CRM write token retries a failed delivery after the underlying problem is resolved; it keeps the original transaction and destination snapshot. Pending/accepted/delivered/blocked records cannot be requeued through this endpoint.

Delivery states: `pending`, `processing` (leased worker), `accepted` (Google request ID received), `delivered` (Google ingestion diagnostics SUCCESS), `failed`, `blocked`. Delivered does not guarantee Google matched an ad click or counted it in bidding. `lastError` exposes a safe diagnostic code; Google request IDs support further inspection in Google diagnostics. No raw OAuth responses or CRM personal fields enter public diagnostics. Browser conversions are not automatically resent offline; use different business outcomes/actions to avoid double counting.

### Manual outcomes for an exact visit (including anonymous visits)

A lead journey is not required. The dashboard must retain the numeric `campaign_visits.id` behind each company row; an `ad_clicks.id`, cookie identifier, company ID or IP is not a visit ID. Company recognition is display context for a human decision only, never an attribution join or automatic qualification trigger.

1. Read `GET /api/public/v1/campaign-visits/{id}/tracking?name=company_identified` using `LEAD_READ_API_TOKEN` on your server. Optional `action` selects an exact action mapping; optional `occurredAt` evaluates click eligibility at that time. It returns `clicks[]` (`kind`, `capturedAt`, without raw click IDs), `consent`, `readiness`, and the latest 100 `deliveries` (with `deliveriesTruncated`). Poll previously saved delivery IDs directly if older entries are truncated.
2. Enable the button only when `data.readiness.ready` is true and your business-event idempotency store has no existing outcome for this company decision. Reasons include `missing_click_id`, `click_expired`, `consent_denied`, `missing_offline_mapping`, `crm_write_not_configured`, `google_not_configured`, `processor_not_configured`, `outcome_predates_visit` and `outcome_in_future`. Readiness verifies local data/configuration, not live Google access, click authenticity, scheduler health, matching or an Ads action's possibly shorter attribution window.
3. On an explicit click, persist the chosen visit ID, original timestamp and request body in your server's idempotency store. Post to `POST /api/public/v1/campaign-visits/{id}/outcomes` with `CRM_WRITE_API_TOKEN`. Keep credentials server-side. The body is the same as the journey API:

```json
{
	"externalEventId": "crm:company-identified:visit:123",
	"name": "company_identified",
	"occurredAt": "2026-09-25T10:00:00Z",
	"adUserDataConsent": "GRANTED"
}
```

4. HTTP 202 returns `{ "ok": true, "data": { "id": "<delivery UUID>", "eventId": "<event UUID>", "status": "pending", "attempts": 0, "googleRequestId": null, "lastError": null, "nextAttemptAt": "...", "updatedAt": "..." } }`. Save `data.id` and poll `/api/public/v1/conversion-deliveries/{id}` using the read token. Display queued/accepted/delivered/failed/blocked distinctly. Neither 202 nor Google ingestion success guarantees an attributed Ads conversion.

Identical retries return the same delivery. A changed body under the same visit/event ID returns 409. Unknown visits return 404. Missing prerequisites return 422 with `reasons[]` **before saving an outcome**, so that event ID remains available. Validation failures are 400. Missing server write authentication is 503. Retry an uncertain network response with the identical payload, including `occurredAt`. One stable ID per visit prevents duplicates per visit, not per company; the dashboard must enforce its own company-level rule without sending company data to Google. No GTM event should fire for this action.

Attribution selects the latest click explicitly captured on the selected visit at or before the outcome, with its original capture time retained. A later click from another visit on the same cookie cannot replace it. New `visit_ad_clicks` links survive clearing both IP-related visit columns. Migration 047 deliberately does not guess historical links from cookies/timestamps or reverse-IP enrichment: old unlinked visits return `missing_click_id`. Journey reporting retains its existing cookie lookup for known journey visitors, scoped to the journey campaign; the exact-visit endpoint never uses this fallback. Deleting the visit or click deletes its provenance links; IP-field redaction is not a complete deletion of advertising identifiers.

**Consent policy:** absent an explicit record, the owner-selected visit policy returns `adUserDataConsent: "GRANTED"`, `source: "owner_default"`, `recordedAt: null`. An explicit browser decision returns `source: "visitor_record"`. Denial always blocks new uploads, including a pending delivery whose consent was withdrawn. Outcomes store which source was used; defaults are never materialized as fabricated visitor records. Already uploaded conversions cannot be withdrawn by this queue.

A platform-managed consent integration can record an explicit choice through `POST /api/runtime/v1/consent` with `{ "campaignPageId": 274, "visitId": 123, "adUserDataConsent": "DENIED", "evidenceRef": "cmp:choice:opaque-id", "policyVersion": "ads-v1" }`. This endpoint requires the owning browser's `cs_vid` cookie, same Origin, a published page, and rate limits. It is not a CRM-token endpoint. Opaque references must contain no personal data. It stores the server time and replaces the visit's current decision. Preview must never call it. No new consent banner is installed, and authored artifact JavaScript remains prohibited.

The owner-selected defaults map both `company_identified` and `lead_marked_eligible` (offline channel) to Ads customer `2354667197`, conversion action `7755799338` (**CS | Lead Marked Eligible (manual)**). No new Ads action is required. The existing action's primary/secondary and bidding settings are unchanged. Submit **one** of these names per business decision, not both. These defaults do not automatically qualify visits or fire browser conversions.

Campaign-specific mappings override the defaults. To change one, use `GET` then `PUT /api/public/v1/campaigns/{id}/tracking` with the campaign-write token, preserving all unrelated configuration. An action-specific mapping overrides the event-only fallback. The read endpoint returns effective defaults as well as stored mappings.

### Operator setup and verification

Apply migrations 046 and 047 before deploying the app. Configure server secrets `CRM_WRITE_API_TOKEN`, `CRON_SECRET`, `GOOGLE_DATA_MANAGER_WORKER_URL` (the HTTPS worker origin), and `GOOGLE_DATA_MANAGER_WORKER_TOKEN`. Set the worker's dedicated `GOOGLE_DATA_MANAGER_TOKEN` to the same relay secret. Keep the existing `GOOGLE_SERVICE_ACCOUNT_EMAIL` and private key in the worker; Data Manager authenticates as that service account without Gmail/Calendar's delegated user. Enable the Data Manager API and grant that account access to the conversion-owning Ads customer. Optional `GOOGLE_DATA_MANAGER_LOGIN_ACCOUNT_ID` selects an explicitly configured manager account; do not guess one.

The worker exposes protected POST `/google/conversions/ingest`, `/google/conversions/status` (body `{ "requestId": "..." }`) and `/google/conversions/validate` (the same destination/event payload as ingestion, forced `validateOnly: true`). Only the dedicated relay secret authorizes these routes. Validation does not create a conversion or establish real click matching. Tokens and raw Google errors are not returned. The protected relay returns bounded, redacted validation diagnostics. CRM payloads use `eventSource: "OTHER"`; Google currently requires this field for these uploads. Legacy direct OAuth (`GOOGLE_DATA_MANAGER_CLIENT_ID`, `GOOGLE_DATA_MANAGER_CLIENT_SECRET`, `GOOGLE_DATA_MANAGER_REFRESH_TOKEN`) remains supported when no relay settings exist; partially configured relay settings fail closed.

The existing Cloudflare Worker cron runs every 15 minutes. Configure its `CONVERSION_PROCESSOR_URL` to the app’s HTTPS `/api/internal/conversions/process` URL and secret `CONVERSION_PROCESSOR_TOKEN` to the app’s `CRON_SECRET`. Deploy both app and Worker. An external scheduler can call the same endpoint with `Authorization: Bearer <CRON_SECRET>` instead. No extra Vercel cron plan is required. Each invocation handles up to 10 due deliveries. Failed network/transient requests retry with backoff, at most 20 attempts; diagnostics poll at 30-minute intervals. Stable transaction IDs protect against duplicates if a process fails after Google accepted an upload.

Verify in local development first: publish a v5 artifact, configure mock mappings, trigger interactions, inspect `cs_event`, query stored events, connect a lead to the visit, post a CRM outcome twice, and confirm one delivery. Mock Google ingestion/diagnostics for repeatable integration tests. Production verification additionally requires the actual GTM container configuration and authorized Google credentials; never report Google receipt based solely on local mocks.

Google references: https://developers.google.com/data-manager/api/devguides/events/send-events and https://developers.google.com/data-manager/api/devguides/diagnostics .

## Published section pages (`/speaker/{slug}`)

Shared Svelte components emit the same `cs_event` envelope and use the same campaign browser mappings as runtime v5. Deploying these component changes covers existing published section versions: no republishing or document migration is required. The immutable artifact runtime is unchanged.

Set `gtmContainerId` and browser mappings on **each campaign** through the existing authenticated tracking configuration API. Section pages now load the configured container instead of a hard-coded container. A null container means no GTM loader; no browser mappings means no mapped conversion destination. Inspect `GET /api/runtime/v1/tracking?pageId={campaignPageId}` to verify the live configuration for either renderer. Never copy artifact-specific action mappings blindly: section actions are listed below. Do not overwrite unrelated or offline mappings.

| Interaction                           | `cs_event_name`     | `cs_action`                                                                          |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Hero email link                       | `navigation_click`  | `hero_email`                                                                         |
| Hero availability link                | `navigation_click`  | `hero_booking`                                                                       |
| Other email / telephone links         | `navigation_click`  | `email` / `phone`                                                                    |
| PDF booklet link                      | `navigation_click`  | `booklet_download`                                                                   |
| Booking controls                      | `button_click`      | `booking_day_select`, `booking_slot_select`, `booking_slot_change`, `booking_submit` |
| Intake submit button (attempt only)   | `button_click`      | `lead_intake_submit`                                                                 |
| Other booking anchor links            | `navigation_click`  | `booking_open`                                                                       |
| Accepted standalone lead intake       | `form_submit`       | Component's configured `ctaKey`                                                      |
| Successfully confirmed inline booking | `booking_confirmed` | Component's configured `ctaKey`                                                      |
| YouTube player reports playback       | `video_play`        | `video-<YouTubeId>`                                                                  |

Other links/buttons emit `navigation_click`/`button_click`; explicitly declared `data-cs-track` takes precedence. Forms emit `form_start` and one `form_input` per field, without field values or inferred identifiers. Native media playback, page views/exits, visible time thresholds, scroll thresholds, and section visibility are also measured. Section names follow section types, with navigation using `landing_navigation`. Autoplay hero background video is not treated as a user playback conversion.

Booking submission attempts, validation errors and failed bookings do not emit `booking_confirmed`. Existing `mailto_clicked` and `calendar_booking_confirmed` events remain for compatibility: use either those legacy triggers or the new mapped `cs_event` for any one Google conversion, not both. Avoid adding an offline upload for the same browser-confirmed booking.

The speaker visit path already stores Google click IDs independently of visit deduplication, using its visitor cookie; intake/booking services retain journey attribution. Measurement requests use that visit and the existing same-origin, publication, rate-limit and visit-ownership checks. Editor previews do not install the new tracker. Navigation away from a speaker document loads a fresh document so loaded GTM tags cannot leak into another campaign or an editor preview; shallow modal navigation remains supported.

Google Consent Mode defaults match the owner-configured runtime v5 defaults. They are not visitor consent evidence. Manual visit outcomes use the separately documented owner-default policy and respect explicit denials.

For GTM Preview testing after deployment: verify the configured container request, `cs_event` identity/action/destination fields, and successful `/api/runtime/v1/events` responses. Test a rejected submission first (no success conversion), then a coordinated successful intake or booking; a successful booking test creates a real calendar booking. Confirm one destination request per conversion. Configuration updates take effect on the next page load; a local build or dataLayer push alone is not evidence of live Google delivery.
