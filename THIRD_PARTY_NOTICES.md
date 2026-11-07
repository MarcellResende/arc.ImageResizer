# Third-party notices

## Lucide icons

The interface icon sprite (`src/renderer/index.html`, `<symbol id="i-…">`) uses
paths from, or redrawn after, Lucide Icons: `minimize-2`, `scaling`,
`arrow-left-right`, `case-sensitive`, `shield-check`, `upload`, `folder`,
`folder-open`, `plus`, `x`, `trash-2`, `check`, `triangle-alert`, `info`,
`search`, `lock`, `lock-open`, `refresh-cw`, `map-pin`, `camera`, `sparkles`,
`image`, `copy`, `pencil`, `arrow-right`, `download`, `zap`, and `file`.

Lucide is distributed under the ISC License. Some Lucide icons are derived from
Feather and remain available under the MIT License. All icons are stored inline
and require no network access at runtime. One stroke style is used everywhere
(24 px grid, 1.75 stroke, round caps and joins).

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Source: https://github.com/lucide-icons/lucide

## Local fonts

Inter is bundled locally in `src/renderer/assets/fonts/` (SIL Open Font
License 1.1; see `INTER-LICENSE.txt` beside the font file). No font is fetched
at runtime. Sora and Manrope were bundled by an earlier revision and have been
removed because the interface no longer uses them.

## Animation assets

No LottieFiles, Motion, or other animation assets are used. All motion is
authored with local CSS transitions, CSS `linear()` spring easings, and SVG.
The legacy generated GIF files are kept for compatibility but are not
referenced by the renderer.
