# ARC Image Studio — redesign v2 ("Glass Atelier")

Date: 2026-11-07 · Base: `main` @ `7ce3919` (v2.5.0), released as v2.6.0.

This replaces the first redesign report. That pass changed colours and shortened
the hero but kept the landing-page structure and never compared against real
captures. This pass rebuilt the layout, compared before/after against real
renders of the running app, and fixed what the captures showed.

Screenshots: [`docs/redesign-v2/before`](docs/redesign-v2/before) (post-Codex state)
and [`docs/redesign-v2/after`](docs/redesign-v2/after). All are captures of the real
Electron app (real preload, real IPC, real fixtures), not mock-ups.

## 1. Audit of the previous redesign (10 problems, from captures)

1. **Landing page, not a workspace.** A ~230 px hero (gradient headline, promo card, three
   check-mark claims) sat above the work area on every tool.
2. **Primary controls below the fold.** At 1240×900 the Resizer's size controls and the CTA
   were off-screen; the whole window scrolled.
3. **Preview was a thumbnail.** The Resizer/Converter preview was ~450 px wide beside the list.
4. **Cards inside cards.** Every region was an equally bordered rounded box; no tonal hierarchy.
5. **Glass nowhere that mattered.** Blue glow and borders were everywhere; the actual
   navigation had no material behaviour.
6. **Navigation chrome was heavy.** Five pills with two-line labels, a separate brand name
   that changed per tool, and a v-pill in its own cell.
7. **File rows were uninformative.** Full path as detail text, tiny status pills, no thumbnails
   in the Resizer list.
8. **Metadata inspector was squeezed** into a narrow nested card.
9. **Typography was marketing-scale** with tracked all-caps kickers on every block.
10. **Motion was decorative or absent**: no continuous selection material, no real state
    transitions beyond a hover glow.

## 2. What changed in the experience

- **Fixed-viewport workspace.** Toolbar → one-line tool header → *main pane* (drop zone / file
  list / preview / result) + *inspector* (options) → floating action dock. The window never
  scrolls; panes scroll internally. First viewport at 1240×900 shows the active tool, where to
  add files, every option, the destination, the result and the primary action.
- **Navigation.** Compact glass segmented control with icons and labels; labels collapse to icons
  under 1040 px. A single glass thumb *slides* between tools on a damped-spring curve. Ctrl+1…5
  switches tools; ←/→/Home/End work on the tab list (proper `tablist`/`tab`/`tabpanel` roles).
- **Integrated title bar.** `titleBarStyle: 'hidden'` + `titleBarOverlay`: the toolbar is the drag
  region and the native Windows caption buttons sit in it (verified with an OS-level screen capture).
- **Resizer = preview-first.** Left: file list with thumbnails and per-file target. Centre: large
  checkerboard stage; the image, never the chrome, is the protagonist; name/dimensions/refresh float
  on a glass bar (Photos-style). Right: mode (Dimensões / Escala / Redes), W×H with an unambiguous
  lock toggle, percentage field+slider+shortcuts, platform chips and format list. A docked
  *result card* shows original vs new size and the pixel change with a proportional diagram, always
  visible.
- **Converter.** Four format tiles with a one-line trade-off each, quality slider with live fill,
  JPG background shown *on the image* (the stage stays dark), switches for lossless / ICC / metadata,
  all driven by the same state as before.
- **Renamer.** The before→after name table is the protagonist; accent-coloured new names, conflict
  notes inline, rule form in the inspector, a clear *copies vs originals* segmented choice and a
  warning that scrolls into view when "originals" is selected.
- **Metadata.** List (status collapses to a dot when narrow) + a dense inspector: summary, health,
  AI/Local/Capture tiles, evidence, sticky search + group filters, key/value rows grouped by
  EXIF/XMP/ICC/…. ICC preservation lives in the dock next to the action.
