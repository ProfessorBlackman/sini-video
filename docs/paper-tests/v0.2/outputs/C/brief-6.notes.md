# Brief 6 — authoring notes (East Legon apartment listing, 15s 4:5)

Structure: 5 scenes, 3.0 + 2.5 + 2.5 + 4.0 + 3.0 = 15.0s.
1. Living room hero with "3-Bedroom Apartment", a "For rent" tag and the location.
2. Kitchen photo with "Fully fitted kitchen."
3. Bedroom photo with "Three spacious bedrooms."
4. Cream "price card": three photo thumbnails, the price counting up to GH₵ 4,500/month, and feature chips.
5. CTA over a darkened living-room photo: "Make it home." plus a pulsing "Book a viewing" button.

## Guesses

- **`countUp` on `"4,500"`.** §7.3 says "Numeric `content` (e.g. `"0"`) can be … animated with `countUp`". I couldn't tell whether a thousands separator still counts as numeric, or whether the separator stays in place while it counts. I kept `"4,500"` because "4500" looks wrong for a price, and I assumed the engine parses and keeps the formatting. If it doesn't, this is a validation error.
- **`countUp` as a timeline preset instead of `enter`.** I put it in the timeline with an `id` (`"count"`) so I could use `"count.end"`. I assumed a text element with no `enter` but a timeline enter preset starts hidden, or at `from` (0), until `at`. §7.1 says "An element with no `enter` is visible from scene start", which suggests the thumbnails, chips, `price-cur` and `price-month` would sit there visibly and then "fade in" again at their timeline `at`. **This is the biggest ambiguity.** Should timeline enter presets be moved to each element's `enter`? For the stack/grid children I couldn't use `stagger` that way, so I used the timeline.
- **Enter presets on children of `grid` and `stack`**, targeted by ID from the timeline. I assumed children are addressable like any other element, and that `fadeUp`'s `y` offset doesn't break the stack layout (§7.2: "`x`, `y` in animations are offsets from the laid-out position").
- **Forward references in time and layout.** `intro-loc` is declared before `intro-title` but its `at` references `intro-title.enter.end`, while `intro-title` is laid out `above` `intro-loc`. I assumed declaration order doesn't matter for references. I chose the order so the anchored element (the location) is defined first, then realised the text order runs the other way.
- **`above` with `align` omitted.** I assumed `start` means the left edges line up, as for `below`.
- **Stack `align: "end"` on a horizontal stack.** I assumed this aligns the bottoms of the boxes. I wanted the text baselines aligned (GH₵ / 4,500 / /month), which isn't the same thing (§7.3 has no baseline option). Different line heights (0.92 vs 1.05 vs 1.3) will make the bottoms misalign visually.
- **Overlay accepts a gradient with three stops and `angle: 180` meaning top-to-bottom.** This follows the §13.2 pattern. I assumed `"ink/0"` is fully transparent.
- **`kenBurns` `pan` units.** I assumed pixels, `[dx, dy]` over the whole duration.
- **`scaleIn` `from`.** §9.2 lists `from (0.8)`, and I assumed that's a scale factor.
- **`pulse` start time.** I assumed `at: "cta-btn.enter.end+0.1"` with the default `duration` (until scene end), and that `every` is the period in seconds.
- **`slide` transition `direction` values.** §10 lists `direction` with no allowed values. I assumed `"up"` (from `slideIn`'s `from` values).
- **`circle` `origin: "center"`.** §10 says "anchor or element ID", and I assumed the anchor names from §7.2.
- **Button sizing.** Buttons are `"auto"` width (§7.2), but the button font role, padding and height aren't documented. I assumed roughly label/caption size with comfortable padding, so the three chips (about 40 characters in all) fit in 936px. They might overflow.
- **`fit: "cover"` on images inside a grid with `aspect`.** I assumed `aspect` sets the cell height from the column width.
- **Raw `animate` on `scale` while a `pulse`-free element also has `countUp`.** I assumed the scale bump (`[1, 1.05, 1]`) and countUp don't conflict.
- **Unicode `₵` and `·` in DM Serif Display and Manrope.** I assumed the bundled fonts have these glyphs. ₵ (U+20B5) is not guaranteed in many fonts.

## Invented

- **Content facts.** The brief gives "3-bedroom", "East Legon", the price and three rooms. "Fully fitted kitchen", "spacious", "Open-plan living" and "Accra" are my copywriting assumptions and need client confirmation. I deliberately didn't invent bathrooms, parking or a phone number.
- **DSL-wise, I believe nothing here is outside the reference.** Two borderline uses:
  - `barWidth` on the theme transition. It's listed in §10 for `wipe`, so it should be fine.
  - `id` on a preset timeline item (`"count"`). §8 shows `"a1.start"` for "a timeline item with `id`", and the example uses an id on a raw `animate` item. I assumed preset items can have ids too.
- Palette token names (`brass`, `sage`, `stone`) are my own, which the reference allows.

## Missing

- **A contact line or phone number for "Book a viewing".** The brief didn't give one, and there's no "placeholder text" concept like the placeholder asset. I used a summary caption instead and didn't invent a number.
- **Currency and number formatting for `countUp`** (prefix, suffix, thousands separator). I had to split "GH₵", the number and "/month" into three text elements in a stack, and hope the stack aligns them nicely.
- **Baseline alignment** in horizontal stacks. Covered under Guesses.
- **Blurred photo backgrounds.** `style.blur` exists for elements, but scene `background` takes only `asset`/`fit`/`overlay`. I wanted a blurred living-room photo behind the CTA. Instead I used a heavy `ink/0.72` overlay. Alternative: a full-bleed `image` element with `style.blur`.
- **Rounded-corner image frames with a border.** Only `radius` is used, which seems fine.
- **An icon per feature chip** (bed, kitchen). There's no icon set, and I didn't want to use the `template` escape hatch. I used text-only chips.

## Hard parts

- **Vertical layout of the price scene (1080×1350).** I had to estimate the grid height by hand: (936 − 2×16)/3 ≈ 301px wide, × 16/9 ≈ 536px tall, so the grid spans y = 96 to about 632. The bottom block, built from `bottom-left` upward with `above`, is roughly chips 70 + gap 44 + price 138 + gap 18 + label 26 ≈ 296px, so it spans about y = 958 to 1254. That leaves a ~325px empty band in the middle. I couldn't verify any of these without rendering. The button height and the `display` line box were pure guesses.
- **Placing the kicker/title pairs on photo scenes.** I anchored the label at `bottom-left` with inset 228 and put the title `below` it. 228 is picked by hand so that label (~26) + gap (20) + subtitle (~67) leaves about 115px of bottom margin. A "bottom-anchored stack of two texts" would avoid this arithmetic.
- **Reading time vs 15s.** The price scene has about 10 words (price, label, 3 chips), which needs about 3.5s of full visibility. The chips only finish at about count.end (1.8s) + 0.2 ≈ 2.0s into a 4.0s scene, so they get about 2.0s plus the outgoing overlap. That's below the rule of thumb, and I accepted it because the chips repeat information already shown in scenes 2–3.
- **Transition mix.** Wipe (theme), slide-push and circle are three different transitions in 15s. I'm not sure that's "coherent". I chose them to mark the change from photos to the price card to the CTA.
