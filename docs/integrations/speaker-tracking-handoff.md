# Speaker section tracking handoff

Branch: `feat/speaker-conversion-tracking`, based on the clean main branch present when this task started. The offline conversion checkpoint remains separate on `wip/offline-conversions-service-account`; this branch does not include or deploy that unfinished integration.

Implemented shared component tracking for published `/speaker/{slug}` pages: campaign-configured GTM, runtime-v5-compatible cs_event payloads, actions, confirmed form/booking events, media and engagement measurements. Measurement/configuration endpoints now accept both published renderers and retain visit ownership checks. Existing speaker click-ID capture and journey attribution are reused. No migration or republishing is required for these component changes.

The previous unconditional GTM-MCDDK28B snippet was replaced by campaign configuration. Before deployment, verify every affected section campaign has its intended gtmContainerId (GTM-MCDDK28B for CH) and browser conversion mappings. A null container intentionally loads no GTM. No production campaign configuration, Google Ads action, GTM trigger, or deployment was changed during this implementation.

See the Published section pages section in `src/lib/artifacts/tracking-guide.md` (included by `/llms-full.txt`) for action names, defaults, and testing instructions. Existing legacy mailto/booking dataLayer events remain; choose one trigger path per Google conversion. Do not map the same booking to a second offline upload.

Resume with git status, inspect/review this branch, verify production campaign mappings through the authorized API, deploy the application, then test a live section campaign in GTM Preview. Browser dataLayer events and local tests do not prove Google delivery. Coordinate successful booking tests because they create real appointments. Offline service-account access remains a separate task blocked on the team's direct Google Ads user grant; consult the offline checkpoint handoff on its branch.

Validation passed: pnpm run format, pnpm run check (zero errors, four existing unused-CSS warnings), production build (DATABASE_URL=postgres://user:password@localhost:5432/db_name to avoid the local placeholder port), and 26 targeted measurement/API/runtime/speaker tests across six files. Svelte autofixer flagged existing dynamic links and effect advisories; new measurement effects perform external side effects and use nonreactive deduplication guards. No keys or tokens are committed.
