# Paper-test findings — DSL v0.2

**Date:** 2026-10-04
**Setup:** 8 briefs ([BRIEFS.md](../BRIEFS.md)), 6 agents, each reading only [DSL_REFERENCE.md](DSL_REFERENCE.md).
- Agents A–D: default model (Claude Opus), 2 briefs each, all 8 briefs covered.
- Agents H, I: Claude Haiku as a stand-in for smaller/open models, briefs 1, 3, 7, 8.
- Outputs graded with [check.py](check.py) (mutation-tested: it caught 7/7 seeded mistakes), then every notes file was read.
- Caveat: agent D ran a small script to adjust timings and parse its JSON, against instructions.

---

## 1. Headline results

| Measure | Result |
|---|---|
| Specs that were fully valid on the first try | **11 / 12** (Opus 8/8, Haiku 3/4) |
| Invented element types, presets or behaviors | **0** |
| Total checker errors | 1 (`variant` inside a button state — not allowed by §9.5) |
| Most-cited hard part | **Arithmetic**: reading time, scene sums, pixel heights. Raised by all 6 agents |

**The vocabulary works.** A strict, enumerated DSL is easy to write correctly, even for a small model. The problems are not in syntax. They are in:
1. **Semantics the reference leaves undefined**, so two agents would expect different renders from the same JSON.
2. **Missing layout and component capabilities**, which forced verbose, pixel-guessed workarounds.
3. **Arithmetic the AI cannot do reliably blind** (text heights, timing sums), which belongs in tools.

### Opus vs Haiku

| | Opus (A–D) | Haiku (H, I) |
|---|---|---|
| Size per spec | 4–15 KB, 10–58 objects | 3–4 KB, 10–13 objects |
| Scene length | mostly 2–5s, as advised | 5–12s (one 12s static chart scene) |
| Feature use | camera, states, focusCycle, cues, matchCut | basic presets; one chart via `template` with hand-written CSS |
| Notes quality | precise, quoted sections | vaguer; some guesses not recognised as guesses |

Small models produce **valid but thin** videos. They need higher-level building blocks (scene recipes, components, charts) more than large models do, and they reach for `template` when a component is missing — the escape hatch the reference asks them to avoid.

---

## 2. Contradictions and undefined semantics (fix in the reference)

These cause a different render than the author intended, silently.

| # | Issue | Raised by | Proposed fix |
|---|---|---|---|
| S1 | **Timeline enter presets vs "no `enter` = visible from scene start" (§7.1).** An element entered from the timeline (the only way to stagger container children) would show, then disappear and animate in. | A, B, C | An element is hidden until its **first enter preset**, wherever it is declared (`enter` or timeline) |
| S2 | **Motion personality "default text enter" (§4.3) vs §7.1.** Unclear when the default applies. | B | Text with no `enter` uses the personality's default. Opt out with `"enter": "none"`. Non-text elements stay visible by default |
| S3 | **`duration` with `stagger`**: per part or total? Makes every `.enter.end` and reading-time check uncertain. | A, B, C | `duration` is per part. Total = `duration + stagger × (parts − 1)`. `.enter.end` = when the last part finishes |
| S4 | **Interaction timing is "about 0.5s"**, and behaviors have no defined end. Every tap-synced change was hard-coded. | A, B, D, H, I | Fixed timings per `pace`. Define `.start/.end` for behaviors. Steps can take an `id` (`"tap-add.end"`) |
| S5 | **`countUp` and formatted numbers** (`"12,000"`, `"GH₵ 4,500/month"`). One agent split a price into 3 elements; another dropped the comma. | C, D, I, H | `countUp` animates the first number in the string and keeps its prefix, suffix and separators |
| S6 | **Role sizes on non-1080-wide canvases and inside devices.** Agents disagreed on whether sizes scale on 16:9 and inside a 620px phone. | A, B, D, I | Role sizes are relative to the canvas's **short side** (no change on 16:9). Device children use a **logical screen** (390 px wide) with app-sized roles, scaled to the device |
| S7 | **Unlisted enum values and conventions:** `slide.direction`, `wipe` angles other than 0, `wipeIn.from` direction, `swing` pivot, `circle.origin` across scenes, radial gradient centre, gradient angle, `pan` units | A, B, C, D, I | List allowed values and conventions explicitly in each table |
| S8 | **Do containers draw `fill`/`radius`/`shadow`?** Does a `stack` size to its content? Do container children keep their own `enter`? | B, C, D | Yes to all three. State it in §7.3 |
| S9 | **Device chrome and screen sizes are unknown** (bezel, status bar, browser bar height) | A, B, D | Publish them, or make device children lay out in the logical screen (S6), which removes the question |
| S10 | **Do two animations on the same property add or override?** (e.g. `drift` + `fadeUp` on `y`) | C | Offsets (`x`, `y`, `rotation`) add. Absolute properties (`opacity`, `color`) use the latest-started animation |

