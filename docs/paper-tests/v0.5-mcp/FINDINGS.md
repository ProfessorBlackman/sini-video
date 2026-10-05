# MCP test round (v0.5) — findings

**Date:** 2026-10-05
**Setup:** Sini 0.1.0 (`ghcr.io/professorblackman/sini:0.1`), used only through the MCP server. 7 agents on the 5 briefs in [BRIEFS.md](BRIEFS.md): M1–M5 with the default model (Claude Opus), M1 and M2 repeated with Haiku. Agents read only the DSL reference (`get_reference`) and never edited `video.json` by hand. Each folder here has the final `video.json`, the agent's `log.md` and `final-sheet.png`; full projects and renders are in `.sini-tests/` (git-ignored).

Compare with the previous rounds: [v0.4 tools](../v0.4-tools/FINDINGS.md), [v0.3](../v0.3/FINDINGS.md), [v0.2](../v0.2/FINDINGS.md).

---

## 1. Results

| Agent | Brief | Final | Length (target) | Features actually used | Agent's ratings (video / tools) | My rating |
|---|---|---|---|---|---|---|
| M1 (Opus) | Ledgerly app demo + feedback round | v6, lint clean* | 20.0s (~20) | browser, camera, text hotspot, interaction (click), toast states, captions | 4 / 3 | **4** |
| M2 (Opus) | Tro ride-share phone reel | v8, lint clean | 16.0s (~15) | phone, 3 screens, typing, taps, scroll, states, progress, components | 4 / 4 | **4.5** |
| M3 (Opus) | Accra Solar in numbers | v8, lint clean | 12.7s (~12) | bar chart + highlight, countUp, drawn icons, wipes | 4 / 4 | **4** |
| M4 (Opus) | Ama Owusu portfolio | v3, lint clean | 15.0s (15) | grid of images, matchCut, placeholders | 3.5 / 4 | **3** (all placeholders) |
| M5 (Opus) | DevFest Accra ticket | v9, lint clean | 10.7s (~10) | svg logo (drawn), group "ticket", countUp, icon, pulse button, wipes | 4 / 4 | **4** |
| M1h (Haiku) | Ledgerly | v2, 2 warnings | 18.0s (~20) | scene-level zoom, hand-drawn boxes; **no camera, cursor or focusCycle** | 4 / 3.5 | **2** |
| M2h (Haiku) | Tro | 4 warnings | 14.5s (~15) | phone per scene; **no screens, scroll or taps** | 4 / 4 | **1.5** |

\* M1 kept three lint warnings it judged (correctly) to be false positives; see §2.

- **The new features work in practice.** For the first time an AI built a full app demo (camera onto a screenshot hotspot, a cursor click, a toast changing state) and a phone flow (typing, taps, scrolling, three screens, a progress tracker) from the reference alone. M2: "Tapping, scrolling, screen changes and state changes worked almost exactly as the reference says."
- **Opus agents still self-correct from contact sheets** (every one changed its design after looking), and every final spec was valid.
- **Haiku avoided the new features** and approximated them (scaling a whole scene instead of the camera, drawing boxes instead of focusCycle, one scene per app screen). M2h shipped with overlapping title text and low-contrast warnings showing, and called the result "production-ready". Haiku-class models need more guidance than the reference gives, and lint warnings need to be harder to ignore (§3).
- Draft renders took 3.7–9s.

---

## 2. Bugs and gaps

Status: **confirmed** = reproduced or found in the code; **reported** = from an agent's log, not yet checked.

### Silent failures (wrong output, no error) — highest priority

| # | Found by | Problem | Status |
|---|---|---|---|
| 1 | M1 | `pin.to` a screenshot hotspot (`"dashboard#outstanding"`) inside a device overlay: all three pinned shapes landed in the centre of the browser. No validate or lint message. | **fixed**: pins resolve hotspots (shared with cursor targets); test added |
| 2 | M5 | An element pinned to another element doesn't follow the target's animation (target slid up 30px, the pinned notch stayed). | **fixed**: pins re-measure the target's animated layer each frame (position, not rotation); test added |
| 3 | M1 | `chrome: "dark"` browser: toolbar and URL are drawn in translucent white over the page's white background, so they vanish. | **fixed**: opaque dark toolbar |
| 4 | M2 | Component instance `layout.height` is ignored; a component's fixed height is overridden by an oversized child (maps grew to ~720px and pushed cards off-screen). | **fixed**: groups keep an explicit width/height (they only fit children in the missing dimension), which also makes instance heights work; test added |
| 5 | M2 | `{{param}}` inside an icon name (`"name": "{{icon}}"`) fails with "Unknown icon '{{icon}}'", although the reference says params work in any string. | **fixed**: icon names checked per instance after `{{param}}` substitution, reported at the instance's `with`. Also: `sini validate` and inline `validate_video` now run the full check (icons, assets) instead of the schema only; tests added |
| 6 | M5 | Content overflowing its container (499px of content in a 440px ticket) — nothing warns. | **fixed**: new `content-overflow` lint for stacks and grids (groups excluded: their children overhang on purpose); test added |
| 7 | M2 | `get_layout` says a button stretches to 544.9px; it renders ~265px. | **fixed**: layout reports the drawn shape of buttons, badges, icons and toasts; test added |

