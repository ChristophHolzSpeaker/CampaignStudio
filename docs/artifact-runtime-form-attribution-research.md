# Published artifact form and attribution research

Research date: 2026-08-26

Question: Does the published artifact at
`https://speaker.christophholz.com/keynote-digital-leadership` follow the artifact-runtime
form convention, and will its submission retain attribution and reach the Cloudflare Worker
notification path?

## Conclusion

**Yes for the published form and Campaign Studio attribution path.** The page has the
runtime-recognized lead form, canonical field names, a stable form key, and the injected
published-page context. The versioned browser runtime will intercept its submit event and
POST the form to Campaign Studio's same-origin lead-intake endpoint. That endpoint resolves
the published artifact by the server-provided page ID and writes the lead/journey/event with
campaign/page/visitor/visit context.

The browser does **not** post directly to the Cloudflare Worker. That is intentional: the
artifact CSP permits connections only to the page origin, and the authoring contract says
that identity is injected rather than authored. The app server subsequently makes an
authenticated server-to-server request to the Worker notification endpoint. The worker
notification contains `campaign_id`, `campaign_page_id`, page slug, and page path.

This source review cannot prove production environment configuration or prove that a live
submission was delivered without submitting a real lead. Delivery additionally requires
`ATTRIBUTION_WORKER_URL` and `ATTRIBUTION_INTERNAL_TOKEN` in the app to match the Worker's
`INTERNAL_API_TOKEN`. A Worker notification failure is logged and does not roll back the
lead/journey/event persistence.

## Public artifact contract

The page's public discovery index directs authors to the complete guide and machine-readable
contract: [llms.txt](https://speaker.christophholz.com/llms.txt). The live
[authoring contract](https://speaker.christophholz.com/api/public/v1/authoring-contract)
defines runtime version `v1` and says the platform injects campaign/page identity, removes
authored form actions, and handles lead forms selected by
`form[data-cs-form="lead-intake"]`.

The required author markup is:

```html
<form data-cs-form="lead-intake" data-cs-form-key="stable-form-key">
	<input name="email" type="email" required />
	<textarea name="scope" minlength="2" maxlength="500" required></textarea>
	<input name="name" />
	<input name="phone" type="tel" />
	<input name="company" />
	<button type="submit">Send</button>
	<p data-cs-form-status aria-live="polite"></p>
</form>
```

`email` and `scope` are required. `name`, `phone`, and `company` are optional; the contract
sets the same length/phone rules implemented by the server. The complete guide gives the
same form example and explains that the runtime, not author code, owns submission and
attribution: [llms-full.txt](https://speaker.christophholz.com/llms-full.txt).

## Published-page inspection

The HTML fetched from the published URL on 2026-08-26 (HTTP 200; ETag
`"090244181b154fd3b8ad3cf235778203f0b84c7c0062e74889ac3d8bd0b75703-v1-r2"`) contains:

```html
<form data-cs-form="lead-intake" data-cs-form-key="booking-lead">
	<input name="email" required type="email" />
	<input name="name" maxlength="120" type="text" />
	<input name="phone" type="tel" />
	<input name="company" maxlength="120" type="text" />
	<textarea name="scope" minlength="2" maxlength="500" required></textarea>
	<button type="submit">Anfrage senden</button>
	<p data-cs-form-status aria-live="polite"></p>
</form>
```

It also contains this server-injected context (values abbreviated only for formatting):

```json
{
	"runtimeVersion": "v1",
	"campaignId": 43,
	"campaignPageId": 150,
	"slug": "keynote-digital-leadership",
	"preview": false,
	"endpoints": {
		"visits": "/api/runtime/v1/visits",
		"leadIntake": "/api/runtime/v1/forms/lead-intake"
	}
}
```

The page therefore satisfies all author-controlled requirements: no `action` competes with
the runtime, every named field is canonical, required fields and documented constraints are
present, and the status element is accessible. The published runtime is loaded from
`/campaign-runtime/v1.js`; it calls the above lead endpoint with `{ campaignPageId, formKey,
fields }` and uses same-origin cookies. The runtime source is directly inspectable at
[campaign-runtime/v1.js](https://speaker.christophholz.com/campaign-runtime/v1.js).

## Server and Worker routing evidence

The repository source of truth corroborates the deployed contract:

- [`src/routes/api/runtime/v1/forms/lead-intake/+server.ts`](../src/routes/api/runtime/v1/forms/lead-intake/+server.ts)
  accepts the exact payload, validates canonical fields, confirms that `campaignPageId` is a
  published artifact, reads the visitor cookie, and invokes the shared intake service using
  the resolved campaign/page and artifact page path.
- [`src/lib/server/leads/intake-service.ts`](../src/lib/server/leads/intake-service.ts)
  resolves the visit, creates or matches the lead journey, and logs a `form_submitted` event
  carrying campaign/page/visit/visitor attribution. It also calls the notification adapter
  with the same context.
- [`src/lib/server/notifications/booking-form-submission.ts`](../src/lib/server/notifications/booking-form-submission.ts)
  packages `campaign_id`, `campaign_page_id`, `page_slug`, and `page_path` into the Worker
  metadata.
- [`src/lib/server/notifications/form-submission-worker-client.ts`](../src/lib/server/notifications/form-submission-worker-client.ts)
  posts it, with the internal bearer token, to
  `POST {ATTRIBUTION_WORKER_URL}/notifications/form-submission`.
- [`worker/src/index.ts`](../worker/src/index.ts) requires internal authentication before
  routing that endpoint, and
  [`worker/src/routes/form-submission-notification.ts`](../worker/src/routes/form-submission-notification.ts)
  validates the payload and delivers the internal email notification.

## Operational caveat

Do not change this artifact to post directly to a Worker URL or add author JavaScript. That
would violate both the deployed authoring contract and the page CSP (`connect-src 'self'`).
For a production delivery confirmation, submit a controlled test lead and verify the
resulting `lead_events`/`lead_journeys` row plus the Worker/Gmail notification logs; this
research intentionally did not create a real lead or send mail.
