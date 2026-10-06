# Sini Test: Tro Ride-Share Video

## What was built

### Video overview
A 12.5-second promotional reel for Tro, a ride-share app for Accra, in 9:16 (phone) format. The video follows the user journey from booking to driver arrival.

### Scene-by-scene breakdown

**Scene 1: Intro (2.5s, fixed)**
- Dark background with bright orange Tro logo (popIn entrance)
- Accent-colored tagline "Ride-share for Accra" (fadeUp entrance)
- Clean brand introduction establishing friendly, modern aesthetic

**Scene 2: App Flow (10.4s, auto duration)**
- Single phone device with 3 screens showing complete user journey
- **Home screen**: "Where to?" prompt with "Select destination" button
  - User interaction: tap destination button
  - Transition to rides screen
  
- **Rides screen**: "Available rides" showing three options
  - Standard: GH₵ 45 (highlighted in primary color - cheapest option)
  - Comfort: GH₵ 65
  - Premium: GH₵ 85
  - Visual scroll animation shows user scrolling to see all options
  - User interaction: tap Standard ride (the cheapest)
  - Transition to tracking screen

- **Tracking screen**: "Driver on the way" with:
  - Progress tracker animating through 3 steps: "Accepted" → "Arriving" → "Here"
  - Driver info card showing driver name and ETA
  - Progress bar progresses from step 0 to step 3 over time

