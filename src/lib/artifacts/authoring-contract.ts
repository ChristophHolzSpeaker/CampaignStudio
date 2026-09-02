import { ctaTypes } from '../../../shared/event-types';
import {
	ARTIFACT_ALLOWED_HTML_TAGS,
	ARTIFACT_ALLOWED_MEDIA_TYPES,
	ARTIFACT_ENTRYPOINT,
	ARTIFACT_MAX_FILE_BYTES,
	ARTIFACT_MAX_FILE_COUNT,
	ARTIFACT_MAX_TOTAL_BYTES,
	ARTIFACT_PROHIBITED_EXTENSIONS,
	ARTIFACT_RUNTIME_VERSION,
	RESERVED_ARTIFACT_SLUGS
} from './contract';

export const ARTIFACT_AUTHORING_CONTRACT = {
	contractVersion: 3,
	runtimeVersion: ARTIFACT_RUNTIME_VERSION,
	rendererType: 'artifact',
	discovery: {
		index: '/llms.txt',
		fullGuide: '/llms-full.txt',
		openApi: '/api/public/v1/openapi.json',
		jsonContract: '/api/public/v1/authoring-contract'
	},
	authentication: {
		publicReadOnlyPaths: [
			'/llms.txt',
			'/llms-full.txt',
			'/api/public/v1/openapi.json',
			'/api/public/v1/authoring-contract'
		],
		writeScheme: 'Authorization: Bearer <campaign-write token>',
		writeScope: 'campaign-write',
		credentialRule: 'Never put a bearer token in artifact HTML, CSS, a URL, or a committed file.'
	},
	workflow: [
		'Create an artifact campaign or select an existing campaignId.',
		'Author a complete index.html plus optional CSS and media using only supported markup.',
		'Create an artifact upload session for the campaignId and desired root slug.',
		'Upload every file as raw bytes to the session using its exact relative path and media type.',
		'Finalize the session and retain the returned campaignPageId and previewUrl.',
		'Have a human review the tokenized previewUrl.',
		'Publish that campaignPageId. Publishing an older finalized version performs rollback.',
		'Use the returned liveUrl; unpublish the active campaignPageId when removal is required.'
	],
	routing: {
		artifactLiveUrl: '/{slug}',
		sectionLiveUrl: '/speaker/{slug}',
		slugPattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
		reservedSlugs: RESERVED_ARTIFACT_SLUGS
	},
	bundle: {
		entrypoint: ARTIFACT_ENTRYPOINT,
		limits: {
			maxFileCount: ARTIFACT_MAX_FILE_COUNT,
			maxFileBytes: ARTIFACT_MAX_FILE_BYTES,
			maxTotalBytes: ARTIFACT_MAX_TOTAL_BYTES
		},
		paths: {
			format: 'Relative, slash-separated safe path segments; nested paths are supported.',
			localReferences:
				'Use relative references such as assets/site.css. They are validated and rewritten to immutable asset URLs.',
			rootRelativeReferences: 'Rejected. Do not use /styles.css for a bundle file.',
			externalReferences:
				'Explicit http(s), mailto, tel, fragment, and data references remain external.'
		},
		allowedMediaTypes: ARTIFACT_ALLOWED_MEDIA_TYPES,
		prohibitedExtensions: ARTIFACT_PROHIBITED_EXTENSIONS,
		allowedHtmlTags: ARTIFACT_ALLOWED_HTML_TAGS
	},
	security: {
		authorJavaScript: false,
		iframes: false,
		inlineEventHandlers: false,
		javascriptUrls: false,
		securityChangingMetaElements: false,
		completeDocumentRequired: true,
		prohibitedHtmlElements: ['script', 'iframe', 'object', 'embed', 'applet', 'base'],
		externalResources:
			'HTTPS styles, images, fonts, audio, and video are permitted by the artifact CSP. Runtime requests remain same-origin. The runtime may load the documented YouTube privacy-enhanced player; authored frames remain prohibited.',
		note: 'Campaign Studio sanitizes HTML, removes authored form actions, and injects its pinned runtime after validation.'
	},
	platformFonts: {
		injectedStylesheet: `/campaign-runtime/fonts/${ARTIFACT_RUNTIME_VERSION}.css`,
		cssVariables: {
			'--cs-font-sans': "'Bureau Grot', ui-sans-serif, system-ui, sans-serif",
			'--cs-font-display': "'Bureau Grot Compressed', 'Bureau Grot', sans-serif"
		},
		families: [
			{ name: 'Bureau Grot', weights: [300, 400] },
			{ name: 'Bureau Grot Compressed', weights: [300, 400, 500, 700] }
		],
		note: 'The stylesheet defines font faces and variables but does not override authored typography.'
	},
	runtime: {
		injectedScript: `/campaign-runtime/${ARTIFACT_RUNTIME_VERSION}.js`,
		identity:
			'Campaign and page identity is injected by Campaign Studio. Never author campaign IDs or page IDs into the artifact.',
		preview:
			'Preview is tokenized and non-indexable. Visit, engagement, CTA, and lead submission side effects are disabled in preview.',
		automaticAnalytics: {
			pageVisit:
				'Recorded on a published artifact load with available URL, UTM, referrer, and visitor context.',
			engagement: 'Recorded after 10 seconds or on page exit after a runtime interaction.',
			ctaClick: 'Recorded for the closest ancestor marked data-cs-action="cta".',
			youtubeVideoPlay:
				'Recorded once per rendered YouTube widget after its player first enters playback.'
		},
		cta: {
			selector: '[data-cs-action="cta"]',
			requiredAttributes: { 'data-cs-action': 'cta' },
			optionalAttributes: {
				'data-cs-cta-type': {
					values: ctaTypes,
					default: 'navigation',
					description: 'Analytics classification; it does not change link navigation.'
				},
				'data-cs-cta-key': 'Stable analytics identifier, maximum 255 characters.',
				'data-cs-cta-section': 'Stable section identifier, maximum 255 characters.'
			},
			label: 'Derived from trimmed visible text and truncated to 255 characters.',
			example:
				'<a href="mailto:hello@example.com" data-cs-action="cta" data-cs-cta-type="email" data-cs-cta-key="hero-email" data-cs-cta-section="hero">Contact us</a>'
		},
		leadForm: {
			selector: 'form[data-cs-form="lead-intake"]',
			formType: 'lead-intake',
			optionalFormKeyAttribute:
				'data-cs-form-key: stable analytics identifier, maximum 120 characters.',
			statusSelector: '[data-cs-form-status]',
			behavior:
				'The runtime prevents normal submission, removes action, disables the submit control while sending, writes an accessible status message, resets after success, and preserves the page on failure.',
			unknownFields:
				'Unknown named controls are ignored by the server. Repeated names collapse to the last value in browser form order. Author only the canonical fields.',
			duplicateSubmission:
				'The visible submit control is disabled while pending, but submissions have no author-supplied idempotency key. Do not programmatically submit or provide competing submit paths.',
			fields: [
				{ name: 'email', required: true, type: 'email', constraints: 'Non-empty valid email.' },
				{
					name: 'scope',
					required: true,
					type: 'string',
					constraints: 'Trimmed length 2 through 500 characters.'
				},
				{
					name: 'name',
					required: false,
					type: 'string',
					constraints: 'Maximum 120 characters.'
				},
				{
					name: 'phone',
					required: false,
					type: 'tel',
					constraints: 'Empty or 8 through 15 digits with an optional leading +.'
				},
				{
					name: 'company',
					required: false,
					type: 'string',
					constraints: 'Maximum 120 characters.'
				}
			],
			example:
				'<form data-cs-form="lead-intake" data-cs-form-key="hero-lead"><label>Email <input name="email" type="email" required></label><label>How can we help? <textarea name="scope" minlength="2" maxlength="500" required></textarea></label><button type="submit">Send</button><p data-cs-form-status aria-live="polite"></p></form>'
		},
		bookingWidget: {
			selector: '[data-cs-widget="booking-calendar"]',
			widget: 'booking-calendar',
			behavior:
				'Campaign Studio replaces the placeholder with its maintained same-origin booking iframe and signed page context. Preview shows a disabled-booking notice. Do not author an iframe or booking URL.',
			example: '<div data-cs-widget="booking-calendar"></div>'
		},
		youtubeVideo: {
			selector: '[data-cs-widget="youtube-video"]',
			widget: 'youtube-video',
			requiredAttributes: {
				'data-cs-widget': 'youtube-video',
				'data-cs-youtube-id': 'Exactly 11 URL-safe YouTube video ID characters.'
			},
			optionalAttributes: {
				'data-cs-video-title': 'Accessible video title, maximum 120 characters.'
			},
			behavior:
				'Campaign Studio validates the video ID, then renders a click-to-load control. Activating it loads the privacy-enhanced YouTube player from www.youtube-nocookie.com. On first confirmed playback, the runtime records a video CTA event with key video-<youtubeId>, section videos, and the title or video ID as label. Do not author an iframe, embed URL, player parameters, or YouTube API code.',
			example:
				'<div data-cs-widget="youtube-video" data-cs-youtube-id="dQw4w9WgXcQ" data-cs-video-title="Campaign introduction"></div>'
		}
	},
	lifecycle: {
		uploadSessionTtl: '1 hour',
		finalize:
			'Validates paths, byte counts, hashes, media types, HTML, CSS, and all local references; then creates an immutable page version and tokenized preview URL.',
		retries:
			'Uploading a duplicate path is rejected. Repeating finalize for an already finalized session returns the same page version. A failed session cannot be reused; create a new upload session. Publication is safe to retry for the same version.',
		publish:
			'Atomically makes the selected immutable campaignPageId active at /{slug}. Publishing an older finalized ID is rollback.',
		unpublish: 'Removes the selected active artifact from public access and returns liveUrl: null.'
	},
	errors: {
		shape: { ok: false, error: 'Human-readable message', issues: 'Optional validation details' },
		rule: 'Treat every non-2xx response as failure. Correct the bundle or request; do not publish after failed finalization.'
	}
} as const;

