# Brief 9: Built in Accra, episode 12 teaser (12 s, 9:16)

## First attempt
- validate: **0 errors**
- lint: **0 warnings**
- Video length 12.00 s (targetDuration 12)
- Clean lint did not mean a good video. The sheet showed:
  - "EP 12" filled only the top half of the frame.
  - The show name was a 22 px label.
  - The guest scene had the bottom 40% empty.
  - A vignette muddied the yellow end card.

## Round 1: hierarchy
- **Checked:** the contact sheet, critically.
- **Changed:**
  - Show name became a `title` ("Built / in Accra").
  - Added an "Episode" label and made "12" a 640 px `countUp` from 1 with `drift`.
  - Guest photo enlarged to 700 px inside a sun-coloured `drawOutline` ring, with `kenBurns`. Name is now a 2-line `title`.
  - End card got a "New episode" badge, a 260 px "Out Thurs-/day." title and the show/guest line.
  - Raised the label role to 32 px and the display/title weight to 800.
- **Lint:** 1 `edge-margin` warning (a negative offset on "12").

## Round 2: size and fit
- **Checked:** `layout` showed "12" at 640 px was only 500 px wide, with room to spare. The hyphenated "Thurs-/day." looked bad.
- **Changed:**
  - "12" → 900 px, with the offset removed.
  - Title → "Out\nThursday." with `fit: "shrink"`, `maxLines: 2`, `maxWidth` 900, then 840 after a `safe-zone` warning.
  - Vignette set to 0.
- **Found:** `layout` reported the shrunk title as 840 px wide ("shrunk to 80%"), but `frame 10` showed "Thursday." drawn to about x=964, past the box and past the reels right margin. **Lint passed.** The shrink measurement and the rendering disagree.

## Round 3: end-card composition
- **Checked:** the bottom half of the yellow end card was empty.
- **Changed:**
  - Put the badge, title and show line in a `stack`.
  - Dropped `fit: shrink` and used a fixed size instead, since I don't trust shrink now.
  - Added a large night disc bleeding off the bottom-right, with `scaleIn` and `drift`, and a sun-coloured "12" pinned into it.
- **Lint:** 3 warnings:
  - `safe-zone` (title too wide, and "12" too low)
  - `low-contrast` on "12": 1.0:1. This is a **false positive**, because lint measures against the scene background (sun) even though the text sits on the night disc.

## Round 4: safe zone and final tweaks
- **Changed:**
  - Raised the disc (inset -120 instead of -260) and offset "12" up so it clears the 420 px bottom zone.
  - Title size 190 (793 px wide).
- **Lint:** only the `low-contrast` false positive remains.

## Final
- validate: **0 errors**; lint: **1 warning** (`low-contrast` on out-12, a false positive: sun-yellow text on a black disc)
- Video length: **12.00 s**, 3 scenes
- Draft render: **6.2 s** for 180 frames at 540×960 / 15 fps
- Remaining weaknesses:
  - The guest photo is a dark placeholder sphere.
  - The episode scene still has unused space below the "12".
  - The "12" in the disc sits close to the disc's upper edge.

## Tools
- **Most helpful:**
  - The `sheet` showed every design problem; lint was clean on a weak first draft.
  - `layout` gave real text widths: the "12" at 640 px was only 500 px wide.
  - `frame` at full size exposed the shrink overflow.
- **Still guessed:**
  - Display sizes, since I had to iterate via `layout`.
  - The pin offset for "12" inside the disc. `pin` puts the centre on a point, and I had to compute disc-centre arithmetic by hand to stay out of the safe zone.

## Problems with Sini
1. **`fit: "shrink"` mismeasures:** the box was reported as 840 px ("shrunk to 80%", 208.6 px), but the rendered glyphs overflowed about 35 px past it, into the reels right margin. Lint did not flag it. In an earlier run the report said "shrunk to 90%, 223px", but 223/260 is 86%, so the percentage and px also disagree.
2. **`low-contrast` uses the scene background**, not what's actually behind the text. Text on a shape gets a false 1.0:1 warning, which can't be silenced.
3. Lint passing on the first draft gives false confidence. There is no check for large empty regions or for a scene that is static after its entrances finish (the low-motion check only fires above 6 s).
4. The `vignette` on a bright yellow background produces muddy brown corners. Fine as designed, but it would be worth a note in the docs that vignette is global and not per scene.
5. The `at` output doesn't list scene start and end times, which would make timing questions easier.
