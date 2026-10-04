# Brief 6 — authoring notes (East Legon apartment listing, 15s, 4:5)

Structure: 4 scenes, fixed durations 3.6 / 3.4 / 4.4 / 3.6 = 15.0s.
1. `hero`: living room full-bleed with kenBurns, "For rent" pill, "3-bedroom apartment." + "East Legon".
2. `gallery`: kitchen (top) and bedroom (bottom) panels wipe in from opposite sides, each with its own kenBurns and a name tag (component `room-panel`).
3. `details`: cream card-like scene, price counts up "GH₵ 4,500" + "/month", brass rule, feature list (component `feature-row`), staggered.
4. `cta`: blurred living-room background, price recap, pulsing "Book a viewing" button.

## Guesses

- **Fixed vs `auto` durations.** Same problem as brief 5: I couldn't trust `targetDuration` to land on 15s (§3 says it adjusts the "hold time" of `auto` scenes, and it's unclear how much it can shrink), so I hand-set durations and hand-checked reading time.
- **Is a `button` label a "text block" for reading time?** (§6 says "each text block"). I assumed it might be, and left 1.4s after the button's enter.
- **Does text inside a component count** for reading time and `prev.enter.end`? Assumed yes.
- **Group size for a component root.** §7.3 says a `group`'s size is `auto` = fits the children, but the child image is `100%` of the group, which is circular. I assumed the instance's `layout.width/height` (applied to the root per §7.4) settles it.
- **`kenBurns` on an image inside a component, via `"kitchen-panel/photo"`**: §9.3 allows component paths as targets; assumed ambient presets work there and stay clipped (§7.3 `image`: "animations such as kenBurns stay clipped inside the frame").
- **Hiding the tag until its timeline `fadeUp`.** §7.1: "An element with an enter preset (on its `enter` key **or** in the timeline) is hidden until that preset starts." I assumed this also applies to a component-internal element targeted from the scene timeline.
- **`wipeIn` on a component instance** while kenBurns runs on its child, with both starting at the same time: assumed they compose.
- **`anchor: "left"` with `inset: [0, 84]`**: §7.2 says inset is "ignored on centred axes", so the vertical 0 is ignored and I get vertical centring + 84px left. Assumed `[vertical, horizontal]` order.
- **Stack child with `layout.height: 669` while the stack has `align: "stretch"`**: assumed stretch only affects the cross axis (width), so the height key wins.
- **`align: "baseline"`** in the horizontal price row: §7.3 mentions it for horizontal stacks, but the `stack` table only lists `start | center | end | stretch`. Used it anyway since it's documented in the note.
- **`countUp` on "GH₵ 4,500"**: assumed it keeps "GH₵ " and the thousands separator while counting (§7.3 says so), and that the text box width during counting doesn't push "/month" around (or that Sini reserves the final width). Not stated.
- **`pulse` with `ring: true` and `scale`**: unclear whether `scale` still scales the button when `ring` is on ("an outline ring expands and fades behind the element instead"). Assumed `scale` sets the ring's max size or is ignored.
- **`radius: 48` for a pill button**: button height default is 2.4 × size = 96, so half = 48. Derived by hand.
- **Overlay as a plain colour** (`"overlay": "ink/0.65"`): the examples only use gradients; §6 says `<colour>`, so assumed a token-with-opacity is fine.
- **Slide transition with `push: true` from `down`**: assumed "push" pushes the old scene out the top.
- **Word count for reading time** with "·" separators and "GH₵": assumed "·" counts as a word (worst case).

## Invented

- Nothing outside the reference's keys/presets, as far as I can tell. Borderline:
  - `align: "baseline"` on a stack (only mentioned in a bullet, not in the type table).
  - `layout.height` on a child of a vertical stack with `align: "stretch"`.
  - Copy I wrote that isn't in the brief: "For rent", "Monthly rent · East Legon", "Living room", "Kitchen", "Bedroom" (from the photo filenames), "3-bedroom apartment." Listed in `notes`.

## Missing

- **Key features.** The brief says "key features" but only gives "3-bedroom" and the location. I didn't invent amenities (rule 9); the features list is thin (3 bedrooms / Living room / Kitchen). Flagged in notes.
- **Contact details for "Book a viewing"** (phone/WhatsApp/URL) — not given; flagged.
- **Splitting the screen into two equal halves with a gap** needs a pixel height: there's no "fill remaining space"/flex option for stack children, so I computed (1350 − 12) / 2 = 669 by hand.
- **Tag positioning without a component-level param for timing**: I couldn't pass a per-instance `at` into the component, so tag reveals live in the scene timeline instead of in the component.
- **A price "unit" style** (smaller "/month" beside the big number in one text element) — no per-span size, so it's a two-element horizontal stack with baseline align.
- **Map pin / location icon** next to "East Legon" — no icon set; used plain text.

## Hard parts

- **Gallery maths:** 4:5 canvas = 1080×1350; two panels + 12px gap → 669px each. If I got the canvas height wrong the stack overflows.
- **Price row width:** "GH₵ 4,500" at 150px display + "/month" at 64px might exceed the 912px stack width. I couldn't measure text, so I dropped the price to 130px by eye (rough estimate ~640px + 16 + ~190px). Could still overflow, or look too small.
- **Hero title vertical position:** anchored bottom-left inset 200; estimated title height as 2 lines × 104 × 0.95 ≈ 198, then "East Legon" below it with gap 24, to keep the bottom ≥ 72px from the edge. All guessed.
- **Reading-time checks per scene** — each one needed: enter start + duration + stagger × (parts − 1), then + 0.5 + 0.3 × words, avoiding the transition window. E.g. details scene: features fadeUp at 2.0, 3 targets, 0.6 + 0.15 × 2 → ends 2.9, + 1.1 reading = 4.0 ≤ 4.4. CTA kicker: 0.55 + 0.6 + 2.3 (5 "words" incl. "·") = 3.45 ≤ 3.6 — very tight; if lint counts words differently, it fails.
- **Total = 15.0s** only because I fixed every scene's duration by hand.