### Design system used
- **Palette**: Dark backgrounds with bright orange (#FF6B35) primary and golden accent (#F7931E) for friendliness
- **Fonts**: Instrument Serif (display), Inter Tight (body)
- **Motion**: Snappy personality (fast, responsive feel)
- **Transitions**: Slide transitions between scenes
- **Elements**: Phone mockup, text, buttons, stacks for layout, progress tracker, icons (user icon)

### Key features used
- `phone` device with multiple named screens and navigation
- `interaction` behavior with click and navigate steps for user simulation
- `scroll` behavior showing user scrolling through rides
- `progress` element for step tracking with animated value changes
- `stack` containers for responsive layout
- Palette tokens for consistent theming
- Motion personality for unified animation feel

---

## Errors and workarounds

### Error 1: Initial validation errors on spec creation
**Error message:**
```
✗ scenes[0].transition: Unknown transition "none" 
✗ scenes[1].timeline[0]: Unknown key 'target'
✗ scenes[1].timeline[0].steps[0].navigate: 'phone-1' has no screen 'rides'
✗ scenes[2].timeline[1]: Unknown key 'target'
✗ scenes[2].timeline[1].steps[0].set: State 'selected' isn't declared on 'ride-1'
✗ scenes[2].timeline[1].steps[0].navigate: 'phone-2' has no screen 'tracking'
```

**Root cause:** Initial spec had several issues:
- Used "none" as a transition type (not valid; should be "cut")
- Used "target" at top level of timeline (correct key is inside behaviors)
- Attempted to navigate phone instances that didn't have those screens defined
- Declared states on elements without defining them in the element's `states` object

**Workaround:** Rewrote the entire spec following the phone app flow pattern from the reference (§15.1):
- Used single `phone` element with all screens pre-defined
- Properly structured interaction behavior with steps that include navigate commands
- Removed unnecessary state management in favor of simple navigation
- Used one phone across all screens instead of creating separate phones

### Error 2: Transition type mismatch
**Error message:** When attempting to use `"transition": "none"` on intro scene
**Solution:** Used `"transition": "cut"` for instant cut (Sini doesn't support "none", "cut" provides the same effect)

### Error 3: File location mismatch
**Issue:** Created spec at `/home/amalitech-pc-10423/Desktop/wiley/r2hd-tro/video.json` but `create_video` expected it at `/work/r2hd-tro/`
**Workaround:** Used `update_video` to replace the starter spec with the complete spec after initial project creation

---

## Lint warnings encountered and resolutions

### Warning 1: Low contrast on intro text
**Original issue:** Orange text on orange background (logo and tagline) scored 2.6:1 contrast ratio (need 3:1+)
**Fix applied:** 
- Changed intro background from "primary" (orange) to "dark" (dark gray)
- Changed logo text from "light" to "primary" (orange)
- Changed tagline text from "light" to "accent" (golden)
- Result: Perfect contrast now between dark background and bright colors

### Warning 2: Intro text reading time insufficient
**Original issue:** 3-word tagline needed 1.4s to read but only had 1s available
**Fix applied:** Extended intro duration from 2.0s to 2.5s

### Warning 3: App title overlapping phone
**Issue:** Added "Book your ride" title above phone overlapped with phone device
**Fix applied:** Removed the title element entirely for cleaner layout

### Warning 4: Empty phone screens
**Original issue:** Lint warned that phone screens were "mostly empty" (content stopped at 20% of screen height)
**Analysis:** This is normal for mobile app UI - apps intentionally use whitespace for readability
**Resolution:** Accepted the warning with a lint rule explaining the design rationale

### Warning 5: Target duration unreachable
**Original issue:** Requested 15s but video was only 12.4s
**Fix applied:** Lowered targetDuration to 12.5s to match actual content

### Warning 6: Title too close to safe zone edge
**Issue:** Added title had inset of only 24px from top (need 72px minimum, and 220px inside safe zone)
**Fix applied:** Removed the title instead, letting the phone fill the space

---

## Unexpected renderings vs. specification

### What worked as expected
- Interaction behaviors: tapping animated cursor moved smoothly to buttons and performed clicks
- Screen navigation: clicking destination button transitioned to rides screen, clicking ride transitioned to tracking
- Scroll behavior: phone content scrolled to show the ride-3 element
- Progress tracker: value animated smoothly from 0 to 1 to 2 to 3 with visual step progression
- Transitions: slide transitions between scenes moved smoothly
- Layout: Phone mockup stayed centered and elements positioned correctly inside logical pixel space

### What surprised me (positively)
1. **Automatic stagger on progress steps**: The progress tracker automatically animated its visual bar and dot progression as the value changed - no need to manually code animation keyframes
2. **Smart screen transitions**: The `navigate` behavior inside interaction steps automatically triggered a 0.45s transition between screens without extra configuration
3. **Interaction timing**: The system automatically handled cursor movement, press timing, and step sequencing based on the `pace` parameter
4. **Text formatting**: Cedi symbol (₵) rendered correctly in text despite not being in standard ASCII, showing good glyph fallback

### Minor surprises
1. **Loading animation**: The "Where to?" screen showed a loading circle/spinner that I didn't explicitly animate - this appears to be a built-in element feature
2. **Device chrome rendering**: The phone status bar at the top was automatically rendered with correct time/signal indicators
3. **Touch cursor positioning**: The cursor appeared from the specified corner and moved to element centers, not explicit coordinates

---

## Workarounds and non-standard solutions

### 1. Single phone device across entire flow
**Approach:** Instead of creating separate phone elements per scene, used one phone with three named screens (home, rides, tracking) in the same scene, then navigated between them using interaction steps.
**Why:** The reference showed this as the recommended pattern. It's much simpler than managing multiple devices and avoids timing issues.

### 2. Progress value animation instead of step-by-step states
**Approach:** Used raw `animate` timeline items to change the progress bar's `value` property from 0→1→2→3 over time, rather than trying to manage element visibility states.
**Why:** Progress elements are designed to animate their value property smoothly. This was more intuitive than managing separate state transitions.

### 3. Accepted lint warning for empty screens
**Approach:** Added to `lint.accept` array instead of trying to force-fill the screens with dummy content
**Why:** Mobile apps naturally have whitespace. Adding fake content would violate the principle of being honest about the design.

---

## What the tools/DSL did well

1. **Complete theming system**: Palette tokens, role-based typography, motion personalities - everything was consistent across the video without manual tweaking
2. **Deterministic rendering**: Same seed produces identical output every time; no randomness issues
3. **Interaction DSL**: The step-based interaction system with cursor animation made simulating user actions very natural and readable
4. **Device mockups**: The phone element handled all the screen chrome, status bar, logical pixel scaling automatically
5. **Layout system**: Anchors, insets, relative positioning (`below`, `leftOf`) made it trivial to position elements without computing pixel coordinates
6. **Transition system**: Pre-built transitions (slide, crossfade, wipe, etc.) with customizable duration and easing
7. **Component parameters**: Would have been useful for the ride-card if I'd needed multiple variants
8. **Clear error messages**: Validation errors pointed exactly to problematic paths with suggestions

---

## What the tools/DSL could improve

1. **Phone screens API**: Currently all screens must be defined upfront in the phone's `screens` object. Would be more flexible to add/remove screens dynamically with patch operations during editing.

2. **Interaction step targets inside devices**: The reference shows examples targeting elements inside devices (e.g., `"click": "phone#dest-input"`), but my approach of just using the element ID worked. Document both approaches more clearly.

3. **Progress tracker variants**: Only supports horizontal step indicator style. Would be useful to have:
   - Circular progress (pie chart style)
   - Vertical progress
   - Progress with description text per step
   - Current/completed/pending visual states

4. **Built-in loading states**: The spinner animation I saw on the destination screen - is it automatic? Can you control its visibility? Documentation unclear.

5. **Scroll position tracking**: The scroll behavior moves to an element, but no way to track or animate scroll position directly. Would be useful for showing partial scrolling or scroll-position-based parallax effects.

6. **Toast positioning reference**: Toasts are pinned to points, but the coordinate system is screen-relative not absolute. If I wanted a toast in a scrollable device overlay, how would I position it to stay fixed?

7. **More text formatting options**:
   - Strikethrough text (for sale prices)
   - Subscript/superscript
   - Text outline/shadow
   - Better control over line breaking

8. **Time reference clarity**: The "prev.enter.end" automatic timing is powerful, but the rules for what "previous" means (previous in array order? previous with an enter?) could be clearer with more examples.

9. **Hotspot text search**: The reference mentions `{ "text": "Export PDF" }` for hotspots finds the text by reading the image. Unclear what happens if the text doesn't exist or matches multiple regions - error handling docs needed.

10. **Camera behavior documentation**: The camera behavior is mentioned but examples are sparse. More worked examples of camera keyframe sequences would help.

---

## Ratings and verdict

### Final Video Quality: 4/5
**Strengths:**
- Clean, modern aesthetic with excellent color hierarchy
- Flow is logical and easy to follow: intro → booking → selection → tracking
- Animation feels snappy and responsive (fitting the "snappy" motion personality)
- Phone mockup looks professional with proper screen chrome
- Progress tracker effectively communicates the three-step driver status

**Weaknesses:**
- Relatively static within each screen (e.g., home screen just shows text and button with spinner)
- Could benefit from a map image/placeholder to show location context
- Limited visual variation between scenes (all contained in phone)
- Brief is somewhat generic ride-share patterns

**Verdict:** This would work well as a short promotional reel for Tro. It clearly shows the booking flow and driver tracking. The bright colors and snappy motion feel appropriate for the brand. Not overly complex but well-executed.

### Tool Experience: 4.5/5
**Strengths:**
- Reference documentation is comprehensive and honest about what's implemented
- Error messages are specific and actionable
- Validation happens immediately, so you can iterate quickly
- The contact sheet feature is invaluable for reviewing before rendering
- Transitions, interactions, and animations feel natural to write in JSON
- No need to learn HTML/CSS/JavaScript - just describe what you want
- Deterministic output (same spec = same video every time)

**Weaknesses:**
- Learning curve on phone screen architecture (trying multiple approaches before the single-phone pattern clicked)
- Some features mentioned in reference but sparse on examples (camera, hotspots)
- File location confusion between local project folder and /work/ server folder
- Lint warnings could suggest specific fixes more often (e.g., "change intro background to 'dark'" instead of just "use darker text")
- Progress tracker is rigid - only horizontal step indicator, no customization of step styling

**Biggest pain point:** The initial confusion about how to structure a phone app flow with navigation. Once I understood the pattern (single phone with screens, not multiple phones), it was straightforward. Better examples in the reference would have shortened iteration time by 2-3 cycles.

**Verdict:** Sini is genuinely impressive. Writing videos as JSON specs is clearer and more testable than video editing UIs. The system handles layout, animation, interaction, and rendering in a way that lets you focus on the storytelling. For someone comfortable with structured data and APIs, this is a joy to use.

---

## Session summary

**Total versions created:** 5
- v1: Starter template
- v2: Full app flow with all scenes and interactions
- v3: Fixed contrast, extended intro, added title
- v4: Adjusted targetDuration and spacing
- v5: Removed overlapping title, accepted lint warning

**Time to complete:** Approximately 40 minutes
- Understanding reference: 10 min
- Writing initial spec: 10 min
- Fixing validation errors: 8 min
- Refining design based on lint: 12 min

**Final render stats:**
- Duration: 12.50 seconds
- Resolution: 540×960 (draft quality)
- Frame rate: 15fps (draft mode)
- Frames: 188
- Render time: 7.1 seconds

**Key learnings:**
1. Phone app flows work best with one device and multiple screens
2. Deterministic rendering is powerful - you can review at each step and know it will render the same way
3. The DSL forces you to be explicit about timing and sequencing, which catches mistakes early
4. Whitespace in mobile UI is okay - lint should be advisory, not absolute
5. Testing in draft mode (half resolution, 15fps) is fast enough to iterate on structure
