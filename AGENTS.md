# AGENTS.md

This file provides guidelines for agentic coding agents working in the CampaignStudio repository. It covers build, lint, test commands, and code style conventions to ensure consistency and efficiency.

## Project Overview

CampaignStudio is a web application built with SvelteKit (Svelte 5), TypeScript, Vite, Tailwind CSS, Drizzle ORM for PostgreSQL, and Better Auth for authentication. The project uses Prettier for formatting and Svelte-check for type checking. No ESLint is configured. Testing is not set up yet; agents should suggest adding Vitest if needed.

The codebase follows SvelteKit conventions with server-side rendering, API routes, and hooks. Key directories:

- `src/routes/`: Page routes and API endpoints.
- `src/lib/`: Shared utilities, components, and server logic.
- `src/lib/server/`: Server-only code (e.g., DB, auth).

No Cursor rules (.cursor/rules/ or .cursorrules) or Copilot instructions (.github/copilot-instructions.md) are present. Follow standard SvelteKit and TypeScript best practices. Use Svelte 5 runes mode for new code.

## Build, Lint, Test Commands

### Development and Build

- `pnpm run dev`: Starts the Vite development server with hot reloading. Use `pnpm run dev -- --open` to open in browser.
- `pnpm run build`: Builds the production version of the app using Vite. Outputs to `build/` directory.
- `pnpm run preview`: Previews the production build locally.

### Linting and Formatting

- `pnpm run lint`: Runs Prettier check on all files: `prettier --check .`. Ensures code matches formatting rules without fixing.
- `pnpm run format`: Auto-formats all files: `prettier --write .`. Run this after making changes.

Prettier is configured via `prettier.config.js` (if present) or defaults: 2-space indentation, single quotes, trailing commas, etc. Includes plugins for Svelte and Tailwind CSS.

### Type Checking

- `pnpm run check`: Syncs SvelteKit types and runs `svelte-check --tsconfig ./tsconfig.json`. Validates TypeScript and Svelte types.
- `pnpm run check:watch`: Runs type check in watch mode for development.

### Database Commands (Drizzle ORM)

- `pnpm run db:push`: Pushes schema changes to the database: `drizzle-kit push`.
- `pnpm run db:generate`: Generates migration files: `drizzle-kit generate`.
- `pnpm run db:migrate`: Applies migrations: `drizzle-kit migrate`.
- `pnpm run db:studio`: Opens Drizzle Studio for DB inspection: `drizzle-kit studio`.

Configure DB via environment variables (e.g., `DATABASE_URL` in `.env`).

### Authentication Commands (Better Auth)

- `pnpm run auth:schema`: Generates auth schema: `better-auth generate --config src/lib/server/auth.ts --output src/lib/server/db/auth.schema.ts --yes`.

### Testing

No test scripts or test files are currently configured in `package.json` or the codebase. To add testing:

1. Install Vitest: `pnpm install -D vitest @vitest/ui @sveltejs/vite-plugin-svelte @testing-library/svelte`.
2. Add to `package.json` scripts:
   ```
   "test": "vitest",
   "test:ui": "vitest --ui",
   "test:run": "vitest run"
   ```
3. Configure `vite.config.ts` to include Vitest plugin.
4. Create tests in `src/lib/tests/` or alongside components (e.g., `Component.test.ts`).

To run all tests: `pnpm run test`.

**Running a Single Test:**

- Use Vitest: `npx vitest src/lib/Component.test.ts` (run specific file).
- Or filter: `npx vitest --testNamePattern \"test name\"`.
- For watch mode: `npx vitest --watch src/lib/Component.test.ts`.

If Playwright is preferred for E2E: Install `pnpm install -D @playwright/test`, add script `"e2e": "playwright test"`, run single test with `npx playwright test tests/example.spec.ts`.

Agents: Before committing, suggest adding tests for new features. Run `pnpm run test` if configured.

### Other Scripts

- `pnpm run prepare`: Syncs SvelteKit dependencies: `svelte-kit sync`.