### Wrong or misleading checks

| # | Found by | Problem | Status |
|---|---|---|---|
| 8 | M1 | `tiny-text` ignores camera zoom (text ~32px on screen was flagged). | reported |
| 9 | M1 | `overlap` flags two captions that are never on screen at the same time. | reported |
| 10 | M2 | `describe_at` calls a caption visible while another element covers it. | reported |
| 11 | M3 | `edge-margin` warning doesn't say which edge. | **fixed**: names the edge(s) and distance; test added |
| 12 | M4, M3 | `target-unreachable` doesn't say which scene makes the video too long; `targetDuration` can't shrink 17.6s of auto scenes to 12s, and when stretching (M1) it padded ~2s of idle time onto one scene. | reported |

### Rendering

| # | Found by | Problem | Status |
|---|---|---|---|
| 13 | M3 | Wipes default to `expo.inOut`, which barely moves for the first ~30%, so every cut seems to hesitate. | **confirmed** (default in `compile.ts`) |
| 14 | M2 | After a content change ("…3 min away" → "…has arrived"), the descender of the old text's "y" stayed visible. | reported |
| 15 | M5 | Pulse ring is always faint grey; button stroke doesn't colour it. | reported |
| 16 | M5 | Background vignette/shadow make a "background-coloured" circle visibly differ from the background (cut-out notches). | reported; probably by design, needs a documented way (e.g. `fill: "background"` or masks) |
| 17 | M4 | Apparent seam across full-screen placeholders on contact sheets. | **explained**: not a sheet bug (same at every scale); the placeholder's 3-stop radial gradient has a visible crease at the middle stop. Smooth the gradient. |
| 18 | M3 | A drawing icon looks like two stray dots in its first frames. | reported |
| 19 | M4 | matchCut: the opening photo keeps a thin border until the very end; only the first grid item shows for a moment at the start. | reported |

### MCP and reference

| # | Found by | Problem | Status |
|---|---|---|---|
| 20 | M4, M5, M3 | `get_reference` returns 54KB: too big to come back inline, so agents read it from a saved file. | **confirmed** (54,207 bytes) |
| 21 | M4, M5 | The reference still says "Status: Draft for paper-testing… Nothing here is implemented yet." | **confirmed** |
| 22 | M5 | Missing-project error says "Create one with 'sini init'" — MCP users need `create_video`. | **confirmed** (`api/src/project.ts`) |
| 23 | M3, M4 | Tool results give container paths (`/work/...`), not the user's real paths. | **confirmed** by design; the server can't know the host path. Could say "in your mounted folder: …" |
| 24 | M1 | Timeline items without an id can be patched by index (`demo.timeline[4].at`), but the reference doesn't say so. | reported |
| 25 | M3 | Chart accepts an undocumented font-size setting. | reported |
| 26 | M1h | `fill: "none"` is rejected; outline shapes must omit `fill`. | reported (accepting `none`/`transparent` is friendlier) |
| 27 | M1h | Errors on a string `"at": "0"` and a mis-nested timeline item didn't suggest the fix. | reported |

### Not Sini bugs

- **M2h "4KB payload truncation":** the error was "Input that could not be parsed as JSON" — Haiku sent malformed JSON in a tool call. Other agents sent much larger specs without trouble.
- **M1h toast contrast "false positive":** white on that green really is 2.5:1, below 4.5:1.
- **Text ink vs box** (M3: aligning big numbers by trial and error) — the known limitation from v0.4, still open.

---

## 3. What agents wished for

- **Hotspots as first-class targets:** a highlight/spotlight on a screenshot region (outline + dim the rest); camera clamped to the device, and a focus offset.
- **Per-key camera ease/duration**, and `describe_at` naming the camera segment ("key 1 → 2, zoom 1 → 2.6") so "the zoom is too fast" maps to one key.
- **Shift a block of timeline items by Δt** (M1's retiming took 12 patch ops).
- **A dashed line** (M5 built a perforation from 15 dots), **dim-others-and-hold** preset (M4), **placeholders that show their hint** (M4; also v0.4).
- **A reference in sections** (`get_reference` with a topic).
- **Lint warnings that are hard to ignore** for weaker models: e.g. `render_video` refusing a final render (or prominently listing warnings) while overlap/contrast warnings remain.

---

## 4. Recommended order

1. **Silent failures #1–#7**: each one breaks trust in the check → look → fix loop. Add a lint/validate signal for anything that can't be resolved (unresolvable pin targets, overflow).
2. **False lint positives #8, #9**, and the quick fixes **#13, #21, #22, #26**.
3. **Reference delivery #20**: `get_reference` by section, with a short index by default.
4. **Weaker models**: a short "recipes" section (app demo, phone flow, stat video) in the reference or the `create-video` prompt, so Haiku-class models use camera/interaction/screens instead of approximating them; and make warnings visible at render time.
5. The rest of §2 and §3 as they come up; ink-aware text boxes still open from v0.4.
