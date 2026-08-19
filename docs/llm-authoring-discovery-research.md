# LLM authoring documentation and discovery research

Date: 2026-08-19

## Executive recommendation

Campaign Studio should publish a small public documentation surface composed of complementary resources:

1. `GET /llms.txt` — a concise Markdown index that tells an agent which authoring resources to read.
2. `GET /docs/campaign-authoring.md` — the complete, task-oriented authoring guide, served as `text/markdown; charset=utf-8`.
3. `GET /api/public/v1/openapi.json` — a complete OpenAPI 3.1 description, served as `application/json`, with every authoring request and response schema, examples, security requirement, error response, and stable `operationId`.
4. `GET /api/public/v1/authoring-contract` — the runtime-derived JSON contract for limits, reserved slugs, markup attributes, valid values, field rules, widgets, and runtime version.

These discovery and documentation resources should be unauthenticated because they contain no secrets. Actual authoring operations should remain bearer-authenticated. The OpenAPI document and authoring contract should link to the Markdown guide, and the guide should link back to both machine-readable contracts.

This layered approach is preferable to putting everything in one very large page:

- OpenAPI precisely describes HTTP operations and payloads.
- The authoring contract precisely describes runtime-supported values that can be generated from code.
- Markdown explains sequence, intent, markup behavior, and complete examples.
- `llms.txt` is the low-cost entry point that helps an agent select the right resource.

Do not depend on `robots.txt`, `sitemap.xml`, or implicit `llms.txt` discovery to make Claude Code find the documentation. Give Claude the `/llms.txt` or guide URL in the user prompt, project instructions, integration setup, or API onboarding material.

## Findings by mechanism

| Mechanism              | Status and purpose                                                                                                          | Practical use here                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| OpenAPI 3.1            | Formal, machine-readable description of HTTP APIs.                                                                          | Canonical HTTP interface: authentication, operations, payloads, responses, errors, and examples.              |
| `llms.txt`             | Widely adopted but still explicitly published as a community **proposal**, not an IETF or similar standards-track protocol. | Small public index pointing to the guide, OpenAPI, and live authoring contract.                               |
| Markdown documentation | Directly readable by agents and humans.                                                                                     | Canonical workflow and behavioral documentation that does not fit cleanly in schemas.                         |
| `robots.txt`           | IETF-standard crawler access-control convention.                                                                            | Ensure documentation is not disallowed, but do not use it as an authoring documentation mechanism.            |
| `sitemap.xml`          | Search-crawler URL discovery protocol.                                                                                      | Optional for general search indexing; not needed for Claude Code authoring discovery.                         |
| MCP                    | Open protocol for connecting an AI client to executable tools, resources, and prompts.                                      | A possible later integration for safe first-class campaign actions; excessive for static documentation alone. |

## OpenAPI 3.1