Always run `pnpm run format`, `pnpm run lint`, `pnpm run check` after changes. Use `pnpm run build` to verify production build.

## Code Style Guidelines

### General Conventions

- **Language**: TypeScript (strict mode enabled in tsconfig.json).
- **Framework**: SvelteKit with Svelte 5 runes mode. Use `$state`, `$derived`, `$props`, etc. Prefer server-side load functions for data fetching.
- **Indentation**: 2 spaces (Prettier default).
- **Semicolons**: Required (Prettier enforces).
- **Quotes**: Single quotes for strings (Prettier).
- **Trailing Commas**: Always (ES5 style).
- **Line Length**: 100 characters (if configured in Prettier; otherwise unlimited).
- **Comments**: Use JSDoc for functions/types. Avoid inline comments unless clarifying complex logic. No TODOs without assignee.

### Imports

- Use named imports over default where possible.
- Order imports consistently:
  1. Node.js built-ins (none in SvelteKit typically).
  2. Third-party libraries (e.g., `import { betterAuth } from 'better-auth/minimal';`).
  3. SvelteKit imports (e.g., `import { redirect } from '@sveltejs/kit';`).
  4. Local aliases (e.g., `import { auth } from '$lib/server/auth';`).
  5. Relative imports if needed (avoid; prefer $lib).

Examples from codebase:

```
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
```

- Use path aliases: `$lib` for src/lib, `$app` for SvelteKit modules.
- Avoid relative paths like `../../../lib`; refactor to use aliases.
- In Svelte files: `<script lang="ts">` for TS.

### Formatting

- Follow Prettier rules strictly. Run `pnpm run format` before commits.
- In Svelte: Use `<script>`, `<style>`, template sections cleanly.
- Tailwind: Classes in arbitrary order, but group logical (e.g., layout, colors, spacing).
- No custom CSS unless necessary; prefer Tailwind.

Example Svelte component structure:

```
<script lang="ts">
	import { onMount } from 'svelte';
	// imports
	let data: string = '';
</script>

<main class="p-4">
	<p>{data}</p>
</main>

<style>
	/* Scoped styles if needed */
</style>
```

### Types

- Enable strict TS: `strict: true` in tsconfig.json.
- Use explicit types for function params/returns, especially in load/actions.
- SvelteKit types: Import from `./$types` for page-specific (e.g., `PageServerLoad`, `Actions`).
- Define interfaces for props/data: e.g., `interface User { id: string; name: string; }`.
- Use generics where appropriate (e.g., `type Load = PageServerLoad<{ user: User }>`).
- Avoid `any`; use `unknown` if unsure.

Examples:

```
export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	default: async ({ request }) => {
		// typed handling
	}
};
```

### Naming Conventions

- **Variables/Functions**: camelCase (e.g., `handleAuth`, `getUserData`).
- **Components**: PascalCase (e.g., `UserProfile.svelte`).
- **Files**: kebab-case for routes (SvelteKit convention), PascalCase for components.
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`).
- **Interfaces/Types**: PascalCase (e.g., `AuthSession`).
- **Database Schemas**: camelCase fields (Drizzle: e.g., `table('users', { id: serial('id').primaryKey() })`).

### Error Handling

- Use SvelteKit's `error` function or `redirect` for user-facing errors.
- In server code: Try-catch async operations, throw `new Error('message')` or custom errors.
- For API: Return `{ success: false, error: 'message' }`.
- Auth errors: Rely on Better Auth; handle sessions in hooks.
- Logging: Use `console.error` for dev; integrate logger (e.g., Pino) for prod.

Examples:

```
try {
	const session = await auth.api.getSession({ headers });
} catch (error) {
	console.error('Auth error:', error);
	throw redirect(302, '/login');
}
```

- Validate inputs with Zod or runtime checks.
- For DB: Use Drizzle's error handling; wrap queries in transactions if needed.

### Security Best Practices

- Never log secrets (e.g., env vars).
- Use `env.dynamic/private` for server secrets.
- Sanitize user inputs.
- Auth: Always check `event.locals.user` in protected routes.
- CORS: Handled by SvelteKit adapter.

### Svelte-Specific

- Props: Use `let { prop } = $props();`.
- Reactive: Use `$state` for state, `$derived` for computed values.
- Stores: Prefer classes with `$state` fields over traditional stores for sharing reactivity between components.
- Lifecycle: Use `onMount` sparingly; prefer runes where possible.

### Svelte 5 Runes and Best Practices

## `$state`

Only use the `$state` rune for variables that should be _reactive_ — in other words, variables that cause an `$effect`, `$derived` or template expression to update. Everything else can be a normal variable.

Objects and arrays (`$state({...})` or `$state([...])`) are made deeply reactive, meaning mutation will trigger updates. This has a trade-off: in exchange for fine-grained reactivity, the objects must be proxied, which has performance overhead. In cases where you're dealing with large objects that are only ever reassigned (rather than mutated), use `$state.raw` instead. This is often the case with API responses, for example.

## `$derived`

To compute something from state, use `$derived` rather than `$effect`:

```js
// do this
let square = $derived(num * num);

