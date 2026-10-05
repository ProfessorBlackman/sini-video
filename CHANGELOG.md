# Changelog

All notable changes to Sini. Versions follow [Semantic Versioning](https://semver.org/); before 1.0, a minor version (0.x) may change the DSL.

Images: `ghcr.io/professorblackman/sini:<version>` for linux/amd64 and linux/arm64.

## [Unreleased]

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

[Unreleased]: https://github.com/ProfessorBlackman/sini-video/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ProfessorBlackman/sini-video/releases/tag/v0.1.0
