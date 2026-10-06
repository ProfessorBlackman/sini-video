# Changelog

All notable changes to Sini. Versions follow [Semantic Versioning](https://semver.org/); before 1.0, a minor version (0.x) may change the DSL.

Images: `ghcr.io/professorblackman/sini:<version>` for linux/amd64 and linux/arm64.

## [Unreleased]

## [0.1.8] - 2026-10-06

Any font, and fixes from the real-assets round ([findings](docs/paper-tests/v0.7-real-assets/FINDINGS.md)).

### Added
- **Downloaded fonts**: `{ "type": "font", "google": "Plus Jakarta Sans" }` fetches a Google Fonts family (every weight and italic), and `{ "type": "font", "url": "https://…", "family": "…" }` fetches one font file. Each is downloaded once, when the video is created or changed or at the next render, into the project's `fonts/` folder with a `fonts.lock.json` (and the licence); renders then never use the network, so they stay identical. Font files are checked to be TTF, OTF, WOFF or WOFF2.
- Font assets take `weight` (a number, or a range for variable fonts) and `style`.
- **`crop` on images**: `[x, y, width, height]` in the image's own pixels; only that region is shown, then fitted to the box. Hotspots keep their image coordinates.
- **`read_image_text`** (MCP) and `sini text <asset>`: every line of text in a screenshot with its box in image pixels, for hotspots and crops without guessing. Cached per image.
- **`lint.avoid`**: words or phrases the video must not say or show. Lint checks the copy (text, labels, toasts, state changes, typing) and, by OCR, every screenshot while it's on screen, so a cropped-away or scrolled-off word passes and a visible one doesn't (`avoided-word`).
- **`spotlight-cut`** and **`camera-target-cut`** lint: a spotlit region, or the camera's zoom target, cut off by the frame or its device screen.

### Fixed
- Text hotspots missed labels on coloured buttons (e.g. "Scan Now" on a bright green button): a fine-tile OCR pass runs when the others miss.
- A text `state` with longer content ran off the frame on one line while rolling in; text now rolls wrapped to its width.
- The index-path patch warning suggested ids inside component definitions, which can't be patched.
- An element with a negative `z` was drawn behind the scene background.

## [0.1.7] - 2026-10-06

Masks and faster checks.

### Added
- **Clips and cutouts**: `style.clip` cuts an element to `"circle"`, `"ellipse"` or a path's outline (an image in a blob); `style.cutout` punches other elements' shapes out of it (ticket notches, keyholes, an opening iris), following them as they move. Built as synchronous clip-paths, so renders stay deterministic.

### Changed
- **Lint is much faster on big videos** (a 229-element, 15s video: 24.5s → 2.8s): the mid-animation samples are measured in one page call, measuring sessions skip painting, and layouts come back as JSON instead of through Playwright's slower object serialisation. `get_layout` and `describe_at` benefit too.

## [0.1.6] - 2026-10-06

Helping the AI judge its own work.

### Added
- **App-flow lint**: `device-per-scene` (a new phone or browser in each of consecutive scenes, instead of one device with `screens`) and `empty-screen` (a device screen whose content stops less than 40% of the way down).
- `render_video` lists accepted lint warnings with their reasons, for the model to pass on to the human; the reference says to accept only warnings that are factually wrong, never to avoid work.
- **Design review**: every `render_contact_sheet` result ends with a short checklist (brief, hierarchy, one idea per scene, space, readability, consistency, motion) and asks for the three biggest problems to be fixed; the same review is in the `create-video` prompt and reference §14.

## [0.1.5] - 2026-10-06

Fixes from the 0.1.4 re-tests.

### Changed
- Connector `curve`: positive now bows to the left of the from → to direction (upward for a left-to-right line). It bowed the other way in 0.1.4.

### Fixed
- MCP results now show each issue's code (needed for `lint.accept`).
- Patches can `set` `lint.accept`; `add` and `move` with `parent`, `after` or `before` no longer need `scene`.
- A match cut from a circle or pill opened as a square window.

### Added
- Validation warns when a platform `safeZone` (reels, tiktok, shorts) is set on a landscape or square video.
- Reference: text hotspots cover the words only; use `[x, y, w, h]` to spotlight a whole card or panel.

## [0.1.4] - 2026-10-06

Diagrams, spotlights and smarter checks: the open items from the test rounds.

### Fixed
- The `zoom` transition scaled whole scenes, so the incoming scene's edges showed as a hard rectangle; it now zooms the content while backgrounds crossfade full-frame.

### Added
- `describe_at` marks elements mostly hidden behind something drawn on top (`coveredBy`).
- **`connector` element**: a line between two elements (or screenshot regions) that follows them every frame, from edge to edge, with `curve`, arrowheads, dashes and `drawOutline`; hidden while an end is hidden.
- **`particles` element**: a seeded field of glowing dots that drift, rise, fall or twinkle; deterministic.
- **Lint over time**: text is sampled every 0.5s; `too-wide-in-motion` (e.g. trackIn spreading past the frame) and `leaves-frame` (outside enters, exits, scene transitions and camera zooms).
- `get_layout` reports `ink` for text: where the letters are drawn (cap tops to descenders, side bearings and italic overhang, letter spacing), for aligning big type.
- **`text-over-image` lint**: text sitting over an image, screenshot, SVG or path without a card behind it.
- **Spotlights on screenshot regions**: `focusCycle` targets can be hotspots (`"app#export"`); a spotlight outlines each region in turn (`ring` colour) and dims the rest of the screenshot.

## [0.1.3] - 2026-10-06

Freeform drawing, after the bakery brief showed illustrated scenes needed curves.

### Added
- **`path` element**: any line or outline, from `points` (straight, or `smooth` curves through every point, `closed` for blobs) or SVG path data `d`. Scales to a given width or height keeping its proportions; stroke width stays in px; gradient fills; draws itself with `drawOutline`.
- **`follow` behavior**: moves an element's centre along a path, optionally turning with it (`rotate`).
- **`style.dash`**: dashed and dotted strokes on shapes and paths, drawn dash by dash with `drawOutline`.
- Reference: a recipe for illustrated scenes without photos.
- **Per-corner `radius`**: `[top-left, top-right, bottom-right, bottom-left]` on shapes, containers, buttons and images.

### Fixed
- Non-numeric style values (e.g. `"opacity": "half"`) passed validation and were silently ignored.

## [0.1.2] - 2026-10-06

Fixes from the re-test round ([findings](docs/paper-tests/v0.6-retest/FINDINGS.md)).

### Added
- **`lint.accept`**: accept a lint warning by code (and element) with a reason; accepted warnings leave lint and render results.
- `get_layout` and `describe_at` show only visible elements by default, with an `elements` filter.
- Patches warn when an index path reaches an item that has an id.

### Fixed
- Text hotspots now find small labels such as buttons (tiled OCR fallback).
- Shapes with gradient fills rendered black.
- Leading and repeated spaces in text were stripped (code indentation).
- Hex colours with an opacity suffix (`#2A1208/0.6`) were rejected.
- `describe_at` reported original text instead of what's on screen after state changes.

## [0.1.1] - 2026-10-05

Fixes from the first MCP test round ([findings](docs/paper-tests/v0.5-mcp/FINDINGS.md)): 7 agents made videos through the published image using only the MCP tools.

### Changed
- **Pinned elements follow their target's animation** (position, not rotation). Videos with pins on animated elements render differently.
- **Transitions default to eases that start moving at once**: `quart.out` for wipes, `cubic.inOut` for slides, match cuts, circles and zooms. `expo.inOut` made cuts seem to hesitate. Set `ease` to keep the old look.
- **`get_reference` returns the reference in parts**: the essentials and an index by default (~23KB instead of 54KB), sections by number or name, or `"all"`.
- **`render_video` lists open lint warnings**, asking the model to fix them or explain them in `notes`.
- MCP results show paths relative to the folder Sini was given, not container paths.

### Added
- **§15 Recipes** in the reference: patterns for app demos, phone flows, numbers, photo reels and announcements, with a complete phone-flow spec.
- **`content-overflow` lint**: content sticking out of a stack or grid.
- `"none"` and `"transparent"` colours.
- Clearer validation messages for quoted numbers, keys put inside `animate`, and missing targets.

### Fixed
- Pins to screenshot hotspots (`"app#card"`) landed in the middle of the device.
- Dark browser chrome drew an invisible toolbar and URL on white pages.
- Groups ignored an explicit width or height, which also broke component instance heights.
- `{{param}}` in icon names was rejected. `sini validate` and inline `validate_video` now run the full check (icons, asset files).
- `get_layout` reported stretched widths for buttons, badges, icons and toasts.
- False lint warnings: overlap and covered ignored the parents' enter/exit times; tiny-text ignored camera zoom. `edge-margin` names the edge; `target-unreachable` lists every scene.
- Rolling text left descenders behind and clipped glyphs with tight line heights.
- Self-drawing icons started as dots; pulse rings were too faint and ignored `style.stroke`.
- Placeholder backgrounds showed a crease.
- The reference no longer says nothing is implemented, and documents index paths in patches and chart text size.

## [0.1.0] - 2026-10-05

The first release: an AI writes a JSON spec, and Sini renders it to MP4 deterministically, with no video-generation model.

### DSL v0.4
- **Elements:** text (with markup and per-word colours), image, shape, svg, button, badge, icon (Lucide), toast, progress, chart (bar, horizontal bar, line), browser and phone devices (screens, overlays, scrolling, status bar), group, stack, grid, template (sandboxed HTML/CSS), and reusable components.
- **Motion:** enter/exit presets, ambient motion (float, pulse, swing…), states, and a per-scene timeline.
- **Behaviors:** interaction (arrow, pointer and touch cursors that click, tap and type), navigate between screens, scroll, camera moves and zooms, focusCycle.
- **Transitions:** cut, crossfade, wipe (with bar), slide and push, circle, zoom, matchCut.
- **Screenshot hotspots** by coordinates or by on-screen text (located with OCR).
- `targetDuration` fits a video to a requested length.

### Tools for the AI
- **MCP server** with 13 tools (create, validate, update with patches, lint, describe a moment, layout, frame, contact sheet, render, versions) and a `create-video` prompt.
- **CLI** `sini` with the same functions.
- **Validation** with did-you-mean suggestions. **Lint** for reading time, edges, safe zones, overlaps, covered text, contrast, tiny text and missing glyphs.
- **Version history:** every change is a new version and can be restored.

### Rendering
- Byte-identical frames for the same spec, image and architecture, including across worker counts.
- H.264 MP4, limited-range BT.709. Draft renders at half size for quick checks.

### Packaging
- Docker image only (about 940 MB): Node 24, Chromium headless shell, a minimal FFmpeg build with libx264 (GPL; run as a separate program), bundled fonts and icons.
- Writes files as the owner of the mounted folder.

[Unreleased]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ProfessorBlackman/sini-video/releases/tag/v0.1.0