// don't do this
let square;

$effect(() => {
	square = num * num;
});
```

> [!NOTE] `$derived` is given an expression, _not_ a function. If you need to use a function (because the expression is complex, for example) use `$derived.by`.

Deriveds are writable — you can assign to them, just like `$state`, except that they will re-evaluate when their expression changes.

If the derived expression is an object or array, it will be returned as-is — it is _not_ made deeply reactive. You can, however, use `$state` inside `$derived.by` in the rare cases that you need this.

## `$effect`

Effects are an escape hatch and should mostly be avoided. In particular, avoid updating state inside effects.

- If you need to sync state to an external library such as D3, it is often neater to use [`{@attach ...}`](references/@attach.md)
- If you need to run some code in response to user interaction, put the code directly in an event handler or use a [function binding](references/bind.md) as appropriate
- If you need to log values for debugging purposes, use [`$inspect`](references/$inspect.md)
- If you need to observe something external to Svelte, use [`createSubscriber`](references/svelte-reactivity.md)

Never wrap the contents of an effect in `if (browser) {...}` or similar — effects do not run on the server.

## `$props`

Treat props as though they will change. For example, values that depend on props should usually use `$derived`:

```js
// @errors: 2451
let { type } = $props();

// do this
let color = $derived(type === 'danger' ? 'red' : 'green');

// don't do this — `color` will not update if `type` changes
let color = type === 'danger' ? 'red' : 'green';
```

## `$inspect.trace`

`$inspect.trace` is a debugging tool for reactivity. If something is not updating properly or running more than it should you can add `$inspect.trace(label)` as the first line of an `$effect` or `$derived.by` (or any function they call) to trace their dependencies and discover which one triggered an update.

## Events

Any element attribute starting with `on` is treated as an event listener:

```svelte
<button onclick={() => {...}}>click me</button>

<!-- attribute shorthand also works -->
<button {onclick}>...</button>

