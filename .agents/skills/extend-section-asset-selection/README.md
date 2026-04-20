# Extend Section Asset Selection - Contributor Guide

This skill helps agents add AI-selectable media to landing page sections safely and consistently.

## Quick Start

1. Read `SKILL.md` first.
2. Decide the section media contract:
   - one asset ID (for example `videoAssetId`)
   - many asset IDs (for example `supportingImageAssetIds`)
3. Update schemas, prompts, and writer hydration using the workflow in `SKILL.md`.
4. Run validation:

```bash
pnpm run format
pnpm run check
pnpm run build
```

## Core Pattern

- AI selects IDs only.
- IDs must come from `input.assets.assetCatalog`.
- Server resolves IDs into URLs/alts/captions.
- Invalid or missing IDs trigger deterministic fallback.

## Typical Files Touched

- `src/lib/server/agents/schemas/landing-page-assets.ts`
- `src/lib/server/agents/schemas/landing-page-plan.ts`
- `src/lib/server/agents/config/landing-page-assets-store.ts`
- `src/lib/server/agents/prompts/landing-page.ts`
- `src/lib/server/agents/landing-page-strategist.ts`
- `src/lib/server/agents/landing-page-writer.ts`
- `src/lib/server/db/schema.ts`
- `supabase/migrations/*.sql`

## Example Shapes

Plan-level selection:

```json
{
	"assetPlan": {
		"hero": {
			"videoAssetId": "hero-executive-stage-ai-strategy-v1",
			"rationale": "Best match for enterprise AI strategy intent"
		},
		"hybridContentSection": {
			"supportingImageAssetIds": ["hybrid-ai-roadmap-visual-v1"],
			"rationale": "Supports phased implementation narrative"
		}
	}
}
```

Catalog option:

```json
{
	"id": "hero-executive-stage-ai-strategy-v1",
	"title": "Executive keynote stage reel",
	"description": "High-authority keynote footage",
	"usageNotes": "Use for strategic executive audiences",
	"videoEmbedUrl": "https://www.youtube.com/watch?v=...",
	"videoThumbnailUrl": "https://...",
	"videoThumbnailAlt": "Christoph speaking on stage"
}
```

## Guardrails Checklist

- No model-supplied raw media URLs in final render path.
- Section selection fields have schema validation.
- Missing catalog data does not break generation.
- Fallback path remains deterministic and safe.
