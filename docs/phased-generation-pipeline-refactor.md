# Campaign Studio — Agentic Landing Page Architecture Rollout

## Objective

Evolve the current structured landing page generation system into a more stable, explainable, and conversational AI-native campaign workflow without rewriting the existing rendering architecture.

Goals:

- Preserve structured page rendering and versioning
- Reduce orchestration fragility and duplicated rules
- Improve first-pass generation quality
- Introduce explicit agent stages and intermediate artifacts
- Move from full-page regeneration toward patch/operation-based editing
- Improve perceived immediacy and “Claude-like” interaction without abandoning schema safety

---

# Phase 0 — Stabilization & Boundaries

## Goal

Stabilize the current system before introducing additional AI orchestration complexity.

## Tasks

### 0.1 Declare Current Phase 1 Feature Complete

- Freeze major new landing page feature additions
- Only fix:
  - rendering bugs
  - validation issues
  - critical publish/versioning bugs

- Define current MVP behavior as baseline

### 0.2 Create Architecture Notes

Create:

- `LANDING_PIPELINE_ARCHITECTURE.md`
- `LANDING_PIPELINE_FUTURE_DIRECTION.md`

Document:

- current generation flow
- current editing flow
- known coupling/duplication
- proposed agentic direction

### 0.3 Add Pipeline Tracing

Add structured logs/tracing for:

- strategist output
- writer output
- hydration changes
- validation failures
- repair pass triggers
- publish/relink actions

Do not change behavior yet.

---

# Phase 1 — Canonical Section Definition System

## Goal

Remove duplicated “truths” across prompts, schemas, eligibility, and editor guardrails.

## Tasks

### 1.1 Create `SectionDefinition`

Create a canonical section definition system.

Example shape:

```ts
type SectionDefinition = {
	type: string;
	displayName: string;
	capabilities: string[];

	schema: ZodSchema;
	component: SvelteComponent;

	generation: {
		allowed: boolean;
		required?: boolean;
		fallbackStrategy?: string;
	};

	editing: {
		editableFields: string[];
		layoutOptions?: string[];
	};

	media: {
		allowedAssetTypes: string[];
		minRequired?: number;
	};

	layout: {
		supportedVariants?: string[];
	};
};
```

### 1.2 Refactor Existing Sources

Refactor:

- `sections/specs.ts`
- `section-eligibility.ts`
- prompt generation helpers
- editor guardrails

to derive from `SectionDefinition`.

### 1.3 Remove Hardcoded Required Section Lists

Remove duplicated:

- `requiredSectionTypes`
- `requiredMvpSectionOrder`

Replace with:

- required capabilities
- optional preferred layouts/order

Example:

- authority
- outcomes
- proof
- CTA
- compliance

### 1.4 Add Capability Resolver

Build utility:

```ts
resolvePageCapabilities(page);
```

Used by:

- generation validation
- editor validation
- publish validation

---

# Phase 2 — Writer Decomposition

## Goal

Reduce hidden orchestration complexity and isolate responsibilities.

## Tasks

### 2.1 Extract LLM Orchestration

Move:

- model call
- retry
- repair pass

into:

- `landing-page-generation-runner.ts`

### 2.2 Extract Hydration Pipeline

Move:

- asset resolution
- fallback insertion
- legacy normalization
- SEO injection

into:

- `landing-page-hydration.ts`

Ensure:

- pure deterministic functions where possible

### 2.3 Extract MVP/Policy Validation

Move:

- required checks
- ordering checks
- capability checks

into:

- `landing-page-policy.ts`

### 2.4 Preserve Existing Public API

Keep:

- `generateLandingPageDocument(...)`

stable during refactor.

No behavior changes yet.

---

# Phase 3 — Intermediate Artifacts & Explicit Agent Stages

## Goal

Make generation explainable, inspectable, and easier to evolve.

## Tasks

### 3.1 Introduce Typed Intermediate Artifacts

Create:

- `LandingStrategy`
- `LandingPageArchitecture`
- `LandingMediaPlan`
- `LandingCritique`

### 3.2 Persist or Trace Artifacts

Initially:

- save to traces/logs only
- no DB migration required yet

Later:

- optionally persist to `generation_jobs`

### 3.3 Introduce Explicit Agent Stages

## Stage 1 — Strategy Agent

Responsible for:

- positioning
- messaging angle
- emotional direction
- CTA strategy

## Stage 2 — Page Architect Agent

Responsible for:

- section selection
- ordering
- pacing
- layout choices

## Stage 3 — Content Agent

Responsible for:

- copywriting only

## Stage 4 — Media Agent

