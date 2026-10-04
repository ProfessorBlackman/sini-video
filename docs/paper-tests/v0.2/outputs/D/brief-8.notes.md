# Brief 8 — Nonprofit year in review, 16:9 (authoring notes)

Plan: 5 scenes, 3 + 3.5 + 4 + 6 + 3.5 = 20s. Intro → hero stat "12,000 meals served" → "340 volunteers / 18 communities" side by side → bar chart of meals per quarter built from `rect` shapes with countUp value labels, Q4 highlighted → thank-you outro. (Nice check: 2,100 + 2,800 + 3,300 + 3,800 = 12,000, so the chart agrees with the headline number.)

The nonprofit's name and the year were not given, so the video says "Our year in review" and never names the org or year. There's no CTA because none was given.

## Guesses

- **Role sizes on a 1920-wide canvas.** §4.2 says "Sizes assume a 1080px-wide canvas." It doesn't say whether they scale up for 16:9. I assumed they **do not** auto-scale (they're in canvas pixels per §3), so I set explicit `size` on the big numbers and labels. If they *do* scale ×1.78, `display` would be ~267px and my explicit sizes would be wrong in the other direction.
- **countUp with thousands separators.** §7.3 says "Numeric `content` (e.g. `"0"`)". I wrote `"12,000"`, `"2,100"` etc. and assumed countUp parses the comma and keeps the format while counting. If commas make it non-numeric, countUp would fail or lint as an error; the fallback would be `"12000"` (uglier).
- **countUp `ease`** — assumed presets accept `ease` like all others (§9.2 "All presets accept at, duration, ease, stagger"), so the count slows near the end with `expo.out`.
- **Bar growth with `wipeIn from: "down"`.** §9.2 says "Revealed by a moving clip edge" with `from` (`left | right | up | down`). I assumed `from: "down"` means the reveal starts at the bottom edge and moves up (bar grows upward from the baseline). If it means the opposite, bars grow from the top — wrong for a chart. I avoided animating `height` because §7.2 implies the origin is top-left, so height would grow downward.
- **`above` layout with `align: "center"`** for value labels — assumed it centres the label horizontally over the bar.
- **Layout relations to absolutely-positioned elements** (labels `below`/`above` bars that use `x/y`) — assumed allowed.
- **`shape: "line"` with only `width`** — assumed it draws a horizontal line at y, height 0. Copied from the example.
- **Raw `animate: { "fill": "sun" }` on a shape and `color` on text** — both are in the animatable list; assumed palette tokens are accepted as animation values.
- **Timeline `target` list with raw `animate`** (dim Q1–Q3). §9.3 shows lists only with presets; assumed raw animations also accept a list.
- **Dimming via `opacity` vs `focusCycle`.** `focusCycle` is for cycling; I just wanted one persistent highlight, so I used raw animations.
- **Nested stacks** (horizontal stack of vertical stacks) and `enter` presets on children of a stack — assumed children of containers can have their own enters and are timed by declaration order.
- **`justify: "center"` with `width: "84%"`** on a horizontal stack to centre two columns — assumed the stack honours explicit width.
- **Intro positioning**: `anchor: "left"` + `inset: [0, 160]` + `offset: [0, -170]` to put the kicker roughly above vertical centre, then the headline `below` it. I had to guess the offset so the whole block looks vertically centred; no way to centre a *group* of stacked texts except wrapping in a stack (which I could have done; I wasn't sure an anchored stack sizes to content).
- **Label role uppercasing** "Our year in review" and "Q1" — assumed automatic.
- **Element `enter.at` referencing another element's enter start** (`"bar-q1.enter.start+0.25"`) — matches §8.
- **`cues` + `"cue:highlight"`** used in both an element `enter.at` and timeline items — assumed fine.

## Invented

- Nothing structurally new. Borderline: comma-formatted numeric content for `countUp` (see Guesses), `style.size` overrides on `label` role text, and passing `ease` to `countUp`.
- I did **not** use `template` for the chart; shapes were enough.

## Missing

- **A chart element.** The big one. No `bar`/`chart` type, so the chart is 4 rects + 4 value labels + 4 axis labels + 1 baseline = 13 hand-placed elements, with pixel heights computed by me. A `{"type":"chart","kind":"bar","data":[...]}` would have been 1 element.
- **Bar growth anchored at the bottom**: no transform-origin control, so I relied on `wipeIn` direction semantics.
- **Per-corner radius** (rounded tops, flat bottoms for bars). Used `radius: 10` on all corners.
- **Number formatting** (thousand separators, prefix/suffix like "+" or "%") for countUp — would have liked `"format": "0,0"` and to count up the "+81%".
- **Centring a multi-element text block** vertically without guessing an offset.
- **Organisation name / logo** — not given; omitted rather than inventing one.

## Hard parts

- Bar chart arithmetic. Baseline y = 900, max bar height 520 for 3,800:
  - Q1: 2100/3800 × 520 = 287.4 → 287, y = 613
  - Q2: 2800/3800 × 520 = 383.2 → 383, y = 517
  - Q3: 3300/3800 × 520 = 451.6 → 452, y = 448
  - Q4: 520, y = 380
  - x positions: 4 bars × 220 + 3 gaps × 120 = 1240 wide, centred → start x = (1920 − 1240)/2 = 340; then 680, 1020, 1360. Baseline x 300 → 1620 (width 1320).
  Every number here is error-prone and has to be redone if the data changes. Lint wouldn't catch a wrong bar height.
- Checking the title (y=90, subtitle 64px) and tallest value label (y ≈ 380 − 16 − ~50 ≈ 314) don't collide, and that "+81%" at top-right doesn't overlap the Q4 label — all estimated.
- Growth %: 3800/2100 = 1.81 → "+81%". Computed by hand.
- Reading times: outro sub-line (5 words → needs 2.0s) originally had only ~1.5s, so I lengthened the outro to 3.5s, shortened chart to 6s and shortened the copy. Intro headline (4 words → 1.7s) visible from ≈1.2s to 3.0s ≈ 1.8s — tight. These checks are entirely manual because default enter timing ("prev.enter.end − 0.2") has to be simulated in your head.
