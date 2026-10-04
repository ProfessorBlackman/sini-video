# Sini — Vertical Slice Plan

**Status:** ✅ Complete (2026-10-04). See §10 for results against the "done" criteria.
**DSL:** [DSL_REFERENCE.md](DSL_REFERENCE.md) v0.4
**Goal:** prove the whole pipeline end to end on a narrow feature set, then test whether an AI with real tools (`validate`, `lint`, `layout`, contact sheets) makes better videos than it did on paper.

---

## 1. What "done" looks like

1. Scenes 1–2 of the Novaé reel, written in DSL v0.4, render to an MP4 that is recognisably the same piece as `inspiration/novae-reel.mp4` (0–7s).
2. The same JSON renders **byte-identical frames** twice in a row, and on a second machine using the Docker image.
3. Everything works through both the **CLI** and the **MCP server**, which call the same core functions.
4. An AI client (Claude Desktop or Claude Code) can, through MCP alone:
   1. read the reference
   2. write a spec
   3. validate and lint it
   4. check the layout
   5. view a contact sheet
   6. patch it
   7. render it
5. A 15s 1080×1920 **draft** render takes under 30s on a laptop. A final render takes under 2 minutes.

---

## 2. Scope

### In the slice

| Area | Included |
|---|---|
| Video | `format`, `fps`, `background`, `seed`, `end` (hold, fade), `targetDuration`, `safeZone` |
| Theme | palette, fonts, roles, motion personalities, default transition, grain |
| Assets | images, placeholders, fallbacks, font assets |
| Elements | `text` (roles, `*italic*`, `**bold**`, `[word]{color}`), `image`, `shape`, `button`, `badge`, `group`, `stack`, `browser` with `children` |
| Layout | anchor + inset + offset, relative, `pin` (including `inside`), absolute, stack/group sizing, `grow`, `fit: "shrink"` |
| Time | expressions, cues, default timing, `"duration": "auto"` |
| Presets | `fadeIn`, `fadeUp`, `slideIn`, `scaleIn`, `wordReveal`, `lineReveal`, `charReveal`, `trackIn`, `typewriter`, `countUp`, `drawOutline`, `wipeIn`; exits `fadeOut`, `wordsUp`; ambients `kenBurns`, `drift`, `pulse` |
| Raw animation | all animatable properties, keyframes, `repeat`/`yoyo`, additive offsets |
| States | timeline state changes with automatic animation |
| Transitions | `cut`, `crossfade`, `wipe` (with bar), `slide` |
| Tools | `validate`, `lint` (subset, §6), `layout`, `at` (describe_at), `frame`, `sheet`, `render` (draft and final), `patch`, versions |

### Phase 2 (after the slice)

`phone`, `screens`, `overlay`, `toast`, `icon`, `progress`, `chart`, `components`, `interaction`, `scroll`, `navigate`, `camera`, `focusCycle`, hotspots, `matchCut`, `circle`/`zoom` transitions, `template`, remaining presets.

### DSL question to settle during the slice

The Novaé intro types a URL into the browser's address bar. v0.4 can't express that: `url` is a static string. Proposal: `typewriter` targeting a `browser` types its `url`. Decide once the browser element is built.

---

## 3. Architecture

```text
                video.json (+ assets/)
                        │
            ┌───────────▼────────────┐
            │  @sini/schema          │  Zod schema from DSL v0.4, JSON Schema export,
            │  validate              │  errors with path + suggestion
            └───────────┬────────────┘
            ┌───────────▼────────────┐
            │  @sini/core            │  resolve: theme defaults, assets, components (phase 2)
            │                        │  timeline: time expressions → absolute times,
            │                        │            default timing, auto durations, targetDuration
            │                        │  evaluator: stateAt(t) — pure, no DOM
            └───────────┬────────────┘
            ┌───────────▼────────────┐
            │  @sini/runtime         │  in-page bundle: builds the DOM from the compiled
            │  (runs in Chromium)    │  scene graph, CSS does layout, exposes
            │                        │  sini.render(t) and sini.layout(t)
            └───────────┬────────────┘
            ┌───────────▼────────────┐
            │  @sini/renderer        │  Playwright: load page, wait for fonts/images,
            │                        │  frames → PNG, parallel workers over frame ranges
            └───────────┬────────────┘
            ┌───────────▼────────────┐
            │  @sini/exporter        │  FFmpeg: H.264 yuv420p faststart MP4
            └────────────────────────┘

   @sini/lint  — rules over the compiled timeline + layout boxes
   @sini/project — project folder, versions, patches
   @sini/cli   ─┐
                ├─ both call the same functions in @sini/api
   @sini/mcp   ─┘
```

