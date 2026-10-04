# Brief 4 — DevConf Accra (1:1, 12s) — authoring notes

Structure: `intro` (2.5s, "DevConf Accra") → `speakers` (5.5s, 2×2 grid + focusCycle) → `tickets` (4.0s, date + "Get tickets"). Total 12.0s, fixed durations.

## Guesses

- **Grid cell width.** §7.3 grid: "Children fill cells left to right ... Row height = tallest child in the row." It doesn't say whether children stretch to the column width. I assumed cards fill the column ((936 − 24) / 2 = 456px) so all four are the same width; if they're auto-sized, "Kwame Mensah" and "Efua Boateng" cards would be wider than "Yaw Asante".
- **`below` a container.** I placed the grid `below` the `sp-header` stack (both top-level). Assumed relative placement works with containers as the reference.
- **Timeline item `.end` for a preset item.** §8 says `"tap.end"` works for "a timeline item ... with id". I used `"cards-in.end+0.15"` on a list-target preset item and assumed `.end` = last target's enter end (duration + stagger × 3).
- **`focusCycle` timing & return.** End is `at + interval × count`, then "everything returns to normal over 0.3s". I assumed that 0.3s happens after `.end` and must fit inside the scene, so I sized the scene to `≈1.39 + 3.8 + 0.3 = 5.5`.
- **`focusCycle` on component instances.** Example uses instance IDs (`"ama"`), so I did the same; assumed `dim` lowers the opacity of the non-focused instances to 0.3.
- **Enter preset on a component instance (`flag-bar`) inside a stack**, with `wipeIn`. Assumed it animates the whole root as one unit.
- **Component with no params** — `"params": {}`. Not shown in the reference; assumed allowed.
- **`typewriter` on the `mono` role** with `cps` — assumed `cps` is passed in the long-form object like other preset params.
- **`charReveal` with `\n`** — assumed the newline isn't counted as a character part.
- **`drawOutline` on a `circle` shape** — §9.2 lists "shape" as supported; assumed a circle with stroke and transparent fill draws its circumference.
- **`drift` with `scale`** — assumed the element starts at its natural scale and reaches 1.04 by scene end.
- **`offset` on an anchored element pushing it partly off-canvas** (decorative ring). Assumed lint treats decorative bleed as fine; it may flag "element off-canvas".
- **`align: "start"` on a vertical stack** for left-aligned intro text; stack default `align` isn't documented.
- **Vignette 0.2** — the range is 0–1 but no guidance on what looks subtle.

## Invented

- No keys/types/presets outside the reference that I'm aware of. Borderline:
  - `"params": {}` (empty params object).
  - Using the `fill: "night/0"` transparent fill to get an outline-only circle — fill/stroke both exist, but "no fill" isn't an explicit value; I used a 0-opacity token.
- Copy: "> announcing", "Meet the speakers.", "DevConf Accra · Speakers", "Save the date", and "Speaker" under each name (listed in `notes`).

## Missing

- **Per-speaker talk titles / roles** — brief doesn't give them, so every card says "Speaker". That makes the label redundant; I kept it for card balance.
- **Focus styling beyond dim + scale** — I'd have liked the focused card's border to turn gold. `focusCycle` only takes `dim` and `scale`; doing it by hand with 4 × 2 state changes timed to `at + i × interval` was possible but error-prone, so I skipped it.
- **Year and ticket URL** — not given; omitted rather than invented.
- **Ghana-flag stripe motif reused** — I made it a component (`flag-bar`) since it appears twice; there's no simpler "decoration" primitive.

## Hard parts

- **Vertical fit of the 2×2 grid in 1080px.** Had to estimate card height by hand: padding 28×2 + photo 150 + gap 16 + body line 40×1.3=52 + gap 16 + label 22×1.2≈26 ≈ 326px; two rows + 24 gap ≈ 676; header at y=96 ≈ 105px tall + 40 gap → grid spans ≈ y 241 → 917, leaving ~163px at the bottom. Without `layout` I can't confirm it stays ≥72px from the edge.
- **Scene length arithmetic.** `cards-in` end = 0.55 + 0.45 + 0.08×3 = 1.24; focusCycle 1.39 → 5.19 (+0.3 return) → 5.5s scene. The fixed 12s total meant rebalancing intro/tickets by hand.
- **Reading time for the intro.** charReveal over 12 characters: 0.4 + 0.03×11 ≈ 0.73 → ends ≈1.28; "DevConf Accra" (2 words) needs 1.1s → 2.38 < 2.5. Very tight; any change to stagger breaks lint.
- **Transition overlap vs reading time.** "Time under an incoming transition doesn't count as reading time" — the speakers title enters at 0.3 under a 0.5s wipe, so I had to reason about whether its reading clock starts at 0.5 instead. I assumed it's fine given 5.5s.
- **Width of "14–15" at 150px in Space Grotesk** and whether `display` names fit — guessed.
