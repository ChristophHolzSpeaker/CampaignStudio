# Landing Page Generation Pipeline — Current Implementation Summary

## 1. Executive Summary

The landing page pipeline is a server-side, multi-step flow that starts from campaign creation or regeneration actions, builds a normalized generation input from campaign + latest ad package + asset catalogs, runs a two-agent LLM flow (strategist -> writer), validates/hydrates the output into a strict `LandingPageDocument`, persists each update as a new `campaign_pages` version, and links the latest ad group to that page.

Preview/editing happens in the app route for campaign landing pages, using a version-history model and both AI-assisted edits and section-specific inline edit remotes. Public rendering happens via `/speaker/[slug]`, which only serves `campaign_pages` rows that are published and belong to campaigns with status `published`.

The implementation is strongly schema-driven (Zod + section registry), but contains notable coupling/duplication between prompt contracts, section schemas, writer hydration logic, publish flows, and multiple inline-edit remotes.

## 2. End-to-End Flow

1. User creates a campaign in `src/routes/(app)/campaign/new/+page.server.ts` action flow.
2. Server saves campaign metadata (`campaigns`), runs Google Ads generation (`runGoogleAdsGenerationForCampaign`), then runs landing page generation (`runLandingPageGenerationForCampaign`).
3. `runLandingPageGenerationForCampaign` (`src/lib/server/agents/landing-page-pipeline.ts`) loads normalized input via `loadLandingPageGenerationInput`.
4. Input loader (`src/lib/server/agents/landing-page-input.ts`) fetches:
   - campaign (`campaigns`)
   - latest ad package + details (`campaign_ad_packages`, `campaign_ad_groups`, keywords/ads via campaign client)
   - contextual landing assets (`loadLandingPageAssets`)
5. Strategist step (`generateLandingPagePlan`) calls OpenRouter with strategist prompt and section eligibility/catalog context.
6. Strategist output is validated with `landingPagePlanSchema`; if invalid, a repair pass is attempted.
7. Writer step (`generateLandingPageDocument`) calls OpenRouter with writer prompt + selected sections + assets context.
8. Writer output is normalized/hydrated/fallback-filled against section contracts and MVP required sections; schema + MVP validation enforced; repair pass attempted on failure.
9. Persist step inserts a new `campaign_pages` version (`persistGeneratedLandingPage`) with slug/version/change note and `is_published = false`.
10. Pipeline updates the relevant ad group link (`campaign_ad_groups.campaign_page_id`) to the new page.
11. In app preview UI (`/campaigns/[id]/landing-page`), `getLandingPagePreview` remote loads selected/latest version + version history + editable catalogs (logos/keynotes/media assets).
12. `PageRenderer` maps `page.sections[]` to Svelte components via section registry.
13. Publish action (`publishCampaign` remote) marks one page published, unpublishes others, updates campaign status, and public route `/speaker/[slug]` renders it live.
14. Later edits/regeneration create additional versions and may relink latest ad groups to the new page version.

## 3. File/Module Map