The OpenAPI Specification defines a language-agnostic HTTP API description intended to let humans and computers understand and interact with a service without reading source code or inspecting traffic. It supports documentation generation, client generation, testing, and other tooling. The OpenAPI 3.1.2 specification also says a 3.1 entry document should preferably be named `openapi.json` or `openapi.yaml`; patch releases clarify the same 3.1 feature set, and tooling that supports 3.1 should support all 3.1.x versions. [OpenAPI Specification 3.1.2, sections 2 and 4.1–4.3](https://spec.openapis.org/oas/v3.1.2.html)

Campaign Studio can therefore retain `openapi: "3.1.0"` for compatibility or update to `3.1.2`; the material requirement is completeness, not the patch number. OpenAPI 3.1 uses JSON Schema Draft 2020-12 semantics for Schema Objects, which is suitable for exact request and response constraints. [OpenAPI Specification 3.1.2, section 4.3.1](https://spec.openapis.org/oas/v3.1.2.html#parsing-documents)

OpenAPI is necessary but not sufficient for artifact authoring. It models HTTP operations well, but an agent also needs cross-operation workflow and DOM/runtime semantics. The specification provides `description` fields with CommonMark and `externalDocs` links at the root and operation levels, so the API description should point to the public Markdown guide rather than attempting to encode every concept only as schema text. [OpenAPI Operation Object](https://spec.openapis.org/oas/v3.1.2.html#operation-object), [OpenAPI External Documentation Object](https://spec.openapis.org/oas/v3.1.2.html#external-documentation-object)

For reliable agent use, the Campaign Studio OpenAPI description should include:

- a stable `operationId` for every operation;
- the production server URL or a correctly resolvable relative server URL;
- bearer security requirements and the scope/role needed by each operation;
- exact schemas for every request and every success response, including artifact upload-session, upload, finalize, publish, rollback, unpublish, and campaign creation responses;
- all path, query, and header semantics, including raw file body and `Content-Type` behavior;
- exact error status codes and structured error bodies;
- realistic examples for a successful end-to-end authoring flow;
- `externalDocs` links to the public authoring guide;
- versioning and compatibility statements for the artifact runtime and authoring contract.

The current repository document is already OpenAPI 3.1, but its artifact operations have mostly prose-only responses and the OpenAPI route itself requires a read or write bearer token. That prevents the document from serving as a frictionless public discovery resource.

## `llms.txt`

The current `llms.txt` publication calls itself “a proposal to standardise” a Markdown file for helping agents use a website. Version 2 recommends an `llms.txt` at the site root or a subpath, a short overview, and categorized Markdown links to detailed LLM-friendly resources. It specifically recommends that the index remain small and that agents fetch linked detail only when needed. [The `/llms.txt` file, v2](https://llmstxt.org/)

The proposal is not a replacement for OpenAPI, authentication, or runtime contracts. It is a discovery/index convention. Its prescribed structure is:

- one required H1 project/site name;
- an optional blockquote summary;
- optional explanatory Markdown without headings;
- H2 sections containing lists of Markdown links and brief descriptions;
- a specially named `Optional` section for secondary resources.

The v2 proposal also recommends clean Markdown alternatives for documentation pages and standard `Link` relations: `rel="alternate"; type="text/markdown"` for a page's Markdown representation and `rel="describedby"` for its covering `llms.txt`. [The `/llms.txt` file, v2 — proposal and format](https://llmstxt.org/#proposal)

There is meaningful ecosystem adoption: Anthropic's own Claude Code documentation pages explicitly direct readers and agents to a documentation `llms.txt` index. This is evidence that the convention is useful for agent-oriented docs, but it does not establish that Claude Code automatically probes every site's `/llms.txt`. [Claude Code tools reference](https://code.claude.com/docs/en/tools-reference)

A suitable Campaign Studio index would be deliberately short:

```markdown
# Campaign Studio Authoring API

> Create, upload, preview, publish, roll back, and unpublish Campaign Studio campaign artifacts.

Read the authoring guide before calling write operations. Never place bearer tokens in authored HTML or documentation.

## Authoring

- [Complete authoring guide](https://HOST/docs/campaign-authoring.md): Workflow, bundle rules, forms, CTA tracking, widgets, fonts, preview, publishing, rollback, and examples.
- [OpenAPI 3.1 description](https://HOST/api/public/v1/openapi.json): Exact HTTP operations, authentication, payloads, responses, and errors.
- [Live authoring contract](https://HOST/api/public/v1/authoring-contract): Runtime version, limits, reserved slugs, supported attributes, fields, and widgets.
```

The proposal's own guidance says to test the index by giving an agent only `llms.txt` as its starting point and asking it questions about the content. Campaign Studio should add this as an acceptance test for the documentation surface. [The `/llms.txt` file, v2 — author guidance](https://llmstxt.org/#example)

## What Claude Code can consume from a public URL

Claude Code has a built-in `WebFetch` tool that accepts a URL and an extraction prompt. For HTML, it converts the response to Markdown and then uses a smaller model to extract an answer; Anthropic explicitly describes this path as lossy. Claude Code's request prefers Markdown via the `Accept` header. For exact raw content, Anthropic recommends using `curl` through the shell rather than relying on WebFetch's processed answer. [Claude Code WebFetch behavior](https://code.claude.com/docs/en/tools-reference#webfetch-tool-behavior)

Consequences for Campaign Studio:

- Serve the long-form guide directly as `text/markdown; charset=utf-8` (or honor Markdown content negotiation) to avoid HTML navigation and conversion noise.
- Keep pages focused and reasonably sized because WebFetch truncates large responses.
- Serve OpenAPI and the authoring contract as raw JSON. Tell agents to retrieve them exactly with `curl` or an equivalent HTTP client when exact schemas/values matter.
- Avoid cross-host redirects on canonical documentation URLs; Claude Code handles a redirect to a different host as a second fetch.
- Expect a first-use permission prompt for a new domain in Claude Code's default permission modes unless the user or organization has preapproved it.

Claude Code also has `WebSearch`, but search returns result links and then relies on WebFetch to read a selected page. Search indexing is therefore helpful but less deterministic than supplying the canonical URL. [Claude Code WebSearch behavior](https://code.claude.com/docs/en/tools-reference#websearch-tool-behavior)

Claude Code project memory can import other **filesystem paths** from `CLAUDE.md` using `@path/to/import`; Anthropic documents relative and absolute paths, not remote URL imports. A repository can place the public docs URL in `CLAUDE.md`, but it cannot rely on `@https://...` as a documented remote import mechanism. [Claude Code project memory imports](https://code.claude.com/docs/en/memory#import-additional-files)

No reviewed Anthropic documentation promises that Claude Code automatically checks `/llms.txt`, `robots.txt`, or `sitemap.xml` after receiving an arbitrary site URL. The documented deterministic mechanisms are an explicit URL fetched with WebFetch/shell access or a configured MCP server. Therefore onboarding should say, for example: “Read `https://HOST/llms.txt` before authoring a Campaign Studio campaign.”

## `robots.txt` and sitemaps

`robots.txt` is the Robots Exclusion Protocol standardized by RFC 9309. It tells crawlers which paths they may retrieve; it is not an API description or an LLM instruction format. The RFC allows crawlers to interpret other records such as `Sitemap`, but those records are outside the core protocol. It also warns that `robots.txt` is not an access-control or security mechanism. [RFC 9309, sections 2.2.4, 2.3, and 2.5](https://www.rfc-editor.org/rfc/rfc9309.html)

Campaign Studio should ensure the public guide, `llms.txt`, OpenAPI document, and authoring contract are not disallowed to relevant user agents. It should not expose private paths in `robots.txt` or treat crawler allowance as authorization.

The Sitemap protocol lists canonical URLs for search-engine crawlers. Search engines use it to discover and crawl pages more efficiently; even then, a sitemap is only a hint and does not guarantee crawling or indexing. [Sitemaps protocol](https://www.sitemaps.org/protocol.html), [Google Search Central sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)

A sitemap may include the public human documentation page for ordinary search visibility. It is not necessary for a coding agent given a direct `llms.txt` or guide URL, and it does not communicate workflow or attribute semantics. Do not add JSON API endpoints merely to make a sitemap serve as an agent documentation index.

## MCP applicability

MCP is an open protocol for connecting AI applications to external systems. MCP servers can expose three primitives: prompts, resources, and tools. Resources provide contextual content; tools let the model perform actions. [MCP server primitives](https://modelcontextprotocol.io/specification/2025-11-25/server), [MCP introduction](https://modelcontextprotocol.io/docs/getting-started/intro)

For a remote server, the current standard transport is Streamable HTTP at an explicit endpoint such as `https://example.com/mcp`. The client connects to the given endpoint and performs an initialization handshake. The transport specification does not turn an ordinary REST API or arbitrary website URL into an MCP server. [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Claude Code supports remote MCP servers, but they must be configured, for example with `claude mcp add --transport http NAME https://HOST/mcp`. Project-scoped configuration can be checked into `.mcp.json` and requires user approval. [Claude Code MCP setup](https://code.claude.com/docs/en/mcp)

MCP would be valuable later if Campaign Studio wants a first-class agent integration that exposes operations such as:

- `create_campaign`
- `create_artifact_upload_session`
- `upload_artifact_file`
- `finalize_artifact`
- `publish_artifact`
- `unpublish_artifact`
- `list_campaigns`
- `get_authoring_contract`

The server could expose the guide and live contract as resources and carry concise usage instructions in its initialization response. This would give Claude typed callable tools and centralize safety checks. It also adds an MCP server, authentication flow, configuration/approval, versioning, and maintenance surface. For the immediate requirement—letting Claude learn the existing HTTP API and author artifacts—public Markdown plus complete OpenAPI and contract JSON are simpler and sufficient. MCP should be a product integration decision, not a prerequisite for publishing good docs.

## Required content of the complete authoring guide

The public guide should answer all of the following without requiring source-code inspection:

### Authentication and lifecycle

- Base URL and API version.
- How bearer tokens are supplied, the scopes/roles required, and how tokens must be kept out of bundles and logs.
- How to create an artifact-capable campaign, or an explicit statement that the campaign must already exist and how to select it.
- The exact create/upload/finalize/preview/publish/rollback/unpublish sequence.
- Which identifiers each response returns and which identifier the next operation consumes.
- Idempotency/retry behavior, upload-session expiry, immutable-version behavior, and rollback semantics.

### Bundle contract

- Required `index.html`, path normalization, nested paths, and slug rules.
- File-count, per-file, and total-size limits.
- Supported media types and correct `Content-Type` for each upload.
- Relative asset-reference behavior, URL rewriting, and treatment of external URLs.
- Explicitly forbidden JavaScript, executable content, iframes, inline event handlers, unsafe HTML, root-relative paths, missing references, and unsupported files.
- Font families, weights, injected variables, and whether the runtime overrides authored typography.

### Forms

- Exact activation markup (`data-cs-form="lead-intake"`) and optional/required `data-cs-form-key` behavior.
- Every supported field, requiredness, type, validation/length limits, normalization, and the business meaning of `scope`.
- Whether unknown fields are ignored or rejected.
- Submit-button, pending, success, and error behavior.
- `data-cs-form-status` semantics and what happens when it is absent.
- Duplicate submissions, network failures, and preview-mode behavior.
- Runtime-managed submission and identity/campaign metadata injection; authors must not call internal endpoints or author IDs themselves.

### CTA tracking

- Exact activation marker (`data-cs-action="cta"`).
- Allowed `data-cs-cta-type` values and behavior for each (`email`, `booking`, `form`, `navigation`, or the actual canonical set).
- Requiredness, allowed format, uniqueness, and analytics meaning of `data-cs-cta-key`.
- Meaning and allowed values of `data-cs-cta-section`.
- Supported elements/events, link behavior, modifier/middle-click behavior if relevant, and preview-mode behavior.
- What event is recorded, when it is recorded, and which campaign/page identity is supplied by the runtime.

### Widgets and runtime

- Exact `data-cs-widget="booking-calendar"` markup, placement requirements, loading/failure state, and preview behavior.
- Runtime and authoring-contract versions, compatibility policy, and deprecation behavior.
- Injected styles/scripts/metadata and the boundary between authored markup and platform-managed behavior.

### Examples and troubleshooting

- One minimal valid complete bundle.
- One complete bundle containing tracked CTAs, a lead form, a booking widget, assets, and platform fonts.
- Copyable `curl` examples with representative JSON responses for the entire lifecycle.
- Common validation failures mapped to corrections.
- A clear source-of-truth statement: OpenAPI for HTTP shapes, live authoring contract for supported runtime values/limits, and the Markdown guide for semantics and workflow.

## Implementation order

1. Complete and validate the OpenAPI schemas and examples for every campaign/artifact operation.
2. Expand the runtime-derived authoring contract so every attribute includes allowed values, requiredness, defaults, and behavioral descriptions rather than names alone.
3. Publish the complete Markdown guide from version-controlled content and link it from OpenAPI `externalDocs`.
4. Make the OpenAPI description, guide, and non-secret authoring contract publicly readable.
5. Add a concise `/llms.txt` that links those three resources.
6. Optionally add an HTML rendering of the guide with a Markdown alternate and `Link` headers.
7. Test with Claude Code starting from only `/llms.txt`, then test exact calls against a non-production environment with a scoped token.
8. Consider MCP only after the REST authoring contract is complete and stable.

## Sources

- [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)
- [The `/llms.txt` file, v2](https://llmstxt.org/)
- [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)
- [Google Search Central: sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Claude Code tools reference](https://code.claude.com/docs/en/tools-reference)
- [Claude Code project memory](https://code.claude.com/docs/en/memory)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-11-25)
