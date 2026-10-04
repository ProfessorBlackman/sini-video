# Paper-test findings — DSL v0.3

**Date:** 2026-10-04
**Setup:** same as v0.2. Same 8 briefs ([BRIEFS.md](../BRIEFS.md)), same 6 agent slots (A–D default model, H and I Claude Haiku), each reading only [DSL_REFERENCE.md](DSL_REFERENCE.md). Graded with the v0.3 [check.py](check.py) (mutation-tested on 9 v0.3-specific mistakes), then every notes file was read.
**Previous round:** [v0.2/FINDINGS.md](../v0.2/FINDINGS.md).

---

## 1. Before and after

| Measure | v0.2 | v0.3 |
|---|---|---|
| Specs valid on first try | 11 / 12 | 10 / 12 |
| Checker errors | 1 | 6 |
| … caused by the reference | 0 | 4 (two unclear rules, see N1, N2) |
| … genuine author mistakes | 1 | 2 (both Haiku) |
| Invented element types / presets | 0 | 0 |
| Briefs needing a repeated card that used a **component** | 0 / 5 | 6 / 6 for Opus, 0 / 2 for Haiku |
| Chart briefs built with **shapes or a template** | 2 / 2 | 0 / 2 (both used `chart`) |
| Screenshot click done with a **hotspot** | — (faked overlay button) | yes (`dashboard#export`) |
| App flows using device **screens** | — (split into 2 scenes) | 3 / 4 |
| Specs using `"duration": "auto"` | — | 8 / 12 |
| Specs listing invented copy in `notes` | — | 12 / 12 |
| Spacer-rect workarounds | 2 | 1 |

### v0.2 problems: status

| v0.2 issue | Status in v0.3 |
|---|---|
| S1 timeline enters flash visible first | ✅ Not raised |
| S2 default text enter vs visibility | ✅ Used correctly, including `"enter": "none"` |
| S3 stagger/duration semantics | ✅ Applied correctly in every reading-time calculation |
| S4 interaction timing | ✅ Step IDs used for sync everywhere. One gap left: does `at` include the cursor fade-in? (N4) |
| S5 `countUp` formatting | ✅ `"GH₵ 4,500"` as one element. One Haiku agent still split "340 volunteers" (a style choice, not an error) |
| S6 role sizes on 16:9 / in devices | ✅ Not raised |
| S7 unlisted enum values | ✅ Mostly. Safe-zone sizes and `circle` default origin still missing (N7) |
| S8 containers draw fill / size to content | ✅ Cards built as styled stacks |
| S9 device sizes | 🟡 Logical screen worked; bezel size / canvas scale still guessed (N9) |
| M1 padding and backgrounds | 🟡 Containers fine. Per-screen background and bottom-pinned buttons still missing (N6) |
| M2 components | ✅ Speaker cards, stat cards, polaroids, goal chips, feature rows |
| M3 chart | ✅ |
| M4 device screens | ✅ |
| M5 screenshot hotspots | ✅ But overlays on a screenshot (toasts) aren't possible (N5) |
| T1–T2 auto duration / target | 🟡 Used in 8/12, but 3 agents went back to fixed durations because `targetDuration`'s limits are undefined (N3) |
| Arithmetic overall | 🟡 Still the #1 hard part, now almost entirely **measurement** (text widths, block heights), which only the real `layout` tool can answer |

**Overall:** every structural gap from v0.2 is closed, and the agents used the new features without prompting. The errors that remain come from two rules the reference doesn't state clearly. The remaining hard part is mostly something paper-testing can't fix: authors need a tool that measures text.

---

## 2. New issues (fix in v0.4)

