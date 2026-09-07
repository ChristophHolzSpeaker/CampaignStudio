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

### One-time GTM installation

Configure the container once, including the existing Google tag and Conversion Linker. Campaign Studio loads the configured container itself on published v5 artifacts. The platform CSP permits Google tag destinations; authored scripts remain prohibited. Test the actual container for additional vendor domains before deployment.

1. Create one Custom Event trigger matching exactly `cs_event`.
2. Create Data Layer Variables for `cs_event_name`, `cs_event_id`, `cs_campaign_id`, `cs_page_id`, `cs_action`, `cs_section`, `cs_metric`, `cs_ads_conversion_id`, `cs_ads_conversion_label`, `cs_value`, `cs_currency`.
3. Create one GA4 Event tag: Event Name = `{{cs_event_name}}`; map campaign/page/action/section/metric parameters to the corresponding variables. Trigger on `cs_event`. Register needed custom dimensions in GA4 for reporting. Avoid enabling overlapping automatic GA4 form/scroll/video events that would duplicate these measurements.
4. Create one Google Ads Conversion Tracking tag: Conversion ID = `{{cs_ads_conversion_id}}`, Conversion Label = `{{cs_ads_conversion_label}}`, Value = `{{cs_value}}`, Currency = `{{cs_currency}}`, Transaction ID = `{{cs_event_id}}`. Use a `cs_event` trigger filtered by `cs_ads_conversion_id` matching RegEx `^[0-9]+$` AND `cs_ads_conversion_label` matching RegEx `^[A-Za-z0-9_-]+$`. The data-layer conversion ID is digits only because this GTM tag adds `AW-` itself. Campaign configuration still stores the full `AW-...` ID; the runtime removes the prefix at the GTM boundary. This single tag routes all mapped browser events.
5. Integrate the site's CMP using GTM Consent Initialization and Consent Mode. The runtime initializes `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization` as denied; the CMP must update consent. Do not have Claude grant consent automatically. Existing first-party CS journey measurement is separate from Google consent. Assess click-ID retention with the site's existing consent policy before enabling production capture.
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

The existing read API remains compatible. Use the same journey UUID already received by the CRM; never match a conversion using reverse IP/company enrichment. The platform captures `gclid`, `gbraid`, and `wbraid` on visits and preserves their original capture times, including repeat arrivals in the same 30-minute visit. Direct returns do not erase these clicks. Known journey visits link to browser identifiers; no IP fingerprinting or automatic cross-device identity merge is introduced. Deleted cookies/new devices need an explicit known journey link. No historical click IDs can be recovered if they were never recorded.

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

Supply actual consent from the CRM's recorded consent state; do not infer it from a purchase. Send `DENIED` if not granted. Do not send personal data in event names or the external event ID. Time must include timezone and cannot be in the future. For appointments use a separately mapped name such as `appointment_confirmed`. CS does not change CRM sales stages when receiving these events.

The stable external event ID is idempotent within a journey. Repeating the same body returns the existing delivery; changing the body under that ID returns 409. Do not generate a new external ID on retry. The delivery snapshots the mapping/click/value at creation so retries cannot change destinations. Outcome value/currency override the mapping defaults. Missing journey returns 404; missing mapping returns 422 and should be configured before retry. HTTP 202 means recorded/queued, not Google delivery.

Offline attribution selects the most recent captured Google click linked to that journey at or before the outcome time. CS keeps all captured clicks for analysis. Missing/expired click IDs or denied consent produce a stored `blocked` outcome with the reason; they are not silently discarded. GCLID imports are subject to Google's 90-day limit and the configured conversion window. Older sales remain in CS reporting even when Google cannot attribute them.

`GET /api/public/v1/conversion-deliveries/{id}` polls one delivery with the read token. `POST` to the same URL with the CRM write token retries a failed delivery after the underlying problem is resolved; it keeps the original transaction and destination snapshot. Pending/accepted/delivered/blocked records cannot be requeued through this endpoint.

Delivery states: `pending`, `processing` (leased worker), `accepted` (Google request ID received), `delivered` (Google ingestion diagnostics SUCCESS), `failed`, `blocked`. Delivered does not guarantee Google matched an ad click or counted it in bidding. `lastError` exposes a safe diagnostic code; Google request IDs support further inspection in Google diagnostics. No raw OAuth responses or CRM personal fields enter public diagnostics. Browser conversions are not automatically resent offline; use different business outcomes/actions to avoid double counting.

### Operator setup and verification

Apply migration 046 before deploying the app. Configure `CRM_WRITE_API_TOKEN`, `CRON_SECRET`, `GOOGLE_DATA_MANAGER_CLIENT_ID`, `GOOGLE_DATA_MANAGER_CLIENT_SECRET`, and `GOOGLE_DATA_MANAGER_REFRESH_TOKEN` as server secrets. OAuth needs `https://www.googleapis.com/auth/datamanager` and access to the conversion-owning Ads account. Optional `GOOGLE_DATA_MANAGER_LOGIN_ACCOUNT_ID` selects a manager account. Enable the Data Manager API in the Google Cloud project. Without Google credentials, outcomes remain pending and processing reports `google_not_configured`.

The existing Cloudflare Worker cron runs every 15 minutes. Configure its `CONVERSION_PROCESSOR_URL` to the app’s HTTPS `/api/internal/conversions/process` URL and secret `CONVERSION_PROCESSOR_TOKEN` to the app’s `CRON_SECRET`. Deploy both app and Worker. An external scheduler can call the same endpoint with `Authorization: Bearer <CRON_SECRET>` instead. No extra Vercel cron plan is required. Each invocation handles up to 10 due deliveries. Failed network/transient requests retry with backoff, at most 20 attempts; diagnostics poll at 30-minute intervals. Stable transaction IDs protect against duplicates if a process fails after Google accepted an upload.

Verify in local development first: publish a v5 artifact, configure mock mappings, trigger interactions, inspect `cs_event`, query stored events, connect a lead to the visit, post a CRM outcome twice, and confirm one delivery. Mock Google ingestion/diagnostics for repeatable integration tests. Production verification additionally requires the actual GTM container/CMP and authorized Google credentials; never report Google receipt based solely on local mocks.

Google references: https://developers.google.com/data-manager/api/devguides/events/send-events and https://developers.google.com/data-manager/api/devguides/diagnostics .