<!-- so do spread attributes -->
<button {...props}>...</button>
```

If you need to attach listeners to `window` or `document` you can use `<svelte:window>` and `<svelte:document>`:

```svelte
<svelte:window onkeydown={...} />
<svelte:document onvisibilitychange={...} />
```

Avoid using `onMount` or `$effect` for this.

## Snippets

[Snippets](references/snippet.md) are a way to define reusable chunks of markup that can be instantiated with the [`{@render ...}`](references/@render.md) tag, or passed to components as props. They must be declared within the template.

```svelte
{#snippet greeting(name)}
	<p>hello {name}!</p>
{/snippet}

{@render greeting('world')}
```

> [!NOTE] Snippets declared at the top level of a component (i.e. not inside elements or blocks) can be referenced inside `<script>`. A snippet that doesn't reference component state is also available in a `<script module>`, in which case it can be exported for use by other components.

## Each blocks

Prefer to use [keyed each blocks](references/each.md) — this improves performance by allowing Svelte to surgically insert or remove items rather than updating the DOM belonging to existing items.

> [!NOTE] The key _must_ uniquely identify the object. Do not use the index as a key.

Avoid destructuring if you need to mutate the item (with something like `bind:value={item.count}`, for example).

## Using JavaScript variables in CSS

If you have a JS variable that you want to use inside CSS you can set a CSS custom property with the `style:` directive.

```svelte
<div style:--columns={columns}>...</div>
```

You can then reference `var(--columns)` inside the component's `<style>`.

## Styling child components

The CSS in a component's `<style>` is scoped to that component. If a parent component needs to control the child's styles, the preferred way is to use CSS custom properties:

```svelte
<!-- Parent.svelte -->
<Child --color="red" />

<!-- Child.svelte -->
<h1>Hello</h1>

<style>
	h1 {
		color: var(--color);
	}
</style>
```

If this is impossible (for example, the child component comes from a library) you can use `:global` to override styles:

```svelte
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
	}
</style>
```

## Context

Consider using context instead of declaring state in a shared module. This will scope the state to the part of the app that needs it, and eliminate the possibility of it leaking between users when server-side rendering.

Use `createContext` rather than `setContext` and `getContext`, as it provides type safety.

## Async Svelte

If using version 5.36 or higher, you can use [await expressions](references/await-expressions.md) and [hydratable](references/hydratable.md) to use promises directly inside components. Note that these require the `experimental.async` option to be enabled in `svelte.config.js` as they are not yet considered fully stable.

## Avoid legacy features

Always use runes mode for new code, and avoid features that have more modern replacements:

- use `$state` instead of implicit reactivity (e.g. `let count = 0; count += 1`)
- use `$derived` and `$effect` instead of `$:` assignments and statements (but only use effects when there is no better solution)
- use `$props` instead of `export let`, `$$props` and `$$restProps`
- use `onclick={...}` instead of `on:click={...}`
- use `{#snippet ...}` and `{@render ...}` instead of `<slot>` and `$$slots` and `<svelte:fragment>`
- use `<DynamicComponent>` instead of `<svelte:component this={DynamicComponent}>`
- use `import Self from './ThisComponent.svelte'` and `<Self>` instead of `<svelte:self>`
- use classes with `$state` fields to share reactivity between components, instead of using stores
- use `{@attach ...}` instead of `use:action`
- use clsx-style arrays and objects in `class` attributes, instead of the `class:` directive

### Database (Drizzle)

- Schemas in `src/lib/server/db/schema.ts`.
- Use PostgreSQL provider.
- Migrations: Run `db:generate` after schema changes, then `db:migrate`.
- Queries: Prefer type-safe (e.g., `db.select().from(users).where(eq(users.id, id))`).

### Authentication (Better Auth)

- Config in `src/lib/server/auth.ts`.
- Hooks: `src/hooks.server.ts` for session management.
- Protected routes: Check `event.locals.user` in load functions.

### Component Patterns

- Reusable components in `src/lib/components/`.
- Props interface at top.
- Slots for flexibility: Prefer snippets and {@render} over legacy slots.

Example Component:

```
<script lang="ts">
	import type { User } from '$lib/types';
	let { user } = $props< { user: User } >();
</script>

<div class="user-card">
	<h2>{user.name}</h2>
</div>
```

## Additional Guidelines for Agents

- Before editing: Read surrounding files with `read` tool.
- When adding features: Follow existing patterns (e.g., +page.server.ts for loads).
- Verify changes: Run `pnpm run check`, `pnpm run lint`, `pnpm run build`.
- If adding tests: Place in `__tests__/` or alongside.
- Commit messages: Conventional (e.g., 'feat: add user profile', 'fix: auth redirect').
- No hard-coded values; use env vars.
- Keep files <300 lines; refactor if larger.

This document should be updated as the project evolves. Aim for consistency to minimize review time.

(Approximately 150 lines when rendered; expand sections as needed.)