Responsible for:

- selecting media asset IDs only

## Stage 5 — Critic Agent

Responsible for:

- critique
- redundancy detection
- CTA weakness
- tone mismatch
- visual imbalance

## Stage 6 — Deterministic Assembler

NO AI.

Responsible for:

- combining artifacts
- enforcing schema
- final document assembly

### 3.4 Add Critique/Revision Pass

Before final persist:

- critique assembled page
- optionally revise content/layout recommendations

---

# Phase 4 — Conversational Editing Foundation

## Goal

Move from full-page rewrites toward safe patch-based editing.

## Tasks

### 4.1 Introduce Operation/Patch Model

Replace:

- “LLM returns full page JSON”

With:

- “LLM returns edit operations”

Example:

```ts
type LandingPageOperation =
	| UpdateSectionContentOperation
	| UpdateSectionLayoutOperation
	| ReplaceMediaOperation
	| ReorderSectionOperation;
```

### 4.2 Build Patch Executor

Create deterministic executor:

```ts
applyLandingPageOperations(page, operations);
```

### 4.3 Reuse Existing Validation

After patch application:

- run schema validation
- run policy validation
- run editor guardrails

### 4.4 Preserve Existing Persistence Flow

Continue using:

- `persistGeneratedLandingPage(...)`

for all AI-generated edits.

---

# Phase 5 — Claude-Like Editing UX

## Goal

Improve perceived immediacy and control without abandoning structure.

## Tasks

### 5.1 Add Layout Variants

Expand existing layout support.

Initial supported controls:

- image left/right
- compact/spacious
- text alignment
- proof placement
- CTA emphasis
- visual tone

### 5.2 Add AI Editing Commands

Supported prompts:

- “Move the image left”
- “Make this more executive”
- “Shorten this section”
- “Use a stronger keynote image”
- “Make the hero more compact”

### 5.3 Add Media Selection Tools

Expose:

- asset IDs
- descriptions
- tags
- usage metadata

Agent chooses IDs only.

Server validates before persist.

### 5.4 Add Change Summary/Diff

Before save:

- summarize changes
- show impacted sections
- show media changes
- show layout changes

### 5.5 Add Preview Workflow

Flow:

1. Generate operations
2. Apply patch
3. Validate
4. Preview diff
5. Accept/reject
6. Persist version

---

# Phase 6 — Inline Editing Refactor

## Goal

Reduce duplicated remote logic and unify editing behavior.

## Tasks

### 6.1 Create Shared Editable Context Loader

Extract:

- auth checks
- campaign checks
- publish checks
- latest-version checks

into:

- `loadEditablePageContext(...)`

### 6.2 Create Shared Inline Session Manager

Extract:

- create/update inline session
- version behavior
- change notes

into:

- `saveAsInlineSessionOrUpdate(...)`

### 6.3 Create Shared Patch Helpers

Create:

```ts
applySectionPatch(...)
```

Used by:

- all inline remotes
- future conversational patch editing

---

# Phase 7 — Generation Jobs & Observability

## Goal

Introduce orchestration visibility and future async workflow support.

## Tasks

### 7.1 Wire `generation_jobs`

Track:

- strategy generation
- architecture generation
- content generation
- media selection
- critique
- final assembly
- edit operations

### 7.2 Add Job Status UI

Show:

- running stage
- failures
- retries
- critique notes
- validation warnings

### 7.3 Add Metrics

Track:

- generation failures
- repair frequency
- validation failure types
- edit operation frequency
- most common user edit requests

---

# Immediate High-ROI Wins

## Priority 1

- Add change summary + diff preview
- Add layout variants for hero/hybrid sections
- Add conversational “move image left/right”

## Priority 2

- Extract writer responsibilities
- Introduce patch-based editing

## Priority 3

- Introduce critic pass
- Add intermediate artifacts

---

# Explicit Non-Goals (For Now)

Do NOT build yet:

- arbitrary raw HTML editing
- freeform drag/drop page builder
- unrestricted DOM manipulation
- autonomous visual redesign engine
- arbitrary CSS generation
- Webflow/Figma replacement
- multi-page autonomous campaign orchestration

The system should remain:

- schema-driven
- versioned
- deterministic at render layer
- campaign-aware
- validation-first

---

# Success Criteria

The rollout is successful if:

- first-pass landing pages require fewer manual edits
- editing feels conversational and immediate
- section/layout changes feel flexible
- orchestration becomes easier to reason about
- duplicated rules are reduced
- validation becomes more deterministic
- AI editing preserves campaign safety and structure
- users feel “agency” without unrestricted chaos
