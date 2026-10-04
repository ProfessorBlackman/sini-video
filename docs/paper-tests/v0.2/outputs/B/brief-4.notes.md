# Brief 4 — DevConf Accra (12s, 1:1) — authoring notes

Structure: `intro` 2.5s → `speakers` 5.5s (2×2 grid, `focusCycle`) → `details` 4s (date + pulsing "Get tickets") = 12s.

## Guesses

- **Theme `motion` object form.** §4.3 shows `{ "base": "editorial", "duration": 0.6 }`. I assumed this overrides the enter duration while keeping the other editorial defaults.
- **`theme.roles` override** (`title.size: 96`): it ended up unused, since I used `subtitle` for the heading. It's harmless, but I wasn't sure whether partial role objects merge.
- **Role sizes on 1:1.** §4.2: "Sizes assume a 1080px-wide canvas". Square is 1080 wide, so I assumed no scaling. But the canvas is only 1080 tall, so display at 150 for 2 lines (≈276px) uses a quarter of the height.
- **`focusCycle` timing and end state.** §9.4 gives `interval` but not what happens after the last item: does everything un-dim, or does the last one stay highlighted? I assumed everything returns to normal at the end. Total = 4 × 0.95 = 3.8s.
- **`focusCycle` `scale` inside a grid.** I assumed scaling a grid child doesn't reflow its neighbours and the card can overlap them.
- **`"cards-in.end"`** for a preset timeline item with an `id` and a `stagger`. I assumed `.end` means the end of the last staggered child (0.35 + 3×0.08 + 0.55 = 1.14).
- **`scaleIn` `from: 0.9`.** Documented as a scale param, but the long form plus `from` on a timeline item is my extrapolation from the `slideIn` example.
- **Circle-cropped photos.** I used `style.radius: 90` on a 180px image to get a circle. The `circle` shape is only for shapes, and there's no image mask.
- **`below` + `align: "center"` inside a group** for centring the name under the photo, and `anchor: "top"` with `inset [40, 0]` inside a group (relative to the group's box per §7.3).
- **`typewriter` `cps`** in the long form. Assumed fine.
- **`wipeIn` on a `line` shape** with `from: "left"` (the example only shows the short form).
- **Grid cell height.** The grid only has `columns`, `gap` and `rowGap`. I assumed each cell's height comes from the child's `height: 360`.
- **`label` role** is uppercase automatically, so "Speaker" and "Accra, Ghana" will render in caps. I relied on this.
- **The wipe transition's `bar`** uses a palette token (`gold`). Assumed allowed ("colour or null").

## Invented

- "Accra, Ghana" and "Speaker" labels: the brief doesn't give speaker titles, so I used a generic "Speaker" for each. "> announcing" is invented copy.
- The palette colours (Ghanaian flag-ish red/gold/green on night blue) are my own choice. All keys used are in the reference, as far as I can tell.
- No year: the brief gives none and I didn't invent one.

## Missing

- **A repeated "card" component.** I wrote the same 4-element group four times with only the name, asset and IDs changed (and IDs must be globally unique, so every child ID needed a prefix). This was very verbose and easy to typo. I wanted a template/repeat or component mechanism.
- **Circular image masks.** Faked with `radius`.
- **No ticket URL/venue** in the brief, so the CTA is just a button. A link line would normally go under it.
- **No way to centre a multi-element block vertically as a unit.** I anchored the top element to the centre with a negative `offset` and chained the rest with `below`, then hand-tuned the offset so the whole block looks centred. A `stack` anchored at the centre might have done it, but then `enter` timing on stack children was unclear to me.

## Hard parts

- **Fitting the square:** heading at 72 + 67 (subtitle 64 × 1.05) + 40 gap + grid (2 × 360 + 24 = 744) → bottom at 923, leaving 157px. All of this was hand-computed.
- **Grid width:** 1080 − 2 × 72 = 936, so cells are (936 − 24) / 2 = 456 wide. I had to check that "Kwame Mensah" at 44px fits in 456px, which was a pure guess at glyph widths.
- **Centring offsets in the intro and details scenes** (−230 and −260): I estimated block heights from size × lineHeight × lines and halved them. This is error-prone, since I don't know whether `anchor: center` centres the element's box or its baseline.
- **Pacing focusCycle against the scene length:** it starts ≈1.34s and ends ≈5.14s, inside a 5.5s scene. That leaves only ~0.36s plus the transition overlap before the cut, so the last speaker gets slightly less emphasis.
