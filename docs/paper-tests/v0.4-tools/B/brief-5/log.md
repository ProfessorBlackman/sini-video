# Brief 5 — da Vinci quote, 10s vertical kinetic type (black and gold, calm)

## First attempt
- validate: **0 errors** (4 scenes, 9 elements)
- lint: **1 warning**: `target-unreachable` (video was 15.20s, so 5.20s over the 10s target)

v1 had four `auto` scenes: "Simplicity", "is the / ultimate", "sophistication.", and the full quote with the author. Theme: `calm`, crossfade, Instrument Serif, gold on near-black, light grain and vignette.

## Round 1: length and the first contact sheet
- **Checked:** `lint`, `at` at 1/4/7/11s (to see which scene was running when), and the contact sheet.
- **Found:**
  - The video was 15.2s. Four scenes with calm 1.1s enters plus reading time can't fit in 10s.
  - `trackIn` with `from: 0.5` spread "Simplicity" past both canvas edges in its first frames, so it was clipped as "S i m p l i c".
  - The full-quote scene used the `title` size (104), which looked small on 9:16. The `label` attribution (22px) was barely readable.
  - The 2.5s scale animation on "sophistication." was stretching that `auto` scene.
- **Changed:**
  - Went from 4 scenes to 3. "is the / ultimate / sophistication." now build in one stack.
  - `trackIn from` 0.5 → 0.12.
  - Quote text 104 → 124px, author 22 → 34px with 0.2em tracking.
  - Added a gold opening quote mark.
  - Shortened the enter durations.
- **Result:** 10.10s, still 1 `target-unreachable` (0.10s over).

## Round 2: hit 10s, tighten the quote block
- **Checked:** lint, `layout 9`, the sheet, and a full-size `frame 8.5`.
- **Changed:**
  - The author now enters at `q-full.enter.end` instead of chaining after the rule, which saved about 0.3s.
  - Quote-mark size 300 with a tighter line height; stack gap 64 → 48.
- **Result:** lint clean at exactly 10.00s. But in the full frame the quote mark floated about 200px above the text. Text glyphs are drawn outside their layout box when `lineHeight` < 1, so the stack gap was not the visual gap.

## Round 3: quote-mark spacing (via `sini patch`)
- **Changed:**
  - Moved `q-open` out of the stack with a patch `move` op and pinned it to the top of `q-full`.
  - My first offset (-70) gave a lint `overlap` warning (q-open/q-full), because the box is taller than the glyph.
  - Tried offset -130: lint was clean, but it still looked too far apart.
  - Final: `lineHeight` 0.25 and offset -40. Lint is clean and the visual gap is about 110px, which looks right.
- Also added `notes` with a patch `set`.

## Round 4: final review and render
- Sheet review:
  - **Hierarchy:** the gold key word in each scene, pale secondary words, and the author as a small tracked label.
  - **Pacing:** 3.3s, 3.0s and 3.7s scenes.
  - The end fade darkens the last frame as intended.
  - A lot of negative space above and below on 9:16. I kept it on purpose for the calm brief.
- Rendered the draft.

## Final
- validate: **0 errors**. lint: **0 warnings**.
- Length: **10.00s** (3 scenes).
- Draft render: **4.7s** reported (6.0s wall), 540×960 @ 15fps, 150 frames.

## What helped most
- **`lint` target-unreachable**, with an exact "long by X s" number. It made trimming to 10s a quick, concrete loop.
- **Full-size `frame`.** The 12-up contact sheet is too small to judge spacing like the quote-mark gap, or the clipping of a tracked word.
- **`layout`**: exact boxes, and the "now" box during `trackIn`/`drift`.
- **`patch`**: `move` and `set` on nested paths worked first time.

## Still guessed
- How the glyph sits relative to its box when `lineHeight` is small. I had to iterate visually (three tries).
- How long each `auto` scene would be. Lint only reports the total; nothing prints per-scene durations. I inferred them from `at` and the sheet labels.

## Problems with Sini
1. **Glyph vs box mismatch.** With `lineHeight` < 1, glyphs render well outside the layout box (a 300px “ with a 75px box draws above it). So stack `gap` and lint `overlap` describe boxes, not ink. The overlap check flagged a layout that looked fine and passed one that looked wrong.
2. **No per-scene durations.** There is no per-scene duration readout in `validate`/`lint`/`at` (e.g. "s-full: auto → 3.7s"). Hitting `targetDuration` meant guessing which scene to trim.
3. **`trackIn` with a large `from` can push text off-canvas.** Lint didn't warn (it seems to check only the final box).
4. **`sini patch` rewrites `video.json`** from compact to fully expanded formatting. That's harmless, but surprising if you then edit by hand.
5. **Lint codes are only visible with `--json`.** The human output shows no code names.