function absolute(origin: string, path: string): string {
	return new URL(path, origin).href;
}

export function renderLlmsIndex(origin: string): string {
	return `# Campaign Studio

> Public documentation for AI coding clients that create, upload, preview, and publish Campaign Studio landing-page artifacts.

Campaign Studio hosts externally authored HTML/CSS/media bundles at /{slug}. Mutating operations require a campaign-write bearer token; the documentation below is public and contains no credentials.

## Start here

- [Complete artifact authoring guide](${absolute(origin, '/llms-full.txt')}): Read this first for the ordered workflow, HTML contract, CTA tracking, lead forms, booking, fonts, validation, preview, publishing, and rollback.
- [OpenAPI 3.1 document](${absolute(origin, '/api/public/v1/openapi.json')}): Exact HTTP operations, request/response schemas, and examples. Fetch this JSON directly when generating requests.
- [Machine-readable authoring contract](${absolute(origin, '/api/public/v1/authoring-contract')}): Runtime-derived limits, allowed content, data-cs attributes, field rules, and lifecycle semantics.

## Important

- Artifact pages publish at /{slug}; legacy section pages remain at /speaker/{slug}.
- Do not author JavaScript, iframes, inline event handlers, campaign IDs, page IDs, or credentials.
- Use relative paths for bundle assets, for example assets/site.css, never /styles.css.
- A human must review the tokenized preview before publication.
`;
}

