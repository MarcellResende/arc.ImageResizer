# ARC Image Studio — Liquid Glass redesign report

Date: 2026-11-07

## Version and worktree findings

- Git `HEAD` is `2c8c78c`, tagged `v2.3.1`, and tracks `origin/main`.
- The working tree already contained uncommitted product work for version `2.5.0`.
- That work adds the Converter, Batch Renamer, clipboard image import, related IPC
  channels, and tests. It was treated as authoritative and preserved.
- No release version was changed by this redesign.
- The requested `referencias/telas_atuais/` directory is not present in this
  checkout, so the eight referenced screenshots could not be compared directly.

## Interface inventory

The redesign covers the five tools currently available:

1. Compressor: empty upload, selected queue, per-file working/success/error,
   real progress, disabled/running action, and result summary.
2. Resizer: upload, queue, image preview, dimensions, percentage, social presets,
   ratio lock, output summary, and refresh state.
3. Converter: upload, queue, preview, JPG/PNG/WebP/AVIF cards, quality,
   transparency background, lossless/ICC/metadata options, and summary.
4. Batch Renamer: upload, live preview, tokens, numbering, case rules, copy/original
   modes, warning, conflicts, processing, and summary.
5. Metadata: upload, analysis, dense inspector, search, group filters, AI/GPS/EXIF
   risk states, ICC option, processing, and privacy summary.

Global states include update checking/available/downloading/error, clipboard
feedback, drag-over, keyboard focus, reduced motion, and reduced transparency.

## Design system implementation

- Semantic CSS tokens cover graphite-blue backgrounds, stable content surfaces,
  contextual glass, borders, text, status colors, radii, shadows, duration, and
  easing.
- Glass is limited to the sticky navigation, contextual notices, and selected
  floating controls. Queues, configuration panels, previews, and metadata tables
  use stable opaque surfaces.
- The hero is shorter and uses a restrained 34–44 px title scale so files and
  controls appear earlier in the workflow.
- Navigation uses a five-position sliding selection material, roving keyboard
  focus, arrow/Home/End navigation, text plus icon, and visible focus rings.
- Drop zones work by drag-and-drop, click, Enter, and Space. Progress and result
  regions expose live status semantics.
- Continuous decorative animation was removed. Functional spinners and real
  progress remain; success runs once. `prefers-reduced-motion` and
  `prefers-reduced-transparency` are supported.
- No blur, animation, or shadow was added per file row. Existing lazy thumbnail
  observation and the 10,000-item/4-worker behavior remain untouched.

## Assets and licensing

- Navigation paths use five Lucide icons stored as inline local SVG. No runtime
  network request is required.
- The Lucide ISC notice is in `THIRD_PARTY_NOTICES.md` and is included in the
  Windows package.
- Existing Inter, Manrope, and Sora font files and licenses remain local. The
  interface now prioritizes Inter.
- No LottieFiles asset, Motion dependency, CDN, remote font, telemetry, or upload
  service was added.
- The legacy generated GIF assets and generator remain in the repository for
  compatibility, but the renderer does not reference those GIFs.

## Security and architecture

- Electron, vanilla HTML/CSS/JavaScript, IPC names, public processing signatures,
  output behavior, and update flow were preserved.
- CSP remains `default-src 'self'; style-src 'self'; script-src 'self'; img-src
  'self' data:`.
- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` remain
  enabled.
- No new renderer dependency or remote runtime resource was introduced.

## Validation

- `node --check src/renderer/app.js`: passed.
- `node --check src/main.mjs`: passed.
- `node --check src/preload.cjs`: passed.
- `npm test`: 28/28 tests passed.
- `npm start`: launched successfully; Compressor, Resizer, Converter, Batch
  Renamer, and Metadata empty/configuration states were inspected at 1240×900.
- Keyboard tool navigation and visible focus were exercised.
- Token contrast checks passed WCAG AA for normal text: primary text on content
  surface 16.26:1, secondary text 8.65:1, and tertiary text 5.44:1.
- `npm run dist`: Windows NSIS build completed. Signing was skipped because no
  code-signing certificate is configured.
- Automated interaction with the native Windows file picker was unreliable in
  this environment, so a complete end-to-end batch was not claimed as a manual
  UI pass. Processing pipelines are covered by the automated tests.

## Regression checklist

- [x] Converter and newer v2.5.0 features preserved.
- [x] DOM IDs and IPC channels preserved.
- [x] Compressor, resize, conversion, rename, and metadata tests pass.
- [x] Real progress wiring preserved.
- [x] Local-only assets and CSP preserved.
- [x] Update UI states retained and restyled.
- [x] Keyboard focus, arrow navigation, Enter/Space upload activation added.
- [x] Reduced motion/transparency fallbacks added.
- [x] Windows installer built successfully.
- [ ] Direct comparison with eight screenshots (files absent from checkout).
- [ ] Manual native file-picker batch at 100%, 125%, and 150% DPI.
