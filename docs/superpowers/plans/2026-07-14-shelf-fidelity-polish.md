# Shelf Fidelity Polish Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a verification checkpoint after each task. Preserve the existing vanilla HTML/CSS/JS architecture and the The Visible Shelf visual contract.

**Goal:** Make the three-shelf personal cultural map denser, more discoverable, more accessible, and lighter to load without adding new product capabilities.

**Architecture:** Keep the existing static HTML pages, shared `app.js`, layout functions in `lib/layouts.js`, and build-time public JSON. Update the shared shelf shell consistently across book, film, and music pages; keep browse/about as separate static templates. Generate smaller cover derivatives during the existing local build flow and keep source records private.

**Tech Stack:** Vanilla HTML, CSS, ES modules, Node test runner, local Obsidian build script, real Chrome browser QA.

---

### Task 1: Synchronize page metadata and keyboard focus

**Files:**
- Modify: `app.js`
- Modify: `index.html`, `film.html`, `music.html`, `browse.html`, `about.html`
- Modify: `styles.css`, `shelf.css`, `pages.css`
- Test: `test/site.test.mjs`

- [ ] Add one media metadata map in `app.js` for title, description, label, and path. Update `document.title` and the description node inside `renderType`, including `popstate` navigation.
- [ ] Add `aria-pressed` to each layout-mode button and update it from `applyLayout`.
- [ ] Store the filter/share trigger before opening transient UI. Focus the first filter pill in `showFilters`; focus the first visible cover in `startPicking(true)`; restore the stored trigger on close/cancel/generation.
- [ ] Add the same skip link and `main` target to film, music, browse, and about pages. Give the main content stable IDs.
- [ ] Give desktop navigation and footer links a 44px visual hit area without changing their optical text size.
- [ ] Replace `setError` string interpolation with `createElement`, `textContent`, and `append`.
- [ ] Add tests for metadata synchronization source markers, layout `aria-pressed`, skip links on all pages, and absence of error `innerHTML` interpolation.
- [ ] Run `npm test` and verify 25 existing tests plus the new assertions pass.

### Task 2: Rebalance the shelf density and mobile controls

**Files:**
- Modify: `lib/layouts.js`
- Modify: `shelf.css`, `styles.css`
- Modify: `index.html`, `film.html`, `music.html`
- Test: `test/layouts.test.mjs`, `test/site.test.mjs`

- [ ] Add type-specific mobile density values: books use four columns, music uses five columns, films retain the current five-item breathing room.
- [ ] Reduce music row heights and compute a bounded stage height so 205 albums target 2,200–2,800px desktop and 3,600–4,800px mobile.
- [ ] Keep cover widths at or above 88px on mobile; preserve deterministic scatter, tidy, vortex, drag, and reduced-motion behavior.
- [ ] Restructure the mobile control capsule into a fixed count segment, scrollable action segment, and always-visible catalog segment. Add a subtle edge fade to the action segment only.
- [ ] Add compact-title styling through a data attribute/class when the work title exceeds the long-title threshold; keep the short-title card unchanged.
- [ ] Add tests for the new density bounds and catalog visibility structure.
- [ ] Run layout tests and inspect fresh 390/768/1365px screenshots.

### Task 3: Align utility surfaces and Chinese typography

**Files:**
- Modify: `shelf.css`, `pages.css`, `styles.css`
- Modify: `app.js`, `catalog-page.js`
- Modify: `test/site.test.mjs`

- [ ] Tune the filter and poster dialog surfaces toward the existing paper/deep-control tokens: retain utility separation, reduce generic glass brightness and blur, and preserve the current transparent work-dialog backdrop.
- [ ] Reduce the close control’s visual dominance while preserving a 44px hit area and keyboard label.
- [ ] Add `text-wrap: pretty`/`balance` and controlled max-widths to about copy and detail text so Chinese semantic phrases do not orphan.
- [ ] Ensure native search clear affordance and select controls use the existing warm palette where the browser permits styling.
- [ ] Add an explicit empty catalog message action that clears the search without introducing a new page or feature.
- [ ] Verify the longest music title and the about page at 390px and 1365px.

### Task 4: Build smaller local cover assets

**Files:**
- Modify: `scripts/build-library.mjs`
- Modify: `catalog-page.js`, `app.js`
- Modify: `package.json` to add the build-only `sharp` image processor
- Test: `test/build-library.test.mjs`, `test/media-data.test.mjs`

- [ ] Add a build-time cover derivative step using `sharp` that produces 320px and 720px WebP assets from the copied Obsidian cover, retaining the source JPEG as fallback.
- [ ] Keep the public record’s `cover` field pointing to the 320px derivative and add a `coverLarge` field pointing to the 720px derivative for every record; never publish source-vault paths.
- [ ] Render shelf and catalog images with explicit dimensions plus `srcset`/`sizes` so the browser does not download 1200px originals for 150–220px cards.
- [ ] Preserve deterministic hashed names and remove orphaned derivatives during build.
- [ ] Add tests for derivative naming, public-path containment, and no missing referenced files.
- [ ] Measure output size and record the before/after totals; target total covers under 25MB and music first-view transfer under 3MB.

### Task 5: Remove runtime font dependency and complete publication details

**Files:**
- Modify: `styles.css`
- Create: `public/fonts/` only with the required local WOFF2 files
- Create: `public/favicon.svg`, `404.html`
- Modify: all five HTML pages for favicon, social metadata, and skip links
- Test: `test/site.test.mjs`

- [ ] Add local Instrument Serif and Space Mono assets with `font-display: swap`; keep the Chinese system font stack unchanged.
- [ ] Remove the Google Fonts `@import` so offline rendering uses the same typography as online rendering.
- [ ] Add a small monochrome favicon derived from the project wordmark, not a third-party logo.
- [ ] Add page-specific Open Graph/Twitter metadata using relative project assets; leave canonical unset until the final GitHub Pages URL is known.
- [ ] Add a branded 404 page with a return-to-shelf link and the same paper grid.
- [ ] Test direct page loads, missing page navigation, font loading, and metadata presence.

### Task 6: Full regression and visual QA

**Files:**
- Modify: `DESIGN.md` only where new tokens or states were added
- Modify: `README.md` only where build/output instructions changed
- Test: all `test/*.mjs`

- [ ] Run `npm test`, `node --check` on all changed modules, and `git diff --check`.
- [ ] Run real Chrome at 390×844, 768×900, and 1365×768 for book, film, music, browse, and about.
- [ ] Verify default scatter, hover/focus, drag suppression, shake, tidy, vortex, filter, share, detail flip, backdrop close, Escape close, empty search, error retry, and browser back/forward.
- [ ] Verify no horizontal overflow, no orphaned Chinese characters, no clipped long title, and catalog visible without horizontal scrolling on mobile.
- [ ] Record screenshots and resource metrics for before/after comparison. Do not claim completion until the fresh screenshots and all tests pass.
