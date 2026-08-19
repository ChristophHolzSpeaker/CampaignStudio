# Software Requirements Specification (SRS)

## Project: Campaign Studio Artifact Runtime MVP

## Parent Initiative: Christoph Holz Speaker Management System

## Version: 2.0

## Status: Approved Architecture Reframe for Incremental MVP Delivery

## Last Updated: 2026-08-19

---

## 1. Purpose

Campaign Studio is a landing-page hosting, publishing, analytics, attribution, lead, and booking platform.

Landing-page presentation may be authored outside Campaign Studio as a deployable artifact. Campaign Studio remains responsible for the platform behavior that makes each page operational, measurable, and manageable.

The governing product principle is:

> Campaign Studio should stop trying to control how every landing page looks. It should control what every landing page can do.

The existing structured-section renderer remains supported because published production pages depend on it. The artifact renderer shall be introduced alongside it rather than replacing it.

---

## 2. MVP Goal

Enable Christoph to use a local AI coding environment as a first-class authoring client and complete this loop:

**Create campaign → Author artifact externally → Upload → Preview → Publish → Receive visits and leads → View attribution and analytics → Roll back if required**

The first milestone succeeds when one artifact-authored page can:

- coexist with every existing section-rendered page,
- be uploaded, validated, previewed, and published,
- load its immutable assets,
- record a page visit and CTA click,
- submit a lead through existing business rules,
- retain existing attribution behavior,
- expose the maintained booking experience,
- be rolled back to an earlier version,
- and appear in existing reporting.

---

## 3. Product Boundaries

### 3.1 Authoring responsibility

The external authoring client owns page layout, content presentation, visual design, semantic HTML, CSS, media selection, and supported Campaign Studio runtime markup.

Campaign Studio shall not reconstruct artifact-authored pages from predefined section objects.

### 3.2 Platform responsibility

Campaign Studio owns campaign and page identity, renderer type, artifact validation and storage, preview, publishing, rollback, routing, the browser runtime contract, analytics, attribution, forms, lead capture, booking, email attribution, reporting, and platform security.

### 3.3 Renderer types

Campaign Studio supports two renderer types:

- `sections`: a validated structured document rendered through the existing Svelte section registry.
- `artifact`: a validated external HTML/CSS/media artifact served as a complete HTML response and enhanced by the Campaign Studio browser runtime.

Renderer type is page-version metadata and determines validation, preview, serving, and canonical live-URL behavior.

---

## 4. Scope

### 4.1 In Scope

- Existing internal campaign management and authentication.
- Backward-compatible operation of published section-rendered pages.
- Authenticated artifact upload by an external authoring client.
- Immutable artifact versions and server-generated manifests.
- Tokenized preview of unpublished artifact versions.
- Artifact publication at `/{slug}`.
- Continued section-page publication at `/speaker/{slug}`.
- Reserved public slug validation.
- Renderer-aware preview and live URLs.
- Supabase-backed page and artifact metadata.
- Object storage for private artifact source and immutable public assets.
- Automatic injection of a versioned Campaign Studio browser runtime.
- Renderer-independent visit, engagement, CTA, form, lead, and conversion behavior.
- A documented `data-cs-*` authoring contract.
- A maintained Campaign Studio booking island.
- Atomic publishing and rollback.
- Existing attribution, email attribution, analytics, and reporting.
- A deployment-oriented public interface for AI coding clients.
- One live landing page per campaign for the first artifact milestone.
- One curated experiment at a time on the legacy speaker route.

### 4.2 Out of Scope

- Migrating all existing section pages to artifacts.
- Removing the section registry or `PageRenderer` while production pages use them.
- Replacing SvelteKit, Vercel, Supabase, or Drizzle.
- Rebuilding a visual drag-and-drop page editor.
- Requiring Campaign Studio's AI generation pipeline for artifact pages.
- Hosting arbitrary server-side code.
- Unrestricted same-origin author-supplied JavaScript.
- General-purpose static hosting for unrelated sites.
- Multi-tenant architecture or sophisticated RBAC.
- Custom domains in the first milestone.
- General-purpose artifact-page A/B test authoring.
- Multiple logical live landing pages per campaign.
- Guaranteed cross-device attribution.
- Full CRM/deal synchronization.

---

## 5. Users and Clients

### 5.1 Internal Admin User

The internal admin can manage campaigns, inspect versions, preview, publish, unpublish, roll back, view analytics and attribution, inspect leads and bookings, and continue operating legacy section pages.

### 5.2 External Authoring Client