| File path                                                             | Responsibility                                      | Key functions/classes/exports                                                                        | Notes                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/routes/(app)/campaign/new/+page.server.ts`                       | Campaign creation pipeline entrypoint               | action create flow, `runGoogleAdsGenerationForCampaign`, `runLandingPageGenerationForCampaign`       | Landing generation runs after ads generation                        |
| `src/lib/server/agents/landing-page-pipeline.ts`                      | Orchestrates landing pipeline + persistence helpers | `runLandingPageGenerationForCampaign`, `persistGeneratedLandingPage`, `attachLandingPageToAdGroup`   | Creates versioned page rows, links ad group                         |
| `src/lib/server/agents/landing-page-input.ts`                         | Builds normalized generation input                  | `loadLandingPageGenerationInput`                                                                     | Requires exactly one ad group in latest package                     |
| `src/lib/server/agents/landing-page-strategist.ts`                    | LLM step 1 (plan)                                   | `generateLandingPagePlan`                                                                            | Uses section eligibility/catalog and repair pass                    |
| `src/lib/server/agents/landing-page-writer.ts`                        | LLM step 2 (final JSON)                             | `generateLandingPageDocument`                                                                        | Heavy hydration/fallback logic; validates + repair                  |
| `src/lib/server/agents/prompts/landing-page.ts`                       | Prompt templates/contracts                          | `buildLandingPageStrategistSystemPrompt`, `buildLandingPageWriterSystemPrompt`, user prompt builders | Encodes section/asset contract in prompt text                       |
| `src/lib/server/openrouter/client.ts`                                 | LLM transport + retries/fallback models             | `callOpenRouter`                                                                                     | Retries parse/network/5xx; model fallback configured                |
| `src/lib/server/agents/schemas/landing-page-input.ts`                 | Zod schema for generation input                     | `landingPageGenerationInputSchema`                                                                   | Campaign/ad package/ad group/assets shape                           |
| `src/lib/server/agents/schemas/landing-page-plan.ts`                  | Zod schema for strategist output                    | `landingPagePlanSchema`, `validateLandingPagePlanSections`                                           | Enforces required assetPlan parts by selected sections              |
| `src/lib/page-builder/page/schema.ts`                                 | Final document schema                               | `landingPageDocumentSchema`                                                                          | `version: 1`, `title`, optional `slug`, `sections`                  |
| `src/lib/page-builder/sections/schema.ts`                             | Section contracts                                   | section props + discriminated union schemas                                                          | Runtime validation boundary for rendering data                      |
| `src/lib/page-builder/sections/specs.ts`                              | Section guidance metadata                           | `sectionSpecs`                                                                                       | Used by section catalog + prompts                                   |
| `src/lib/server/agents/section-eligibility.ts`                        | Allowed/required section gating                     | `getSectionEligibility`                                                                              | Current required list is fixed to 10 section types                  |
| `src/lib/server/agents/section-catalog.ts`                            | Prompt-facing catalog from specs                    | `buildSectionCatalog`                                                                                | Infers required prop keys from schema parse failures                |
| `src/routes/(app)/campaigns/[id]/landing-page/+page.server.ts`        | Preview route actions                               | `retryGeneration`, `editPage`, `setLogos`, `setKeynotes`, `restoreVersion`                           | Manual retry, AI edit, version restore                              |
| `src/routes/(app)/campaigns/[id]/landing-page/landing-page.remote.ts` | Preview query data loader                           | `getLandingPagePreview`                                                                              | Returns selected page + version history + picker datasets           |
| `src/lib/components/campaign/LandingPageSettingsRail.svelte`          | UI controls for edits/regeneration/history          | forms to actions above                                                                               | Restricts AI edit to latest renderable version                      |
| `src/lib/components/page-renderer/PageRenderer.svelte`                | Dynamic section rendering                           | section lookup via `sectionRegistry`                                                                 | Unsupported sections show fallback text block                       |
| `src/lib/page-builder/sections/registry.ts`                           | Type->component mapping                             | `sectionRegistry`, `sectionComponentRegistry`                                                        | Rendering contract for all section types                            |
| `src/routes/(app)/campaigns/[id]/campaign-status.remote.ts`           | Publish/archive remote                              | `publishCampaign`                                                                                    | Resolves published slug; updates `campaign_pages` + campaign status |
| `src/routes/speaker/[slug]/+page.server.ts`                           | Public live landing load                            | page query by slug + published flags                                                                 | Requires both page published and campaign status published          |
| `src/lib/server/db/schema.ts`                                         | DB table definitions                                | `campaign_pages`, `campaign_ad_packages`, `campaign_ad_groups`, `generation_jobs`, etc.              | `generation_jobs` defined but not used by landing pipeline code     |

## 4. Data Structures and Schemas

### Core final page JSON

Defined by `landingPageDocumentSchema` in `src/lib/page-builder/page/schema.ts`:

```ts
{
  version: 1,
  title: string,
  slug?: string,
  sections: PageSection[]
}
```

`sections` is a discriminated union (`type`) from `src/lib/page-builder/sections/schema.ts`, including:

- `seo`
- `immediate_authority_hero`
- `hero_large_email_cta`
- `booklet_download_cta`
- `logos_of_trust_ribbon`
- `youtube_grid`
- `keynote_speeches`
- `speaker_in_action`
- `hybrid_content_section`
- `proof_of_performance`
- `frictionless_funnel_booking`
- `compliance_transparency_footer`

### Generation input (`LandingPageGenerationInput`)

From `src/lib/server/agents/schemas/landing-page-input.ts`:

- `campaign`: id, name, audience, format, topic, language, geography, notes
- `adPackage`: id, targetingSummary, messagingAngle, conversionGoal
- `adGroup`: id, name, intentSummary, optional landingPageAngle, keywords, ads
- `assets`: from `landingPageAssetsSchema` (defaults + fixed content + catalogs)

### Strategist output (`LandingPagePlan`)

From `src/lib/server/agents/schemas/landing-page-plan.ts`:

- `pageTitle`, `conversionGoal`, `messagingAngle`
- `sectionPlan[]` entries: `type`, `purpose`, `contentDirection`
- optional `assetPlan` subobjects (`hero`, `hybridContentSection`, `speakerInAction`, `logosOfTrustRibbon`, `keynoteSpeeches`)
- refinements enforce required asset selections if corresponding sections are selected.

### Asset schemas

From `src/lib/server/agents/schemas/landing-page-assets.ts`:

- defaults: hero/booking/compliance
- fixed: logos ribbon + proof testimonials
- catalog arrays: hero videos/images, hybrid images, speaker videos, logos, keynotes

### DB record shapes used in flow

- `campaign_pages`: versioned page JSON + slug + publication flags + change notes
- `campaign_ad_groups`: contains active `campaign_page_id` pointer
- `campaign_ad_packages`: versioned strategy source for input normalization
- `campaigns`: status gate for editing/publishing

## 5. Prompt and LLM Flow

### Prompt locations

- `src/lib/server/agents/prompts/landing-page.ts` (strategist + writer prompts)
- editor prompts are inline in `src/lib/server/agents/landing-page-editor.ts`

### Provider/client

- `callOpenRouter` in `src/lib/server/openrouter/client.ts`
- Uses `OPENROUTER_API_KEY`
- JSON response format requested for planner/writer/editor
- Retry behavior:
  - max attempts: 3
  - retryable: parse errors, abort/network-ish errors, HTTP 429/5xx listed statuses
  - fallback models: configured for `google/gemini-3.1-flash-lite-preview` -> `google/gemini-2.5-flash`

### Generation steps

1. **Strategist** (`generateLandingPagePlan`)
   - model call via OpenRouter
   - validates with `landingPagePlanSchema`
   - on failure, one repair call with validation issues embedded
   - extra section eligibility validation via `validateLandingPagePlanSections`
2. **Writer** (`generateLandingPageDocument`)
   - model call via OpenRouter
   - output normalized/hydrated (assets + required section completion + SEO enforcement + ordering)
   - schema validation + MVP validation checks
   - one repair call if schema/MVP checks fail
   - throws if still invalid after repair
3. **Editor** (`runLandingPageEditFromPrompt`)
   - prompt receives current page + approved hero/hybrid media sets
   - validates against `landingPageDocumentSchema` then `validateEditedPageGuardrails`
   - one repair pass on validation failure
   - guardrails enforce required sections and approved-media-only edits

### Prompt guidance augmentation

- `resolvePromptGuidanceForCampaign` is used in strategist/writer to append prompt library guidance when available (with tracing).

### Error handling boundaries

- pipeline/action functions catch and return failures at route-action level
- low-level LLM and validation errors throw with detailed messages
- preview loader uses `safeParseLandingPageDocument`; render can fail gracefully with `canRenderPage=false`

## 6. Database Persistence

### Primary write path (initial generation)

In `runLandingPageGenerationForCampaign` transaction:

1. Insert new row into `campaign_pages` via `persistGeneratedLandingPage`
   - increments `version_number`
   - slug format: `slugify(page.slug ?? page.title)-c{campaignId}-v{version}`
   - sets `is_published=false`, `published_at=null`
   - optional `change_note` (e.g., `Initial generation`)
2. Update `campaign_ad_groups.campaign_page_id` for generated ad group via `attachLandingPageToAdGroup`

### Editing/versioning

- AI edit (`editPage`) persists as a **new** `campaign_pages` version, change note prefixed with `AI edit: ...`
- Restore version action clones selected older JSON into a **new latest version** with change note `Restored from vX`
- Logo/keynote picker actions also persist as new versions (`Updated trust logos`, `Updated keynotes`)
- Inline section edits often start a new “Inline edit session” version, then mutate same version in place for subsequent edits in that session

### Publish/draft/archive behavior

- Publish remote (`publishCampaign`) unpublishes all campaign pages, marks one selected/latest as published, sets/keeps slug, stamps `published_at`
- Updates latest ad package ad groups to selected published page
- Campaign status updated via `setCampaignStatus` (`published` or `archived`)
- Public route requires:
  - `campaign_pages.is_published = true`
  - `campaigns.status = 'published'`

### `generation_jobs`

- Table exists in schema (`src/lib/server/db/schema.ts`) but no landing-page pipeline reads/writes found in current code.

## 7. Rendering Flow

### Preview rendering

- Route: `src/routes/(app)/campaigns/[id]/landing-page/+page.svelte`
- Data comes from remote query `getLandingPagePreview`
- Renders with `PageRenderer` when selected version parses successfully
- If parse fails, UI shows non-renderable warning and allows switching/retrying

### Live rendering

- Route: `src/routes/speaker/[slug]/+page.server.ts` loads published page row by slug
- Parses JSON with `parseLandingPageDocument`
- Route component `src/routes/speaker/[slug]/+page.svelte` passes page to `PageRenderer`

### Dynamic section renderer

- `PageRenderer.svelte` iterates sections, resolves component via `sectionRegistry`
- For `hybrid_content_section` and `keynote_speeches`, passes extra `disableScrollReveal`
- Missing registry entry => renders fallback text: `Unsupported section: ...`

### Missing/invalid sections

- Hard invalid page JSON is blocked at parse points (`parseLandingPageDocument`) except preview loader, which uses safe parse and degrades gracefully
- Unsupported-but-typed section type at runtime unlikely unless registry/schema drift occurs

### URL resolution

- Live URL is consistently built as `${origin}/speaker/${publishedSlug}` in campaign layout/detail loads
- No separate staging URL mechanism found for landing pages in inspected flow

## 8. Editing / Regeneration Flow

### Full regeneration

- Manual retry action `?/retryGeneration` in landing preview page server action
- Strategy update action on campaign detail (`?/updateStrategy`) triggers ads regeneration + landing regeneration

### AI-assisted full-page edit

- Action `?/editPage` in landing preview
- Guardrails:
  - only latest version
  - only when campaign is not published
  - requires non-empty prompt

### Manual non-AI edits

- Forms:
  - `?/setLogos` updates `logos_of_trust_ribbon`
  - `?/setKeynotes` updates `keynote_speeches`
  - `?/restoreVersion` clones selected version to latest
- Section-level inline remotes (AI not involved):
  - `ImmediateAuthorityHeroInlineEdit.remote.ts`
  - `HybridContentSectionInlineEdit.remote.ts`
  - `ProofOfPerformanceInlineEdit.remote.ts`
  - `BookletDownloadCtaInlineEdit.remote.ts`
  - `FrictionlessFunnelInlineEdit.remote.ts`
  - `KeynoteSpeechesInlineEdit.remote.ts`
- Inline edits are “surgical” at field level, gated by auth + campaign/page state checks.

### Save semantics

- Most edits create new `campaign_pages` versions through `persistGeneratedLandingPage`
- Inline edit session optimization may update same page row after session creation

## 9. Coupling, Duplication, and Fragile Areas

- Section requirements are encoded in multiple places:
  - `section-eligibility.ts` required list
  - writer `requiredMvpSectionOrder`
  - prompt text rules in `prompts/landing-page.ts`
  - plan schema refinements
- Publish logic is duplicated:
  - `campaign-status.remote.ts`
  - similar logic in `src/routes/(app)/campaigns/[id]/ads/+page.server.ts`
- Editor/writer normalize legacy aliases and legacy hybrid structures independently from core page parser normalization.
- `landing-page-writer.ts` is large and mixes concerns (prompting, hydration, ordering, fallback generation, validation), making behavior coupling dense.
- “required” semantics are strict and can throw at eligibility stage if any mandatory section has insufficient assets.
- Fallback handling is extensive and spread across writer + assets store + preview behavior, with implicit precedence chains.
- Ad-group link updates happen in multiple flows (initial generation, strategy regeneration, restore/publish, AI edits), increasing cross-module coupling.
- `generation_jobs` table exists but is not wired into this pipeline, while pipeline progress events exist for campaign creation flow.
- Model name tracing and actual call model differ in spots (trace logs `...preview` while call sometimes uses non-preview variant).

## 10. Open Questions

1. Is the current requirement that **all 10 MVP sections** must always exist intentional long-term, or temporary?
2. Should `generation_jobs` be authoritative for landing page pipeline status, or is it intentionally unused right now?
3. Is the duplicate publish logic in ads and campaign-status flows intentional for route independence, or accidental drift?
4. For inline edit sessions, is “update-in-place after first session version” intended audit behavior?
5. Should live URL slug stability across republish/version restores remain coupled to existing published slug reuse behavior?
6. Is there a planned staging preview URL mode separate from `/campaigns/[id]/landing-page` and `/speaker/[slug]`?
7. Are `speaker_in_action` and `youtube_grid` both intended active section types, or is one legacy in this pipeline?
8. Is model selection inconsistency (`...flash-lite` vs `...flash-lite-preview`) deliberate per stage or an artifact?
