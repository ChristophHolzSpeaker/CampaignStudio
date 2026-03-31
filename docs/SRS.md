# Software Requirements Specification (SRS)

## Project: Campaign Studio MVP

## Parent Initiative: Christoph Holz Speaker Management System

## Version: 1.0

## Status: Approved for MVP Build

---

## 1. Purpose

Campaign Studio MVP is the first implementation phase of Module 0 from the wider Speaker Management System SRS.

Its purpose is to prove that the system can:

1. accept structured campaign inputs,
2. generate a targeted landing page using AI,
3. publish that landing page to a public URL,
4. track basic source and visit data,
5. allow internal users to manage campaigns.

This MVP is **not** the full production version of Module 0. It is a focused, usable first release intended to validate the workflow and support real campaign testing.

---

## 2. MVP Goal

Enable an internal user to complete the following end-to-end loop:

**Create campaign → Generate landing page → Publish page → Receive visits → View basic tracking data**

Success for the MVP means this loop works reliably for real campaigns.

---

## 3. Scope

### In Scope

* Internal campaign management app
* Structured campaign intake
* AI-generated landing page content
* Structured page rendering using predefined components
* One landing page per campaign for initial MVP release
* Publish / unpublish workflow
* Public page routes
* Basic attribution capture
* Basic visit logging
* Basic campaign reporting
* Internal authenticated access

### Out of Scope

* Multi-variant generation
* A/B testing
* Advanced AI conversational editing UI
* Full production-grade SEO engine
* Full 100 percent attribution across all channels
* Advanced analytics dashboards
* Multi-tenant architecture
* Sophisticated RBAC
* Custom domains
* Agency/external collaboration workflows
* Automated briefing call booking integrations
* CRM / HubSpot deal syncing
* Production-grade email ingestion and signature parsing

---

## 4. System Overview

Campaign Studio MVP consists of:

1. **Internal App**

   * authenticated interface for creating and managing campaigns

2. **AI Generation Pipeline**

   * takes structured campaign input and generates page content and page structure

3. **Page Renderer**

   * renders generated structured data into predefined frontend components

4. **Publishing Layer**

   * exposes public landing pages through a stable URL

5. **Tracking Layer**

   * captures basic source/referrer/UTM data and logs visits

6. **Reporting View**

   * displays basic campaign performance data

---

## 5. Users

### 5.1 Internal Admin User

Primary MVP user.

Responsibilities:

* create campaigns
* edit campaign metadata
* generate landing pages
* preview pages
* publish/unpublish pages
* view basic tracking/reporting

### 5.2 Public Visitor

Visitor arriving on a published landing page.

Responsibilities:

* view page
* interact with CTA paths
* generate trackable visit/session data

---

## 6. Functional Requirements

## 6.1 Authentication

### FR-001

The system shall require authentication for access to the internal Campaign Studio app.

### FR-002

Only authenticated internal users shall be able to create, manage, generate, publish, or unpublish campaigns.

### FR-003

Public landing pages shall remain accessible without authentication.

---

## 6.2 Campaign Management

### FR-010

The system shall allow an internal user to create a campaign.

### FR-011

A campaign shall contain at minimum:

* campaign name
* audience
* format
* topic
* optional freeform notes or prompt instructions
* status

### FR-012

The system shall allow the internal user to view a list of campaigns.

### FR-013

The system shall allow the internal user to open an existing campaign.

### FR-014

The system shall allow the internal user to edit campaign metadata before generation.

### FR-015

The system shall allow a campaign to exist in one of the following states:

* draft
* generated
* published
* unpublished
* archived

---

## 6.3 AI Content Generation

### FR-020

The system shall allow an internal user to trigger AI generation for a campaign.

### FR-021

The generation input shall include at minimum:

* audience
* format
* topic
* optional freeform campaign notes

### FR-022

The AI pipeline shall generate:

* landing page content
* structured page representation for rendering
* metadata required for storage and preview

### FR-023

The system shall save generated output to persistent storage.

### FR-024

The system shall support regeneration of campaign output.

### FR-025

The system shall preserve campaign ownership of generated outputs so that generated content is associated with the correct campaign.

---

## 6.4 Structured Rendering

### FR-030

The system shall render generated page data using predefined frontend components.

### FR-031

The renderer shall support a fixed, controlled component library for MVP.

### FR-032

The generated page structure shall be validated before rendering.

### FR-033

If generated structure is invalid, the system shall reject publishing and surface an internal error state.

### FR-034

The rendered page shall be previewable internally before publishing.

---

## 6.5 Prompt-Based Update Support

### FR-040

The system shall support internal re-generation or update requests based on user prompt instructions.

### FR-041

The system may support targeted updates to page content or section ordering if the generated structure remains valid.

### FR-042

If targeted update logic is unstable or invalidates structure, the system may fall back to full regeneration.

### FR-043

The MVP does not require a polished conversational editing interface; prompt-based update can be initiated through a basic admin action.

---

## 6.6 Publishing

### FR-050

The system shall allow an internal user to publish a campaign page.

### FR-051

Publishing shall generate or activate a public URL for the campaign page.

### FR-052

The system shall allow an internal user to unpublish a campaign page.

### FR-053

Unpublished pages shall not be accessible to the public.

### FR-054

The system shall allow internal preview of unpublished pages.

### FR-055

The system shall store published slug or route information.

---

## 6.7 Public Landing Pages

### FR-060

Each published campaign shall have one public landing page URL for MVP.

### FR-061

Public pages shall render server-side or through a fast delivery path suitable for SEO-conscious landing pages.

### FR-062

Public pages shall include:

* headline and supporting copy
* page sections based on generated structure
* at least one CTA path
* campaign metadata where required for tracking

