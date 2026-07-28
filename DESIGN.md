# 阿崔的精神地图 Design System

## 0. Research Log

- Live reference: scanned 10 public page templates and the home page at 375px, 768px, and 1280px. Raw captures stay local in the ignored `research/reference/`; publishable findings live in `research/THE_VISIBLE_SHELF_AUDIT.md`.
- Runtime tokens: extracted with `getComputedStyle`; the values below are the rendered contract, not estimates from a screenshot.
- Interaction reference: drove and recorded Shake, Filter, Tidy, Scatter, Vortex, Share, category selection, hover, fixed controls, responsive states, and detail navigation.
- Architecture reference: `research/THE_VISIBLE_SHELF_AUDIT.md` records page roles, client functions, events, resources, and migration boundaries.
- Skipped reference lanes: embedded brands, Lazyweb, and generated concepts were excluded because the user required The Visible Shelf as the only visual reference.

## 1. Atmosphere & Identity

A personal library emptied onto a warm paper table. The signature is abundance without interface noise: real covers overlap into an irregular editorial composition, while navigation and metadata recede until requested. It should feel curated by a person, not catalogued by a platform.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Paper | `--paper` | `rgb(232 226 216)` / `#e8e2d8` | Page background and browser theme, observed source body |
| Paper light | `--paper-light` | `rgb(244 241 234)` | Information slip |
| Ink | `--ink` | `rgb(26 26 26)` | Primary text, observed source body |
| Ink muted | `--ink-muted` | `rgb(92 87 79)` | Creator and category |
| Control | `--control` | `rgb(42 40 38)` | Bottom capsule |
| Control text | `--control-text` | `rgb(255 255 255)` | Capsule content |
| Focus | `--focus` | `rgb(181 86 57)` | Focus ring and selected state |
| Active | `--active` | `rgb(196 93 62)` | Active control, observed source |
| Paper line | `--paper-line` | `rgb(213 206 194)` | Subtle page ruling |
| Focus backdrop | `--focus-backdrop` | `rgb(35 31 27 / 58%)` | Share-poster dialog backdrop only |
| Glass surface | `--glass-surface` | `rgb(244 241 234 / 78%)` | Filter and share tools only |
| Glass edge | `--glass-edge` | `rgb(255 255 255 / 56%)` | Refracted inner highlight |

No dark theme is included in the first version. Cover artwork retains its original colors.

## 3. Typography

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| Brand | 24px | 400 | 1 | -0.02em | Site name |
| Book title | 18px | 400 | 1.15 | -0.01em | Selected-book slip |
| Body | 14px | 400 | 1.4 | 0 | Author |
| Mono | 10px | 400 | 1.3 | 0.08em | Navigation, count |

- Display serif: `"Instrument Serif", Georgia, serif`; used by the source for the brand and editorial headings. Instrument Serif and Space Mono are checked into `public/fonts/` so the layout does not depend on a font CDN.
- Detail Chinese text: `"LXGW WenKai", "霞鹜文楷", var(--font-display)`; reserved for the flipped work object so the information side feels handwritten and distinct without changing navigation or controls.
- Interface sans: `Inter, -apple-system, sans-serif`; used by the source for body text.
- Interface mono: `"Space Mono", monospace`; used by the source for controls, labels, and metadata.

## 4. Spacing & Layout

Base unit: 4px.

| Token | Value | Usage |
|---|---:|---|
| `--space-1` | 4px | Tight metadata gap |
| `--space-2` | 8px | Inline navigation gap |
| `--space-3` | 12px | Information slip padding |
| `--space-4` | 16px | Mobile page edge |
| `--space-6` | 24px | Header padding |
| `--space-8` | 32px | Desktop page edge |

- Header: fixed, transparent, full width, 32px desktop inset and 16px mobile inset.
- Stage: full-width, vertically scrollable paper canvas; no maximum content width.
- Covers: absolute-positioned inside the stage, seeded from each book identity so refreshes remain stable.
- Desktop cover width: 104-168px. Mobile cover width: 88-120px.
- Breakpoints: mobile `< 640px`, tablet `640-1023px`, desktop `>= 1024px`.
- Page texture: subtle vertical paper ruling, not a flat fill.
- Cover assets: the data builder emits deterministic `-320.webp` and `-720.webp` derivatives; the interface uses `srcset` and keeps the larger asset for the floating detail object.

## 5. Components

### Media Navigation

- **Structure**: brand link followed by `书 / 影 / 音` text items.
- **States**: one of `书` / `影` / `音` active; all three load real records from the shared media data source.
- **Accessibility**: semantic `nav`; active category uses `aria-current="page"`.
- **Motion**: none.

### Cover Object

- **Structure**: native button containing one proportional image and an accessible label.
- **States**: default is rotated and shadowed; hover/focus raises z-index; press gives a short physical response; one click opens the floating work object on the same shelf page.
- **Accessibility**: keyboard reachable, visible focus ring, image alt contains title and author, pressed state reflects mobile selection.
- **Motion**: scatter touch feedback is 180ms without overshoot; layout modes retain their editorial spring; reduced-motion mode makes the transition immediate.

### Information Slip

- **Structure**: title, creator, books' completion month, optional categories.
- **States**: hidden by default; visible on hover or keyboard focus. The floating object carries the full public information.
- **Material**: no panel, border, blur, or glass; typography stays attached to the cover object.
- **Accessibility**: associated with the cover through `aria-describedby`; content is always present in the DOM.
- **Motion**: opacity and transform only, 200ms ease-out.