An AI coding client can read the public authoring documentation and machine contracts without credentials. With the appropriate bearer scope, it can create or select a campaign, upload and finalize an artifact, obtain a preview URL, publish a version, receive its canonical URL, and inspect permitted analytics and leads.

The client shall not require knowledge of Campaign Studio database tables, Svelte components, or internal server modules.

### 5.3 Public Visitor

A public visitor can view a published page, interact with supported CTAs and forms, use the booking experience, and participate in best-effort renderer-independent attribution.

---

## 6. Functional Requirements

### 6.1 Authentication and authorization

**FR-001** The internal application shall require authentication.

**FR-002** Only authorized internal users or authoring clients shall create campaigns, upload artifacts, finalize versions, preview private versions, publish, unpublish, or roll back pages.

**FR-003** Published landing pages shall be publicly accessible without authentication.

**FR-004** Public authoring credentials shall have separate read/write scopes and rate limits.

### 6.2 Campaign and page versions

**FR-010** An authorized user or client shall be able to create and inspect a campaign.

**FR-011** A campaign shall contain name, audience, format, topic, language, geography, optional notes, and status.

**FR-012** Every page version shall belong to exactly one campaign and declare exactly one renderer type.

**FR-013** Historical finalized page versions shall remain immutable after a newer version is published.

**FR-014** The first artifact milestone shall permit at most one published landing-page version per campaign.

**FR-015** Existing page-version identifiers used by visits, lead events, email aliases, ad relationships, and reports shall remain valid during the incremental migration.

**FR-016** Campaign Studio shall list every campaign regardless of whether its latest page uses the `sections` or `artifact` renderer and shall identify the latest renderer and page count.

**FR-017** Campaign detail and page-version history shall expose renderer type, publication state, and a preview action for both renderer types.

### 6.3 Section renderer compatibility

**FR-020** Existing `sections` pages shall continue to render through the current Svelte section registry at `/speaker/{slug}`.

**FR-021** Existing published section documents shall not require migration or data rewriting for the artifact milestone.

**FR-022** Section documents shall continue to be schema-validated before persistence and publication.

**FR-023** Existing speaker-route SEO, experiment, attribution, CTA, form, and booking behavior shall remain operational unless separately changed.

**FR-024** The existing AI generation and editing workflow may continue producing `sections` versions but shall not be required for `artifact` versions.

### 6.4 Artifact ingestion and validation

**FR-030** The system shall accept an authenticated artifact upload containing one HTML entrypoint and referenced styles and assets.

**FR-031** A ZIP may be accepted as transport, but it shall be validated and extracted before the version becomes previewable.

**FR-032** The system shall reject missing or multiple entrypoints, absolute archive paths, parent traversal, symlinks, duplicate normalized paths, prohibited executable content, unsupported media types, and configured count or size overages.

**FR-033** The system shall generate a manifest containing each normalized path, media type, byte size, and integrity hash.

**FR-034** Finalization shall succeed only when every referenced local asset resolves to a validated uploaded object.

**FR-035** Local asset references shall be normalized to immutable versioned URLs before preview or publication.

**FR-036** A finalized artifact and its asset objects shall be immutable.

### 6.5 Public routing and rendering

**FR-040** Section pages shall retain canonical live URLs at `/speaker/{slug}`.

**FR-041** Artifact pages shall have canonical live URLs at `/{slug}`.

**FR-042** The artifact route shall return a complete raw HTML response and shall not render uploaded HTML through a Svelte page or `{@html}`.

**FR-043** The artifact route shall resolve only a published `artifact` version whose owning campaign is published.

**FR-044** Unknown, invalid, reserved, unpublished, or renderer-mismatched slugs shall not expose an artifact.

**FR-045** Current application route namespaces and selected platform asset names shall be reserved from artifact publication.

**FR-046** Fixed application routes shall continue to take precedence over the root artifact route.

**FR-047** The internal app and public interfaces shall generate URLs according to renderer type.

**FR-048** Navigation from a Svelte page to an artifact document shall perform a full document navigation.

### 6.6 Preview, publishing, and rollback

**FR-050** An authorized user or client shall be able to preview an unpublished finalized artifact through a tokenized, non-indexable URL.

**FR-051** Publishing shall verify renderer content, artifact integrity, campaign ownership, and slug availability.

**FR-052** Publishing shall atomically deactivate the previous version and activate the selected version.

**FR-053** A failed publish shall leave the previous version active.

**FR-054** An authorized user or client shall be able to unpublish a page.