### Key decisions

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript, pnpm workspaces | One language for core, in-page runtime, CLI and MCP; official MCP TS SDK |
| Where layout happens | **In Chromium, with CSS** (flexbox for stacks, absolute positioning for anchors/pins), measured with `getBoundingClientRect` | Text is measured by the same engine that renders it, so `layout` results always match the pixels. No second text-shaping engine to keep in sync |
| Where timing happens | **In Node** (`@sini/core`) | Timing is independent of geometry (reading time uses word counts, not sizes), so it can be computed and unit-tested without a browser |
| Animation engine | Own pure evaluator: progress windows + easing + interpolation, the same approach as the Novaé reel's `render(t)`. No GSAP | Deterministic, seekable, no licensing question, portable to a Canvas renderer later |
| Frame capture | `page.screenshot` as PNG per frame, N parallel pages over frame ranges, then one FFmpeg encode | `render(t)` is pure, so frames are independent. Proven by the reel's `render.py` |
| Determinism | Pinned Chromium (Playwright version) in Docker; bundled fonts only; no network; CSS transitions/animations disabled globally; `--force-color-profile=srgb`, `--font-render-hinting=none`, fixed device scale factor; grain and anything random seeded from `video.seed` + frame index | Required for byte-identical frames |
| Packaging | Docker image `ghcr.io/<org>/sini` with Playwright Chromium, FFmpeg, bundled fonts, Lucide icons | Decided in PRODUCT_DIRECTION |

### Licensing notes

- Fonts: SIL OFL. Lucide: ISC. Playwright: Apache-2.0.
- **FFmpeg with libx264 is GPL.** Sini only calls `ffmpeg` as a separate program, so Sini's own licence is unaffected. The Docker image must still comply for the ffmpeg binary it ships (offer its source). An alternative is an LGPL FFmpeg build with OpenH264 (BSD). Decide before the first public image.

---

## 4. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | **Repo and image skeleton** | pnpm monorepo, CI (typecheck, tests), Dockerfile builds, `sini --version` runs in the container |
| M1 | **Schema and validate** | Zod schema covers v0.4. Every rule in `paper-tests/check.py` is ported. The reference examples pass. The paper-test outputs, upgraded to v0.4, give the same results as the Python checker. JSON Schema is exported |
| M2 | **Timeline core** | Time expressions, default timing, stagger semantics, `auto` durations and `targetDuration` are implemented and unit-tested. `sini at <t>` (describe_at) works without a browser |
| M3 | **Runtime and layout** | DOM built for slice elements, CSS layout, `sini layout --time t` returns boxes, `sini frame --time t` returns a PNG |
| M4 | **Export** | `sini render` (final) and `--draft` (540p, 15fps) produce MP4s. Parallel workers. **Determinism test in CI:** render a fixture twice and compare frame hashes |
| M5 | **Slice presets, transitions and texture** | All slice presets, `wipe` with bar, grain, end fade. Novaé scenes 1–2 render from JSON |
| M6 | **Lint and contact sheet** | Lint subset (§6) and `sini sheet` (12-frame grid with timestamps) |
| M7 | **Project, patches and MCP** | Project folder with `versions/`, `sini patch`, `sini versions/checkout`. MCP server with tools, resources and image results; works from Claude Desktop via `docker run -i` |
| M8 | **Tool-assisted test** | See §7 |

M2 and M3 can run in parallel after M1.

---

## 5. Interfaces (slice)

| Operation | CLI | MCP tool | Returns |
|---|---|---|---|
| Read the reference | `sini docs` | resource `sini://reference` | DSL_REFERENCE.md |
| Create | `sini init <dir>` | `create_video` | project path |
| Validate | `sini validate` | `validate_video` | structured errors |
| Lint | `sini lint` | `lint_video` | structured warnings |
| Layout | `sini layout --time t` | `get_layout` | boxes per element |
| Describe time | `sini at t` | `describe_at` | visible and animating elements at t |
| Frame | `sini frame --time t` | `render_frame` | PNG (image content in MCP) |
| Contact sheet | `sini sheet` | `render_contact_sheet` | PNG grid |
| Patch | `sini patch <file>` | `update_video` | new version number + validation result |
| Versions | `sini versions`, `sini checkout <n>` | `list_versions`, `restore_version` | |
| Render | `sini render [--draft]` | `render_video` | MP4 path, duration, render time |

