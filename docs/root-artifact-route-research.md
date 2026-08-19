# Root Artifact Route Research

**Date:** 2026-08-19  
**Question:** Can Campaign Studio keep section-rendered pages at `/speaker/[slug]` while serving externally generated artifact HTML at root `/[slug]` through a SvelteKit `+server` route on Vercel?

## Conclusion

Yes. The clean route boundary is:

```text
/speaker/[slug]  -> existing Svelte page and section renderer
/[slug]          -> new GET endpoint returning the artifact's HTML Response
```

This is supported by SvelteKit's filesystem router and by the repository's existing `@sveltejs/adapter-vercel` deployment. A `src/routes/[slug]/+server.ts` handler can return a complete HTML document with `Content-Type: text/html; charset=utf-8`; SvelteKit gives `+server` handlers full control of the `Response`, and layouts do not wrap endpoint responses ([SvelteKit routing: `+server`](https://svelte.dev/docs/kit/routing#server)).

The split is preferable to making `/speaker/[slug]` negotiate between a Svelte page and arbitrary HTML. It leaves production section pages unchanged and gives artifact pages an independent response, cache, CSP, and error policy. It is a logical route separation, not necessarily a deployment-function separation: adapter-vercel bundles routes into a common function unless `split: true` is configured ([SvelteKit Vercel adapter configuration](https://svelte.dev/docs/kit/adapter-vercel#deployment-configuration), [Vercel's SvelteKit integration](https://vercel.com/docs/frameworks/full-stack/sveltekit)). Splitting functions is optional and is not needed to make the routing model work.

## Current repository fit

- The legacy public path is already isolated in [`src/routes/speaker/[slug]/+page.server.ts`](../src/routes/speaker/%5Bslug%5D/+page.server.ts). It looks up a published `campaign_pages` row, verifies the parent campaign is published, parses the section document, and passes it to the existing Svelte page.
- [`src/routes/speaker/[slug]/+page.svelte`](../src/routes/speaker/%5Bslug%5D/+page.svelte) owns section-renderer-specific behavior: `PageRenderer`, Svelte remote functions, booking/modal state, analytics, and the A/B experiment result. None of this needs to be loaded for a root artifact endpoint.
- [`svelte.config.js`](../svelte.config.js) already uses `@sveltejs/adapter-vercel` with its default Node deployment configuration.
- [`src/hooks.server.ts`](../src/hooks.server.ts) protects only route IDs beginning with `/(app)`. A root `/[slug]` endpoint would therefore be public, while still passing through the common `handle` hook. SvelteKit explicitly states that layouts do not affect `+server` handlers; cross-cutting behavior belongs in hooks ([SvelteKit routing](https://svelte.dev/docs/kit/routing#server)).
- Live URL construction is currently hard-coded to `/speaker/${slug}` in places such as [`src/routes/(app)/campaigns/[id]/+layout.server.ts`](../src/routes/%28app%29/campaigns/%5Bid%5D/+layout.server.ts). A later implementation must make URL construction renderer-aware so existing pages remain `/speaker/...` and artifact pages become `/...`.

## Route precedence and collision behavior

SvelteKit ranks static routes above dynamic routes; constrained parameters rank above unconstrained parameters, and rest parameters rank lowest ([SvelteKit route sorting](https://svelte.dev/docs/kit/advanced-routing#sorting)). Route groups such as `(app)` and `(auth)` do not change URL paths ([SvelteKit route groups](https://svelte.dev/docs/kit/advanced-routing#advanced-layouts-group)). Therefore:

| Request                               | Result after adding `/[slug]`                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/speaker/existing-slug`              | Still matches the two-segment legacy `/speaker/[slug]` page; root `/[slug]` cannot match it.             |
| `/login`, `/account`, `/no-follow`    | Existing fixed one-segment routes win over the dynamic root route.                                       |
| `/api/...`, `/book/...`, `/embed/...` | Existing multi-segment routes remain unaffected.                                                         |
| `/artifact-slug`                      | Matches the new root endpoint and can resolve a published bundle.                                        |
| `/unknown`                            | Matches the root endpoint; the handler must deliberately return a 404 when no published artifact exists. |

The main collision risk is at **publish time**, not router ambiguity. An artifact slug equal to a fixed application route (for example `login` or `account`) would be shadowed by the more-specific fixed route. A slug that occupies a currently unused namespace such as `admin` or `api` could also block a future index route or make routing surprising.

One subtle example is `/speaker`: the repository has `/speaker/[slug]` but no `/speaker` index route, so the one-segment request `/speaker` would otherwise reach root `[slug]`. Reserving `speaker` prevents that namespace from becoming an artifact accidentally.

Recommended controls:

1. Maintain a reserved first-segment list covering the current application namespaces: `account`, `admin`, `api`, `book`, `campaign`, `campaigns`, `confirm`, `embed`, `login`, `no-follow`, `preview`, `register`, `signout`, and `speaker`, plus platform/static names such as `favicon.ico` and `robots.txt`.
2. Validate the reservation in the shared create/publish service, not only in the route.
3. Add a parameter matcher for the allowed slug syntax (for example lowercase letters, digits, and hyphens). SvelteKit matchers let an invalid parameter fall through to other routes or a 404 ([SvelteKit parameter matching](https://svelte.dev/docs/kit/advanced-routing#matching)). Excluding dots also prevents arbitrary root asset-looking requests from becoming artifact lookups.
4. Keep root `/` as the existing home page. `[slug]` requires one segment and does not replace `/`.

## Raw HTML response behavior

The artifact route should contain `+server.ts` only, with a `GET` handler returning a standard `Response`. Because there is no co-located `+page`, browser `Accept` negotiation does not redirect the request into Svelte rendering. If a page and endpoint are later placed in the same directory, SvelteKit gives browser `GET`/`HEAD` requests to the page when `Accept` prioritizes `text/html`, so co-locating both would defeat this design ([SvelteKit content negotiation](https://svelte.dev/docs/kit/routing#server-content-negotiation)).

Consequences of a raw endpoint:

- The response body must be a complete HTML document. `src/app.html`, the root `+layout.svelte`, global `layout.css`, favicon injection, and Svelte hydration are not applied.
- The endpoint must explicitly set `Content-Type: text/html; charset=utf-8` and its intended caching and security headers.
- Errors thrown from `+server` do not render the route's `+error.svelte`; the endpoint should return a deliberate HTML 404 if an HTML error experience matters ([SvelteKit endpoint error behavior](https://svelte.dev/docs/kit/routing#server)).
- Campaign Studio's browser runtime, analytics bootstrap, attribution configuration, CSP nonce/hash handling, and widgets must be inserted into the artifact HTML or referenced by the artifact. They are not inherited from the legacy Svelte route.
- Links from Svelte-rendered application pages to artifact pages should use `data-sveltekit-reload` (or `rel="external"`) to guarantee a full document navigation across the Svelte-page/raw-document boundary ([SvelteKit link option](https://svelte.dev/docs/kit/link-options#data-sveltekit-reload)).

## Artifact and asset URLs

Serving `index.html` at `/my-page` does **not** give sibling bundle files a natural `/my-page/...` base. Without a `<base>` element, browsers resolve relative URLs against the document URL ([HTML Standard: document base URLs](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#document-base-urls)). In concrete terms:

```text
document URL https://example.com/my-page  + styles.css -> https://example.com/styles.css
document URL https://example.com/my-page/ + styles.css -> https://example.com/my-page/styles.css
```

SvelteKit's default trailing-slash policy does not provide a bundle directory, and the HTML is opaque endpoint output, so the normal Vite/Svelte asset rewriting described by `kit.paths` is not an artifact solution ([SvelteKit `paths` configuration](https://svelte.dev/docs/kit/configuration#paths)).

The robust contract is to rewrite bundle references at upload/publish time to immutable, absolute or root-relative versioned URLs, for example:

```text
/_cs/artifacts/{pageId}/{versionId}/styles.css
/_cs/artifacts/{pageId}/{versionId}/script.js
/_cs/artifacts/{pageId}/{versionId}/assets/hero.webp
```

Those asset URLs can point directly to public object storage/CDN URLs or be served through a dedicated asset route when authorization is required. Avoid relying on `<base href="...">` as the primary fix: it also changes relative navigation, form actions, fragment links, and script-created URLs throughout arbitrary authored HTML.

Repository `static/` files are copied and served unchanged as build-time deployment assets, not as a runtime publishing store ([SvelteKit project structure](https://svelte.dev/docs/kit/project-structure#project-files-static)). SvelteKit's adapter notes that ordinary project files are not automatically copied for runtime filesystem reads, and recommends `$app/server`'s `read` only for deployed app assets ([SvelteKit Vercel adapter: filesystem access](https://svelte.dev/docs/kit/adapter-vercel#troubleshooting-accessing-the-file-system)). Vercel recommends object storage for files written at runtime ([Vercel file guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)). Artifact versions uploaded after deployment should therefore live in durable object storage (the proposed Supabase Storage is compatible with this requirement), not in the function filesystem.

## Vercel runtime, prerender, and caching constraints

### Runtime

Keep the endpoint on the adapter's default Node runtime initially. The repository already depends on server-side Postgres/Supabase code and has not configured the Edge runtime. Adapter-vercel permits route-level runtime, region, duration, ISR, and function-splitting configuration, but none is required for returning HTML ([SvelteKit Vercel adapter](https://svelte.dev/docs/kit/adapter-vercel#deployment-configuration)). If latency becomes material, place the Node function near Supabase rather than moving to Edge by default; Vercel recommends running functions near their data source ([Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)).

### Prerendering and ISR

A database-selected `active_version_id` needs to take effect without a Vercel rebuild, so the root artifact endpoint should not be build-time prerendered. Dynamic parameter routes can be prerendered only when entries are discoverable or supplied, and prerendered output is fixed at build time ([SvelteKit prerender entries](https://svelte.dev/docs/kit/page-options#entries)).

ISR is possible because adapter-vercel supports it for route handlers, but it is safe only when every visitor receives the same HTML. The adapter explicitly warns against ISR for user-specific server responses ([SvelteKit adapter-vercel ISR](https://svelte.dev/docs/kit/adapter-vercel#incremental-static-regeneration)). If artifact HTML is invariant and analytics/attribution run client-side, ISR or shared-CDN caching is a good fit. If the server varies HTML by cookies, experiment assignment, preview token, or user identity, do not share-cache it.

### Response caching

Vercel Functions default to `Cache-Control: public, max-age=0, must-revalidate`, so the new endpoint is not usefully CDN-cached unless it sets a cache policy ([Vercel Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers)). A practical published-page policy is:

- HTML: short browser TTL or `max-age=0`, longer `s-maxage`, plus controlled purge/revalidation when `active_version_id` changes.
- Versioned CSS/JS/images: long-lived `max-age=31536000, immutable` because the versioned path never changes.
- Preview HTML: `private, no-store` and an unguessable/authenticated preview URL.

Vercel does not CDN-cache responses that set cookies, are marked private/no-store, or contain authorization-dependent state; its documented cache criteria should be checked before assuming a hit ([Vercel CDN cache criteria](https://vercel.com/docs/caching/cdn-cache#cacheable-response-criteria)). This is especially relevant because the legacy speaker route currently performs server-side experiment assignment with cookies; the artifact route should not copy that behavior blindly if public caching is a goal.

### Size and asset proxying

Vercel documents a 4.5 MB Function request/response payload limit ([Vercel Functions limits](https://vercel.com/docs/functions/limitations#request-body-size)). Keep the dynamically returned HTML small and serve large CSS, JavaScript, fonts, images, and video directly from object storage/CDN. This also avoids paying for a Function invocation and storage fetch for every asset request.

## Recommended decision

Adopt the route split as the initial architecture:

1. Leave `/speaker/[slug]` and the section renderer unchanged.
2. Add `/[slug]` later as a bundle-only `+server` endpoint; do not put a `+page` beside it.
3. Give each renderer an explicit canonical/live URL builder rather than inferring the prefix from the slug.
4. Reserve application slugs before publishing.
5. Normalize artifact references to immutable versioned asset URLs and store runtime uploads in object storage.
6. Return complete HTML with explicit content type, CSP/security headers, and cache policy.
7. Keep HTML visitor-invariant where possible, moving analytics and attribution initialization into the injected Campaign Studio browser runtime so Vercel can cache the page safely.

This preserves backward compatibility while making the renderer choice structural: old pages remain Svelte pages under `/speaker/...`; new artifacts are independent HTTP documents at `/...`.
