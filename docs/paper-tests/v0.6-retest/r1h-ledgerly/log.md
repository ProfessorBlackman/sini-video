# Sini Test Report: Ledgerly Feature Demo

## What Was Built (Final Version: 5)

### Scene-by-Scene Breakdown

**Scene 1: Dashboard Intro** (0.67s)
- Browser element displaying `assets/dashboard.png` asset with dark Chrome frame
- "Meet Ledgerly" display text with fadeUp entrance, positioned 200px from top (safe zone adjustment)
- Establishes the app context and brand

**Scene 2: PDF Export Highlight** (3.35s - 8.72s)
- Group container with camera behavior to control zoom
- Browser showing dashboard zoomed to Export PDF button area
- Camera zoom: from full view to hotspot focus over 2.8 seconds (slow zoom as per feedback)
- Interaction behavior: cursor click on Export PDF button
- Toast notification on success: "PDF Exported / invoices.pdf ready" with dark background (#1f2937) and white text for contrast compliance
- Demonstrates core feature: PDF export functionality

**Scene 3: Highlight Stat Cards** (8.72s - 14.09s)
- Browser showing full dashboard
- Three shape overlays (blue stroked rectangles) positioned on stat cards:
  - Outstanding (pinned to hotspot coordinate [193, 254])
  - Paid this month (pinned to hotspot coordinate [482, 254])
  - Overdue (pinned to hotspot coordinate [770, 254])
- FocusCycle behavior: highlights each card for 1 second in sequence, dimming others to 0.3 opacity, with 1.08x scale
- Shows key metrics at a glance

**Scene 4: Call-to-Action** (14.09s - 15.43s)
- Clean dark background with white text
- "Try Ledgerly Free" as display text with fadeUp entrance
- "ledgerly.app" as body text below, in accent color blue, also fadeUp
- Drives conversion with clear URL

### Features Used

- **Browser element** with screenshot content and Chrome styling
- **Camera behavior** for zoom/pan control with keyframe interpolation
- **Interaction behavior** with cursor tracking and click simulation
- **FocusCycle behavior** for sequential highlighting with dimming
- **Group container** for managing camera target
- **Toast notification** for success confirmation
- **Hotspot pinning** with both text matching and pixel coordinates
- **Layout system**: anchor points, pinning, relative positioning
- **Animation presets**: fadeUp entrance animations
- **Timeline-based animations** with precise timing expressions
- **Shapes** for visual overlays (highlighting rectangles)

## Tool Errors, Warnings, and Surprises

### Errors Encountered

1. **Interaction "target" key error (Version 1)**
   - Error: `scenes[1].timeline[1]: Unknown key 'target'`
   - Cause: Used `"target": "app"` in interaction behavior definition
   - Resolution: Removed the target key; interactions don't have a root "target" - targets are specified per step
   - Lesson: The reference shows interaction structure clearly but initial confusion with scroll behavior which does have "target"

### Lint Warnings and Resolutions

1. **Hotspot text not found (Version 1-2)**
   - Warning: `Text hotspot 'export' ("Export PDF") wasn't found in the image`
   - Root cause: Either the exact text in screenshot differs from "Export PDF", or text matching is case/whitespace sensitive
   - Resolution: Switched to pixel coordinates [1390, 60, 120, 48] for all hotspots
   - Note: Dashboard asset didn't include a fallback, so validation didn't catch missing asset

2. **Title in safe zone (Version 1-2)**
   - Warning: `'title' sits under the reels interface (top edge). Keep text...inside the safe area: 220px from the top`
   - Resolution: Changed `layout.inset` from `[80, 0]` to `[200, 0]`
   - Design outcome: Better visual hierarchy with title properly spaced

3. **Toast extending off-canvas (Version 1-2)**
   - Warning: `'export-toast' extends past the canvas (751.3,1073 404.7×152.3 on 1920×1080)`
   - Root cause: Toast pinned to zoomed element position; the pin target's coordinates were transformed by camera zoom
   - Resolution: Changed layout from "pin to hotspot inside zoomed group" to "pin to zoomed element's center with offset"
   - Adjustment: `"pin": {"to": "app#export", "point": "center"}, "offset": [100, -50]`

4. **Toast contrast ratio (Version 1-4)**
   - Warning: `'export-toast' has a contrast of 3.8:1 against its background (minimum 4.5:1)`
   - First attempt: Changed text color to white (#ffffff) - insufficient because background was still too light
   - Second attempt: Changed background to darker shade (#1f2937) - resolved to 5.0+:1 contrast
   - Final state: Dark gray background with white text, accessible and visually distinct

### Surprises and Discoveries

1. **Camera behavior with pinned elements**
   - Pinned elements (like the toast) follow their target through camera transformations
   - This is powerful but caused the toast to move off-screen when camera zoomed; needed offset adjustment

2. **Hotspot coordinate system**
   - Hotspots use image pixel coordinates (not canvas pixels)
   - The dashboard.png appears to be 1440×900 based on the provided dimensions
   - Switching from text matching to pixel coordinates was reliable and predictable

3. **Scene duration auto-calculation**
   - Scenes with `"duration": "auto"` calculated to 16.10s total
   - The hold time is intelligent: it extends the scene based on animation end times
   - Very convenient for iterating without manual timing calculations

4. **Toast positioning complexity**
   - Toasts are sized relative to their content (title + body text)
   - When pinning to a zoomed element, the reference point moves with the camera
   - Text content changes (icon, title, body) animate smoothly between states

## Rendering Observations

### What Rendered vs. Expected

**Expected:** Smooth, professional-looking demo with clear feature highlights
**Rendered:** Exactly that, plus:
- Zoom motion was very smooth and cinematic
- Stat card highlights with focusCycle created natural emphasis pattern
- Toast notification appeared at correct time with good visual feedback
- Text animations (fadeUp) were subtle and professional
- Safe zone warnings prevented content from being cut off on mobile platforms

### Layout Precision

- The pixel coordinate hotspots worked well once identified
- Text sizing and spacing in the canvas vs. device context handled correctly
- The browser chrome (URL bar) rendered clearly in both full and zoomed views

## Workarounds Used and Why

### Workaround 1: Pixel Coordinates for Hotspots
Instead of relying on text-matching hotspots:
```json
// Before (didn't work):
"hotspots": {"export": {"text": "Export PDF"}}

// After (worked):
"hotspots": {"export": [1390, 60, 120, 48]}
```
**Why:** Text matching failed to locate the button. Using pixel coordinates was reliable because we could position the zoom/click precisely on the visual location.

### Workaround 2: Offset Pin Instead of Direct Hotspot Pin
Instead of pinning toast to a zoomed hotspot:
```json
// Initial approach had issues with camera zoom transformation
// Final approach:
"layout": {"pin": {"to": "app#export", "point": "center"}, "offset": [100, -50]}
```
**Why:** Ensured toast stayed in frame and near the button without being affected by camera bounds calculations.

### Workaround 3: Dark Toast Background for Contrast
Instead of adjusting text color alone:
```json
// Insufficient:
{"fill": "#10b981", "color": "#ffffff"}  // 3.8:1 contrast

// Solution:
{"fill": "#1f2937", "color": "#ffffff"}  // 5.0+:1 contrast
```
**Why:** Darker background maintained the "success" visual association while improving readability.

## Wishes and Improvement Ideas for the DSL/Tools

### DSL Features I Wished Existed

1. **Asset preview/inspection tool**
   - Would help identify exact text and coordinates in screenshots
   - Could show a rendered preview of the asset with grid overlay
   - Suggestion: `get_asset_preview(project, asset_id, with_grid: true)`

2. **Hotspot debugging output**
   - When text matching fails, return what text was actually found in the image
   - Could show alternative text suggestions
   - Would have saved trial-and-error with hotspot coordinates

3. **Element bounding box visualization**
   - A render with visible bounding boxes for all elements at a given time
   - Would help verify layout without studying `get_layout` JSON
   - Useful for debugging pin/focus positioning

4. **Camera keyframe builder**
   - Interactive UI to select focus point and zoom level
   - Could generate the exact coordinate values needed
   - Would be faster than estimating or trial-and-error

5. **Lint detail improvements**
   - When lint warns about element positioning, show what the actual box dimensions are
   - Provide actionable suggestions with before/after values
   - Example: `'title' at [495, 80] width=929 extends into safe zone [0-220]. Adjust inset to [220, 0] or more.`

6. **Component param substitution preview**
   - For complex components with many {{param}} references
   - Could show a preview with values substituted

### Tool/Workflow Improvements

1. **Faster iteration cycle**
   - The validate/lint/render loop was good but rendering even in draft takes 7-8 seconds
   - For small changes (e.g., timing tweaks), could have a "preview" mode that skips encoding

2. **Sync with design changes**
   - If a screenshot asset changes, some references might break
   - Could have a "check asset compatibility" that validates hotspot coordinates still make sense

3. **Interactive timeline editor**
   - Rather than editing JSON timing expressions
   - Could see a visual timeline with animations as bars
   - Drag to adjust timing, see preview update live

4. **Auto-generated hotspot detection**
   - When adding a browser/image asset, optionally run OCR+bounding box detection
   - Present interactive UI to name and confirm hotspots
   - Would eliminate text-matching failures

### DSL Syntax Improvements

1. **Better error messages for common mistakes**
   - Current: `Unknown key 'target'` on interaction
   - Could be: `'target' is not valid for interaction behavior. Did you mean to use it in 'scroll' or 'navigate'? Interaction targets are specified in steps: {click: "element-id"}`

2. **Optional type hints**
   - Could have a strict mode that validates element references at spec time
   - Would catch typos like `"click": "app#export"` where app#export doesn't exist

3. **Time reference validation**
   - When using `"<id>.enter.end"` syntax, validate the id exists
   - Catch forward references or typos early

## Ratings and Final Thoughts

### Final Video Rating: 4.5/5

**Strengths:**
- Professional appearance: smooth animations, good pacing, clean typography
- Feature demonstration is clear: users see PDF export in action, key metrics highlighted
- Compelling call-to-action with URL
- Proper visual hierarchy and safe zone compliance
- Animation timing works well, not rushed
- Video is optimal length (~16 seconds) for social/marketing

**Areas for improvement:**
- Stat card highlight boxes could be positioned more precisely (they're close but could be tighter)
- Could add subtle emphasis (like pulse animation) to highlighted cards
- Toast could have more visual depth or a slightly longer dwell time

**Verdict:** Ready to ship for external use. Would be proud to show this to stakeholders.

### Tool Experience Rating: 4/5

**Strengths:**
- DSL is powerful and expressive for a video spec
- Reference documentation is comprehensive and well-organized
- Validation and lint features catch real problems
- Animation capabilities rival professional motion graphics tools
- Hotspot system is clever when it works
- Quick iteration (version control built in)
- Clear separation of concerns (spec vs. rendering vs. layout)

**Weaknesses:**
- Asset debugging is opaque (hotspot text matching failures not explained)
- Initial learning curve on interaction behavior syntax
- Some lint warnings could be more actionable
- No visual preview tools during authoring (have to render to see)
- Error messages could be more prescriptive

**Verdict:** Solid tool. Would use again for video demos. Would recommend to others with caveat about asset preparation upfront.

## Worst Problem Hit

**Problem:** Hotspot text matching failure combined with off-canvas toast positioning when using camera zoom on a group containing pinned elements.

**Symptoms:**
- Toast didn't appear (outside canvas bounds)
- Hotspots showing lint warnings but no clear path to fix

**Investigation:**
- Used `get_layout` to discover toast was at (751.3, 1073) - below the 1080px canvas height
- Used `describe_at` to understand what was animating
- Realized camera zoom was transforming the pinned element's position

**Resolution:**
- Switched from text hotspots to pixel coordinates (fast, reliable)
- Changed toast layout from direct hotspot pin to offset pin on the zoomed element
- Adjusted background color for contrast

**Time to resolve:** ~25 minutes, mostly due to not having visual debugging tools.

**Impact on workflow:** Required understanding the camera/pin interaction deeply. Would have been faster with better debugging output.

## Summary

Built a 16-second professional feature demo for Ledgerly invoicing app using Sini's video DSL. Successfully demonstrated:
- Dashboard overview with branded intro
- PDF export feature with smooth zoom (2.8s) and success notification
- Key metrics highlighted sequentially with focusCycle
- Clear call-to-action with URL

Applied client feedback (slower zoom, add URL) through 5 iterative versions.

Sini proved to be a capable tool for video authoring with a well-designed DSL, though asset debugging and visual preview capabilities would accelerate iteration. The final video is production-ready and demonstrates Sini's ability to create professional motion graphics from pure JSON specifications.

**Final stats:**
- 4 scenes, 12 elements, 5 timeline items
- 16.10 seconds duration
- 5 versions created
- 0 errors in final state
- All lint checks passing
