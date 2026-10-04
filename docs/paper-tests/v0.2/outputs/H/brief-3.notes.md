# Brief #3: Pulse Fitness App Demo — Authoring Notes

## Guesses

### Motion personality
**Quote:** "Clean and snappy"  
**Assumed:** Selected `"motion": "snappy"` from the four preset personalities. "Snappy" has a shorter default enter duration (0.45s) and faster stagger (0.04) than editorial, which suits quick transitions between screens and responsive UX interactions.

### Phone structure and state changes
**Quote:** "Show the phone: onboarding screen, user picks a goal ('Build strength'), taps Continue, then the home screen scrolls to today's workout"  
**Assumed:** 
- Used the `phone` type with `children` stacked vertically (reference: "Device `children` stack vertically with no gap and stretch to the screen width")
- Split into two scenes (onboarding and home) rather than one scene with state/visibility changes, because the layouts are completely different (goal selection vs workout display)
- Used button `states` to change the "Build strength" button's appearance when selected (outline → solid, color change)

### Interaction behavior
**Quote:** "user picks a goal ('Build strength'), taps Continue"  
**Assumed:** Used the `interaction` behavior with a two-step sequence:
1. Click the "Build strength" button, which sets its state to "selected"
2. Wait 0.2s for visual feedback
3. Click "Continue" button

Each click takes ~0.5s movement + ~0.18s press ≈ 0.68s per step (from reference: "`click` moves to an element (about 0.5s), presses it (0.18s) and applies `set`").

### Scroll behavior
**Quote:** "the home screen scrolls to today's workout"  
**Assumed:** Used the `scroll` behavior with `"to": "workout-card"` to scroll the phone content into view. The scroll target is an element ID inside the phone's children. Interpreted this as vertical scrolling within the phone's viewport to reveal the workout details.

### Content above the scroll target
**Inferred:** Since the brief says the screen "scrolls to" the workout, there must be content above it that gets scrolled past. Added:
- `home-header`: "Today" title
- `status-text`: "Your personalized workout" caption

This creates vertical content tall enough that scrolling to `workout-card` has visual effect.

### Scene timing
**Estimated:** 
- Onboarding: 7 seconds (interaction at 1.5s finishes ~3s, leaving 4s buffer)
- Home: 8 seconds (scroll at 1.5s, 0.9s duration, leaves 6.1s to read result)
- Total: 15 seconds ✓

## Invented

1. **Color palette.** Created a clean, tech-forward palette (blue primary, light background):
   - `#0066FF` (modern app blue)
   - `#F5F5F5` (clean light background)
   - `#1A1A1A` (dark text)
   - `#999999` (gray for disabled/secondary states)

2. **Transition style.** Used `"type": "slide", "direction": "up"` with 0.4s duration. This is clean and implies forward progress (old screen exits down, new screen enters from bottom).

3. **Goal button styling.** Used `variant: "outline"` for unselected goals and created a `"selected"` state with `variant: "solid"` + color swap. The reference allows state overrides of any style property and `label`, so this is valid.

4. **Inactive goal buttons.** Set secondary goals to `"color": "gray"` and `"stroke": "gray"` to deemphasize them. The "Build strength" button is blue to draw attention.

5. **Spacer element.** Added a transparent rectangle (`"shape": "rect", "opacity": 0, "height": 120`) between the goal buttons and "Continue" button to create visual spacing and ensure content is tall enough within the phone for scrolling to work later.

6. **Scroll target timing.** Placed the scroll behavior at 1.5s into the home scene (0.9s duration), which is early enough to feel responsive but gives the scene time to appear first.

7. **Home screen layout.** Used:
   - `role: "title"` for "Today" (larger, authoritative)
   - `role: "caption"` for the status text (smaller, secondary)
   - `role: "body"` with `weight: 600` for the workout card (bold, prominent)

## Missing

1. **Animated state transition.** The reference says "Switching state animates automatically: text and labels roll vertically, colours blend, numbers roll, sizes ease." I used a state change on the goal button, but didn't explicitly control the animation duration. Assumed the default (0.35s per the reference) is fine.

2. **Scroll visual feedback.** No scrollbar, fade indicator, or "bounce" animation at scroll boundaries is visible. These could make the scroll feel more natural, but the reference doesn't explicitly support them in the interaction model.

3. **Onboarding completion message.** Could have added a checkmark or "Goal selected" confirmation after the interaction, but the brief emphasizes speed ("snappy"), so I skipped extra confirmations.

4. **Workout details richness.** The home screen only shows "Strength Training, 45 min". Could show reps, exercises, difficulty, or an image, but the brief asks only to "scroll to today's workout," which I interpreted minimally.

5. **Additional screens.** Brief mentions only onboarding and home. Could have added a screen showing the workout in progress, completion, or stats, but staying focused on the requested flow.

## Hard Parts

1. **Understanding phone children stacking.** The reference says children "stack vertically with no gap and stretch to the screen width unless they set their own `width`." Needed to interpret what "no gap" means—I assumed it means no automatic spacing, so I set explicit `inset` on each child element. The reference example uses explicit `inset` values, so this seemed correct.

2. **Scroll behavior ambiguity.** The reference shows:
   ```json
   { "behavior": "scroll", "target": "phone", "to": "edit-card", "at": 1.15, "duration": 0.9 }
   ```
   It's unclear whether the scroll happens immediately at `at: 1.15` and completes at `at + duration`, or whether it's animated over the duration. I assumed the latter (1.15s is start, 0.9s duration means it ends at 2.05s), which seems more useful for video pacing.

3. **State change on phone children.** The reference shows states work on buttons and other elements, but the phone is a container. I placed buttons inside the phone's children array and set their states directly. The reference example does this (`"click": "size-m", "set": { "size-m": "selected" }` where `size-m` is inside a `phone`), so it should be valid, but I couldn't find explicit confirmation.

4. **Reading time calculation for multi-line content.** The "Strength Training\n45 min" is 4 words across two lines. Reading time ≈ 0.5 + (0.3 × 4) = 1.7s, but the workout card is revealed by scroll, not a static view. I assumed the scroll animation (0.9s) gives it enough "screen time" before the 8-second scene ends.

5. **Relative layout inside phone.** Phone children don't set their own position—they stack. So I couldn't use "below" or "above" layout; each child auto-stacks. The `inset` property controls padding-like spacing, but there's no direct control over gaps between stacked children. Used transparent spacer elements to create visual gaps, which feels hacky but works.

---

**Readiness:** Valid JSON, should render without errors. The biggest uncertainties are:
- Whether state changes on buttons inside phone children work as expected
- Whether the scroll truly makes sense given the content layout (the `status-text` provides something to scroll past, making the scroll to `workout-card` visual)
- Whether phone children can have explicit gaps, or if transparent spacers are the only option
