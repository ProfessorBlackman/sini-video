# Brief 11 — Ledgerly 2.0 product update (16:9)

Brief: 15-second landscape product update, three features (recurring invoices, multi-currency, faster PDF exports), app shown in a browser with no screenshot, end on "Update today".

Structure: 5 scenes. `intro` (title card) → `recurring` → `currency` → `pdf` → `outro` (CTA). Each feature scene has a `feature-copy` component (kicker / title / one line) on the left and a `browser` with mock UI built from stacks, text, badges and shapes on the right. An `invoice-row` component is reused 4×. Push-slide transitions between features, a circle reveal into the outro.

## First attempt

- `validate`: **0 errors** (5 scenes, 44 elements).
- `lint`: **1 warning**: `target-unreachable` (video was 19.50 s against `targetDuration: 15`, 4.5 s too long).

## Round 1: reading time and in-browser legibility
- **Checked:** `sini at` at 1/4/7/10/14 s, `sini layout 7.3` and `15.4`, and the first contact sheet.
- **Found:**
  - The intro held for about 4 s. The intro subtitle and every feature body line were long, and reading time (0.5 + 0.3 × words) was driving the `auto` durations.
  - Everything inside the browsers was unreadable. `layout` showed in-device text at 17 logical px, about 13 canvas px, because the browser is 1000 px wide (0.78 canvas px per logical px). Badges came out at about 9 canvas px.
  - The browsers were mostly empty: content filled only the top third.
  - `f3-doc` (a rect shape in the browser page) came out 94 px wide instead of stretching to the page width.
- **Changed:**
  - Shortened copy ("Three new features.", 4–5-word feature lines).
  - Set explicit `style.size` on all in-browser text: titles 60, rows 34, badges 22–28, the currency total 150.
  - Increased row padding and added a 4th invoice row.
  - Gave `f3-doc` an explicit width.
- Result: 16.5 s, 1 warning (still `target-unreachable`). Saved v1.

