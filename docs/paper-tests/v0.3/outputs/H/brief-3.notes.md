# Brief #3 Authoring Notes: Pulse Fitness App Demo

## Guesses

**Default text enter suppression:**
The reference states (§4.3) that top-level `text` elements in a scene get the theme's default text enter (popIn for snappy motion). However, elements inside containers, devices, and components do not. I set `"enter": "none"` on all text elements inside the phone's screens because they are logically part of the device and should appear with the screen transition, not animate independently. This interpretation follows the spirit of the rule but isn't explicitly confirmed for elements in `screens`.

**Snappy motion interpretation:**
"Clean and snappy" maps to the `snappy` motion personality (back.out easing, 0.45s duration, popIn text enter per §4.3). I applied this globally. The interaction cursor pace set to `normal` (0.5s move, 0.18s press, 12 chars/s typing per §9.4) felt like a reasonable middle ground, though "snappy" could imply `fast` pace instead.

**Phone dimensions:**
The reference specifies logical screen size as 390×844 for a phone. I placed the phone at 380×740 canvas pixels to fit within safe zones and leave space around it. No guidance was given for scaling between logical and canvas pixels; I estimated that Sini would handle the scale internally.

**State change animation:**
The strength-btn has two states: default and selected. The reference (§9.5) says state changes animate automatically (colors blend, numbers roll, sizes ease), but doesn't specify the default duration or easing. I left it unspecified, assuming the engine applies a sensible default (~0.35s per §9.5).

**Interaction step timing:**
The interaction behavior's end time is critical for sequencing. The reference (§9.4) provides timing formulas:
- Move: 0.5s (normal pace)
- Press: 0.18s (normal pace)
- A click step total: 0.5 + 0.18 = 0.68s per step
- Two steps (tap-strength, wait 0.3s, tap-continue) ≈ 0.68 + 0.3 + 0.68 ≈ 1.66s total
- Cursor fades in 0.2s before first step, out 0.3s after last step

I set `navigate-home` to start at `"tap-continue.end+0.15"` and `scroll-to-workout` at `"navigate-home.end+0.4"`. These are educated guesses about pacing; without running the tools, I can't verify exact timings.

**Home screen scroll target:**
The reference (§9.4) says `scroll` behavior can target "logical px, an element ID inside the target, 'top' or 'bottom'." I used the element ID `workout-card`, and the reference says "An element is scrolled until its top sits 24 logical px below the top of the visible area." This felt reasonable but required interpreting the semantics of scrolling within a phone's logical pixel space.

## Invented

- **Goal options:** Only "Build Strength" was named in the brief. I added "Improve Cardio" as a plausible alternative for a fitness app.
- **Workout details:** "Strength Training," "45 min • 8 exercises," "Start Now" button — all created to fulfill the "scrolls to today's workout" instruction without specific content.
- **Home screen header:** "TODAY'S WORKOUT" label — invented to label the section.
- **Checkmark indicator:** The selected button shows `"✓ Build Strength"` — a common UX pattern but not explicitly requested.
- **Color palette:** Navy (#0A1428), accent red (#FF6B6B), light gray (#F8F9FA), mute (#6C757D), white. These felt "clean" for a fitness app but are entirely invented.
- **Font choice:** Space Grotesk for display — selected from the bundled list (§4.2) as "snappy" in personality, but it's subjective.
- **Button variants:** Used `solid` for primary actions and `outline` for secondary; this follows UX conventions but wasn't specified.
- **Group container:** Wrapped the workout card details in a `group` element with styling — makes the layout composable but adds complexity not strictly needed.

## Missing

1. **Interactive feedback details:** No specification of what happens after "Start Now" is tapped, or whether additional interactions are needed.
2. **Workout exercises list:** The brief mentions "today's workout" but doesn't ask for a detailed list; I showed only a summary card.
3. **Status bar styling:** The phone has `statusBar: true`, which renders a 54-pixel logical px status bar by default (§7.3), but the brief gave no guidance on its appearance.
4. **Cursor appearance:** The interaction specifies `"cursor": "touch"` (a finger pointer), which is standard for mobile, but the visual styling (color, size) is engine-determined.
5. **Screen transition type:** I used `"transition": "push"` for the navigate behavior (new screen slides from right, old pushed out left per §10). The brief didn't specify; `fade` or `none` would also work.

## Hard Parts

1. **Interaction timing arithmetic:**
   - Each click step takes move (0.5s) + press (0.18s) = 0.68s for normal pace.
   - Two click steps plus a 0.3s wait = 0.68 + 0.3 + 0.68 = 1.66s minimum for the interaction.
   - Plus cursor fade-in (0.2s before) and fade-out (0.3s after) means the interaction window spans ~2.16s total.
   - I had to estimate when it was safe to start the `navigate` behavior without visual overlap.
   - Using `"tap-continue.end+0.15"` for navigate and `"navigate-home.end+0.4"` for scroll are guesses designed to avoid visual jarring but can't be verified without layout tools.

2. **Logical pixel coordinate system inside phone:**
   - The phone's logical screen is 390×844.
   - I placed children with layouts like `inset: [60, 24]` and `width: 280`, all in logical pixels.
   - The phone itself is rendered at 380 canvas pixels wide on a 1080px canvas.
   - The scaling factor isn't explicit; I assumed Sini handles it transparently, but layout calculations inside the phone's coordinate system required care.

3. **State change with element inside container:**
   - The strength-btn is inside a screen inside the phone. I referenced it as `"strength-btn"` in the `set` action, assuming it's resolvable from the scene's timeline.
   - If the reference requires a full path like `"phone/strength-btn"` or `"phone.screens.onboarding[1]"`, my spec is wrong.
   - The example in §13.2 references screen-internal elements without a prefix (e.g., `"edit-card"`), so I followed that pattern.

4. **Auto-duration with interaction and behaviors:**
   - The scene uses `"duration": "auto"`, which computes duration as the latest of: text reading time + 0.4s hold, or end of every timeline item.
   - The last timeline item (scroll-to-workout) ends at `"navigate-home.end+0.4"` + 0.8s (scroll duration) ≈ very dependent on earlier timing.
   - With `targetDuration: 15`, Sini stretches or shrinks the hold time of auto scenes. I have no way to verify if my sequence will fit in 15s or what adjustments the engine will make.

5. **Button styling and states:**
   - The strength-btn uses `style` at the element level and overrides within `states`. The reference shows this working for `fill`, `color`, and `label`.
   - I assumed these nested style keys override the base style; the reference is clear on this but implementation details (e.g., how nested padding or radius is merged) are left to the engine.

## Summary

This brief required modeling an interactive mobile app flow with two screens, state changes, and sequential behaviors (interaction → navigate → scroll). The biggest challenges were:
- Estimating interaction step durations to time downstream behaviors
- Understanding element referencing within phone screens
- Mapping "clean and snappy" to concrete design choices (fonts, colors, pacing)
- Reconciling logical pixel (phone screen) and canvas pixel coordinate systems

The spec relies heavily on guesses about timing sequences and the engine's automatic state animation behavior. Without access to validation and layout tools, errors in behavior sequencing or state application are likely.