---

## 3. Missing capabilities (ranked by cost to authors)

| # | Gap | Raised by | Workaround used | Proposed addition |
|---|---|---|---|---|
| M1 | **Padding, gaps and backgrounds in containers and devices** | A, B, C, D, H, I | Invisible spacer rects; a fixed-height group + rect behind every section | `padding` on containers and devices; `gap` on device children; `screen.background` on devices |
| M2 | **Reusable components** (4 speaker cards, 3 stat cards with prefixed IDs) | B, D | Copy-paste × 4 | Top-level `components` with params; `{ "use": "speaker-card", "id": "ama", "with": {...} }`, child IDs auto-prefixed |
| M3 | **Chart element** | D, I | 13 hand-placed rects with computed heights; a hand-written CSS template | `{ "type": "chart", "kind": "bar", "data": [...] }`, bars grow from the baseline |
| M4 | **Changing a phone's screen within a scene** (onboarding → home) | B | Two scenes with a push transition that moves the whole phone | Device `screens` + a `navigate` interaction step with an in-device transition |
| M5 | **Clicking something inside a screenshot** | A | A fake button over a guessed spot on an image it never saw | `hotspots` on image assets: named regions that `click`, `focus` and `camera` can target |
| M6 | **Placing relative to an element's corner**, `below` + horizontal inset | A, D | Absolute coordinates computed by hand | Allow `offset` with every placement method; add `"pin": { "to": "img", "corner": "top-right" }` |
| M7 | **Per-word styling** (colour one word, underline/circle a word) | A, C | Split text into several elements and guess baselines | Inline markup: `[ultimate]{color:gold}`; preset `circleWord`/`underline` targeting a word |
| M8 | **Toast, badge, icon** | A, D | 6-element groups | `toast` and `badge` types; an `icon` element using a bundled open-licence icon set |
| M9 | **Progress per-step styling** (done / current / upcoming) | I, D | None | Built-in done/current/upcoming styling with overridable colours |
| M10 | **End-of-video fade** | C | Hold on the last frame | `video.end: "fadeToBlack" | "hold" | "cut"` |
| M11 | **Instagram/TikTok safe zones** | A | Kept content above y≈1450 by eye | `video.safeZone: "reels" | "tiktok" | "shorts"`, used by lint |

---

## 4. Arithmetic belongs in tools, not in the AI

Every agent spent most of its effort on maths it couldn't verify:
- text heights (`size × lineHeight × lines`) and whether a word fits a width
- vertical centring of multi-element blocks
- reading time per text block and scene durations summing to an exact total
- bar heights from data

Proposed changes:

| # | Change |
|---|---|
| T1 | **`"duration": "auto"` for scenes.** The engine computes it from the last enter + reading time + a hold |
| T2 | **`video.targetDuration`.** The engine scales `auto` scenes to hit it, and lint reports the difference |
| T3 | **A `layout` tool (`sini layout` / `get_layout`)** that returns computed boxes for every element, so the AI checks real geometry instead of estimating |
| T4 | **Lint rule: reading time** per text block, computed from real enter ends and transition overlaps (agents disagreed on whether time under a transition counts: it shouldn't) |
| T5 | **Lint rule: low-motion scenes** (e.g. > 6s with nothing animating), to catch thin small-model output |
| T6 | **Recommend stacks for centring groups**, in §1 rules and an example |

---

## 5. Authoring behaviour worth guiding

- **Agents invented product copy and claims** ("Auto-numbered invoices", "Fully fitted kitchen"). Most flagged it honestly. Add a rule: stick to facts in the brief; mark anything invented so the human can check it.
- **Glyph coverage** (`₵`, `✓`, `▶`, smart quotes) was a recurring worry. Bundle fonts with wide coverage and have lint flag missing glyphs.
- **Transition variety:** one agent used three transition types in 15s and doubted it. Add guidance: one signature transition, others only to mark a change of section.

---

## 6. Recommended next step

Fold S1–S10 (reference fixes) and the cheap structural additions M1, M6, M10, T1, T6 into **DSL v0.3**, then rerun the same 8 briefs to compare.

Larger additions need a scope decision first: M2 components, M3 chart, M4 device screens, M5 hotspots, M7 inline markup, M8 toast/badge/icon, M9 progress styling, and the T3 layout tool.