(Note: I applied this round's edits as literal find/replace on my own hand-written JSON with a short script. Every later edit was made by hand with the editor.)

## Round 2: timing and making the PDF screen read as a document
- **Checked:** the sheet. The 0.5 s default chaining of the three feature-copy enters (num → title → body) pushed the body's enter end late. The PDF screen was an empty white box.
- **Changed:**
  - Gave the component's enters explicit times (0.15 / 0.25 / 0.6).
  - Intro: charReveal stagger 0.03, title size 180, subtitle tied to `intro-title.enter.end-0.3`.
  - Made the currency state switches faster (1.2 s and 2.1 s).
  - Moved the Export button into a header row next to the invoice number.
  - Replaced the blank doc with a white card holding "text line" pills.
- Result: 15.2 s, 1 warning (`target-unreachable`, 0.2 s).

## Round 3: shape bug, vertical balance
- **Checked:** `sini frame 12`, then zoomed in. `"shape": "pill"` rendered as a **tapered ellipse**, not a pill. `layout 8` showed the currency content sitting high in its browser (content from y≈363 to 594 inside a browser running from 210 to 870).
- **Changed:**
  - Pills became `rect` shapes with radius = height / 2.
  - Currency browser top padding went from 150 to 210 to centre the total.
  - Tried `"grow": 1` on `f3-doc` to fill the empty lower half of the PDF browser.
  - Subtitle offset changed to −0.5.
- Result: **15.00 s, 0 warnings.**

## Round 4: `grow` didn't work
- **Checked:** `layout 12` reported `f3-doc` at 455.6 tall, with "now 318.8". The sheet showed the short version, so `grow` is computed by `layout` but not applied by the renderer.
- **Changed:**
  - Gave `f3-doc` an explicit `height: 460`.
  - Added a subtle `drift` (scale 1.04) on the intro block so the title card isn't static.
- Result: 0 errors, 0 warnings, 15.0 s. Saved v2.

## Feedback round: "At around 0:06 the features go by too fast, and make the 'Update today' button bigger."
- **Finding the elements:** `sini at 6` showed t = 6 s is the cut from `recurring` (3.5 s in, leaving via slide at 13%) into `currency` (0.2 s in). "The features" therefore means the three feature scenes, which were each about 3.3 s long. The button is `outro-btn`, inside `outro-block`.
- **Patch** (`patches/feedback.json`, v3):
  ```json
  [
    { "op": "set", "path": "video.targetDuration", "value": 17 },
    { "op": "set", "path": "recurring.duration", "value": 4.2 },
    { "op": "set", "path": "currency.duration", "value": 4.2 },
    { "op": "set", "path": "pdf.duration", "value": 4.2 },
    { "op": "set", "path": "currency.timeline.3.at", "value": 2.6 },
    { "op": "set", "path": "currency.timeline.4.at", "value": 2.6 },
    { "op": "set", "path": "currency.timeline.5.at", "value": 2.6 },
    { "op": "set", "path": "recurring.timeline.0.stagger", "value": 0.18 },
    { "op": "set", "path": "pdf.timeline.0.at", "value": 1.4 },
    { "op": "set", "path": "pdf.timeline.1.at", "value": 2.2 },
    { "op": "set", "path": "outro-btn.style.size", "value": 60 },
    { "op": "set", "path": "outro-block.gap", "value": 56 }
  ]
  ```
  My first try used `timeline[3]`. It failed with `Unknown key 'timeline[3]'`: the bracket syntax created a literal key. Dotted indices (`timeline.3.at`) worked. Because the patch is all-or-nothing, nothing was saved by the failed try.
- **Second patch** (`patches/feedback-2.json`, v4): the first patch gave 18.0 s, 1 s over the new 17 s target (lint `target-unreachable`). This patch set the feature scenes to 4.0 s and the target to 17.5.
- **Trade-off:** slowing the features meant giving up the brief's 15 s. The final video is 17.5 s. The intro and outro are already near their minimums, so there was nowhere else to take the time from.
- Button: 34 px → 60 px label (`layout` shows the box went from 288×82 to 508×144).
- `sini versions`: v1 round 1, v2 round 4 (pre-feedback), v3 feedback, v4 feedback duration fit.

## Final
- `validate`: **0 errors**. `lint`: **0 warnings**.
- Length: **17.50 s** (15.0 s before the feedback).
- Draft render: 960×540 at 15 fps, 263 frames, **7.2 s** reported (8.8 s wall clock).
- Files: `final-sheet.png`, `out/draft.mp4`.

## Tools that helped most
- **`sini layout`** was the most useful. It exposed the logical-vs-canvas scale problem (13 px text), the stretched/not-stretched shape, the off-centre content and the `grow` mismatch. It also confirmed the button size change.
- **`sini at`** made the feedback round easy. It names both scenes during a transition, with progress.
- **`sini sheet` / `frame`**: the sheet catches pacing and composition. A single full-size frame was needed to see the pill-shape bug.
- **lint** `target-unreachable` with exact seconds made duration tuning quick.

## What I still had to guess
- **Scene durations and start times.** No command prints them. I worked them out by subtracting the local time `at` reports from the global time.
- **How much each change would shorten an `auto` scene.** I had to iterate.
- **The patch path syntax for array items** (`timeline.3`). It isn't documented; §11 only shows id-rooted paths. Timeline items without an `id` can only be addressed by index, which is fragile.
- **Whether the `outro-block.gap` path works** on a container key that isn't `style`. It validated and saved, but I didn't measure it separately.

## Problems with Sini itself
1. **`shape: "pill"` renders as an ellipse** (pointed ends) instead of a rounded rect. Workaround: `rect` + `radius`.
2. **`layout.grow` inside a browser page:** `sini layout` reports the grown size, but the renderer draws the un-grown size. The two tools disagree.
3. **A `shape` in a device page doesn't stretch** to the page width, contrary to §7.3 ("Page children … stretch to the screen width"). It rendered 94 px wide.
4. **`sini save` / `patch` reformat `video.json`** (they expand the compact JSON to one key per line). An editor holding the old text then fails find/replace. That's surprising, though harmless.
5. **Patch paths:** `timeline[3]` is silently treated as a literal key name, and only fails later at schema validation with a confusing "Unknown key 'timeline[3]'". The path syntax for arrays should be documented, or bracket syntax accepted.
6. **No scene timing summary.** A `sini scenes` command, or durations in `lint`/`validate` output, would avoid arithmetic.
7. **Lint missed real problems:** the 13 px in-browser text, mostly-empty browser screens, and a rendered shape 94 px wide inside a 912 px page. A minimum rendered text size check for device content would be valuable.
8. **In-device role sizes are tiny for a 16:9 browser** of normal width (body 17 logical px ≈ 13 canvas px). The defaults suit a full-screen 1920-wide browser, not the common "copy left, browser right" layout. Every text needed a `size` override.
9. **The `targetDuration` vs. feedback conflict isn't surfaced.** When a human asks for slower pacing, there's no hint about which scenes have slack to trade.
