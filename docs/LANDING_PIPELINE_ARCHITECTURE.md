# Landing Pipeline Architecture

## Phase 0 Baseline

The landing page system is treated as Phase 1 feature complete for now.

During this stabilization window, only these landing-page changes are in scope:

- rendering bugs
- validation issues
- critical publish/versioning bugs
- observability and tracing that do not change behavior

Out of scope during Phase 0:

- new major landing page features
- generation architecture rewrites
- editing model rewrites

## Current Generation Flow

1. Campaign creation/regeneration calls `runLandingPageGenerationForCampaign(...)`.
2. Input normalization loads campaign, latest ad package/ad group, and asset catalogs.
3. Strategist agent generates a structured page plan.
4. Writer agent generates page JSON from the plan.
5. Writer output is hydrated, fallback-filled, and validated against schema + MVP rules.
6. On validation failure, a repair pass is attempted.
7. Valid page document is versioned via `persistGeneratedLandingPage(...)`.
8. Relevant ad group is linked to the new page version.

Primary code paths:

- `src/lib/server/agents/landing-page-pipeline.ts`
- `src/lib/server/agents/landing-page-input.ts`
- `src/lib/server/agents/landing-page-strategist.ts`
- `src/lib/server/agents/landing-page-writer.ts`

## Current Editing Flow

The system supports both full-page AI edits and targeted manual/inline edits.

- AI edit route validates latest-version constraints and runs full JSON validation + guardrails.
- Manual edits (logos, keynotes, restore version) persist new versions.
- Inline section remotes perform surgical field-level changes with campaign/page safety checks.
- Most edits persist through `persistGeneratedLandingPage(...)` and keep version history.

Primary code paths:

- `src/routes/(app)/campaigns/[id]/landing-page/+page.server.ts`
- `src/lib/server/agents/landing-page-editor.ts`
- `src/lib/components/page-sections/*InlineEdit.remote.ts`

## Publish and Relink Flow

Publishing uses campaign-scoped page state and latest ad package relinking.

- publish action selects a target version (explicit selection or latest)
- all campaign pages are first unpublished
- selected page is marked published and slug-resolved
- latest ad package ad groups are relinked to the published page

Primary code path:

- `src/routes/(app)/campaigns/[id]/campaign-status.remote.ts`

## Known Coupling and Duplication

- Required section semantics are duplicated across eligibility, prompt rules, writer validation/order, and editor guardrails.
- Writer module mixes concerns (LLM orchestration, hydration, fallback, normalization, validation).
- Publish/relink behavior appears in multiple campaign flows, increasing drift risk.
- Ad group linking is triggered by several paths (initial generation, publish, edits), making coordination brittle.
- Intermediate artifacts are implicit in logs and in-memory objects rather than explicit typed contracts.

## Phase 0 Tracing Contract

Phase 0 introduces structured event coverage for:

- strategist output
- writer output
- hydration changes
- validation failures
- repair pass triggers
- publish actions
- ad-group relink actions

This tracing is observability-only and must not modify runtime behavior.
