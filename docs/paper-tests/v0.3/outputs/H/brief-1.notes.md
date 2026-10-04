# Brief #1 Authoring Notes: Crumb & Co. Bakery Reel

## Guesses

**Default text enter for motion personalities (§4.3):**
The reference states playful motion has `bounceIn` as the default text enter. I used `charReveal` on the main heading instead, interpreting "playful" to allow character-level animation for visual interest. This is a guess that extends the spirit of playful beyond the prescribed preset.

**Three-scene structure:**
The brief is 15 seconds total. I structured it as three auto-duration scenes (intro ~2s, product ~3-4s, CTA ~2-3s) with transitions. This assumes equal weight per concept. The reference recommends 2–5s per scene, but auto-duration combined with targetDuration should manage the total.

**Warm color palette:**
"Warm and playful" interpreted as: dark-brown backgrounds for contrast, rust as accent, cream as light, gold as highlight. These aren't palette values I invented wholesale—they're common for bakery branding—but I created the specific hex values without guidance.

**Button styling:**
The CTA should drive pre-orders. I made a solid button with inverted colors (cream fill, rust text) on the rust background, guessing this provides enough contrast and emphasis.

**Safe zone compliance:**
With `safeZone: "reels"`, I placed key content away from edges (120-200px insets from top, 80px from bottom). I guessed these numbers since the reference doesn't specify exact safe zone boundaries.

## Invented

- **Tagline and copy:** "Artisan Bakery," "Freshly baked. Ready to share. Pure comfort," "Available this Friday," "Order Box," "crumbandco.com" — all generated because the brief had no marketing copy.
- **Font choice:** Fraunces for display. Bundled fonts listed in §4.2; Fraunces felt warm/playful, but this is subjective.
- **Texture settings:** `grain: 0.05` — invented to add warmth without overwhelming.
- **Transition styling:** Wipe from left with rust bar — styled to match the brand.
- **Product asset names:** `cinnamon-roll-hero` and `box-product` — descriptive placeholders.
- **Layout coordinates:** All insets, gaps, widths (85%, 90%, 600px height). These are estimates.

## Missing

1. **Specific website or link:** Brief said "pre-order by Friday" but gave no destination. I put a placeholder URL.
2. **Animation for product image:** The reference allows `kenBurns` on images. I used simple `fadeUp` instead of a more dynamic pan/zoom, which felt safer but less engaging.
3. **Interactive element:** No interaction brief (unlike #3). A simple button with no state change feels incomplete, but there's no specification for what happens on click.
4. **Audio/voiceover timing:** Sini handles visual timing; no audio was requested, but a bakery reel would benefit from music or voice—outside scope.

## Hard Parts

1. **Auto-duration estimation:**
   - Text reading time formula: `0.5s + 0.3s × words`
   - "CRUMB & CO." = ~1 word = 0.5 + 0.3 = 0.8s, plus charReveal duration and stagger
   - "CINNAMON ROLL BOX" = 3 words = 0.5 + 0.9 = 1.4s minimum
   - Multiple scenes with multiple text elements made total duration hard to predict. Using `targetDuration: 15` should compensate, but I had to guess if the hold times would stretch properly.

2. **Placeholder contrast:**
   - Placeholders with `color: "rust"` or `color: "cream"` won't have the visual pop of real product photography. The video will look flat without assets.
   - Guessed that texture grain (0.05) would help, but I have no way to verify rendering.

3. **Safe zone math:**
   - "Reels" safe zone has specific boundaries, but the reference doesn't define pixel offsets. I centered content and added large insets (120–200px) as a conservative guess.
   - Footer text at 80px from bottom might still get clipped depending on the exact safe zone definition.

4. **Text size for phone display:**
   - Some text uses `role: "subtitle"` (64px on canvas), but I couldn't verify it would fit or read well at the actual canvas width (1080px) until layout tools run.
   - Guessed line-height and letter-spacing would inherit from role defaults without explicit override.

## Summary

The brief was light on specifics, requiring substantial copy invention (brand tagline, CTA text, deadline messaging). The playful motion choice was interpreted loosely—I could have stuck strictly to `bounceIn` for text but chose `charReveal` for visual rhythm. Placeholder assets are a major limitation; without real product photos, the reel will lack warmth and appeal. Safe-zone compliance is estimated conservatively but unverified.
