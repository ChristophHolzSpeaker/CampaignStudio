# Design System Strategy: Kinetic Editorial (Light Mode)

## 1. Overview & Creative North Star: "The Living Manuscript"

This design system moves away from the static, boxy constraints of traditional SaaS interfaces and toward the fluid, high-contrast world of avant-garde print media. Our Creative North Star is **"The Living Manuscript."**

We treat the digital viewport as a premium paper stock where information isn't just "placed," but "composed." By leveraging the **Kinetic Editorial** aesthetic, we use intentional asymmetry, aggressive typographic scales, and tonal layering to guide the eye. This isn't a "website"; it is a curated experience that feels both authoritative and dangerously modern.

## 2. Colors: Tonal Depth & The "No-Line" Rule

The palette is anchored by a clinical, high-end white base, punctuated by a visceral, high-energy primary accent.

### Color Tokens

- **Primary (The Kinetic Pulse):** `#b8002a` (Primary) and `#e2183b` (Primary Container). This is our focal point. Use it sparingly to denote action or critical narrative shifts.
- **Neutral Base:** `#f9f9f9` (Surface/Background). A slightly off-white, gallery-style neutral that prevents eye strain and feels more "editorial" than pure hex white.
- **Tonal Tiers:**
- `#ffffff` (Surface Container Lowest)
- `#f3f3f3` (Surface Container Low)
- `#eeeeee` (Surface Container)
- `#e2e2e2` (Surface Container Highest)

### The "No-Line" Rule

**Prohibit 1px solid borders for sectioning.** Structural separation must be achieved exclusively through background color shifts. For example, a `surface-container-low` section should sit against a `surface` background to define its boundary.

### Signature Textures

To escape the "flat" look, apply subtle linear gradients to primary CTAs. Transition from `primary` (`#b8002a`) to `primary_container` (`#e2183b`) at a 135-degree angle. This adds "soul" and depth to the kinetic elements of the UI.

## 3. Typography: Bureau Grot System

The system now runs on the locally hosted Bureau Grot family. Headings and buttons rely on **Bureau Grot Compressed** in uppercase to deliver a kinetic, editorial shout, while all body copy sits in **Bureau Grot** (book/light) to keep long reads soft and legible.

- **Display (The Headline Act):** `display-lg` (3.5rem) and `display-md` (2.75rem) in Bureau Grot Compressed. Stack these across sections, allowing overlaps with imagery or containers to punctuate the layout while keeping the uppercase treatment sharp.
- **The Utility Scale:** `label-md` and `label-sm` (0.75rem / 0.6875rem). Reserve this scale for metadata, breadcrumbs, and small callouts—always uppercase with 0.05em to 0.08em letter spacing to echo editorial annotations.
- **Body:** `body-lg` (1rem) in Bureau Grot (book/light) with a 1.6 line height. This weight keeps longform narration calm beneath the aggressive compressed headlines.

Buttons and other call-to-action text mirror the heading approach: Bureau Grot Compressed, uppercase, tight letter spacing, zero border radius. Treat them as typographic anchors rather than pastel tokens.

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are largely forbidden. We define hierarchy through the **Layering Principle.**

- **Nesting:** Place a `surface-container-lowest` (#ffffff) card on top of a `surface-container-low` (#f3f3f3) background. This creates a "soft lift" that feels organic to the paper-stock metaphor.
- **Glassmorphism:** For floating navigation or modals, use `surface` colors at 80% opacity with a `20px` backdrop-blur. This allows the kinetic energy of the background content to bleed through, maintaining a sense of place.
- **Ambient Shadows:** If a shadow is required for a floating action button, use the `on-surface` color (#1a1c1c) at 4% opacity with a `48px` blur and `16px` Y-offset. It should feel like a soft glow, not a hard edge.
- **The Ghost Border:** If accessibility requires a border, use `outline-variant` (`#e6bdbc`) at 15% opacity.

## 5. Components: Editorial Primitives

All components follow a strict **0px border-radius** (Square/Hard Edge).

- **Buttons:**
- **Primary:** Background: `primary` gradient; Text: `on-primary` (#ffffff); Radius: 0px. High padding: `1rem` (top/bottom) by `2rem` (left/right).
- **Tertiary:** No background. Underline with a 2px `primary` stroke that expands on hover.
- **Cards:** No borders. Use `surface-container-low` backgrounds. Headline should be `headline-sm` with a `primary` color "kicker" (label-sm text) above it.
- **Inputs:** Bottom-border only (2px `outline`). On focus, the border transitions to `primary`. Labels should be `label-md` in `on-surface-variant`.
- **The Kinetic Divider:** Instead of a line, use a `3.5rem` (Spacing 10) vertical gap. If a visual break is needed, use a wide, thin rectangle of `surface-container-highest` (`#e2e2e2`) at a height of 4px.

## 6. Do’s and Don’ts

### Do:

- **Embrace White Space:** Use the `24` (8.5rem) spacing token between major sections.
- **Asymmetric Alignment:** Align some text blocks to the far left and others to a 60% center-offset to create visual tension.
- **Type as Image:** Treat large `display` type as a graphic element.

### Don't:

- **No Rounded Corners:** Never use `border-radius`. This design system is built on the precision of the right angle.
- **No Generic Icons:** Avoid thin-line "wireframe" icons. Use solid, bold, "chunky" icons that match the weight of Space Grotesk.
- **No "Grey" Text:** Never use `#777777`. Use the `on-surface-variant` (`#5d3f3f`) for secondary text to keep the warmth of the palette.