**FR-055** An unpublished page shall not remain accessible through its canonical public URL.

**FR-056** Rollback shall publish an earlier immutable version without copying or mutating its contents.

**FR-057** The public slug shall remain stable across version changes unless an authorized operation explicitly changes it.

**FR-058** Campaign Studio shall render a finalized artifact version in its authenticated landing-page workspace without interpreting the artifact as section JSON or enabling section-specific editing controls.

**FR-059** Public campaign navigation shall return a renderer-aware signed `embedUrl` for every previewable page version. Both section and artifact previews shall be frameable and report their document height through the documented embed message contract; canonical live artifact responses shall remain frame-protected.

### 6.7 Campaign Studio browser runtime

**FR-060** Campaign Studio shall provide a documented and versioned browser runtime for artifact pages.

**FR-061** The artifact renderer shall inject trusted public context and a pinned runtime version automatically.

**FR-062** The runtime shall derive campaign, page-version, and slug identity only from server-injected context.

**FR-063** Runtime v1 shall recognize a documented subset of `data-cs-*` attributes for CTAs, lead forms, conversions, and supported widgets.

**FR-064** Unknown attributes or values shall not create analytics semantics or invoke arbitrary platform behavior.

**FR-065** Tracking or widget failure shall not prevent basic content and ordinary links from rendering.

### 6.8 Analytics and attribution

**FR-070** Both renderer types shall use the same visit, attribution, lead-event, and reporting models.

**FR-071** The runtime shall record page visits through a normal HTTP interface backed by existing campaign-visit behavior.

**FR-072** Visits shall capture, where available, campaign ID, page-version ID, slug, timestamp, visitor identifier, referrer, UTM parameters, user agent, and deployment geography.

**FR-073** The runtime shall support the existing engagement threshold and best-effort engagement marking.

**FR-074** Supported CTA clicks shall use existing CTA event semantics.

**FR-075** Visit ownership and trusted page context shall be resolved server-side before CTA, form, lead, or conversion events are recorded.

**FR-076** Existing email attribution and page-version email aliases shall remain compatible.

**FR-077** Artifact pages shall not automatically participate in speaker-route experiments.

**FR-078** The artifact milestone shall not introduce a parallel artifact-only analytics system.

### 6.9 Forms and lead capture

**FR-080** Artifact pages shall declare supported lead forms through the runtime markup contract.

**FR-081** The runtime shall submit supported forms through a renderer-independent HTTP interface.

**FR-082** HTTP and legacy Svelte form adapters shall invoke the same shared server-side lead-intake behavior.

**FR-083** Lead processing shall retain validation, campaign/page verification, attribution, journey creation or matching, events, notification, qualification, and approved booking follow-up.

**FR-084** Form handling shall provide accessible pending, success, validation-error, and service-error states.

**FR-085** Public form endpoints shall enforce origin policy, request-size limits, schema validation, and rate limits.

### 6.10 Booking widget

**FR-090** Artifact pages shall declare the maintained booking experience through a supported widget placeholder.

**FR-091** The initial widget shall be isolated from artifact CSS and author markup.

**FR-092** The widget shall receive trusted campaign and page context through a short-lived signed token.

**FR-093** The widget shall reuse existing availability, policy, qualification, confirmation, attribution, notification, and calendar behavior.

**FR-094** The widget shall exchange only documented lifecycle, resize, and completion messages with its parent.

### 6.11 External authoring interface

**FR-100** The public read-only interface shall expose a machine-readable contract describing bundle structure, upload limits, allowed media and markup, prohibited content, routing, fonts, form fields and validation, runtime attributes and behavior, widgets, lifecycle semantics, and contract version without exposing credentials or private campaign data.

**FR-101** The interface shall support creation of an artifact upload session for a campaign.

**FR-102** Upload and finalization shall be separate operations.

**FR-103** Successful finalization shall return an immutable version identifier and preview URL; failure shall return structured validation errors.

**FR-104** Publishing a finalized version shall return its canonical live URL.

**FR-105** The interface shall support listing versions and publishing an earlier version as rollback.

**FR-106** The workflow shall not require clients to submit internal identifiers derivable from authenticated server state.

**FR-107** The system shall publish a concise `/llms.txt` discovery index that links to the complete guide, OpenAPI document, and JSON authoring contract using absolute public URLs.

**FR-108** The system shall publish a complete LLM-readable Markdown guide covering authentication, artifact-only campaign creation, bundle authoring, supported platform markup, CTA tracking, lead forms, booking, fonts, upload, validation, preview, publish, rollback, unpublish, analytics, and error handling.