| # | Issue | Raised by | Proposed fix |
|---|---|---|---|
| N1 | **How to reference elements inside a device.** Haiku agents wrote `phone/add-btn` by analogy with component paths (3 checker errors); another wasn't sure. | H, I | State plainly: device children (including `screens`) use their **plain IDs**. Only component instances create `/` paths |
| N2 | **`navigate` is documented under "Behaviors" but has no `behavior` key**, so an author wrote `"behavior": "navigate"`. The interaction-step form can't set a transition. | H, B, D | Make it a normal behavior: `{ "behavior": "navigate", "target": "phone", "to": "home", "transition": "push" }`. On steps: `"navigate": { "phone": "home" }, "transition": "fade"` |
| N3 | **`targetDuration` limits undefined.** How far can holds shrink? Do fixed scenes count? Does the end fade add time? Do ambient presets extend `auto` scenes (they run "to scene end", which is circular)? | C (×2), B, D, H | Define: only `auto` scenes' holds change, each between 0.2s and +3s; fixed scenes and the end fade are inside the total; ambients and cursor fade-outs don't extend `auto`; lint reports any remainder |
| N4 | **Interaction `at` vs cursor fade-in** | A, B, H | `at` = start of the first move. The cursor fades in during the 0.2s before `at` |
| N5 | **No overlays on a screenshot device** (`content` XOR `children`), so a toast had to be pinned in canvas pixels | A | Add `overlay: [...]` on devices: elements laid out in the device's logical viewport, on top of `content` |
| N6 | **No per-screen background or padding; no "push to bottom"/"fill remaining space"** (spacer rect; split-screen heights computed by hand) | B, C | `screens` entries can be `{ "background", "padding", "gap", "children" }`. Add `layout.grow: 1` for children of stacks and device pages (takes remaining space) |
| N7 | **Safe-zone sizes and `circle` default origin missing** | A, B, D, H | Publish safe-zone margins per platform; `circle` defaults to `center` |
| N8 | **Component details:** are definition states inherited? Can `set`/state targets use component paths? Does instance `style` merge with the root's? Can params fill enum values (`variant`)? Empty `params`? | B, A, D | Yes to all, stated explicitly |
| N9 | **Device canvas scale**: bezel thickness, so where things land on canvas | B, D, H, I | Publish: phone screen = 92% of outer width, starting 4% in. Better: `layout` reports it |
| N10 | **`pin` only centres** the element on the point; placing it just inside a corner means halving its size by hand | A | Add `pin.inside: <px>`: the element's matching corner sits that far inside the point |
| N11 | **Small semantics:** raw `animate` items' `.end`; `<id>.enter` when the enter comes from a list-target timeline item; grid children stretch to column width; default stack `align`; what counts as a word; whether button labels count for reading time; `…` glyph; whether progress `value` steps or glides | A, B, C, D, I | One line each in the reference |
| N12 | **Haiku invented an anchor** (`bottom-center`) | I | Validator suggestion: "did you mean `bottom`?" (no reference change) |

## 3. Still-deferred features, now requested more often

| Feature | v0.2 requests | v0.3 requests | Recommendation |
|---|---|---|---|
| Toast / badge / icon | 2 | 3 (A ×2, D) | **Promote to v0.4.** Toasts were the hardest part of the SaaS brief in both rounds |
| Per-word colour / emphasis | 2 | 3 (A, C ×2) | Promote: `[word]{color}` inline markup is cheap |
| Addressable chart bars / progress steps | 0 | 1 (D) | `chart-id#Q4` using the hotspot syntax |
| Focus styles beyond dim/scale | 0 | 1 (B) | Defer |

---

## 4. What paper-testing can't tell us

Every agent's remaining hard part was **measuring**:
- does this text fit on one line?
- how tall is this block?
- where does the phone's button land on the canvas?
- will the scroll reach its target?

In real use, the AI would call `layout` and `lint` and get exact answers. Paper tests can't simulate that, so further paper rounds will keep reporting it.

**Recommendation:** after the small v0.4 fixes above, stop paper-testing and build the vertical slice. The next useful test is the same 8 briefs **with working `validate`, `lint` and `layout` tools**, where the AI can iterate.
