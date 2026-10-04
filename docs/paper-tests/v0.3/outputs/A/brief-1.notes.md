# Brief 1 — Crumb & Co. cinnamon roll box (authoring notes)

Structure: 4 scenes, all `"duration": "auto"`, `video.targetDuration: 15` to stretch holds. intro (wordmark) → reveal (box + "New!" sticker) → weekend (3 polaroids) → cta (Pre-order by Friday + pulsing button).

## Guesses

- **§10 `circle` transition, `origin`**: "anchor name, or an element in either scene", but no default is given. I set `"origin": "center"` explicitly in the theme transition. I also assumed `circle` is fine as the *theme* transition (every example uses wipe/slide as the signature).
- **§3 `safeZone: "reels"`**: the reference never says what area the reels UI covers. I guessed roughly the top ~250px and bottom ~350px and kept key content between y≈280 and y≈1550. Can't check without `lint`.
- **§7.2 `pin`**: relative placement (`below`, etc.) says the target must be "in the same scene and the same parent"; `pin` doesn't say. I kept `new-badge` at top level next to `box-img` so both are in the same parent, to be safe.
- **§7.2 `pin` + `width`/`height`**: I assumed size keys work together with `pin` ("Size, for all methods").
- **§7.1 `style.rotation` on a component instance**: §7.4 says the instance's `style` applies to the root, so I rotated each polaroid via the instance's `style`. I assumed this merges with the root's own `style` (fill, padding, shadow) rather than replacing it. The reference says "apply to", not "merge".
- **§7.3 `stack` children "ignore their own placement keys but keep size keys"**: I assumed `style.rotation` still applies to stack children (it's style, not placement), so the polaroids are tilted in the row.
- **§9.2 `bounceIn` on non-text elements**: it only says it "splits into words, for text". I assumed on a component instance it drops the whole card in, and that a list target staggers across the three polaroids.
- **§8 `"pols-in.end"`**: I gave the polaroid timeline item an `id` and referenced `.end`. §8 lists `"tap.start"`/`"tap.end"` for timeline items, so I assumed a preset timeline item's `.end` = its last part finishing. I avoided `"pol-1.enter.end"` because it's unclear whether `<id>.enter` exists when the enter comes from a timeline item.
- **§9.2 `scaleIn` `from: 0.6`**: `from` is a scale factor for scaleIn but a side for slideIn. I assumed the number form is right here.
- **§9.2 `drift` params**: drift takes `x`, `y`, `scale` as direct keys. I put them on the timeline item next to `preset`, as the long-form rule says ("Preset parameters go in the same object").
- **§9.2 `swing` on text**: I assumed swing works on a text element (it's not restricted). Pivot defaults to `"top"`. A 4° swing of a two-line wordmark may look odd; can't preview.
- **§4.2 `label` role**: uppercase is automatic, so `"New this weekend"` renders `NEW THIS WEEKEND`. I assumed `align: center` is needed on each text in a centred stack (stack `align` positions the box, not the text lines inside it).
- **§7.3 button `radius`**: the default is 0.3 × height. For a pill I set 60 (height = 2.4 × 44 = 105.6, half ≈ 53). Assumed a radius larger than half the height is clamped into a pill, as §7.1 suggests.
- **§6 auto duration with text inside containers**: "each text block's enter end + reading time". I assumed this also counts text nested inside stacks (all my text is inside stacks).
- **§4.1 radial gradient as scene background**: `{ "radial": ["cream", "dough"] }`. Assumed a plain colour object is accepted directly for `scene.background`, not only inside `overlay`.

## Invented

- Palette token `white` and every palette colour (allowed, but my own choice).
- Copy not in the brief: "New this weekend", "Introducing the Cinnamon Roll Box", "New!", "Made for the weekend.", "A whole box of swirls.", "Pre-order now". All listed in `notes`.
- No keys or presets used outside the reference, as far as I can tell. The closest call: `justify: "center"` on `new-badge` with a fixed `width`/`height`. `justify` is documented for stacks, but it's unclear whether it centres along the main axis when the stack has a fixed height.

## Missing

- **A real circular sticker with centred text**: no `shape` with children and no "badge" element. I used a `stack` with fixed 190×190 size, radius 95 and centred `justify`/`align`. A shape with text inside, or text with a `fill`/pill background, would be more direct.
- **Per-instance offsets inside a stack**: I wanted the middle polaroid slightly lower (scattered look), but stack children ignore placement. Rotation only. A `group` with hand-placed `x`/`y` would work, but means pixel arithmetic.
- **Overlap in a horizontal stack**: there's no negative gap or overlap, so the polaroids sit side by side instead of overlapping like a real pile.
- **Colouring one word** (e.g. "Friday" in cinnamon): only `*italic*` and `**bold**` are supported inline, so I used italic for emphasis.
- **Where to pre-order**: the brief doesn't say, so there's no URL or "link in bio" line. Flagged in notes.

## Hard parts

- **Fitting the polaroid row**: 3 × (250 + 2 × 18 padding) + 2 × 16 gap = 890px, against a usable width of 1080 − 2 × 72 = 936. Rotated cards stick out further. Width was hand-computed.
- **Vertical budget in `reveal`**: title 3 lines × 104 × 0.95 ≈ 296px, starting at inset 280 → ends ≈ 576; + 64 gap + 700 image → ≈ 1340. Line-height maths done by hand, and I don't know whether the italic Fraunces lines are wider or taller.
- **Badge position**: the pin offset `[-40, 40]` puts the badge centre 40px inside the image corner. Half the badge (95px) still sticks out. That's intended, but it's a guess at how it'll look.
- **Pacing against targetDuration 15**: rough hand estimate of the auto durations (≈3.3 + 3.6 + 3.2 + 3.5 ≈ 13.6s), so Sini should stretch the holds by about 1.4s in total. I can't tell whether that distributes evenly or lands on one scene. Transition time (0.6s × 3) "doesn't count as reading time", which might push scenes longer than I estimated.
- **Default enter timing inside stacks**: in `cta` I relied on "each following enter starts at prev.enter.end − 0.2" for children of a stack. I'm not sure the declaration order of nested children is what "prev" walks.
