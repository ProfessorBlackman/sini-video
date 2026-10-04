# Brief 1 — Crumb & Co. cinnamon roll box (9:16, 15s)

Structure: hook (2s) → box (3s) → inside (3.5s) → friday (3.5s) → cta (3s) = 15s.

## Guesses

- **§10 `slide` transition, `direction`** — values are not listed. I assumed `"left"` means "new scene moves towards the left" (enters from the right). It could just as well mean "comes from the left".
- **§7.2 negative `inset`** (`[-160, -160]` on blob-a) — the reference never says negative insets are allowed. I copied the idea from the phone example (`"inset": [-120, 0]`) and assumed it pushes the element past the edge.
- **§7.2 `inset` with `anchor: "left"`** — "Ignored on centred axes". I assumed `anchor: "left"` centres vertically, so `[0, 84]` means "84px from the left, vertical inset ignored". Then I used `offset` to move it up.
- **§7.2 `above`** — `hook-brand` is placed `above` `hook-title`, but it's declared after it. I assumed declaration order doesn't matter for layout references.
- **§7.3 group children inherit enter** — `sticker` (a group) has `popIn`. I assumed its children appear and scale with it, and aren't visible "from scene start" on their own.
- **§7.1 `style.rotation` on a group** — assumed it rotates the whole group, including children.
- **§9.2 `bounceIn` on multi-line text with `stagger`** — not clear if `bounceIn` splits text into words or lines, or just bounces the whole block. I added `stagger: 0.1` hoping it splits by word.
- **§9.2 `swing`** — the pivot point isn't stated (top? centre?). I assumed centre. On `fri-day` I hoped for a playful wobble, but it could look like a pendulum hanging from the top.
- **§9.2 `kenBurns` on an image with `radius`** — assumed the zoom stays clipped inside the rounded frame and doesn't grow the frame itself.
- **§9.3 timeline `slideIn` on items that have no `enter`** — `item-1..3` have no `enter`, so per §7.1 they are "visible from scene start". I assumed a timeline enter preset hides them until its `at`. If it doesn't, they'll be visible and then jump off-canvas to slide in. This is a real risk.
- **§9.2 `wipeIn` `from: "down"`** — assumed "the clip edge starts at the bottom and moves up".
- **§4.2 `label` role** with `size` override — assumed uppercase still applies, so "Crumb & Co." renders as "CRUMB & CO." and "Pre-order by" as "PRE-ORDER BY". I was fine with that.
- **§7.3 text `style.weight`** — the type of value isn't given (600 vs "semibold"). I used the number 600.
- **§7.3 `button` sizing/typography** — no size, padding or font role is documented for buttons. I assumed a reasonable default size. I also assumed `style.radius: 999` gives a fully round pill.
- **§4.1 `radial` gradient** — direction and centre are not documented. I assumed the first colour is the centre and the second the edge.
- **`video.background` as a palette token** (`"cream"`) — §3 shows `"ink"` in the example, so I assumed tokens resolve there even though `video` comes before `theme`.
- **Reading time with transitions** — the reading-time rule says "fully visible". I'm not sure if the time when the next scene's slide transition is covering the outgoing scene counts.
- **`*Friday.*` italic** — assumed `*…*` italic works with the display font Fraunces (Fraunces has italics; I didn't check whether Sini bundles the italic style).
- **`"•"` and `"✓"` glyphs** — assumed the bundled fonts have them.

## Invented

- Nothing outside the documented key names, as far as I can tell. Borderline cases:
  - `slide.direction: "left"` — the key is documented, the value isn't.
  - `style.italic: true` on `sticker-text` — `italic` is listed as a text style override, but the value type (bool) is my guess.
  - `vignette: 0.15` — documented range 0–1, fine.
  - `pan: [0, -20]` on kenBurns — documented as `[dx, dy]`; units (px?) are guessed.

## Missing

- **No way to underline or circle one word** (for example, a hand-drawn circle around "plans?"). Shapes can't reference a word's position inside a text block. I used italics instead.
- **No "sticker"/badge element** (circle + text). I built it from a group with a circle and a text.
- **No real date.** The brief says "by Friday" with no date, and there's no calendar element anyway, so I used only the word "Friday."
- **No sound/music** — a playful reel would normally have music. The reference doesn't mention audio at all.
- **No safe-zone guidance for Instagram UI** (the bottom ~300px is covered by captions/buttons on Reels). §14 only says 72px from the edges. I kept key content above ~1450px by eye.
- **No emoji/icon element** for the list bullets (a small roll or heart icon would be nicer). I used "•".

## Hard parts

- **Reading time vs scene length.** I had to recompute `0.5 + 0.3 × words` and the enter end times for every text block, then shuffle scene durations so they still add up to exactly 15s. I don't know the real duration of `bounceIn` / `charReveal` with stagger (is the stagger added to the 0.6s duration?), so all the "visible for X seconds" checks are estimates. I cut the hook's kicker line and shortened the pickup line ("Pick up Sat or Sun.") just to make the numbers work.
- **Vertical positions.** To place `inside-title` under an 880px-tall image I used `inset [960, 84]` instead of `below: "roll-img"`. `below` with `align: start` would have aligned it to the image's left edge (x = 0), and there's no "below, but with a horizontal inset" option except `offset`. Then I estimated the text heights (lines × size × lineHeight) to check nothing hits the bottom of the frame.
- **Size of display text on one line.** "Weekend" at 190px in Fraunces: I guessed it fits in 936px but couldn't verify. `fit: "shrink"` exists, but only with `maxLines`, and I didn't want it to shrink the second line separately.
- **Sticker overlap with the box image.** The sticker's top-right inset [200, 90] was chosen so it overlaps the image's top-right corner. That needed mental arithmetic: image x = (1080-760)/2 = 160 to 920, y = 260 to 1020. A "pin to the corner of element X" placement would remove the guessing.
