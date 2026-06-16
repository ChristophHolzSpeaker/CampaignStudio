# Speaker Page Performance PRD

## Problem Statement

The public `speaker/[slug]` page is too slow because the initial server request does too much work before HTML is sent. The route currently loads published campaign page content, resolves booking availability, and records page-view analytics on the server. That blocks first paint, makes the page harder to cache on Vercel, and pushes performance below the target.

## Solution

Render the speaker page shell immediately from immutable published page content, then defer non-critical work to the client.

- Keep the public page SSR-backed from published `campaign_pages` content.
- Move visit logging to a browser-triggered remote command after the shell paints.
- Store the visitor identifier client-side so dedupe still works without a server cookie.
- Load booking slot data after paint instead of during the initial request.
- Keep SEO metadata and structured data in the initial response.
- Make the public route cache-friendly by removing request personalization from the SSR path.

## User Stories

1. As a visitor, I want the speaker page content to appear immediately, so that the page feels fast.
2. As a visitor, I want booking slots to load after the page shell is visible, so that I can start reading before secondary data arrives.
3. As a visitor, I want the page to stay visually stable while booking data loads, so that the experience does not jump around.
4. As a visitor, I want my page view to still be recorded, so that analytics remain accurate.
5. As a returning visitor on the same browser, I want repeated page views within the dedupe window to count as one visit, so that reporting is not inflated.
6. As an internal user, I want the live speaker page to remain based on published campaign content, so that the public page still reflects the canonical version.
7. As the system, I want the page shell to remain cacheable on Vercel, so that repeated requests can be served faster.
8. As the system, I want booking availability to be fetched separately from the page shell, so that slow availability lookups do not block first paint.
9. As the system, I want analytics logging to happen after paint, so that telemetry does not delay rendering.
10. As the system, I want the visitor identifier to live in the browser instead of a server cookie, so that caching is not broken by request personalization.
11. As an internal analyst, I want visit dedupe to remain in place, so that campaign visit counts stay trustworthy.
12. As an internal analyst, I want page-view attribution to continue using `campaign_visits` as the source of truth, so that reporting stays consistent with the current analytics model.
13. As a maintainer, I want the implementation to use existing remote-function and route-load seams, so that the change stays small and testable.
14. As a maintainer, I want the public page to preserve SEO metadata and structured data, so that performance work does not regress discoverability.
15. As a maintainer, I want the page to avoid unnecessary client bundle growth, so that the performance gain is not offset by heavier hydration.

## Implementation Decisions

- Keep published page content SSR-backed from `campaign_pages` and `campaigns`.
- Remove visit logging from the server load path for the public speaker route.
- Replace server-side visitor cookie handling on the speaker route with a browser-scoped visitor identifier stored client-side.
- Add a client-triggered remote command for campaign visit logging.
- Preserve the current 30-minute dedupe window in the logging path.
- Keep `campaign_visits` as the authoritative page-view dataset.
- Move booking slot retrieval out of the initial page load and into a deferred client-side fetch path.
- Render a lightweight loading state or empty shell for booking content until the async data arrives.
- Keep SEO and JSON-LD generation in the initial server render.
- Keep the change within the existing page-rendering and attribution architecture; no new analytics model is introduced.
- The browser-scoped identity only needs to satisfy the existing MVP attribution requirement; cross-device or cross-session identity is not part of this change.
- Cacheability should be improved through the route no longer being personalized by cookies and by removing blocking non-page-critical work from SSR.
- The implementation should reuse the existing remote-function experimental setup already enabled in the project.

## Testing Decisions

- Good tests should verify visible behavior and request shape, not implementation details.
- Test that the public speaker route still renders the page content when booking data and visit logging are absent.
- Test that booking data is fetched independently and does not block the initial render path.
- Test that the visit logging command accepts a browser visitor id and preserves dedupe behavior within the configured window.
- Test that the public route no longer depends on a server-issued visitor cookie.
- Test that the logging path still writes the expected attribution fields into the campaign visit record.
- Prior art exists in the repo’s Vitest route-load tests and server-service tests, especially the booking flow tests and route `+page.server` tests.
- Existing test seams to mirror include mocked server modules, route load assertions, and isolated service-level tests.

## Out of Scope

- Reworking the analytics schema.
- Changing the booking availability algorithm.
- Introducing cross-device or cross-browser attribution guarantees.
- Building a new reporting dashboard.
- Redesigning the public speaker page UI.
- Adding a different CDN provider or moving hosting away from Vercel.
- Making other public routes cacheable in the same change.
- Changing the landing page generation pipeline.

## Further Notes

- This fits the SRS: basic attribution visibility is required, but guaranteed cross-device/cross-session attribution is not.
- The biggest win comes from removing all blocking non-content work from the public page request.
