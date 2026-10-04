# Tool-assisted test (M8) — DSL v0.4 with the working engine

**Date:** 2026-10-04
**Setup:** 5 briefs ([BRIEFS.md](BRIEFS.md)), 5 agents, each reading only [DSL_REFERENCE.md](../../DSL_REFERENCE.md) and using the `sini` CLI: `validate`, `lint`, `at`, `layout`, `sheet` (they looked at the contact sheets), `patch`, `render --draft`.
- A, B, C: default model (Claude Opus). H, I: Claude Haiku.
- Brief #11 included a round of human feedback ("at 0:06 the features go by too fast; make the button bigger") applied with `sini at` and a patch.
- Each folder has the final `video.json`, `log.md` (the agent's own account) and `final-sheet.png`.

Compare with the paper tests: [v0.2](../v0.2/FINDINGS.md), [v0.3](../v0.3/FINDINGS.md).

---

## 1. Results

| Agent | Brief | First version (errors / warnings) | Final | Length | Draft render | My rating (1–5) |
|---|---|---|---|---|---|---|
| A (Opus) | #1 bakery | 0 / 4 (safe-zone ×2, edge-margin, low-contrast) | 0 / 0 | 15.00s | 8.7s | 4 |
| A (Opus) | #9 podcast | 0 / 0 (agent judged the design weak and reworked it) | 0 / 0* | 12.00s | 6.2s | 4.5 |
| B (Opus) | #5 quote | 0 / 1 (target-unreachable) | 0 / 0 | 10.00s | 4.7s | 4 |
| B (Opus) | #10 award | 0 / 1 (low-contrast) | 0 / 0 | 10.00s | 3.7s | 4 |
| C (Opus) | #11 SaaS update + feedback | 0 / 1 (target-unreachable) | 0 / 0 | 15.0s → 17.5s after feedback | 7.2s | 4 |
| H (Haiku) | #1 bakery | 0 / 13 | 0 / 2 (genuine low contrast, 2.9:1) | 15.00s | 9.2s | 3 |
| H (Haiku) | #5 quote | 0 / 0 | 0 / 0 | 10.00s | 6.6s | 3 |
| I (Haiku) | #9 podcast | 0 / 6 (safe-zone) | 0 / 0 | 13.00s | 5.5s | 3 |
| I (Haiku) | #10 award | 2 / 0 (invented transition `"fade"`) | 0 / 0 | 10.10s | 3.7s | 2.5 |

\* One false-positive contrast warning (text on a shape measured against the scene background), fixed after the test.

Ratings are mine, from the final contact sheets, against the brief: hierarchy, pacing, brand feel, polish. They're a single reviewer's judgement, not a user study.

### What changed compared with the paper tests

| | Paper (v0.2 / v0.3) | With tools (v0.4) |
|---|---|---|
| Valid on the first try | 11/12, 10/12 | 8/9 |
| Final specs with errors | n/a (no feedback loop) | **0/9** |
| Final specs with lint warnings | n/a | 1/9 (2 genuine contrast warnings the agent chose to keep) |
| Hit the requested length exactly | rarely (hand-summed) | 7/9 exactly; 1 at 13.0s for 12s; 1 longer on purpose after feedback |
| #1 complaint | arithmetic: text heights, reading time, scene sums | **Gone.** Agents used `layout`, `lint` and `targetDuration` instead |
| Self-correction from visuals | impossible | Every Opus agent changed the design after looking at its own contact sheet |

**The core claim holds:** a capable model with these tools produces correct, on-brief, on-length motion videos without a video-generation model. The best results came from the default model; Haiku produced valid, clean but plain videos (again: thin specs, 2–9 elements against 11–56).

### Most useful tools (from the agents' logs)

1. **`sheet`**: the only way to judge design. Every Opus agent changed hierarchy, spacing or pacing after looking.
2. **`layout`**: exact positions ended the pixel guessing; the Haiku agents used it to clear every safe-zone warning.
3. **`lint`**: especially `safe-zone`, `reading-time`, `target-unreachable` and `low-contrast`.
4. **`validate` suggestions**: `"fade"` → "Did you mean 'crossfade'?" fixed the only errors in one round.
5. **`at` + `patch`**: the feedback round on #11 worked as designed: `sini at 6` found the elements, two patches made versions 3 and 4.

---

## 2. Bugs and gaps found — and what happened to them

| Found by | Problem | Status |
|---|---|---|
| C | `shape: "pill"` rendered as an ellipse | **Fixed**: radius set to half the height after layout |
| C | `layout.grow` measured but not drawn | **Fixed**: the animated box and container fill the grown box |
| C | Shapes inside a browser page / stack didn't fill the width | **Fixed**: flow shapes default to 100% width |
| C | In-device text drawn at ~13px, no warning | **Fixed**: `layout` reports `screenFontSize`; new `tiny-text` lint |
| C | `timeline[3]` rejected in patch paths | **Fixed**: `[n]` and `.n` both work |
| B, C | No per-scene timing view | **Fixed**: `sini inspect`; MCP `get_video` includes timing |
| B | Letter-spaced centred text sat ~9px left of centre | **Fixed**: trailing tracking is balanced (also while `trackIn` animates) |
| B | Lint codes only visible with `--json` | **Fixed**: codes shown in normal output |
| A | Instance `layout` replaced the component root's (lost its size) | **Fixed**: sizes merge; the instance's placement replaces the root's |
| A | Text covered by a later shape wasn't caught | **Fixed**: new `covered` lint |
| A | Contrast measured against the scene background, not the shape behind the text | **Fixed**: uses the fill of the topmost shape/container behind the text |
| B | Pulse ring "not visible" | Not a bug: it renders (verified), but it's faint on dark backgrounds |
| H | Contrast "too strict" (2.9:1) | Not a bug: 2.9:1 is below WCAG's 3:1 for large text |
| A, B | Text ink can extend outside its layout box with tight `lineHeight`, so overlap checks and stack gaps measure the box, not the glyphs | **Open** (known limitation) |
| A | `fit: "shrink"` box ~35px narrower than the drawn italic text | **Open** (same cause) |
| B | `trackIn` with a big start spacing can briefly push text off-canvas; lint only checks resting positions | **Open** |
| A | Lint can't judge design quality (empty space, dull scenes) | **Open** by nature; the contact sheet is the check |
| A | Placeholders show no hint, so a contact sheet doesn't say what goes there | **Open**; hints stay in the spec for humans |
| B | `patch` reformats `video.json` | Accepted: versions are written canonically |

---

## 3. Recommendations

1. **Phase 2 features**, in order of demand across all three test rounds: device `screens` + `navigate`, `interaction` (cursor), `scroll`, `toast`/`icon`, `chart`, `matchCut`, `camera`.
2. **Ink-aware text boxes**: measure glyph bounds (canvas `measureText` actualBoundingBox) so overlap, shrink and spacing use what's drawn.
3. **Lint over time**: sample `layout` at each element's animation extremes, not only at rest.
4. **A design-review prompt**: the MCP `create-video` prompt could ask the model to critique its contact sheet against a short checklist (hierarchy, one idea per scene, empty space, contrast), which is what the best agents did unprompted.
