# Inline YouTube reference

A complete artifact bundle demonstrating a video in normal document flow, using only Campaign Studio's supported YouTube placeholder. No authored JavaScript, iframe, modal, overlay, or duplicate video CTA marker is required.

Upload only `index.html` and `assets/site.css`, using their paths relative to this directory. Use a separate reference campaign and the slug `inline-video-reference`; do not replace an existing marketing campaign. The page is marked `noindex,nofollow`.

## Runtime and verification

- Runtime v3 already renders this widget inline on desktop, but requires a second click inside YouTube to play.
- Runtime v4 initializes the native player immediately with `autoplay=0`, `controls=1`, and `playsinline=1`, matching campaign #3’s section-rendered YouTube grid. The visitor clicks the native play control once. YouTube resources load before that click.
- The platform records one `cta_click` with type `video`, key `video-xmJRcJAr8Rc`, section `videos`, and label `Inline-Referenz · Keynote didacta 2026` on confirmed playback. Preview playback never records analytics.
- Confirm playback stays inside the original video area, the page remains scrollable, and pause/resume does not create a second event.
- After publishing the reference, test an actual play and verify the event in `lead_events` for the new page and visit. An HTTP 204 from the CTA endpoint alone is insufficient because the endpoint currently catches downstream Worker failures.

## Publishing

Deploy runtime v4 and its contract/font route before finalizing a v4 reference. Use the documented create → upload → finalize → preview → publish API workflow from `/llms-full.txt`, with the campaign-write bearer token held outside the bundle. Record campaign ID, finalized page ID, previous published page ID (when updating), runtime version, and live URL.

Existing v3 artifacts remain pinned to v3. They adopt v4 only after uploading/finalizing new versions and publishing them. Preserve old versions for rollback; do not overwrite immutable storage objects or modify their runtime metadata directly.

## Prompt for Christoph's Claude Code

Read https://speaker.christophholz.com/llms-full.txt and https://speaker.christophholz.com/api/public/v1/authoring-contract before changing anything. Use the existing campaign sources and Campaign Studio's authenticated publishing API.

For the selected landing pages, place each YouTube video directly in its existing content section, using an empty placeholder:

```html
<div
	class="video-slot"
	data-cs-widget="youtube-video"
	data-cs-youtube-id="EXISTING_11_CHARACTER_VIDEO_ID"
	data-cs-video-title="Existing video title"
></div>
```

Replace the example ID with that video's existing valid ID. Keep each player in normal document flow in a responsive 16:9 area. Let Campaign Studio render the native YouTube player and play control in that same area; do not add your own play button. Remove modal/lightbox/overlay wrappers, hash links that open them, and separate thumbnail activation steps only where they actually exist. Do not treat ordinary inline widgets as modals or rewrite sections that are already correct.

Do not author iframes, JavaScript, player URLs/parameters, or custom tracking. Do not add `data-cs-action="cta"` to the video widget or its ancestors: Campaign Studio records confirmed plays automatically. Preserve every existing video ID/title, other page content, styling, forms, CTAs, campaign identity, and public slug.

Check the deployed runtime contract. v3 supports inline placement but cannot provide single-click playback or explicitly request iOS inline playback through authored markup. Do not invent a workaround: report that platform limitation. Once v4 is available, upload and finalize replacement artifact versions so they receive v4; merely republishing an existing v3 version does not upgrade it.

Preview each changed version. Verify the player stays in place, does not open a modal/new tab, and the surrounding page remains usable on desktop and mobile. Publish through the normal workflow, retaining previous versions for rollback. Report the URLs, old/new version IDs, runtime versions, and what was actually verified. Do not claim database analytics were verified unless a real confirmed-play event was checked against the published page's ID.
