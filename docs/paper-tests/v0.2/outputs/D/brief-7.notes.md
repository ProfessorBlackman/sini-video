# Brief 7 — Chop Express (authoring notes)

Plan: 4 scenes, 2.5 + 5 + 4.5 + 3 = 15s. Intro hook → in-app pick + add to cart (phone + interaction + states) → order tracker (progress, value stepped 0→3) → CTA with pulsing "Order now".

## Guesses

- **Card = `stack` with `style.fill` / `radius` / `shadow`** (§7.3 Containers). The reference never says containers draw a background, but §7.1 says "Every element accepts" `style`, so I assumed a stack with `fill` renders a card box. If it doesn't, the dish card has no visible surface.
- **No padding on containers.** Nothing in §7.3 mentions padding, so the card's image/text will touch the card's edges. I accepted that.
- **States on a container** (`p-jollof.states.selected` with `stroke`, `strokeWidth`, `scale`). §9.5 says "Any style property ... can change"; I assumed `scale` counts as a style property (it's listed in §7.1 `style`) and that a stack can carry states.
- **`click` on a container** (`p-jollof`). §9.4 says click "moves to an element"; I assumed any element ID inside the phone is clickable and the cursor targets its centre.
- **Interaction targets inside a phone's `children`** — assumed IDs nested in device children are addressable from the scene timeline (the Novaé example does `click: "edit-card"`, so probably fine).
- **Interaction `from: "bottom-right"`** — assumed this is a canvas anchor where the finger starts.
- **Stepping the progress tracker** with three raw `animate: { "value": N }` items. §7.3 only shows `[0, 2]`. I assumed the "to-value-from-current" form (§9.3) works for `value` and that the indicator snaps/eases to a whole step. Unknown whether intermediate fractional values render something sensible during the 0.4s ease.
- **Progress orientation / size**: assumed horizontal, with step labels shown under dots, and that `width: 912` is honoured. Height unknown, so I couldn't verify the gap to `status` below it.
- **Progress `style.fill` vs `style.color`**: copied the example (`fill` = active colour, `color` = labels); the meaning of each is not explained.
- **`button` `style.size`** to enlarge the CTA label. §7.1 `style` doesn't list `size`; §7.3 text lists `size` under text style. I assumed buttons accept the text overrides too. No way to set button padding/width.
- **`swing` ambient on a text element** with `at: "hungry.enter.end"` — assumed rotation pivots around the element centre.
- **Text states changing `content`** (h-app, status) — §9.5 says `content` can change and "text and labels roll vertically"; assumed a two-line content change rolls cleanly even when line count stays the same.
- **Timeline item IDs as time references** (`"at": "step-1.start"`). §8 says `"a1.start"` works for "a timeline item with id a1"; I assumed raw-animate items can carry `id` (shown in §9.3 `"id": "lift"`), so this is likely fine.
- **Interaction `id`** (`tap-flow`): §9.4 examples don't show an id on behaviors; I added one assuming any timeline item can have one. Not referenced anywhere, harmless if ignored.
- **`circle` transition `origin: "center"`** — table says "anchor or element ID"; assumed `center` is an anchor value here.
- **Radial gradient with a raw hex** (`["tomato", "#B8341F"]`) — assumed mixing tokens and hex in a gradient is allowed.
- **Wipe `bar` uses a palette token** — matches the example.
- **`theme.texture.vignette: 0.15`** — within 0–1, fine.
- **Label role + `content` in mixed case** ("Chop Express") — assumed label role uppercases automatically (table says "Uppercase").
- In the phone, I set `p-title` (caption role) with `letterSpacing: 0.08` and uppercase content manually instead of using `label` — label at 22px felt too small inside a scaled-down phone, but I don't know whether phone children are rendered at canvas scale or "screen" scale. This is a big unknown: is a 40px subtitle inside a 620px-wide phone huge or tiny?

## Invented

- `style.size` on a `button` (not listed for buttons).
- `gap` on a `stack` in `phone.children` — listed for stacks, fine; but `align: "start"` on the card stack was chosen to stop the button stretching; whether that stops images from being full-width I don't know (so I set image `width: "100%"`).
- `id` on a `behavior` timeline item (`tap-flow`) — not shown in §9.4.
- Nothing else knowingly invented: all presets/transitions/types are from the reference.

## Missing

- **A cart toast / badge bump**: no notification/toast element. I used a button whose label rolls from "Cart · 0" to "Cart · 1" instead of a numeric badge.
- **A rider icon / map** for "On the way": no icon set and no SVG assets supplied. Used a placeholder plate image instead.
- **Container padding and per-corner radius** for cards.
- **Pulse ring** behind the CTA: wanted an expanding, fading ring (common CTA idiom). `pulse` only scales the target; I pulsed the button itself.
- **Explicit "cursor exits" / hide the finger** after the last tap — no step for it; assumed it disappears on its own.
- Knowing the phone's inner screen width (bezel size) so I could size the card image sensibly.

## Hard parts

- Vertical stacking in the 9:16 canvas: phone height = 620 × 2.1 = 1302; anchored bottom with inset 90 → top at 1920 − 90 − 1302 = 528. Headline title (104px × 0.95 × 2 lines ≈ 198px) starting at y=150 ends ≈ 348, so ~180px clear. All mental arithmetic; line height in px wasn't stated directly.
- Interaction timing: click ≈ 0.5 + 0.18 = 0.68s each, so from at 1.2: tap jollof ends ≈1.88, wait → 2.18, tap Add ends ≈2.86, wait → 3.26, tap Cart ends ≈3.94. I placed the headline state change at 3.3 by hand because I couldn't reference a step's end time (no `tap-flow.step2.end`-style expression). If `pace` defaults differ, it desyncs.
- Reading-time checks: final status "Delivered. Enjoy!" visible 3.0 → 4.5 = 1.5s ≥ 0.5 + 0.3×2 = 1.1s. "Added. That easy." 3.3 → 5.0 = 1.7s ≥ 1.4s. CTA headline (5 words, needs 2.0s) visible from ≈0.6 → 3.0 = 2.4s. Tight but OK.
- Tracker page: estimated progress element height (~100px?) blind, so the vertical spacing between tracker, status and plate (plate top = 1920 − 170 − 560 = 1190) is guesswork.
