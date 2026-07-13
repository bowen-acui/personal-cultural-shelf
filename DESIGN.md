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
| Focus backdrop | `--focus-backdrop` | `rgb(35 31 27 / 58%)` | A warm, translucent retreat behind one touched work |
| Glass surface | `--glass-surface` | `rgb(244 241 234 / 78%)` | Focus layer, filter and catalog tools |
| Glass edge | `--glass-edge` | `rgb(255 255 255 / 56%)` | Refracted inner highlight |

No dark theme is included in the first version. Cover artwork retains its original colors.

## 3. Typography

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| Brand | 24px | 400 | 1 | -0.02em | Site name |
| Book title | 18px | 400 | 1.15 | -0.01em | Selected-book slip |
| Body | 14px | 400 | 1.4 | 0 | Author |
| Mono | 10px | 400 | 1.3 | 0.08em | Navigation, count |

- Display serif: `"Instrument Serif", Georgia, serif`; used by the source for the brand and editorial headings.
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

## 5. Components

### Media Navigation

- **Structure**: brand link followed by `书 / 影 / 音` text items.
- **States**: one of `书` / `影` / `音` active; all three load real records from the shared media data source.
- **Accessibility**: semantic `nav`; active category uses `aria-current="page"`.
- **Motion**: none.

### Cover Object

- **Structure**: native button containing one proportional image and an accessible label.
- **States**: default is rotated and shadowed; hover/focus raises z-index and reveals the information slip; press compresses to 98.5%; click opens the Focus Layer.
- **Accessibility**: keyboard reachable, visible focus ring, image alt contains title and author, pressed state reflects mobile selection.
- **Motion**: source transition is 300ms for transform and shadow; reduced-motion mode makes the transition immediate.

### Focus Layer

- **Structure**: a native dialog containing the full cover, one media label, title, creator, public categories, and books' optional completion month.
- **States**: closed, entering, open, switching, leaving. Only one work can be focused at once.
- **Interaction**: one click, Enter, or Space opens it; clicking the surrounding backdrop, Escape, media navigation, Filter, or Share closes it. Clicking another cover switches focus directly. Dragging never opens it.
- **Material**: warm translucent paper, one refracted highlight, one inner shade, and two warm shadows. It is not blue-purple glass and carries no decorative glow.
- **Accessibility**: `aria-labelledby`, `aria-describedby`, a 44px close target, focus moves into the dialog and returns to the triggering cover.

### Information Slip

- **Structure**: title, creator, books' completion month, optional categories.
- **States**: hidden by default; visible only for the active cover.
- **Accessibility**: associated with the cover through `aria-describedby`; content is always present in the DOM.
- **Motion**: opacity and transform only, 200ms ease-out.

### Control Capsule

- **Structure**: fixed warm-dark capsule with three groups: layout (Scatter, Shake, Tidy, Vortex), action (Filter, Share), and destination (Catalog). The collection count sits in the footer.
- **States**: default, active, pressed, hover, focus, compact mobile. Active layout uses an inset surface and a small accent dot rather than a solid accent pill.
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

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Cover emphasis | 300ms | ease | Transform and shadow, observed source behavior |
| Slip reveal | 200ms | ease-out | Opacity and transform |
| Tidy | 700ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Grid arrangement with 18ms stagger |
| Vortex | 900ms | `cubic-bezier(0.2, 1.6, 0.4, 1)` | Spiral arrangement with 8ms stagger |
| Filter | 400ms | ease | Dim unrelated covers to 0.12 |
| Focus layer | 320ms | `cubic-bezier(0.22, 1, 0.36, 1)` | Cover and information settle into the warm glass layer |
| Focus backdrop | 240ms | ease-out | Environment recedes without disappearing |
| Press | 80ms | ease-out | Physical compression to 0.985 |

- No continuous animation, parallax, or decorative motion.
- Shake recomputes Scatter positions; Scatter, Tidy, and Vortex are explicit user-chosen modes.
- Pointer and touch dragging update only the selected cover position.
- Hover and focus share the same visual state.
- Tap opens one cover in the Focus Layer; tapping the surrounding canvas or pressing Escape closes it.
- `prefers-reduced-motion: reduce` removes transition duration.

## 7. Depth & Surface

Strategy: mixed, limited to the physical cover metaphor and the single touched-work Focus Layer.

| Level | Value | Usage |
|---|---|---|
| Cover rest | `2px 4px 12px rgb(0 0 0 / 15%), 0 1px 3px rgb(0 0 0 / 10%)` | Observed source cover shadow |
| Cover active | `8px 16px 28px rgb(0 0 0 / 24%), 0 3px 8px rgb(0 0 0 / 14%)` | Focused cover |
| Slip | `0 8px 24px rgb(0 0 0 / 14%)` | Paper information slip |
| Focus glass | `0 1px 0 rgb(255 255 255 / 56%) inset, 0 -1px 0 rgb(70 58 47 / 9%) inset, 0 18px 48px rgb(55 44 35 / 22%), 0 4px 14px rgb(55 44 35 / 14%)` | Touched-work layer |

Covers use the observed 4px radius. Glass is reserved for transient interaction layers and the catalog tool strip; it never wraps every item into a card.

## 8. Accessibility Constraints & Accepted Debt

Layer contract: header `--layer-header: 40`, active object `--layer-object-active: 50`, filter `--layer-filter: 60`, controls `--layer-controls: 70`, status `--layer-status: 80`. Dialogs use the browser top layer. Every interactive target is at least 44px, and transient states are mutually exclusive.

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