- **Empty / working / done / failed states** share one vocabulary: quiet drop zone with a drag-over
  state, real progress bar plus per-row working/success/error, a completion panel with big tabular
  numbers (draws its check once), and a CTA that visibly runs, succeeds or retries.

## 3. Design system

- **Tokens** (`styles/tokens.css`): graphite/frost/ice palette, semantic names only
  (`--pane`, `--pane-sunken`, `--text-2`, `--accent`, `--ok/--warn/--err`, glass tokens), 4-px
  spacing scale, control heights 28/34/42, type scale, durations and easings.
- **Three materials** (`styles/base.css`): *canvas* (solid), *pane* (solid, hairline, no blur),
  *glass* (toolbar nav, action dock, preview bar, popovers/toast). Glass = tint + fill gradient +
  backdrop blur/saturate + specular rim (1 px gradient border via masked pseudo-element) + inner
  highlight. **Only 4–5 elements carry `backdrop-filter`; no list row, thumbnail or table cell does.**
- **Concentric geometry.** Segmented container 13 px → thumb 10 px (padding 3); pane 18 px → inner
  controls 8–12 px.
- **Typography.** Inter only (tabular numerals for sizes, dimensions, progress). Tool names are
  sentence case; no all-caps kickers.
- **Icons.** One Lucide-derived inline sprite, one stroke style (see `THIRD_PARTY_NOTICES.md`).
- **Files.** `styles.css` (898 lines of layered patches) → `styles/{tokens,base,components,layout,tools}.css`.

## 4. Motion

All motion is CSS (`transform`/`opacity`), no library, no loop except the working spinner.

| Trigger | Behaviour |
| --- | --- |
| Tool switch | glass thumb slides (320 ms spring) + view rises in (280 ms) |
| Segmented / format tile / preset list / platform chips | the same continuous thumb moves between items, including 2-D grids |
| Hover | pointer-following light on buttons; 140 ms |
| Press | 0.97 scale, 90 ms |
| Switch | knob travels on a spring and stretches while pressed |
| Lock toggle | lock ↔ unlock icon morph |
| Drop zone drag-over | ring + glow fade in, icon lifts |
| Result card | proportional boxes animate to the new size |
| Batch finished | one-time badge pop + check stroke draw (≈ 600 ms) alongside the real numbers |
| Popovers / toast | 0.96 → 1 + opacity on a spring |

`prefers-reduced-motion` collapses all durations; `prefers-reduced-transparency` swaps every glass
surface for a solid one; `prefers-contrast: more` strengthens hairlines and tertiary text.

## 5. Performance

- File rows use `content-visibility: auto`; there is **no blur, shadow or animation per row**.
- Row selection uses one delegated listener per list instead of one per row per render.
- Progress renders are coalesced and **adaptively throttled** (a render that costs N ms may use at
  most ≈ ⅓ of the main thread).
- Measured in the real app (this machine, DOM-render only; native thumbnails/IPC excluded):
  1,200 files → add 148 ms, first render 33 ms, re-render 33 ms; 5,000 files → first render 128 ms,
  re-render 136 ms. Thumbnails are still lazy via `IntersectionObserver`.

## 6. Verification actually performed

| Check | Result |
| --- | --- |
| `npm test` | **28/28 pass** |
| `node --check` on `app.js`, `main.mjs`, `preload.cjs` | pass |
| Every `$('#id')` used by `app.js` exists in the new HTML (215 ids) | none missing |
| Renderer console during all scripted scenarios | no errors or warnings captured |
| **Real end-to-end batches** through the real IPC (9 fixtures each): Resizer (50 %), Converter (WebP), Renamer (copies), Metadata cleaner — each reached its completion panel and wrote its batch folder | pass |
| Compressor real batch | verified mid-run with live per-file progress (optipng on 3 MB PNGs is slow); completion UI verified with injected results |
| Window sizes 1000×720, 1240×900, 1600×900 | layouts checked, see screenshots |
| 150 % device scale (`--force-device-scale-factor=1.5`) | crisp, layout unchanged |
| Keyboard (synthetic key events in the real app): Tab focus ring, ←/→ tab navigation, Ctrl+2 tool switch, ↑/↓ row selection in the Resizer list. This exposed a real bug — list re-renders destroyed focus after one step — fixed by restoring focus to the same row after each render | pass after fix |
| Console probe: a deliberate `console.error`/`console.warn` is captured by the harness, so the "no errors" result above is meaningful | pass |
| Native caption buttons with the integrated title bar | verified by OS screen capture |

