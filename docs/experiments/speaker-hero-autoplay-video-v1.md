# Speaker Hero Autoplay Video v1

## Purpose

Determine whether replacing the foreground hero image with the page's existing hero video improves lead creation on public speaker landing pages. Christoph makes the final decision; the system does not automatically promote a variant.

The winning dual-button CTA from `speaker_primary_cta_v1` is permanent baseline behavior. That earlier experiment is retired as completed without deleting its assignments, events, variants, or analytics. Its analytics are frozen at its retirement cutoff and remain identified as legacy label-based attribution.

The logo ribbon has already been moved permanently to section index 2, after SEO at index 0 and the hero at index 1. Ribbon placement is not part of this experiment.

## Experiment definition

- Key: `speaker_hero_autoplay_video_v1`
- Route: `/speaker/[slug]`
- Goal event: `lead_created`
- Traffic: 50% control and 50% treatment across eligible traffic
- Assignment: sticky per visitor and isolated from the retired experiment by a new experiment identity and cookie
- Initial status: `draft`
- Earliest decision point: 14 complete days after activation

### Control A - Static hero image

Render the existing foreground hero image. Keep the permanent dual-button CTA and all other page content unchanged.

### Treatment B - Autoplay YouTube hero video

Replace only the foreground hero media panel with the page-specific video already selected in `videoEmbedUrl`. Keep the static hero image as the section background and as the video poster and fallback.

Playback must be:

- embedded through `youtube-nocookie.com`;
- muted, autoplaying, looping, inline, and without player controls;
- replaced by the static image for visitors who prefer reduced motion; and
- replaced by the static image on loading or playback failure.

There is no consent gate. Loading the privacy-enhanced YouTube player still initiates third-party requests, so the ungated load remains an explicit privacy/compliance launch risk requiring separate owner review.

## Eligibility and measurement

Only pages with a syntactically valid YouTube hero URL participate. An ineligible page renders the static baseline and creates neither an assignment nor an exposure.

An exposure is recorded when the assigned hero renders. Successful playback is not required: excluding failed players would remove a real treatment cost and bias the randomized comparison. Treatment B records `video_ready` and `video_error` as diagnostic events and uses the image fallback after failure.

`lead_created` is the sole winner-selection metric. Hero CTA click-through rate, video readiness/errors, and page performance are supporting diagnostics and guardrails. Analytics must attribute new conversions through explicit experiment and variant IDs as defined by [ADR 0001](../adr/0001-identify-experiment-conversions-by-id.md).

## Launch and decision process

1. Make the dual-button CTA unconditional baseline behavior.
2. Retire `speaker_primary_cta_v1` with an explicit cutoff while retaining its historical data.
3. Correct conversion attribution before collecting events for the new experiment.
4. Create the new experiment in `draft` and verify both variants in the separate test environment using manual assignment-cookie changes.
5. Explicitly change the experiment to `running`; this activation starts the 14-day clock.
6. After at least 14 complete days, Christoph chooses Control A, Treatment B, or continued data collection. Analytics may describe a variant as currently leading but must not declare or apply a winner automatically.