**FR-109** The complete OpenAPI 3.1 document and runtime-derived JSON authoring contract shall be publicly readable and cacheable. All state-changing, reporting, preview-listing, lead, and other private-data operations shall remain bearer-authenticated.

### 6.12 Reporting and legacy features

**FR-110** Reporting shall include section and artifact pages without duplicating metrics by renderer.

**FR-111** Reporting shall identify campaign, live URL, renderer type, active version, visits, CTA activity, leads, and bookings where available.

**FR-112** Historical section-page reporting shall remain intact.

**FR-120** Existing generation, section editing, preview, and selection features may be marked legacy but shall not be removed while production pages or active workflows depend on them.

**FR-121** Legacy authoring features shall not be extended merely to reproduce artifact authoring flexibility.

**FR-122** Retirement shall require evidence that no production page, attribution path, or required business workflow depends on the feature.

---

## 7. Non-Functional Requirements

### 7.1 Performance and caching

**NFR-001** Published artifact HTML shall remain comfortably below Vercel's documented Function payload limit.

**NFR-002** Large styles, fonts, images, scripts, and video shall be served directly from object storage or a CDN.

**NFR-003** Published immutable assets shall use long-lived immutable caching.

**NFR-004** Published HTML shall use bounded shared caching so publish and rollback take effect without an application rebuild.

**NFR-005** Preview responses shall be private, non-indexable, and `no-store`.

**NFR-006** Tracking and widget failure shall not materially block initial page rendering.

**NFR-007** A database-selected artifact version shall not be build-time prerendered.

### 7.2 Reliability and atomicity

**NFR-010** Campaign, version, artifact, manifest, and publication metadata shall persist reliably.

**NFR-011** Finalization shall be idempotent for the same upload and content hash.

**NFR-012** Partial or failed uploads shall never become publicly routable.

**NFR-013** Publication and rollback shall be atomic with respect to the active version.

**NFR-014** Immutable version objects shall not be overwritten.

**NFR-015** Missing or invalid public artifact data shall produce a deliberate unavailable or 404 response.

### 7.3 Security

**NFR-020** Public routes shall not expose admin behavior, private configuration, service credentials, raw prompts, or unpublished data.

**NFR-021** Artifact HTML and manifests shall be treated as untrusted until validation succeeds.

**NFR-022** Extraction shall prevent traversal, symlink, duplicate-path, decompression-bomb, and type-confusion attacks.

**NFR-023** Artifact responses shall define explicit Content Security Policy and related security headers.

**NFR-024** Initial same-origin artifacts shall reject author JavaScript, inline event handlers, `javascript:` URLs, and unsafe executable embeds. The pinned Campaign Studio runtime shall provide supported behavior.

**NFR-025** If unrestricted author JavaScript becomes required, artifact pages shall execute on a separate public origin that receives no admin authentication cookies.

**NFR-026** Runtime endpoints shall verify the published campaign/page relationship and shall not trust identity authored into artifact HTML.

**NFR-027** Runtime context shall be serialized as inert data without script-context breakout.

**NFR-028** Private source HTML and manifests shall not be publicly reachable through an uninstrumented storage URL.

### 7.4 Maintainability

**NFR-030** Renderer-specific route adapters shall remain separate from renderer-independent campaign, publishing, analytics, attribution, lead, and booking modules.

**NFR-031** Svelte remote-function and HTTP adapters shall reuse shared server-side business behavior.

**NFR-032** The runtime authoring contract shall be small, documented, and versioned.

**NFR-033** The first milestone shall favor incremental schema extension over broad migration of analytics and attribution identifiers.

**NFR-034** The Drizzle schema shall remain the database schema source of truth.

---

## 8. Technical Constraints

**TC-001** The application shall remain on SvelteKit and Svelte 5.

**TC-002** The SvelteKit application shall continue deploying through `@sveltejs/adapter-vercel` to Vercel.

**TC-003** Persistence shall use Supabase Postgres through Drizzle ORM.

**TC-004** Artifact source and public immutable assets shall use durable object storage; Supabase Storage is the initial provider.

**TC-005** The artifact route shall be a SvelteKit server endpoint returning an HTML `Response`, not `{@html}`.

**TC-006** AI authoring clients shall use public read-only documentation interfaces and authenticated server-side interfaces for state-changing or private-data operations.

**TC-007** API keys, storage credentials, signing keys, and service credentials shall remain server-side.

**TC-008** The Cloudflare Worker email-attribution context shall remain compatible with page-version identifiers.

