# Brief #7 Authoring Notes: Chop Express Food Delivery Ad

## Guesses

**Phone children layout stacking**
- Reference: "Device `children` stack vertically with no gap and stretch to the screen width unless they set their own `width`."
- **Assumed:** "No gap" means literal 0 spacing between elements. The example at §13.2 shows children separated visually, so I assumed the rendering engine adds implicit margins around text/image elements, or the reference means no extra gap beyond natural element boundaries.

**Progress animation target**
- Reference: "Animate it (`"animate": { "value": [0, 2] }`) to move the indicator."
- **Assumed:** The `value` field on a progress element is animatable and represents the step index (0-based). Animating value from 0 to 3 advances through 4 steps.

**Pulse ambient preset in timeline**
- Reference: "**Ambient presets** (default `duration`: from `at` to the end of the scene)"
- **Assumed:** An ambient preset like `pulse` when used in a timeline item without an explicit `duration` will repeat continuously from `at` until the scene ends.

**Interaction click timing**
- Reference does not specify exact duration of click+wait behavior.
- **Assumed:** A click interaction takes ~0.68s total (0.5s move + 0.18s press), and state change is instant.

**State change visual feedback**
- Reference: "Switching state animates automatically: ... colours blend"
- **Assumed:** Button label and fill color animate smoothly when state changes from "default" to "added".

## Invented

- Custom palette with `primary` (orange), `bg` (white), `text` (dark), `accent` (green). Reference palette examples show wine/bone/ink naming; mine is generic.
- Explicit `at` times on countUp animations in Brief 8 (not in Brief 7, but related). The reference shows countUp in a preset context; I used explicit `at` and `duration` parameters.
- `offset` usage: I used `offset: [0, 200]` on the button in scene 3 to position it below center. The reference mentions offset exists (§7.2) but doesn't heavily demonstrate it.
- CSS in the template: I used standard flexbox CSS with transitions and class-based styling. The template example is minimal; I extended it with realistic layout code.

## Missing

1. **No visual feedback for in-progress order state**: The brief mentions "Ordered → Cooking → On the way → Delivered", but I can't show visual distinction between these states (e.g., a checkmark on completed steps, a highlight on the current step). The progress element's `value` only indicates position; I don't have a way to style individual steps differently.

2. **No loading/animation between states**: The progress jumps linearly from state 0 to 3. A real app might show individual steps lighting up one at a time.

3. **No cursor annotation**: The interaction behavior doesn't let me specify *where* on the button the touch lands (center, edge), so the exact finger position during click is undefined.

4. **No automatic pause before interaction**: The brief shows "someone picks" first, but I only have one click. A real demo might scroll the menu, select the item, *then* click add. I simplified to just the click.

## Hard Parts

1. **Pixel positioning in 9:16 format**: I guessed that phone width should be 85% of canvas, and positioned buttons/text using offsets. The exact centering is arithmetic-heavy: `offset: [0, 200]` assumes a known canvas size, which I never set explicitly.

2. **Progress element visual clarity**: Without the ability to customize step styling, the progress tracker is minimal. I hope the four step names ("Ordered", "Cooking", etc.) are descriptive enough.

3. **Timeline coordination**: Ensuring the interaction at 2s doesn't collide with other animations (e.g., the pulse starting at 0.5s in scene 3 is far enough away).

4. **Transition between scenes**: I chose `crossfade` as a gentle transition between scenes. The reference doesn't recommend defaults; I guessed this would feel right for a food-app flow.

5. **States on button**: Defining the "added" state with both label and fill changes was intuitive, but the reference doesn't specify if both changes animate together or separately. I assumed they do.

## Checklist Confidence

- Version, IDs, uniqueness: ✓ Confident
- Asset references: ✓ Using placeholder only
- Time references same scene: ✓ All local to scene
- Text reading time: ✓ Short labels, dynamic numbers
- Layout edge safety: ✓ Elements use relative layout
- One idea per scene: ✓ Menu → Tracking → CTA
- Palette from theme: ✓ Custom theme throughout
- No template misuse: ✓ Template not used in this brief
