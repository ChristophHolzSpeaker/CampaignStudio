---
name: extend-section-registry
description: Extend the Christoph section library by adding a new typed section contract, schema, metadata spec, component, and registry wiring.
license: MIT
metadata:
  author: Christoph Engineering
  version: '1.0.0'
  organization: Christoph
  date: January 2026
  abstract: Practical workflow for safely adding new page-builder sections in Campaign Studio while preserving schema-driven rendering and controlled AI contracts.
---

# Extend Section Registry

Use this skill when adding a new landing-page section to the controlled Christoph section system.

If the section includes AI-selectable media, also use `extend-section-asset-selection`.

## Goal

Add one new section in a way that is:

- strongly typed
- Zod-validated
- discoverable by AI and editors via usage metadata
- renderable through the registry
- exported for application use

## Current Registry Structure

- `src/lib/page-builder/sections/types.ts`
  - section type literals
  - prop interfaces
  - section/spec shared TypeScript contracts
- `src/lib/page-builder/sections/schema.ts`
  - per-section `props` Zod schemas
  - per-section `{ type, props }` schemas
  - `pageSectionSchema` discriminated union by `type`
- `src/lib/page-builder/sections/specs.ts`
  - usage contract metadata per section:
    - `label`
    - `description`
    - `whenToUse`
    - `whenNotToUse`
    - `contentGuidance`
    - `propsSchema`
- `src/lib/page-builder/sections/registry.ts`
  - `sectionComponentRegistry` (`type -> Svelte component`)
  - `sectionRegistry` (`type -> full spec + component`)
  - helpers: `getSectionSpec`, `getSectionComponent`, `getSectionRegistryEntry`
- `src/lib/page-builder/sections/index.ts`
  - central exports for schema/types/specs/registry

## Required Workflow

1. Add the new section type and props contract in `src/lib/page-builder/sections/types.ts`.
2. Add the new section `props` Zod schema and section schema in `src/lib/page-builder/sections/schema.ts`.
3. Add metadata guidance in `src/lib/page-builder/sections/specs.ts`.
4. Add a Svelte component in `src/lib/components/page-sections/`.
   - If visuals are not requested, keep it a minimal placeholder stub.
5. Register the component and spec in `src/lib/page-builder/sections/registry.ts`.
6. Export all new contracts and schemas in `src/lib/page-builder/sections/index.ts`.

## Validation Checklist

- New section is included in the discriminated union.
- New section appears in both component and spec registries.
- Types and schemas stay aligned (`props` shape matches exactly).
- No `{@html}` usage.
- No arbitrary component injection.

Run after changes:

```bash
pnpm run format
pnpm run check
pnpm run build
```

## Guardrails

- Keep contracts explicit; avoid generic plugin abstractions.
- Prefer semantic field names over presentational names.
- Do not invent unsupported fields in section schemas.
- Preserve the controlled, predefined-component architecture.
