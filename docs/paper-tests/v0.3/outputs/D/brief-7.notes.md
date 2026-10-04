# Brief 7 — Chop Express (authoring notes)

## Guesses

- **Interaction `navigate` step transition.** §9.4 says the step option is `navigate: { device-id: screen }` and the standalone `navigate` has `transition` (`push | fade | none`). It doesn't say which transition a step-level navigate uses, or how to set one. I assumed `push` and added a `wait: 0.5` after the step so the 0.45s screen change finishes before the next click.
- **Clicking a target on a screen that isn't shown yet.** `place-order` lives on the `cart` screen, which only appears after the `open-cart` step. I assumed the cursor can target it once the screen has switched. The reference doesn't say whether elements on hidden screens can be referenced, or when their position is resolved.
- **Ambient presets and `"duration": "auto"`.** §6 says auto = latest of reading times and "the end of every behavior and timeline item". An ambient (`float`, `kenBurns`, `pulse`) runs "to the end of the scene" (§8), which makes this circular. I assumed ambients don't extend an auto scene. To be safe I gave the CTA scene a fixed `3.0` so the pulsing button has a known hold.
- **Do interaction cursor fades count toward auto duration?** §9.4 says the cursor "fades out 0.3s after the last" step, but "the interaction's end is the end of its last step". I assumed the fade-out doesn't count and may be cut off by the 0.4s hold.
- **`targetDuration` with fixed scenes.** I assumed `targetDuration` only adjusts the `auto` scenes (§3 says "hold time of auto scenes") and the fixed 3.0s CTA is left as is.
- **Timeline raw-animation ids in time expressions.** I used `"step-1.start"` / `"step-1.end"` on raw `animate` items. §8 says `"tap.start"` works for "a timeline item ... with `id`". I assumed raw animations have an end of `at + duration`. §9.4 only defines end times for behaviors.
- **Animating `value` on `progress`.** §7.3 shows `"animate": { "value": 3 }` and says "the line fills step by step". I wasn't sure whether one 0→3 animation pauses at each step, so I used three separate `value` animations (to 1, 2 and 3) timed with the status-text state changes.
- **Progress size on canvas.** §7.3 says progress height is "about 2.5 × the caption size", which is about 65px on canvas. There's no size control, so I assumed it stretches to its stack's width (912 minus padding) and that its labels use caption size. It may look small on a 1080-wide reel.
- **Stack `align: "stretch"` for nested stacks.** I assumed `jollof-row` (horizontal, `justify: space-between`) fills the card width when the parent card has `align: "stretch"`. Otherwise `add-btn` would sit right next to the dish name.
- **Phone page children stretch.** §7.3 says page children "stretch to the screen width". I assumed this means the `place-order` button becomes full width. That's what I wanted, but it isn't certain for buttons, which are auto-sized.
- **Invisible stroke for the `selected` state.** I set `stroke: "pepper/0"` with `strokeWidth: 3` on the default card so the state can blend the colour to `pepper`. I assumed a fully transparent stroke draws nothing and doesn't take up layout space.
- **`style.size` on a button inside a phone.** `cart-btn` uses `size: 14`. I assumed this is in logical px (in-device default is 16).
- **`hook-img` rotation plus `popIn`.** I combined a raw `rotation` animation with a `popIn` enter. §9.3 says offsets including rotation add up, and "for every other property, the animation that started most recently wins". Scale comes only from popIn, so it should be fine, but that's a guess.
- **`circle` transition `origin: "center"`.** I assumed an anchor name refers to the canvas.
- **`wipeIn` on an image with `radius`.** I assumed the clip respects the rounded corners.

## Invented

- Nothing outside the reference in keys, presets or types, as far as I can tell. Close calls:
  - `"strokeWidth"` inside a `states` style. States "can change any `style` property", so this should be allowed.
  - State names `one`, `selected`, `added`, `placed`, `on-the-way`. Free-form names are allowed, but I gave them kebab-case to be safe. The reference doesn't say whether state names must be kebab-case.
  - `"radius": 100` on the CTA button to make a pill. §7.1 says "half the height or more makes a pill". Button height = 2.4 × 52 ≈ 125, so 100 is more than half (62.5). That's fine.
- Copy and content: all listed in `notes` (headlines, two extra dishes, card descriptions).

## Missing

- **No icon element.** I wanted a cart or bag icon with a count badge. I used an outline button whose label rolls from "Cart 0" to "Cart 1".
- **No way to express "rider moves along the tracker".** I wanted a scooter icon riding the progress line. There's no way to pin an element to a progress step, and `pin` only takes element anchors or hotspots. I used a separate placeholder image of a rider with `kenBurns` instead.
- **No control over progress dot and label sizes**, beyond the reference's statement that height ≈ 2.5 × caption.
- **No way to set the transition of an interaction `navigate` step** (see Guesses).
- **No price.** I left it out rather than invent one.
- **Food emoji.** The glyph coverage list doesn't include emoji, so I avoided them.

## Hard parts

- **Phone vertical fit.** The phone's outer height is "≈ width × 2.1", but there's no stated bezel size, so I couldn't map logical px to canvas px exactly. I estimated a screen scale of about 1.33 and hand-summed the logical heights of the page children (status bar 54, header, label, featured card about 250 including a 170px image, and so on). The goal was to keep `add-btn` well above the Reels bottom UI zone. I had already dropped a bleed layout (`inset: [-120, 0]`) because my estimate put the button near y≈1900. The reference doesn't define the size of the Reels safe zone, so I guessed it's roughly the bottom 20%.
- **Hitting 15s.** I hand-estimated every auto scene: reading time 0.5 + 0.3 × words, snappy enter 0.45, click step 0.5 + 0.18 = 0.68s × 4 plus waits. The total came to about 16.8s, so I cut copy ("Jollof in one tap." has 4 words) and waits to get to about 15.2s. That relies on `targetDuration` trimming the 0.4s holds. Fragile.
- **Text width.** "Hungry?" at 190px and "Chop / Express" at 170px: I guessed glyph widths of about 0.55em for Bricolage Grotesque to make sure they fit inside 936px. I couldn't verify without `layout`.
- **Timing the tracker.** Chaining `step-N.end+0.25` with matching state changes was manageable. Without ids on raw animations it would have needed hard-coded seconds.
