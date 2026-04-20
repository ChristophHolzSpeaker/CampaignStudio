---
name: extend-section-asset-selection
description: Extend Campaign Studio sections with curated media library support (ID-based AI selection, server-side resolution, safe fallback).
license: MIT
metadata:
  author: Christoph Engineering
  version: '1.0.0'
  organization: Christoph
  date: April 2026
  abstract: Workflow for adding AI-selectable media to new or existing sections while preserving controlled schema-driven rendering, validation, and safety constraints.
---

# Extend Section Asset Selection

Use this skill when a section needs AI-selected media (images/videos) from the approved asset library.

## Goal

Add media selection in a way that is:

- curated and allowlisted
- ID-based (never freeform URLs from AI)
- schema-validated end-to-end
- safe with deterministic fallback
- compatible with Campaign Studio's controlled renderer architecture

## Core Rules (Non-Negotiable)

- AI selects `assetId` values only.
- AI must select from `input.assets.assetCatalog` only.
- Server resolves IDs to URLs/alts/captions.
- If ID is invalid/missing, use fallback defaults.
- Never trust model-provided media URLs directly.
- Preserve existing section behavior if no asset plan is provided.

## Files to Update

- `src/lib/server/db/schema.ts`
- `supabase/migrations/*.sql`
- `src/lib/server/agents/schemas/landing-page-assets.ts`
- `src/lib/server/agents/schemas/landing-page-plan.ts`
- `src/lib/server/agents/config/landing-page-assets-store.ts`
- `src/lib/server/agents/prompts/landing-page.ts`
- `src/lib/server/agents/landing-page-strategist.ts`
- `src/lib/server/agents/landing-page-writer.ts`
- optional section schema/types:
  - `src/lib/page-builder/sections/types.ts`
  - `src/lib/page-builder/sections/schema.ts`
  - `src/lib/page-builder/sections/specs.ts`

## Required Workflow

1. Define section media contract

- Decide whether section uses:
  - single asset (`hero.videoAssetId`)
  - multiple assets (`supportingImageAssetIds[]`)
- Update section props types/schema if needed.

2. Extend planning contract

- Add/extend `assetPlan` in `landing-page-plan` schema.
- Add conditional validation:
  - if section exists in `sectionPlan`, required asset selection fields must exist.

3. Ensure catalog availability

- Extend `landing-page-assets` schema catalog for the new section media options.
- Update asset loader to map active `media_assets` rows into the new catalog slice.

4. Update prompts

- Strategist prompt must require ID selection for the section.
- Writer prompt must require resolving from catalog IDs only.
- Add explicit "never invent IDs/URLs" rule.

5. Apply server-side resolution

- In writer hydration, resolve selected IDs to real media fields.
- Inject resolved media into section props.
- Log and fallback if selection is invalid.

6. Seed and migrate

- Add migration for new media metadata if needed.
- Seed representative assets with tags and section compatibility.

## Validation Checklist

- AI output contains only approved asset IDs.
- Invalid IDs do not break rendering (fallback works).
- Section renders correctly with resolved media.
- No raw model URL usage path exists.
- Zod schemas pass for assets, plan, and page document.

Run after changes:

```bash
pnpm run format
pnpm run check
pnpm run build
```

## Guardrails

- Do not introduce arbitrary HTML rendering.
- Do not bypass schema validation.
- Do not add section media fields without corresponding Zod + type updates.
- Prefer minimal, explicit contracts over generic plugin abstractions.