export function renderArtifactAuthoringGuide(origin: string): string {
	const openApiUrl = absolute(origin, '/api/public/v1/openapi.json');
	const contractUrl = absolute(origin, '/api/public/v1/authoring-contract');
	return `# Campaign Studio artifact authoring guide

This is the complete operational guide for an AI coding client such as Claude Code. For exact schemas, also fetch [OpenAPI 3.1](${openApiUrl}) and the [JSON authoring contract](${contractUrl}). Public documentation requires no token. Every create, upload, finalize, publish, unpublish, reporting, or private-preview operation requires the appropriate bearer token.

## Non-negotiable rules

1. Create a complete static \`index.html\` plus optional CSS and media. No authored JavaScript is accepted.
2. Do not author \`<script>\`, \`<iframe>\`, \`<object>\`, \`<embed>\`, \`<applet>\`, \`<base>\`, inline \`on*\` handlers, \`javascript:\` URLs, CSP meta tags, or refresh meta tags.
3. Do not place campaign IDs, page IDs, API tokens, or private data in the bundle. Campaign Studio injects trusted identity and its pinned runtime.
4. Reference bundle assets relatively: \`assets/site.css\`, \`images/hero.webp\`, or \`../images/hero.webp\` from nested CSS. Root-relative bundle paths such as \`/styles.css\` are rejected.
5. The entrypoint must be exactly \`index.html\`. Only that file may contain HTML.
6. A human reviews the finalized tokenized preview before publishing.

## Discovery and authentication

- Short discovery index: ${absolute(origin, '/llms.txt')}
- Full guide: ${absolute(origin, '/llms-full.txt')}
- OpenAPI: ${openApiUrl}
- JSON contract: ${contractUrl}
- Write authentication: \`Authorization: Bearer <campaign-write token>\`

Never embed or commit the token. Keep it in the caller's environment and send it only in the Authorization header over HTTPS.

## End-to-end workflow

### 1. Create an artifact-only campaign

Skip this step when a suitable campaign already exists. All campaign text fields except notes are required and contain 2–120 characters.

\`\`\`sh
curl -sS -X POST "${origin}/api/public/v1/campaigns" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{"renderer_type":"artifact","campaign":{"name":"Future-ready leadership","audience":"Technology leaders","format":"Keynote campaign","topic":"Leadership in the age of AI","language":"English","geography":"Global","notes":"Externally authored artifact"}}'
\`\`\`

Retain \`data.campaignId\`. Artifact campaign creation intentionally creates no page; the finalized upload creates the immutable page version.

\`\`\`json
{
  "ok": true,
  "data": {
    "campaignId": 12,
    "rendererType": "artifact",
    "campaignUrl": "/campaigns/12"
  }
}
\`\`\`

To select an existing campaign, call \`GET /api/public/v1/campaigns\` with a read or write bearer token and retain \`campaignId\`.

### 2. Author the bundle

Bundle layout example:

\`\`\`text
index.html
assets/site.css
assets/hero.webp
\`\`\`

The upload limits are ${ARTIFACT_MAX_FILE_COUNT} files, ${ARTIFACT_MAX_FILE_BYTES} bytes per file, and ${ARTIFACT_MAX_TOTAL_BYTES} bytes total. Fetch the JSON contract immediately before authoring for the current allowed media types, prohibited extensions, reserved slugs, and allowed HTML tags.

Campaign Studio injects the platform font stylesheet. Use \`var(--cs-font-sans)\` for Bureau Grot and \`var(--cs-font-display)\` for Bureau Grot Compressed. Available weights are 300/400 for Bureau Grot and 300/400/500/700 for Bureau Grot Compressed.

### 3. Add supported platform behavior

CTA tracking marks a real interactive element. The marker records analytics but does not alter the element's native navigation:

\`\`\`html
<a href="mailto:hello@example.com"
   data-cs-action="cta"
   data-cs-cta-type="email"
   data-cs-cta-key="hero-email"
   data-cs-cta-section="hero">Contact us</a>
\`\`\`

Allowed CTA types are ${ctaTypes.map((value) => `\`${value}\``).join(', ')}; omitted type defaults to \`navigation\`. Use stable, descriptive key and section values. The visible text becomes the tracked label.

A lead form must use exactly the canonical field names. Email and scope are required. Scope is 2–500 characters; name/company are at most 120; phone is empty or 8–15 digits with an optional leading plus.

\`\`\`html
<form data-cs-form="lead-intake" data-cs-form-key="hero-lead">
  <label>Email <input name="email" type="email" required></label>
  <label>Name <input name="name" maxlength="120"></label>
  <label>Phone <input name="phone" type="tel"></label>
  <label>Company <input name="company" maxlength="120"></label>
  <label>How can we help?
    <textarea name="scope" minlength="2" maxlength="500" required></textarea>
  </label>
  <button type="submit">Send</button>
  <p data-cs-form-status aria-live="polite"></p>
</form>
\`\`\`

The runtime removes any form action, sends the form to Campaign Studio, disables the submit button while pending, reports success/failure in \`data-cs-form-status\`, and resets after success. It creates a status element if one is omitted.

Mount booking with a placeholder only. Campaign Studio supplies the maintained booking interface and signed page context:

\`\`\`html
<div data-cs-widget="booking-calendar"></div>
\`\`\`

Mount a YouTube video with the video ID only. Campaign Studio validates the ID and creates a privacy-enhanced player only after the visitor activates the control. Do not author a YouTube URL, iframe, player parameters, or API code:

\`\`\`html
<div data-cs-widget="youtube-video"
     data-cs-youtube-id="dQw4w9WgXcQ"
     data-cs-video-title="Campaign introduction"></div>
\`\`\`

### 4. Create the upload session

The lowercase slug becomes the canonical root URL and must not collide with an application route. The session expires after one hour.

\`\`\`sh
curl -sS -X POST "${origin}/api/public/v1/campaigns/$CAMPAIGN_ID/artifact-versions" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{"slug":"future-ready-leadership"}'
\`\`\`

Retain \`data.artifactVersionId\` (the upload session ID), \`data.uploadTemplate\`, and \`data.finalizeUrl\`.

\`\`\`json
{
  "ok": true,
  "data": {
    "artifactVersionId": "11111111-2222-4333-8444-555555555555",
    "expiresAt": "2026-08-19T19:00:00.000Z",
    "constraints": { "maxFileCount": 100, "maxFileBytes": 4194304, "maxTotalBytes": 26214400 },
    "uploadTemplate": "${origin}/api/public/v1/artifact-versions/11111111-2222-4333-8444-555555555555/files/{path}",
    "finalizeUrl": "${origin}/api/public/v1/artifact-versions/11111111-2222-4333-8444-555555555555/finalize"
  }
}
\`\`\`

### 5. Upload every file

Replace \`{path}\` with the exact URL-encoded relative path and send raw bytes with the correct Content-Type.

\`\`\`sh
curl -sS -X PUT "${origin}/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/files/index.html" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \\
  -H "Content-Type: text/html" \\
  --data-binary @index.html

curl -sS -X PUT "${origin}/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/files/assets/site.css" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN" \\
  -H "Content-Type: text/css" \\
  --data-binary @assets/site.css
\`\`\`

Each successful response returns the canonical path, media type, byte size, and SHA-256. Upload all referenced files before finalizing.

\`\`\`json
{
  "ok": true,
  "data": {
    "path": "assets/site.css",
    "mediaType": "text/css",
    "byteSize": 1842,
    "sha256": "<64 lowercase hexadecimal characters>"
  }
}
\`\`\`

### 6. Finalize and preview

\`\`\`sh
curl -sS -X POST "${origin}/api/public/v1/artifact-versions/$ARTIFACT_VERSION_ID/finalize" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
\`\`\`

Finalization validates every file and local reference, sanitizes HTML, rewrites local assets to immutable URLs, and creates a page version. Retain \`data.campaignPageId\`, \`data.previewUrl\`, and \`data.publishUrl\`. If finalization fails, correct the bundle and create/upload a valid version; do not publish.

\`\`\`json
{
  "ok": true,
  "data": {
    "campaignId": 12,
    "campaignPageId": 34,
    "versionNumber": 1,
    "slug": "future-ready-leadership",
    "previewUrl": "${origin}/artifact-preview/34?token=<signed-preview-token>",
    "publishUrl": "${origin}/api/public/v1/artifact-versions/34/publish"
  }
}
\`\`\`

Open the returned preview URL for human review. Preview disables visits, engagement, CTA tracking, and lead submissions; it exists to verify layout, assets, fonts, and runtime placeholders without contaminating production data.

### 7. Publish, rollback, or unpublish

\`\`\`sh
curl -sS -X POST "${origin}/api/public/v1/artifact-versions/$CAMPAIGN_PAGE_ID/publish" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
\`\`\`

The returned \`data.liveUrl\` is the canonical \`/{slug}\` URL. Publication is atomic. To perform rollback, publish an older finalized \`campaignPageId\`; immutable artifact objects are not changed.

\`\`\`json
{
  "ok": true,
  "data": {
    "campaignId": 12,
    "campaignPageId": 34,
    "versionNumber": 1,
    "slug": "future-ready-leadership",
    "liveUrl": "${origin}/future-ready-leadership"
  }
}
\`\`\`

\`\`\`sh
curl -sS -X POST "${origin}/api/public/v1/artifact-versions/$CAMPAIGN_PAGE_ID/unpublish" \\
  -H "Authorization: Bearer $CAMPAIGN_WRITE_TOKEN"
\`\`\`

Unpublishing removes the selected active artifact from public access and returns \`liveUrl: null\`.

\`\`\`json
{
  "ok": true,
  "data": {
    "campaignId": 12,
    "campaignPageId": 34,
    "slug": "future-ready-leadership",
    "liveUrl": null
  }
}
\`\`\`

Upload retry rules are deliberately strict: a duplicate path is rejected. Repeating finalize after the same session has finalized returns the same page version. A session that failed finalization cannot be reused; create a fresh session and upload the corrected bundle. Publishing the same finalized version is safe to retry.

## Runtime and analytics semantics

On a published artifact, the injected runtime automatically records a visit with available campaign attribution. It records engagement after ten seconds or on page exit following interaction. CTA clicks are best-effort and also push a \`cta_click\` object to \`window.dataLayer\` when that array exists. Any element can carry the CTA marker, but use native links and buttons so keyboard activation produces a normal click; middle-button \`auxclick\` is not tracked. Modifier-assisted link clicks retain native navigation and are tracked best-effort. CTA keys are not uniqueness-enforced, so make them stable and unique within a page; section values are author-defined analytics labels.

Lead submissions reuse Campaign Studio's lead, attribution, journey, qualification, and notification behavior. The \`scope\` field is the visitor's meeting purpose or inquiry context and is used in lead qualification. Unknown form fields are ignored; repeated field names collapse to the last value, so author only one control per canonical name. The submit control is disabled while a request is pending, but there is no author-visible idempotency key—do not add programmatic or competing submission paths. A network or service failure leaves the page and entered values in place and writes the retry message to the status element.

The booking placeholder is replaced with the maintained same-origin booking widget. In preview, it renders a clear disabled-booking notice; booking mutations are unavailable.

The YouTube placeholder is replaced with a click-to-load control. After activation, the runtime loads only the privacy-enhanced \`www.youtube-nocookie.com\` player for the validated video ID. On first confirmed playback, it records one \`cta_click\` event with type \`video\`, key \`video-<youtubeId>\`, section \`videos\`, and the authored title (or video ID) as label. Pauses, resumes, seeks, and replays do not create additional events for that rendered widget.

Do not reproduce these behaviors in authored code. Authored JavaScript is rejected, and platform IDs are resolved from signed/injected runtime context.

## Validation and error handling

Treat every non-2xx response as failure. JSON errors have \`ok: false\`, a human-readable \`error\`, and sometimes validation \`issues\`. Common causes are an expired session, reserved or malformed slug, wrong media type, oversized file/bundle, prohibited extension or markup, missing \`index.html\`, unsafe CSS, root-relative asset path, missing referenced file, duplicate normalized path, or invalid HTML document.

Do not retry validation failures unchanged. A \`429\` response means the public API rate limit was exceeded; honor its response headers before retrying. Never infer publication from an upload or finalize response—only a successful publish response makes the artifact live.

## Complete minimal index.html

\`\`\`html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Future-ready leadership</title>
  <link rel="stylesheet" href="assets/site.css">
</head>
<body>
  <main>
    <section id="hero">
      <h1>Lead what comes next</h1>
      <p>A keynote for technology leaders navigating the age of AI.</p>
      <a href="#contact" data-cs-action="cta" data-cs-cta-type="form"
         data-cs-cta-key="hero-contact" data-cs-cta-section="hero">Start a conversation</a>
    </section>
    <section id="contact">
      <h2>Bring the conversation to your organization</h2>
      <form data-cs-form="lead-intake" data-cs-form-key="main-contact">
        <label>Email <input name="email" type="email" required></label>
        <label>How can we help?
          <textarea name="scope" minlength="2" maxlength="500" required></textarea>
        </label>
        <button type="submit">Send</button>
        <p data-cs-form-status aria-live="polite"></p>
      </form>
    </section>
    <section aria-labelledby="booking-heading">
      <h2 id="booking-heading">Book a meeting</h2>
      <div data-cs-widget="booking-calendar"></div>
    </section>
    <section aria-labelledby="video-heading">
      <h2 id="video-heading">See the keynote in action</h2>
      <div data-cs-widget="youtube-video"
           data-cs-youtube-id="dQw4w9WgXcQ"
           data-cs-video-title="Campaign introduction"></div>
    </section>
  </main>
</body>
</html>
\`\`\`

## Machine-readable source of truth

The JSON contract at ${contractUrl} is runtime-derived and is the source of truth for changing limits, allowed content, attributes, validation constraints, fonts, and lifecycle semantics. The OpenAPI document at ${openApiUrl} is the source of truth for HTTP operation shapes. If prose and machine-readable values differ, stop and report the mismatch instead of guessing.
`;
}
