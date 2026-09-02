# Artifact authoring workflow

Campaign Studio accepts complete HTML/CSS/media bundles through the bearer-authenticated public API. Artifact pages publish at `/{slug}`; existing section pages remain at `/speaker/{slug}`.

The deployed application publishes the client-facing sources of truth at:

- `/llms.txt` — concise LLM discovery index.
- `/llms-full.txt` — complete Markdown workflow and semantics.
- `/api/public/v1/openapi.json` — exact OpenAPI 3.1 HTTP contract.
- `/api/public/v1/authoring-contract` — runtime-derived JSON rules, limits, markup, fonts, fields, and lifecycle behavior.

These four read-only resources are public and contain no credentials or private campaign data. Creation, upload, preview discovery, lifecycle, reporting, and lead operations remain bearer-authenticated. The JSON contract is authoritative for changing artifact rules; OpenAPI is authoritative for HTTP shapes.

## Prerequisites

- A campaign created for the artifact or selected from `GET /api/public/v1/campaigns`.
- A bearer token with the `campaign-write` scope.
- A bundle with exactly one `index.html`, no author JavaScript, and only paths relative to the bundle root.

Read `GET /api/public/v1/authoring-contract` before deploying. It is the source of truth for limits, reserved slugs, allowed content, canonical lead fields and validation, supported `data-cs-*` attributes, runtime behavior, fonts, and widgets.

To create a campaign without manufacturing a legacy section page, post the artifact discriminator and campaign metadata:

```sh
curl -sS -X POST "$BASE_URL/api/public/v1/campaigns" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"renderer_type":"artifact","campaign":{"name":"Future-ready leadership","audience":"Technology leaders","format":"Keynote campaign","topic":"Leadership in the age of AI","language":"English","geography":"Global"}}'
```

Retain the returned `campaignId`. The finalized artifact upload creates the first immutable page version.

## Deploy

Set `BASE_URL`, `CAMPAIGN_ID`, and `CAMPAIGN_WRITE_TOKEN` in the calling environment, then create a session:

```sh
curl -sS -X POST "$BASE_URL/api/public/v1/campaigns/$CAMPAIGN_ID/artifact-versions" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"slug":"future-ready-leadership"}'
```

The response contains an `artifactVersionId`. Upload every file with its correct media type; nested paths are supported:

```sh
curl -sS -X PUT "$BASE_URL/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/files/index.html" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \
  -H "Content-Type: text/html" \
  --data-binary @index.html

curl -sS -X PUT "$BASE_URL/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/files/assets/site.css" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \
  -H "Content-Type: text/css" \
  --data-binary @assets/site.css
```

Finalize only after all files are uploaded:

```sh
curl -sS -X POST "$BASE_URL/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/finalize" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
```

Finalization validates hashes, paths, types, HTML safety, and local references, then returns an immutable `campaignPageId` and tokenized `previewUrl`. Review that URL before publishing:

```sh
curl -sS -X POST "$BASE_URL/api/public/v1/artifact-versions/$CAMPAIGN_PAGE_ID/publish" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
```

The response contains the canonical root `liveUrl`. Publishing an older finalized `campaignPageId` performs rollback without copying or modifying objects. To remove the active page:

```sh
curl -sS -X POST "$BASE_URL/api/public/v1/artifact-versions/$CAMPAIGN_PAGE_ID/unpublish" \
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
```

## Runtime markup

Use server-supported markup only. Campaign/page IDs are injected by Campaign Studio and must not be authored into HTML.

### Platform fonts

Campaign Studio injects a versioned platform font stylesheet into every artifact document. Artifacts may use the same families as the maintained landing pages without bundling those font files:

```css
body {
	font-family: var(--cs-font-sans);
}

h1,
h2 {
	font-family: var(--cs-font-display);
}
```

The corresponding family names are `Bureau Grot` (weights 300 and 400) and `Bureau Grot Compressed` (weights 300, 400, 500, and 700). The stylesheet defines the faces and variables but does not override an artifact's authored typography.

```html
<a
	href="mailto:hello@example.com"
	data-cs-action="cta"
	data-cs-cta-type="email"
	data-cs-cta-key="hero-email"
	data-cs-cta-section="hero"
	>Contact us</a
>

<form data-cs-form="lead-intake" data-cs-form-key="hero-lead">
	<input name="email" type="email" required />
	<input name="name" />
	<input name="phone" />
	<input name="company" />
	<textarea name="scope" required></textarea>
	<button type="submit">Send</button>
	<p data-cs-form-status aria-live="polite"></p>
</form>

<div data-cs-widget="booking-calendar"></div>

<div
	data-cs-widget="youtube-video"
	data-cs-youtube-id="dQw4w9WgXcQ"
	data-cs-video-title="Campaign introduction"
></div>
```

For YouTube, provide only the exact 11-character video ID and an optional accessible title of up to 120 characters. Campaign Studio validates the ID at finalization, then presents a click-to-load control that creates a sandboxed privacy-enhanced `www.youtube-nocookie.com` player. On the first confirmed playback, the runtime records a `cta_click` event with type `video`, key `video-<youtubeId>`, section `videos`, and the title (or video ID) as its label. Do not author YouTube URLs, iframes, player parameters, or API code.

Local HTML and CSS asset references are rewritten to immutable public storage URLs. External URLs remain explicit. Author scripts, inline event handlers, executable files, root-relative paths, missing references, and unsupported media types are rejected.