### Control Capsule

- **Structure**: fixed warm-dark capsule reading left to right as count, three actions (Layout, Filter, Share), accent Catalog link. Grouping comes from rhythm, not rules: 16px between the three groups against 6px inside the action group, so the eye segments them without any divider element. Every label shares one vertical center; Catalog is optically raised 1px.
- **States**: default, pressed, hover, focus, compact mobile. Layout is a single cycling control whose label is the current arrangement, so no separate active treatment is needed. The capsule hugs its content at every width — it never stretches edge to edge on mobile — and the whole row fits a 320px viewport without clipping or horizontal scrolling.
- **Accessibility**: `aria-live="polite"` after data loads.
- **Motion**: controls use the observed 200ms transition.

### Category Pills

- **Structure**: wrapped buttons above the cover field, generated from public categories.
- **States**: hidden, open, selected, keyboard focus.
- **Accessibility**: `aria-pressed`; selected count remains visible in the control bar.
- **Motion**: opacity 400ms; unrelated covers dim to 0.12 rather than disappearing.

### Share Picker

- **Structure**: Pick Mode instruction, Cancel, five selectable covers, generated square poster dialog.
- **States**: idle, picking, selected, complete, dialog open.
- **Accessibility**: status text announces remaining count; dialog closes with Escape.
- **Motion**: cover opacity and selection ring only.

### Browse Grid

- **Structure**: page heading, search field, public category filters, responsive cover grid.
- **States**: full, filtered, search result, empty.
- **Accessibility**: native search input, live result count, semantic list.
- **Motion**: none.

### Floating Work Object

- **Structure**: a modal floating object on the current shelf page. Its front is the original cover; tapping it flips to a dark information back. Pointer devices open on the cover face because hover already revealed the slip; `hover: none` devices open on the information face, since a touch visitor has never seen the title and would otherwise be shown the cover they just tapped.
- **Information**: media type, title, creator, categories, and book completion month. Films and music never show dates.
- **Rating**: books alone show five dots representing the `rating` field from 1–5. Missing book ratings render as five empty dots; films and music show no rating row.
- **Material**: the reverse uses the same warm-dark surface as the control capsule, with a terracotta title accent and no glass card.
- **Dismissal**: close button, Escape, or tapping the transparent backdrop returns to the unchanged shelf. The shelf stays sharp and fully visible behind the floating object.
- **Motion**: 520ms GPU-composited `rotateY`; reduced-motion removes the transition.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Cover emphasis | 180ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Scatter hover, press, and focus feedback |
| Slip reveal | 200ms | ease-out | Opacity and transform |
| Tidy | 700ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Grid arrangement with 18ms stagger |
| Vortex | 900ms | `cubic-bezier(0.2, 1.6, 0.4, 1)` | Spiral arrangement with 8ms stagger |
| Filter | 400ms | ease | Dim unrelated covers to 0.12 |
| Press | 80ms | ease-out | Physical compression to 0.985 |

- No continuous animation, parallax, or decorative motion.
- Layout cycles Scatter, Tidy, and Vortex in that order; re-entering Scatter reseeds the composition, which replaces the former separate Shake action.
- Pointer dragging updates only the selected cover position; touch uses native scroll and tap-to-open instead.
- Hover and focus share the same visual state.
- Tap opens the floating work object without leaving the shelf; dragging remains a separate gesture and does not open it.
- `prefers-reduced-motion: reduce` removes transition duration.

## 7. Depth & Surface

Strategy: physical cover objects remain the only depth metaphor on the shelf.

| Level | Value | Usage |
|---|---|---|
| Cover rest | `2px 4px 12px rgb(0 0 0 / 15%), 0 1px 3px rgb(0 0 0 / 10%)` | Observed source cover shadow |
| Cover active | `8px 16px 28px rgb(0 0 0 / 24%), 0 3px 8px rgb(0 0 0 / 14%)` | Focused cover |
| Slip | `0 8px 24px rgb(0 0 0 / 14%)` | Paper information slip |

Covers use the observed 4px radius. Glass is reserved for utility tools such as filtering and poster generation; touching a work never creates another surface.

## 8. Accessibility Constraints & Accepted Debt

Layer contract: header `--layer-header: 40`, active object `--layer-object-active: 50`, filter `--layer-filter: 60`, controls `--layer-controls: 70`, status `--layer-status: 80`. The share dialog uses the browser top layer. Every interactive target is at least 44px, and transient states are mutually exclusive.

### Constraints

- Target WCAG 2.2 AA.
- Only books may expose a completion month; films and music never expose dates.
- Every book is reachable and identifiable by keyboard and screen reader.
- Focus contrast is at least 3:1 against the paper background.
- Touch target is the entire cover and therefore exceeds 44px.
- The composition has no horizontal overflow at 390px, 768px, or 1280px.
- Reduced-motion preference is respected.
- Relevant personas: keyboard-only visitor; mobile visitor using one hand; low-vision visitor using browser zoom; visitor who wants a quick public overview without private reading notes.
- Chinese display lines use the system serif stack with balanced wrapping; body copy stays within roughly 28-36 Chinese characters per line and uses pretty wrapping.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Cross-media relationships are not generated | Data adapters | The current product is a display archive, not an interpretation engine; inventing relationships would misrepresent the user. | Revisit only if the user explicitly requests a map layer. |
