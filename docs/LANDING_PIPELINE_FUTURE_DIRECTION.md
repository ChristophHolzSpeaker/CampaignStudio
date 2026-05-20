# Landing Pipeline Future Direction

## Intent

Evolve the landing pipeline into an explicit, inspectable, agentic workflow while preserving:

- schema-driven rendering
- strict validation boundaries
- versioned persistence
- deterministic server-side assembly

## Direction of Travel

1. Stabilize current behavior and improve observability.
2. Remove duplicated section truths through canonical section definitions.
3. Decompose writer responsibilities into orchestration, hydration, and policy modules.
4. Introduce explicit intermediate artifacts and agent stages.
5. Move edits from full-document rewrites toward operation/patch execution.
6. Improve conversational editing UX while preserving safety.

## Target Agentic Shape

Planned generation responsibilities:

- Strategy Agent: positioning, messaging angle, CTA strategy.
- Page Architect Agent: section selection/order/layout pacing.
- Content Agent: copy generation only.
- Media Agent: approved asset ID selection only.
- Critic Agent: critique and revision recommendations.
- Deterministic Assembler: non-AI final composition + schema enforcement.

## Architecture Boundaries to Preserve

- Never render arbitrary AI HTML.
- Never bypass schema validation prior to persistence.
- Never introduce unvalidated fields or unsupported section contracts.
- Keep public rendering deterministic through registry-backed components.

## Editing End State

Editing should transition to operation-based mutation:

- AI returns typed operations, not full page JSON rewrites.
- server applies operations deterministically.
- existing schema/policy/guardrail checks run after patch execution.
- persistence remains versioned and campaign-aware.

## Observability Expectations

Each stage should be traceable with structured events for:

- inputs and outputs
- validation and repair decisions
- publish/relink side effects
- stage-level timing and failure causes

This provides explainability now and enables future `generation_jobs` integration.
