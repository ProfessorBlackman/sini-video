# Sini Video Test: Tro Ride-Share App Reel

## Overview
Built a 15-second promotional video for Tro, a ride-share app in Accra, Ghana, using Sini 0.4. The video demonstrates the core user flow: selecting a destination, browsing ride options, selecting the cheapest option, and tracking the driver.

---

## What Was Built (Scene by Scene)

### Scene 1: Intro (5.1 seconds)
- **Background**: Bright orange (#FF6B35) - warm, friendly, energetic
- **Elements**: 
  - Large "Tro" title in dark ink for high contrast
  - "Get around Accra" subtitle, also in dark ink
  - Both text elements positioned within safe zone (reels: 220px from top)
- **Features Used**: Text elements with custom layout anchoring
- **Timing**: Auto-duration adjusted to 5.1s to fit 15s target

### Scene 2: App Demo (9.9 seconds)  
**Transition**: Crossfade (0.5s) from orange to light background
- **Phone mockup**: 720px wide, positioned center
- **Three screens** with interactions:

#### Screen 1: Destination Selection (frames 5.63-6.88s)
- "Where to?" heading
- Outline button showing "Osu, Accra" (example Accra location)
- User taps button → navigates to rides screen

#### Screen 2: Ride Selection (frames 8.13-9.38s)
- "Choose a ride" heading
- Three ride options displayed as components:
  - Comfort: GH₵ 46, 2 min
  - XL: GH₵ 62, 3 min  
  - Pool: GH₵ 19, 4 min (cheapest)
- Pool option highlighted in orange when selected
- Green "• CHEAPEST" label below Pool option (size increased to 13px in-device)
- Orange "Confirm" button (solid variant)
- Interaction: User clicks Pool, label shows selected state, then confirms

#### Screen 3: Driver Tracking (frames 10.63-14.38s)
- "Driver on the way" heading
- Progress tracker: 3 steps ("Assigned" → "Heading over" → "Arriving soon")
  - Animates from step 0 to step 2 over 2.0 seconds
  - Uses orange fill color matching the theme
- Driver info stack showing:
  - Orange circular avatar (accent color)
  - Driver name "Kwame"

**Features Used**:
- Phone device with multiple screens
- Component reuse: ride-option component instantiated 3 times with different parameters
- State management: ride-3 component switches to "selected" state on click
- Interaction behavior: multi-step interaction with click, wait, navigate, and set actions
- Progress element with animated value change
- Animations: state changes, progress value animation

---

## Tool Errors, Warnings & Resolutions

### Error 1: Invalid Spec Structure (Version 1)
**Issue**: Initial spec had several schema violations:
- Unknown key `form` on shape element (should be `shape`)
- Unknown key `scroll` in interaction steps
- Shape sizing issues (width/height in style instead of layout)
- Button styling issues

**Resolution**: Reviewed reference §7 and §9 thoroughly to understand correct element types and interaction behavior. Restructured shape, button, and interaction definitions.

### Lint Warning 1: Safe Zone Violation (Version 1)
**Warning**: "header sits under the reels interface (top edge)"
- Header positioned at 120px from top, but reels safe zone requires 220px minimum

**Resolution**: Updated header inset from [120, 0] to [240, 0] and tagline from [280, 0] to [380, 0]

### Lint Warning 2: Low Text Contrast (Versions 1-3)
**Warning**: "header/tagline has contrast 2.7:1-2.8:1 (minimum 3:1)"
- White text (#FFFFFF) on orange (#FF6B35) = insufficient contrast

**Resolution**: Changed text color from white to dark ink (#1A1A1A). Dark text on orange provides much higher contrast and passes lint.

### Lint Warning 3: Text Too Small to Read (Versions 1-5)
**Warning**: "cheapest-tag drawn at 18.7px on canvas, too small to read"
- Label role in-device font (11px) scaled to 18.7px on canvas

**Issue**: First size increase attempt (version 2) patched wrong element due to array indexing confusion.
- Patched ride-3 (component instance) instead of cheapest-tag (text element)
- ride-3 is at screens.rides[3], cheapest-tag at screens.rides[4]

**Resolution** (Version 5): Removed erroneous size from ride-3, added style.size: 13 to correct element. Lint clean after this fix.

---

## Rendering Observations

### What Rendered as Expected
1. **Intro sequence**: Bright orange background with readable dark text creates the desired "bright and friendly" feel ✓
2. **Phone device**: Properly renders with frame mockup, status bar, and logical pixel scaling ✓
3. **Component reuse**: ride-option component instantiated cleanly 3 times with different parameters ✓
4. **State management**: Pool ride option highlights in orange when selected ✓
5. **Interactions**: Touch cursor appears from bottom-right, follows target elements, disappears smoothly ✓
6. **Screen transitions**: Navigation between phone screens uses smooth push transition ✓
7. **Progress tracker**: Animates smoothly from step 0 to step 2 with visual progress ✓

### Unexpected Behaviors / Surprises
1. **Text node locations in phone screens**: Elements inside phone screens reference using top-level IDs (not deeply nested paths) for interactions, which is cleaner than expected
2. **Component path references**: Inside-component elements use "/" notation (e.g., "ride-3/name") which works consistently
3. **Screen parameter defaults**: Phones inherit padding and gap from device definition but can override per-screen with object notation
4. **Auto-duration targeting**: The targetDuration parameter intelligently distributes time across "auto" scenes; natural 10.4s became 15s final duration

---

## Workarounds & Why

1. **Cheapest label positioning**: Instead of pinning to ride-3 with an offset, used simple "below" layout with gap. More readable in the spec.

2. **Avatar styling**: Couldn't use width/height in style for shape; used layout properties instead. This is correct but unintuitive since other elements accept size-related style properties.

3. **Component vs. manual stacking**: Used a ride-option component for the three ride cards to avoid repeating the structure. Component parameter substitution ({{name}}, {{price}}, {{time}}) is clean and powerful.

4. **Colors in palette**: Added unused "mist-text" token early (version 2) when trying to fix contrast, but switched to using "ink" token instead. The palette token is cleaner than hex values.

---

## Wishes for Sini Tools/DSL

1. **Better error messages for array/object paths in patches**: When I patched screens.rides[3] thinking it was an element, got no warning that the index was off. A suggestion like "Did you mean index 4?" would help.

2. **Interactive visualization for phone screens**: Hard to visualize screen layout until rendering. A "describe screen" tool showing element positions within the phone's logical pixels would speed iteration.

3. **Shorthand for state transitions**: Setting up selected/unselected states for multiple options required manually defining states on each component instance. A preset like "selectable: true" would be nice.

4. **Component override clarity**: Instance-level style merging with root style is undocumented in examples. Took trial-and-error to understand which properties merge vs. replace.

5. **Better safe-zone feedback**: Lint warns about safe zone violations, but doesn't show exact measurement or suggest a corrected inset value.

6. **Reference section depth**: Had to call get_reference three times (essential, §7, §9) to understand the full API. A single complete reference or better in-tool guidance would help.

---

## Ratings

### Final Video Quality: 4/5
**Reasons for score:**
- ✓ Meets the brief completely (destination pick → ride selection → driver tracking flow)
- ✓ Bright and friendly color scheme (orange + light background + dark text)
- ✓ Realistic app UX (actual prices in Ghanaian cedi, Accra location, driver name)
- ✓ Smooth interactions and transitions
- ✓ Professional phone mockup rendering
- ⚠ Could use more visual variety (all screens are white with identical layout)
- ⚠ Driver tracker progress could benefit from ETA or distance visualization

**Strengths**: Clean layout, readable text, intuitive flow, good use of color to highlight the cheapest option
**Limitations**: Minimal animation beyond state changes and progress bar; no icons or imagery beyond shapes

### Tool Experience: 4/5
**Reasons for score:**
- ✓ Well-structured DSL that maps closely to visual design
- ✓ Reference documentation is thorough and indexed
- ✓ Validation catches schema errors immediately
- ✓ Contact sheet rendering lets you preview frames cheaply before full render
- ✓ Lint catches real design problems (contrast, readability, safe zones)
- ⚠ Learning curve on component internals and path references
- ⚠ Patch path indexing requires careful counting
- ⚠ Some error messages are unclear (e.g., "style.size too small" doesn't explain why it's too small)
- ⚠ No interactive editor; all changes require CLI round-trips

**Strengths**: Deterministic rendering, immediate validation, contact sheets for iteration, components for DRY, sensible defaults
**Worst problem**: Array indexing in patches is error-prone and doesn't provide helpful guidance when off-by-one

---

## Final Spec Summary
- **Versions**: 5 (create → fixes for safe zone, contrast, text size, element targeting)
- **Scenes**: 2
- **Elements**: 28 (including component instances)
- **Duration**: 15 seconds (matches targetDuration)
- **Lint status**: ✓ Clean
- **Render status**: ✓ Draft MP4 completed in 8.0s

---

## How the Tools Were Used

1. **get_reference** (essential, §7, §9): Built mental model of DSL
2. **create_video**: Initialized project with full spec
3. **validate_video**: Caught schema errors before rendering
4. **lint_video**: Identified contrast, safe zone, and readability issues
5. **render_contact_sheet**: Checked composition before full render (×2)
6. **render_frame**: High-res closeup of key moment (ride selection screen)
7. **get_layout**: Verified element positioning and sizing
8. **describe_at**: Mapped human feedback ("at frame X") to element IDs
9. **update_video**: Applied 4 successive patch sets to fix issues
10. **get_video**: Verified patch results
11. **render_video**: Generated final draft MP4

---

## Deliverables
- `/work/r2h-tro/video.json` - Final video spec (v5)
- `/work/r2h-tro/out/sheet.png` - Contact sheet (12 frames)
- `/work/r2h-tro/out/frame-8.50.png` - High-res frame of ride selection
- `/work/r2h-tro/out/draft.mp4` - Final video (540×960 @ 15fps, 15s)