MCP resources: `sini://reference`, `sini://schema`, `sini://examples/{minimal,novae,components}`.

---

## 6. Lint rules in the slice

| Rule | Needs |
|---|---|
| Broken references and unknown vocabulary | validate |
| Reading time (`0.5s + 0.3s × words`, excluding transitions and end fade) | timeline |
| `targetDuration` not reachable | timeline |
| Off-canvas and outside the 72px margin | layout boxes |
| Inside the platform `safeZone` | layout boxes |
| Unintended overlap between text blocks | layout boxes |
| Text overflows its `maxWidth` / shrinks below 60% with `fit: "shrink"` | layout boxes |
| Missing glyph in the chosen font | font files (fontkit) |
| Low contrast on solid backgrounds (WCAG 4.5:1) | colours |
| Element never visible | timeline |

Later: contrast over images (sample the rendered frame), low-motion scenes.

---

## 7. The real test (M8)

Repeat the paper test, but give the AI the tools:
- Brief set: the slice-compatible briefs (#1 bakery and #5 quote from [BRIEFS.md](paper-tests/BRIEFS.md)), plus 3 new briefs that need only text, images, buttons, stacks and the browser element.
- Same model slots as the paper tests (default model and Haiku).
- Each agent works through the MCP server: write → validate → lint → layout → contact sheet → patch, up to N iterations, then render.

Measure:
- validation and lint errors at the first attempt vs at submission
- iterations used
- whether the arithmetic complaints disappear
- render time
- a human rating of each final video (1–5) against the brief

Phase 2 then adds devices, components, charts and interactions, and reruns all 8 briefs.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Chromium output differs across CPUs/GPUs | Software rendering (`--disable-gpu`, SwiftShader), Docker-only official renders, hash test in CI on two runner types |
| Screenshot speed too slow for the 30s draft target | Parallel pages; draft at 540p/15fps; measure in M4 before building more |
| CSS layout can't express a DSL layout rule cleanly (e.g. `pin.inside`, `grow` in device pages) | Allow a second pass: measure, then position absolutely from measured boxes |
| Reading-time and `auto` rules feel wrong once watched | They're constants in one module; tune them against real renders in M5 |
| Reference grows past what a model reads well (now ~8k words) | Keep the slice docs split: `sini://reference` core, plus per-feature resources fetched on demand |

---

## 9. Open decisions

1. ~~**Licence**~~ — decided: **Apache-2.0**.
2. **GitHub org:** `sinihq` is free; reserve it and the `@sini` npm scope before M0.
3. **FFmpeg build:** GPL libx264, or LGPL + OpenH264 (§3).

---

## 10. Results

| Criterion | Result |
|---|---|
| Novaé scenes 1–2 recognisable from JSON | ✅ [examples/novae](../examples/novae/video.json), compared frame by frame with the original reel |
| Byte-identical frames run to run | ✅ CI test: two renders with different worker counts give identical frame hashes |
| Byte-identical frames across machines | ✅ A frame rendered in the Docker image (Ubuntu 24.04, Node 24) matches one rendered on the host (Ubuntu 22.04, Node 23), SHA-256 identical |
| CLI and MCP share one core | ✅ Both call `@sini/api`; 13 MCP tools mirror the CLI; MCP tested in-memory and over stdio, locally and through Docker |
| AI can create → check → look → patch → render | ✅ [Tool-assisted test](paper-tests/v0.4-tools/FINDINGS.md): 9 videos, 0 errors in final specs, agents iterated on their own contact sheets (they used the CLI; the MCP server exposes the same functions) |
| Draft of a 15s video under 30s | ✅ 15.5s video in 8.6s |
| Final of a 15s video under 2 minutes | ✅ 15.5s 1080×1920 in 80s (was 593s before switching frame capture to JPEG) |

### Still open

- **Reserve the names:** `sinihq` GitHub org and `@sini` npm scope (needs you).
- **FFmpeg build:** the image uses Ubuntu's FFmpeg (libx264, GPL). Decide before publishing the image (§3).
- **Image size:** 2.56 GB on the Playwright base image; a Chromium-only base would roughly halve it.
- **Phase 2** features and the known limitations listed in [paper-tests/v0.4-tools/FINDINGS.md](paper-tests/v0.4-tools/FINDINGS.md).