### Not verified / limitations

- **100 % and 125 % DPI were not separately captured** (only 100 % and 150 %). 125 % uses the same
  CSS path.
- **Windows file pickers** (`Selecionar imagens/pasta`) were not driven; tests inject files through
  the same IPC (`files:from-paths`, etc.) the drop/paste paths use.
- **Drag & drop from Explorer and Ctrl+V from the OS clipboard** were not exercised with real OS
  input; the drag-over *state* and the paste *toast* were rendered, and the handlers are unchanged.
- **Auto-update** UI was rendered with a simulated `available` state; no real update was downloaded.
- **`npm run dist` was not re-run** for this pass. Only `src/**` and licence files changed; the
  `files` whitelist in `package.json` is unchanged.
- Unlike `v45.2.3` in the screenshots, the real build shows `v2.5.0` (the harness runs the app
  through Electron's own `package.json`).
- Spring easings use CSS `linear()` (Chromium 113+; Electron 45 is fine).

## 7. Reference → component decisions

| Reference | Observed | ARC component | Decision |
| --- | --- | --- | --- |
| Apple Liquid Glass / HIG Materials | glass belongs to navigation and controls; content stays opaque | toolbar nav, dock, stage bar, popovers; panes solid | blur on 4–5 elements only; specular rim; solid fallback for reduced transparency |
| macOS Tahoe | light chrome, toolbar over content | integrated title bar + compact toolbar | `titleBarOverlay`, no hero |
| Finder (MacStories capture) | dense flat rows, quiet header | all file lists | flat rows, hairline header, thumbnails, no cards |
| Craft | concentric radii, selection that feels attached | segmented control, format tiles, preset list | one continuous sliding thumb everywhere |
| Apple Photos | image-first; tools float over it | Resizer/Converter stage | large stage, glass caption/action bar |
| Flighty | numbers as the interface | result card, summary, dock | tabular large figures, before/after, status in one line |
| Apple Music / Safari | segmented material, popovers | nav, modes, toast, update popover | spring thumb, scale-in popovers |

## 8. Deliberately not changed

- IPC channel names, payloads, `preload.cjs`, processing modules, output behaviour, updater.
- Security: `contextIsolation`, `sandbox`, `nodeIntegration: false` and the CSP are unchanged
  (no inline styles or scripts were introduced; `style` is only set through the CSSOM).
- Release workflow (the version was bumped to 2.6.0 for this release).
- No new dependency, no CDN, no remote font/asset; no Lottie file or Motion library was added
  (the referenced Lottie animations were re-created as local CSS/SVG motion instead).
- Not virtualised: lists stay in the DOM (content-visibility keeps this cheap up to the app's
  10,000-file cap; beyond a few thousand rows the first render is ~0.1–0.3 s).

## 9. Files

Added: `src/renderer/styles/{tokens,base,components,layout,tools}.css`, `docs/redesign-v2/**`.
Rewritten: `src/renderer/index.html`, `REDESIGN_REPORT.md`, `THIRD_PARTY_NOTICES.md`.
Changed: `src/renderer/app.js` (rows, selection, segmented thumbs, result card, throttled renders,
tab semantics), `src/main.mjs` (title bar + background colour only).
Removed: `src/renderer/styles.css`; unused Sora and Manrope fonts and their licences.