---

## 9. Data Requirements

The exact migration remains an implementation decision, but the model shall support:

### 9.1 Campaigns

Stable identity, metadata, lifecycle status, timestamps, and creator identity where available.

### 9.2 Page versions

Campaign identity, version number, renderer type, renderer-specific content reference, change note, slug, publication state, and timestamps.

For the incremental milestone, the existing `campaign_pages` row remains the page-version identity. Existing rows default to `sections`.

### 9.3 Artifacts

A one-to-one extension for artifact page versions containing private source location, public immutable asset prefix, entrypoint, server-generated manifest, content integrity hash, and timestamp.

### 9.4 Visits and lead events

Existing records continue carrying campaign, page-version, visit, visitor, attribution, CTA, journey, and timestamp context.

### 9.5 Deferred model deepening

A stable logical landing-page identity and explicit active-version pointer may be introduced when multiple logical pages per campaign are required. They are not required for the first artifact milestone.

---

## 10. Assumptions and Deferred Items

Assumptions:

- Campaign Studio remains internal-admin driven.
- Christoph's AI coding environment is the primary artifact authoring client.
- Uploaded presentation is trusted in intent but validated as untrusted input.
- One live page per campaign is sufficient for the first milestone.
- Existing section pages remain production dependencies.
- Analytics and attribution remain best-effort.
- Artifact HTML remains visitor-invariant for shared caching.
- Existing booking, notification, lead, email, and reporting behavior is reused.

Deferred:

- Multiple logical landing pages per campaign.
- Custom domains.
- Arbitrary author JavaScript on an isolated origin.
- General artifact-page experiment authoring.
- Automated optimization.
- External collaboration workflows.
- General-purpose visual editing.
- Programmatic SEO at scale.
- Cross-device identity resolution.
- Full CRM synchronization.
- Multi-tenant artifact hosting.
- Complete retirement of section authoring and rendering.

---

## 11. Acceptance Criteria

**AC-001** Existing published `/speaker/{slug}` pages continue rendering without data migration.

**AC-002** A client can discover and retrieve the complete public authoring guide, OpenAPI document, and JSON authoring contract without credentials, then use authenticated operations to create or select a campaign.

**AC-003** The client can upload an artifact, and unsafe or invalid uploads are rejected before preview.

**AC-004** A successful upload finalizes as an immutable version with a server-generated manifest and integrity hash.

**AC-005** An authorized user or client can preview the version through a tokenized, non-indexable URL.

**AC-006** The artifact publishes atomically at `/{slug}` without changing `/speaker/{slug}` behavior.

**AC-007** Local artifact assets resolve through immutable URLs and are not proxied through the HTML Function.

**AC-008** The artifact records a visit with available UTM and referrer data in the existing visit model.

**AC-009** A supported CTA records existing CTA semantics against the correct visit and page version.

**AC-010** A supported lead form invokes the same server behavior as the Svelte adapter and produces expected journeys, events, attribution, and notifications.

**AC-011** The artifact mounts the maintained booking widget with signed page context.

**AC-012** Existing reporting includes the artifact without a second analytics implementation.

**AC-013** Publishing an earlier immutable version rolls back the canonical URL without mutating artifact objects.

**AC-014** Unpublishing removes the artifact from public access.

**AC-015** Reserved application route names cannot be published as artifact slugs.

**AC-016** The end-to-end workflow is documented and reliable enough for real internal use.

**AC-017** The documented artifact-only create → upload → finalize → preview → publish workflow is executable using only response fields from prior steps and a campaign-write bearer token.

**AC-018** An internal user can find an artifact campaign, inspect its versions, and preview a selected artifact in Campaign Studio; an external client can place the page's API-provided `embedUrl` in an iframe and receive resize messages.

---

## 12. Migration and Delivery Principle

Delivery shall proceed through vertical slices:

1. Artifact identity, upload, validation, immutable storage, and preview.
2. Raw root-route serving, asset normalization, caching, and security headers.
3. Browser-runtime visit, engagement, and CTA behavior.
4. Shared lead-intake behavior and artifact HTTP form adapter.
5. Maintained booking island with signed context.
6. External finalize/publish workflow and OpenAPI documentation.

Each slice shall leave existing section-rendered production pages operational.

The system shall prioritize backward compatibility, controlled platform behavior, validated inputs, shared business modules, atomic lifecycle operations, and a small authoring contract over preserving Campaign Studio as the primary visual authoring environment or performing a broad rewrite before one artifact page proves the architecture.
