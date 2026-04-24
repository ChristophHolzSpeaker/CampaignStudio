# Campaign Studio User Journey

## Internal App Flow

### `/login`

- Internal user entry point.
- If already authenticated, auto-redirects to `/campaigns`.
- User submits email and password.
- Successful sign-in redirects to `/campaigns`.

### `/campaigns`

- Campaign library view for authenticated users.
- Lists campaigns with audience, format, language, geography, status, created date, and visit rollups.
- Filters narrow the list by format, audience, status, geography, and language.
- Primary actions: create campaign (`/campaign/new`), open campaign (`/campaigns/:id`), publish or unpublish.

### `/campaign/new`

- Campaign creation flow with two input modes: planner chat and manual fields.
- Required fields: name, audience, format, topic, language, geography.
- Planner mode iteratively resolves missing required fields before unlock.
- On create, the generation pipeline runs in this order:
  1. Validate campaign brief.
  2. Save campaign metadata.
  3. Generate Google Ads package.
  4. Generate landing page document.
  5. Persist assets and redirect to campaign detail.
- Pipeline progress is streamed live from `/campaign/new/progress`.

### `/campaigns/:id`

- Campaign detail workspace.
- Shows campaign status, strategy snapshot, ad package and ad groups, and visit metrics.
- Supports publish or unpublish.
- Strategy edit prompt triggers regeneration of strategy, ads, and landing page version.
- Provides live landing page URL when campaign is published.

### `/preview/landing-page?campaignPageId=...`

- Internal landing page preview and AI edit workspace.
- Loads selected campaign page version (or sample when no id is provided).
- Accepts prompt-driven landing page edits and loads the resulting new version.
- Editing is blocked while parent campaign is published.

### `/campaigns/analytics`

- Cross-campaign analytics dashboard.
- Date-range filtering via `from` and `to` query params.
- Displays KPI overview, funnel trend, campaign performance, source-medium performance, and CTA performance.

### `/campaigns/:id/analytics`

- Campaign-scoped analytics dashboard.
- Same reporting model as global analytics but filtered to one campaign.

## Public Landing and Booking Flow

### `/speaker/:slug`

- Public landing page route for published campaign pages only.
- Resolves structured page JSON and renders via predefined section registry.
- Logs visit and attribution context.
- Supports modal flows (showreel and booking) without full page navigation.

### `/book/l/new` -> `/book/l/:token` (lead booking)

- Used from campaign landing page CTA path.
- Intake captures lead details and validates campaign context.
- System creates or matches lead journey and issues booking link token.
- User is transitioned to token route to pick and confirm a slot.
- Confirmation finalizes booking or returns explicit conflict/unavailable states.

### `/book/g` (general booking)

- Public non-campaign booking path.
- Two-step flow:
  1. Intake and slot discovery.
  2. Slot confirmation.
- Honors booking policy, rule settings, and global pause controls.

### `/book/r/:token` (reschedule)

- Reschedule flow for an existing booking.
- Valid token loads current booking and replacement slots.
- User selects a new slot and confirms.

## Admin Configuration Routes

### `/admin/prompts`

- Lists generation prompts used by Campaign Studio.
- Supports activate or deactivate and edit navigation.

### `/admin/prompts/new`

- Creates a new prompt record for purpose/audience/format/topic combinations.

### `/admin/prompts/:id`

- Updates an existing prompt record.

### `/admin/bookings`

- Configures booking engine behavior.
- Updates lead and general booking rules.
- Enables global pause and custom pause message for public booking routes.

### `/admin/documentation`

- Internal documentation route that renders this markdown file.
- Intended as a source for operational journey diagrams and onboarding references.