### FR-063

The public page shall support at least the following CTA types in MVP:

* contact form CTA placeholder or form
* external booking CTA link or placeholder
* email CTA link or placeholder

### FR-064

Exact downstream integrations for booking and email handling may be stubbed or simplified in MVP, provided the CTA path is represented.

---

## 6.8 Tracking and Attribution

### FR-070

The system shall capture available UTM parameters from public landing page visits.

### FR-071

The system shall capture available referrer data from public landing page visits.

### FR-072

The system shall log page visits associated with a campaign.

### FR-073

Visit records should include, where available:

* campaign ID
* page slug
* timestamp
* referrer
* utm_source
* utm_medium
* utm_campaign
* utm_term
* utm_content

### FR-074

The system shall support basic attribution visibility at campaign level.

### FR-075

The MVP does not require guaranteed cross-device or cross-session attribution.

---

## 6.9 Reporting

### FR-080

The system shall provide a basic reporting view for internal users.

### FR-081

The reporting view shall display at minimum:

* campaign name
* campaign status
* page URL
* visit count

### FR-082

The reporting view may additionally display simple grouped source data if available.

### FR-083

The MVP does not require advanced BI, charting, or funnel analytics.

---

## 7. Non-Functional Requirements

## 7.1 Performance

### NFR-001

Published pages should load quickly and minimize client-side JavaScript.

### NFR-002

The public landing page response path should avoid unnecessary runtime database composition where possible.

### NFR-003

Tracking must not materially block page rendering.

### NFR-004

The system should be designed so public pages are fast enough for paid campaign use and technically SEO-conscious usage.

### NFR-005

Perfect Core Web Vitals are not required for MVP, but obvious performance regressions are unacceptable.

---

## 7.2 Reliability

### NFR-010

Campaign data and generated outputs must persist reliably.

### NFR-011

A failed AI generation attempt must not corrupt campaign state.

### NFR-012

Publishing must only be allowed when required generated data exists and passes validation.

---

## 7.3 Security

### NFR-020

Internal app access must require authentication.

### NFR-021

Public routes must not expose internal admin functionality.

### NFR-022

The system must not expose raw internal prompts, secrets, or private configuration on public pages.

---

## 7.4 Maintainability

### NFR-030

The MVP shall favor a simple architecture over premature extensibility.

### NFR-031

The component renderer shall use a constrained component set to limit rendering complexity.

### NFR-032

The data model should allow future extension into multi-variant generation and richer reporting without requiring total rewrite.

---

## 8. Technical Constraints

### TC-001

Frontend application shall be built in SvelteKit.

### TC-002

Backend persistence shall use Supabase Postgres.

### TC-003

Authentication may use Supabase Auth.

### TC-004

Storage may use Supabase Storage if assets or generated artifacts require it.

### TC-005

Deployment target for the SvelteKit application is Vercel.

### TC-006

AI generation may be handled via server-side application logic and/or external model APIs.

### TC-007

The MVP should avoid infrastructure complexity unless directly necessary to support the core loop.

---

## 9. Suggested Data Model

This is a recommended MVP baseline, not a final schema.

## 9.1 campaigns

Fields:

* id
* name
* audience
* format
* topic
* notes
* status
* created_at
* updated_at
* created_by

## 9.2 campaign_pages

Fields:

* id
* campaign_id
* version_number
* structured_content_json
* rendered_snapshot_html (optional)
* slug
* is_published
* published_at
* created_at
* updated_at

## 9.3 campaign_visits

Fields:

* id
* campaign_id
* campaign_page_id
* slug
* visited_at
* referrer
* utm_source
* utm_medium
* utm_campaign
* utm_term
* utm_content
* user_agent
* ip_hash_or_session_identifier_if_used

## 9.4 generation_jobs (optional but recommended)

Fields:

* id
* campaign_id
* status
* input_payload
* output_payload
* error_message
* created_at
* completed_at

---

## 10. Assumptions

* MVP is internal-admin driven, not self-serve for external clients
* Only one campaign page output per campaign is required for initial release
* Multi-variant workflows are deferred
* SEO strategy at scale is deferred
* Attribution is basic and best-effort, not absolute
* Prompt-based surgical updates may fall back to full regeneration if needed
* UI polish is secondary to workflow completion

---

## 11. Exclusions and Deferred Items

Deferred to later phases:

* multi-user RBAC
* campaign collaboration workflows
* advanced prompt editing UI
* visual drag-and-drop editing
* multi-page campaigns
* full programmatic SEO rule engine
* structured schema library at large scale
* split testing
* advanced source-to-conversion reporting
* CRM and deal sync
* booking platform integration depth
* email ingestion and automatic lead extraction
* production-grade marketing analytics stack

---

## 12. Acceptance Criteria

The MVP shall be considered complete when all of the following are true:

### AC-001

An internal authenticated user can create a campaign.

### AC-002

A campaign can be submitted for AI generation.

### AC-003

The generated output is saved and can be previewed.

### AC-004

The generated page can be published to a public URL.

### AC-005

The published page can be viewed publicly.

### AC-006

Visits to the published page are logged with available UTM/referrer data.

### AC-007

The internal app displays a basic campaign list and basic visit counts.

### AC-008

A campaign can be unpublished and removed from public access.

### AC-009

The workflow from campaign creation to published page is reliable enough for real internal use.

---

## 13. Delivery Principle

This MVP is intended to validate the commercial and technical viability of Campaign Studio.

It is **not** intended to fulfill the full production ambition of Module 0 as described in the master SRS.

The MVP must prioritize:

* end-to-end usability
* simplicity
* speed of delivery
* real-world testability

over:

* platform completeness
* enterprise polish
* feature breadth
