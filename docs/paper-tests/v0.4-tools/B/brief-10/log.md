# Brief 10 — Lumen, Agency of the Year 2026, 10s square (gold on black)

## First attempt
- validate: **0 errors** (3 scenes, 11 elements)
- lint: **1 warning**: `low-contrast` on `kicker` (4.0:1, "mute" label on ink)
- Length was already 10.00s (`targetDuration: 10`, three `auto` scenes)

v1 had three scenes:
- **intro:** "DESIGN STUDIO" kicker plus a LUMEN wordmark (charReveal + trackIn)
- **award:** "Winner" badge, "Agency of the Year", and "2026" with `countUp` from 2000
- **outro:** LUMEN, a rule, and "lumen.studio" typed with `typewriter`

Theme: Fraunces/Manrope, editorial motion, a gold-bar wipe transition.

## Round 1: contrast, scale, a bad count-up
- **Checked:** lint and the contact sheet.
- **Found:**
  - The kicker was low-contrast and tiny (22px).
  - The "Winner" badge was tiny.
  - The title at 104px felt small on 1080².
  - `countUp` from 2000 showed "2019" mid-animation, which reads as the wrong year. Bad idea for an award year.
- **Changed:**
  - Kicker: gold/0.85, 30px, 0.3em tracking.
  - Badge: 30px with padding.
  - Title 130px, year 240px with `trackIn` instead of `countUp`.
  - Outro wordmark 150px, URL 80px.
- **Checked `layout 4`:** the award stack is 608px tall inside 1080, so it fits.
- **Result:** lint clean.

## Round 2: motion on static holds
- **Checked:** the sheet. The intro wordmark sits static for about 2s after it settles.
- **Changed:** added a `drift` (scale 1.04, y 0) on `intro-block`.

## Round 3: outro typing looked off-balance
- **Checked:** full-size `frame 8.1`. `typewriter` on centred text types from the left edge of the final box, so "lume|" sits off-centre under the centred wordmark. It looks unbalanced for most of the outro.
- **Changed:**
  - URL enter → `trackIn` (calmer, stays centred).
  - Added `drift` on `outro-block` and `award-block` so every hold has slow motion.
  - Added `notes` (the kicker/badge copy is paraphrased; the wordmark is typographic, not the real logo).

## Round 4: final review and render
- Full-size `frame 5.5` and `6.6` of the award card:
  - Clear hierarchy: badge → title → gold year.
  - Balanced margins, good contrast.
- Lint was clean, so I rendered the draft.

## Final
- validate: **0 errors**. lint: **0 warnings**.
- Length: **10.00s** (3 scenes, about 3.3s each).
- Draft render: **3.7s** reported (4.9s wall), 540×540 @ 15fps, 150 frames.

## What helped most
- **Contact sheet:** caught the "2019" count-up problem immediately. No validator would flag that.
- **Full-size `frame`:** caught the off-centre typewriter.
- **`lint` low-contrast:** gave an actual ratio.
- **`layout`:** confirmed the stack fits without guessing text heights.

## Still guessed
- Whether the `pulse` with `ring: true` on the badge actually renders. `at 6.5` says pulse is animating, but I couldn't see a ring in the frames I sampled. It may be very subtle or between beats.
- Optical centring of the tracked wordmark. With `letterSpacing` 0.12em, LUMEN measures about 9px left of centre (trailing tracking after the N seems to be counted in the box). I left it.

## Problems with Sini
1. **`typewriter` on centred text** reveals left-to-right inside the final centred box, so partially typed text is off-centre. It might be better to centre the growing string, or document the behaviour.
2. **Trailing letter-spacing** appears to be included in the text box, which shifts tracked, centred wordmarks slightly left.
3. **Pulse ring visibility** couldn't be confirmed from `at`/`frame`. `at` could report the ring's current scale/opacity.
4. **`countUp` on a year is a footgun.** Not a bug, but no warning suggests it.
5. **Lint codes appear only with `--json`.**
