# Brief 7: Chop Express Food Delivery — Authoring Notes

## Guesses

**Phone dimensions and layout** (§7.3)
- Reference specifies logical screen is 390×844, but provides no guidance on canvas-pixel width for phone mockup. Guessed 540px canvas width, which scales the logical screen appropriately.
- Phone padding/gap values (24/16, gap 20) invented to match typical mobile UI spacing.

**Colour scheme** (§4.1)
- Brief says "food delivery" but does not specify brand colours. Chose warm orange (#FF6B35) as primary and dark background (#0F0F0F) as typical for food delivery apps. This is inference from context, not from brief.

**Button state and interaction** (§9.5, §9.4)
- Brief says "adds to cart" but does not specify visual feedback. Invented an "added" state that changes label to "Added ✓" and swaps fill/text colours. The state animation (label roll + colour blend) is automatic per §9.5.
- Interaction includes a click on the item card (to select it) followed by a click on the button. This is interpretation of "picks jollof rice… adds to cart."

**Scene durations and timing**
- Divided 15 seconds across three scenes: 5 + 5.5 + auto. Used `targetDuration: 15` so Sini adjusts the final scene's hold to hit target. Without this, video would be ~12 seconds.
- Interaction `at: 1.2` gives phone time to slide in and settle before touch interaction begins.

## Invented

- **Brand name styling**: Header renders as "CHOP EXPRESS" in uppercase (using `uppercase: true` implicit via role, or letterSpacing adjustment). Not specified in brief.
- **Price and dish description**: "GH₵ 15" and "Jollof Rice" label are my invention; brief only says "picks jollof rice."
- **Button label change**: "Added ✓" state label invented. Brief does not specify what the button should say after click.
- **Interaction cursor**: Chose `cursor: "touch"` and `from: "bottom-center"` as reasonable defaults for mobile ad context. Brief does not specify.
- **Pace of interaction**: Used `pace: "normal"` (0.5s move, 0.18s press, 12 chars/s typing). No guidance in brief.
- **Pulse amplitude and timing**: `scale: 1.1, every: 0.8`. Brief only says "pulsing" without parameters; chose subtle, fast pulse.

## Missing

- **Item selection visual feedback**: When user clicks the item card, I have no way to highlight/select it visually (the interaction just moves to the card). Ideally the card would show a "selected" state, but I chose not to invent one.
- **Cart confirmation animation**: Brief does not describe how the cart should animate or whether a confirmation toast/modal appears. The state change on the button is the only feedback.
- **Delivery time estimate**: Progress tracker shows four steps but does not show time per step or total delivery time. Brief silent on this.

## Hard Parts

**1. Time reference chaining** (§8)
- Progress animation runs from `at: 1.0` for `duration: 4.0`, ending at 5.0s into the scene. Must ensure this fits within the 5.5s scene duration. Verified by arithmetic.
- Interaction has multiple steps with computed end time. The `tap.end` reference point can be used in later scenes, but I kept this scene self-contained.

**2. Animating discrete state values** (§9.3)
- The progress `value` is an integer index (0, 1, 2, 3). Animating it with `[0, 3]` over 4 seconds will interpolate smoothly. The DSL description says "Animate it (`"animate": { "value": 3 }`) and the line fills step by step," which suggests discrete steps, but easing with `cubic.inOut` will make it fluid. Chose smooth animation as more engaging.

**3. Phone interior paths** (§7.4)
- When referencing elements inside the phone in interactions, use path syntax `phone/add-btn`. This required careful reading of the component/device scoping rules (§7.4: "From outside, refer to them as `<instance-id>/<local-id>`").

**4. Container stagger vs. explicit timing** (§7, §4.3)
- The phone's children have `enter: "none"` so they don't get the theme's default text enter. This is correct, but required explicitly setting each. Easy to forget and end up with unwanted animations.

## What the reference doesn't address

- Whether buttons inside a phone device should follow in-device button sizing rules (§7.3) or canvas sizing. I assumed in-device (logical pixels), but this is implicit.
- Exact bezel appearance of phone mockup; the reference mentions "`outer height ≈ width × 2.1`" but doesn't describe frame styling or rounded corners.
