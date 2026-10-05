# DevFest Accra 2026 test log (m5-devfest)

## 1. What I built (final: version 9, 10.70s, 1:1, draft at out/draft.mp4)

Theme: night/navy/gold (#F2B544 to match the logo)/bone palette, Bricolage Grotesque + Inter Tight, `editorial` motion, gold-bar `wipe` transition at 15°, light grain and vignette.

- **intro (3.0s)**: radial navy background. A centred stack holds the logo (`svg`, `drawOutline`, then `float`) and "DevFest / Accra [2026]{gold}" (`display` at 130, `wordReveal` with stagger).
- **ticket-scene (3.8s)**: a "SAVE THE DATE" label (`trackIn`). The ticket is a `group` (900x480, navy fill, gold/0.35 stroke, soft shadow) that comes in with `slideIn` from below plus a raw `rotation` animation from -6 to 0 with `back.out`, then `float`. Inside it:
  - a horizontal `stack` with three parts:
    - the main column (`justify: space-between`): the logo with the label "DevFest Accra 2026"; a big gold "14" (`countUp` from 1) bottom-aligned with "November / 2026" (`fadeUp`); a `map-pin` icon with "Accra International / Conference Centre" (`fadeUp`).
    - a perforation made of 15 dots from a `perf-dot` component.
    - a stub with a `ticket` icon and "ADMIT ONE".
  - two background-coloured circles anchored to the group's top and bottom edges, which act as tear-off notches.
- **cta (auto, about 3.9s)**: radial background. The logo (`popIn`, `float`), "See you at / DevFest Accra" (`title`, `wordReveal`), "14 November 2026 · Accra" (`fadeUp`), and a gold pill button "Get tickets" (`popIn`, then `pulse` with `ring: true`).

Invented copy is listed in `notes`: "Save the date", "Admit one", "See you at DevFest Accra".

## 2. Tool errors, warnings, surprises

- `get_video` before creation: "No video spec at /work/.sini-tests/m5-devfest/video.json. Create one with 'sini init'." This was expected. The message names a CLI command (`sini init`) instead of the MCP tool `create_video`, which is a small mismatch for an MCP user.
- Lint v1: "targetDuration 10s can't be reached: the video is 10.20s (long by 0.20s)." I removed `targetDuration` and set fixed scene durations instead.
- Lint v3: "'intro-title' is readable for 1.2s but needs about 1.4s (3 words). Lengthen the scene by 0.2s..." This was clear and actionable. I raised the intro to 3.0s.
- **Lint missed an overflow.** In v2, the ticket's content (padding plus head, date row and venue, about 499px) was taller than the fixed 440px stack. The venue block spilled out of the bottom of the ticket (get_layout: t-venue bottom at y=820 vs ticket bottom at 800). I didn't run lint on v2 itself, but nothing in get_layout flagged overflow either. I only caught it from the contact sheet and by comparing the numbers myself.
- `get_reference` returned 57KB, which went over the inline tool-output limit and was saved to a file. I had to extract it before I could read it.
- The reference header still says "Draft for paper-testing with LLMs. Nothing here is implemented yet." That is misleading, because it is implemented.

## 3. Rendered differently than expected

- **Pinned elements don't follow their target's animation** (v2). `notch-top`/`notch-bottom` were scene-level shapes with `pin: { to: "perf", point: "top" }`. In get_layout at 5.8s, the ticket's `current.y` was 364.2 (floating) while the notch stayed at its static y=334. In the frame at 3.25s, while the ticket was still sliding and rotating in, the notch was a dark blob in the middle of the ticket. The reference presents pin as the way to attach badges and stickers, so I expected it to track the target.
- `justify: "space-between"` on the ticket's main column had no visible effect in v2 because the content overflowed. That is fair, but nothing reported the overflow.
- **Pulse ring colour**: the `ring: true` pulse on the gold button draws a faint grey/bone ring (seen at 9.4s). Setting `style.stroke: "gold"` on the button didn't change it. The reference doesn't say how to colour the ring.
- **Notch colour vs background**: a circle filled with the scene's own background token (`night`) was visibly lighter than the background around it once vignette and shadow were applied (frame 6.4s). `#070C18` was visibly darker. I had to tune by eye to `#0A1120`.
- The contact-sheet image (v1) made me think the ticket shifted horizontally between frames. It was just my misreading of the grid offsets, and get_layout confirmed x=90 throughout. Not a bug.

## 4. Workarounds

- Rebuilt the ticket as a `group` containing a full-size horizontal stack plus notch circles anchored with a negative inset. That way the notches are children of the ticket and move, rotate and float with it. I used this instead of `pin`, which didn't follow the animation.
- Built the perforation from 15 tiny circles (a component to avoid copy-paste), because there is no dashed line or stroke-dash style.
- Faked the "cut-out" notches with circles filled with a hand-tuned colour, because there is no masking or clipping.
- Dropped `targetDuration` and used fixed scene durations to control the total length.

## 5. Wishes

- A dashed or dotted stroke style for `line` (`style.dash`), and some kind of mask/cutout (or a built-in `ticket` shape with notches).
- `pin` that tracks the target's animated transform, or at least a lint warning when a pinned element's target animates.
- An overflow warning in lint/get_layout when a fixed-height container's children exceed it.
- A colour param for `pulse` ring (`ringColor`), defaulting to the element's fill.
- A "transparent" or "punch-through" fill that shows the scene background, so you don't have to match vignetted colours by eye.
- Buttons with an optional icon (for example `arrow-right` after "Get tickets").
- The get_video "missing" error should point to `create_video`, not `sini init`.

## 6. Ratings

- **Final video: 4/5.** Clean, on-brand (the gold matches the logo), readable, with a convincing ticket (perforation, notches, stub), a counting date and a clear CTA. It loses a point because the CTA is fairly static for its last ~2.5s (only a subtle grey ring pulse), the intro and outro compositions are similar, and it runs 10.7s rather than exactly 10.
- **Tool experience: 4/5.** The DSL is expressive and the reference is good. Contact sheets, get_layout and lint are genuinely useful, and patches with versioning made iterating cheap (9 versions, a 4s draft render). It loses a point for pin not following animation (the worst issue, which cost a full restructure), the missed overflow warning, the uncolourable pulse ring, and colour-matching by trial and error.
