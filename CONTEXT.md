# Campaign Studio

Campaign Studio creates controlled, campaign-specific landing pages and measures how those pages turn visitors into leads.

## Language

**Experiment**:
A time-bounded comparison of landing-page experiences intended to inform a product-owner decision.
_Avoid_: Test campaign, automatic optimization

**Control**:
The established landing-page experience against which an experiment compares a change.
_Avoid_: Default variant, old version

**Treatment**:
The changed landing-page experience being compared with the control.
_Avoid_: Winner, new default

**Assignment**:
The persistent allocation of an eligible visitor to one experiment variant.
_Avoid_: Exposure, impression

**Exposure**:
An eligible visit on which the visitor's assigned experiment variant is rendered, whether or not every external asset loads successfully.
_Avoid_: Assignment, successful playback

**Conversion**:
A lead-created outcome attributed to the visitor's assigned experiment and variant.
_Avoid_: CTA click, engagement

**Diagnostic event**:
A supporting observation, such as a CTA click or video playback error, that helps explain experiment performance but does not select the winner.
_Avoid_: Conversion, goal event

**Landing page**:
A campaign-owned public experience whose presentation comes from one published page version and whose platform behavior comes from Campaign Studio.
_Avoid_: Campaign page row, artifact, renderer

**Page version**:
A revision of a landing page whose finalized presentation and renderer type are immutable while lifecycle metadata records whether it is published.
_Avoid_: Landing page, active page

**Section version**:
A page version whose presentation is a validated structured document rendered through Campaign Studio's controlled section library.
_Avoid_: Legacy page, Svelte page

**Artifact version**:
A page version whose presentation is a validated external document and immutable assets rather than a Campaign Studio section document.
_Avoid_: Static site, uploaded HTML, bundle page

**Renderer type**:
The declared presentation strategy of a page version: section or artifact.
_Avoid_: Page type, route type

**Campaign Studio runtime**:
The versioned browser behavior that connects an artifact version's supported markup to Campaign Studio analytics, attribution, forms, conversions, and widgets.
_Avoid_: Tracking script, artifact JavaScript

**Authoring client**:
An authenticated external tool that creates presentation artifacts and manages their Campaign Studio lifecycle through the supported authoring contract.
_Avoid_: Admin user, AI agent
