# AGENTS.md

This file defines how agentic coding agents should operate in this repository.

---

# 🧠 System Overview

This is a **schema-driven AI page generation MVP** built with:

- SvelteKit (Svelte 5, runes mode)
- Supabase (Postgres + local dev)
- Drizzle ORM (schema + queries)
- OpenRouter (LLM generation pipeline)

---

# 🎯 Core Concept

The system works as:

1. User prompt → generates marketing content (LLM 1)
2. Content → structured JSON layout (LLM 2)
3. JSON → stored in DB
4. JSON → rendered via predefined components
5. Users can prompt updates → JSON is surgically modified and persisted

Agents must preserve this architecture at all times.

---

# 🧭 Decision Priority (CRITICAL)

When making decisions, always prioritize:

1. **SRS** → what must be built (`docs/SRS.md`)
2. **AGENTS rules** → how it must be built
3. **DESIGN system** → how it should look (`docs/DESIGN.md`)

If conflicts arise:

- Do NOT expand scope beyond SRS
- Do NOT violate system architecture
- Adapt design within constraints

---

# 📁 Project Structure

- `src/routes/` — SvelteKit routes (+page, +page.server, APIs)
- `src/lib/` — shared code
- `src/lib/server/` — server-only logic (DB, AI, validation)
- `supabase/` — Supabase project (migrations, config)
- `drizzle/` — schema and migration definitions

---

# ⚙️ Skills Usage (MANDATORY)

This project uses OpenCode skills.

Agents MUST:

## Svelte Skill
Use for:
- components
- routes
- rendering logic
- load functions
- form actions

## Supabase Skill
Use for:
- database schema
- migrations
- local Supabase setup
- edge functions
- auth / RLS (future)

## General Rule

Before implementing framework-specific logic:

- Check for a relevant skill
- Use the skill instead of inventing patterns

Do NOT:

- invent Supabase patterns manually
- bypass SvelteKit conventions
- introduce custom architectures unnecessarily

---

# 🗄 Database Architecture

- Supabase = Postgres provider
- Drizzle = schema + query layer

Rules:

- Drizzle schema is the **single source of truth**
- Migrations must remain consistent
- Do NOT mix raw SQL and Drizzle unless necessary
- Do NOT create schema directly in Supabase without intent

---

# 🤖 AI / LLM Architecture

The system uses a **multi-step generation pipeline**:

## Step 1 — Content Generation
- Model: lightweight (e.g. Gemini Flash)
- Output: structured marketing content

## Step 2 — JSON Layout Generation
- Model: structured model (e.g. Nemotron)
- Output: strict JSON schema

## Step 3 — Mutation (Edits)
- Input:
  - existing JSON
  - user instruction
- Output:
  - updated JSON
- Must be **surgical (minimal diff)**

---

# 🔒 AI Rules (CRITICAL)

- NEVER return invalid JSON
- ALWAYS follow schema exactly
- NEVER invent fields
- NEVER output UI code
- ONLY output structured JSON

All AI output must:

- be validated before saving
- be safe to render
- be deterministic in structure

---

# 🧱 Rendering System

- Pages are rendered from JSON
- Components are predefined
- No arbitrary HTML rendering

Rules:

- DO NOT use `{@html}`
- DO NOT generate raw HTML from AI
- ALWAYS map JSON → components

---

# ✏️ Mutation System

When updating pages:

- Modify ONLY what is requested
- Preserve structure and IDs
- Do NOT regenerate full pages unless explicitly asked
- Maintain layout stability unless instructed otherwise

---

# 🎨 Design System

The visual system is defined in:

→ `docs/DESIGN.md`

Agents MUST:

- follow layout, spacing, and typography rules
- respect visual hierarchy and asymmetry principles
- prefer design system over generic Tailwind defaults

Do NOT:

- introduce conflicting visual styles
- default to generic SaaS UI patterns

---

# 📦 Product Specification (SRS)

Defined in:

→ `docs/SRS.md`

Agents MUST:

- stay within MVP scope
- avoid over-engineering
- prioritize working features over extensibility

If unsure:

→ choose the simplest implementation that satisfies the SRS

---

# ⚙️ Development Rules

- Prefer minimal changes over rewrites
- Read existing code before editing
- Follow existing patterns

After changes ALWAYS run:

```bash
pnpm run format
pnpm run check
pnpm run build
````

---

# 🎯 SvelteKit Conventions

* Use runes (`$state`, `$derived`, `$props`)
* Prefer server load functions
* Prefer form actions over custom APIs
* Keep AI calls server-side only

---

# 🔐 Security

* Never expose API keys to client
* Use `$env/dynamic/private`
* Validate all inputs
* Treat AI output as untrusted until validated

---

# 📏 Code Style

* TypeScript strict mode
* No `any`
* Use explicit types
* Use `$lib` imports (avoid deep relative paths)

---

# 🚫 Anti-Patterns

Agents MUST NOT:

* regenerate full pages unnecessarily
* bypass schema validation
* mix client/server logic incorrectly
* introduce new architecture without justification
* store unvalidated AI output

---

# 🧪 Testing (Future)

Testing is not yet implemented.

If adding tests:

* use Vitest
* colocate tests or use `/tests`

---

# 🧭 Agent Workflow

When given a task:

1. Understand the request
2. Inspect existing code
3. Identify relevant skill(s)
4. Propose minimal change
5. Implement cleanly
6. Validate (typecheck + build)

---

# 🧩 Guiding Principle

This is a **controlled AI system**, not a freeform generator.

Always prioritize:

* structure over creativity
* safety over flexibility
* consistency over speed

---

# 📌 Summary

* Use skills
* Respect schema
* Keep changes minimal
* Keep AI controlled
* Follow SvelteKit + Supabase best practices
