# Brief #1: Crumb & Co Bakery Reel — Authoring Notes

## Guesses

### Motion personality
**Quote:** "Warm and playful"  
**Assumed:** Selected `"motion": "playful"` from the four preset personalities (editorial, snappy, calm, playful). "Playful" felt closest to the tone with its `spring` easing and `popIn` default text reveal.

### Timeline structure
**Quote:** "Make a 15-second Instagram reel"  
**Assumed:** Divided into four scenes (3+4+4+4 seconds). This is the minimum viable structure to show:
- Hero statement
- Product imagery
- Time-sensitive details
- Call-to-action with branding

No guidance given on how to chunk time, so I defaulted to ~4s per major beat (2–5 second guidance from the reference).

### Cinnamon roll appearance
**Quote:** "We're launching a cinnamon roll box"  
**Assumed:** Two placeholder assets—one for the baked good itself, one for the packaging. Used `"hint"` to guide future image sourcing.

## Invented

1. **Color palette.** The reference allows custom hex values. I created a warm palette:
   - `#2A1810` (dark brown background)
   - `#FDF4ED` (cream for contrast)
   - `#A85A38` (cinnamon)
   - `#D4A574` (honey gold)
   - `#E8A76D` (bright accent)

2. **Scene backgrounds.** Only the CTA scene uses a gradient; others are solid `"warm-bg"`.

3. **Entrance animations.** Chose presets per element:
   - `wordReveal` for headlines (editorial default, good for headlines)
   - `scaleIn` for product image (playful, matches theme)
   - `fadeUp` for subtitle
   - `charReveal` for the brand name (more dramatic)

4. **Button animation.** Added a `pulse` timeline item on the order button at 1s into the CTA scene. This was inferred from the `pulse` ambient preset (params: `scale`, `every`).

5. **Transition type.** Used a wipe with a 45° angle and `"bar": "honey"` to give it a warm, diagonal sweep. Duration 0.5s is the reference's default.

## Missing

1. **More visual richness.** With actual product photos, could show multiple angles or a lifestyle shot, using `kenBurns` zoom for movement.

2. **Countdown timer or urgency cue.** The deadline ("pre-order by Friday") could be emphasized with a `countUp` animated number or animated timer, but the reference's `countUp` is designed for numeric content, not time formatting.

3. **Scroll or reveal animations.** Could have used `wipeIn` or `slideIn` for more dramatic reveals, but `wordReveal` and `scaleIn` felt appropriate for a playful bakery.

4. **Typography variability.** All text uses theme roles (display, subtitle, body). Could have overridden `size` or `letterSpacing` for more custom typographic hierarchy, but the defaults are good.

## Hard Parts

1. **Pacing a 15-second reel.** Each scene must convey its idea in 3–4 seconds. I erred toward longer holds (4s per scene) to give each element time to enter and settle. A faster reel might use 2–3 second scenes.

2. **Reading time math.** Checked each text block:
   - "Fresh from the oven." = 4 words → 0.5 + (0.3 × 4) = 1.7s needed. Scene is 3s ✓
   - "This weekend" = 2 words → 1.1s needed. Scene is 4s ✓
   - "Pre-order by Friday" = 4 words → 1.7s needed. Scene is 4s ✓
   
   All pass, but the math is tight on shorter text.

3. **Timing relative animations.** The reference supports expressions like `"at": "launch-date.enter.end+0.15"` but I had to pick a numeric offset. Calculated that if `wordReveal` with the editorial default (0.75s duration) starts at 0.3s, it ends at 1.05s, so +0.15s offset = 1.2s into the scene. Used that offset for staggered text.

4. **No image assets.** Had to rely on placeholders with good `hint` text, accepting reduced visual impact.

---

**Readiness:** This spec is valid JSON and should render without errors. The biggest uncertainty is whether `pulse` timing (`at: 1, every: 0.8`) and animation targets in timeline items are correctly interpreted; the reference examples show raw animate but pulse is an ambient preset.
