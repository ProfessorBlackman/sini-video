# Sini Video Testing Log: Ledgerly Feature Demo

## 1. What Was Built

**Project:** r1hb-ledgerly feature demo video
**Final Version:** 5
**Duration:** 20 seconds (16:9, 1920×1080, 30fps)
**Target:** Social media feature demo for invoicing app

### Scene-by-Scene Breakdown

**Scene 1: Dashboard Intro (2.5s)**
- Element: Browser mockup displaying the Ledgerly Invoices dashboard screenshot
- Features used: `browser` element with asset referencing
- Shows the full app interface to establish context

**Scene 2: Zoom and Click Export (4.5s)**
- Elements: Browser in a group container with camera behavior
- Features used: 
  - `group` container for camera target
  - `camera` behavior with keyframe animation (zoom from 1x to 2.8x)
  - `interaction` behavior with cursor and click action
  - Hotspot targeting (`browser2#export`)
- Animation: Smooth zoom-in to Export PDF button over 2.5s, click at 2.6s

**Scene 3: PDF Ready Toast (auto ~3.85s)**
- Elements: Browser + toast notification
- Features used:
  - `toast` element with icon, title, and body
  - `slideIn` preset with `from: "right"`
  - Pinned layout with `inside` offset for positioning
  - State targeting within device
- Shows success confirmation with animated notification sliding in from right

**Scene 4: Highlight Statistics (5.0s)**
- Elements: Browser with stat cards
- Features used:
  - `focusCycle` behavior targeting three hotspots
  - Spotlight effect with dimming (0.4 opacity)
  - Scale emphasis (1.06x) on focused element
  - Staggered cycling (1.2s per stat)
- Highlights Outstanding, Paid This Month, and Overdue stats one by one

**Scene 5: Call-to-Action (auto ~4.15s)**
- Elements: Text with fade-in animation
- Features used:
  - `text` element with `display` role
  - `fadeUp` enter preset
  - Multiline content with center alignment
- Shows "Try Ledgerly free" with "ledgerly.app" URL below

## 2. Tool Errors, Warnings, and Surprises

### Validation & Lint Process
- **Initial validation**: Passed immediately with no schema errors
- **Lint warnings (round 1)**:
  - Target duration mismatch (20s target vs 12.5s actual) → Fixed by using auto durations
  - Text readability time warnings → Extended scenes to allow proper reading time
  - Safe zone violations → Moved toast to safer position
- **Lint warnings (ongoing)**: One persistent warning about toast at top edge of safe zone
  - **Root cause**: Safe zone checking appears to use 9:16 (1080×1920) margins even for 16:9 format
  - **Status**: Not blocking - the toast is correctly positioned for app UI demonstration
  - **Workaround**: Could be accepted via lint.accept config, but not applied due to patch syntax limitations

### Patch Application Warnings
- When updating camera keyframe timing: Path suggestion indicated using ID-based addressing (`click-export.at`) instead of array indexing
- Impact: Minimal - patches applied successfully despite warnings
- Learning: Tool provides helpful guidance on optimal path syntax for future edits

### Asset & Hotspot Behavior
- **Hotspot text detection**: Used `{"text": "Export PDF"}` format and Sini successfully located the region
- **Multiple hotspots on same asset**: Declared all four stats (outstanding, paid, overdue, export) on the dashboard asset without conflicts
- **Device content scaling**: Browser mockup correctly scaled the 1440×900 dashboard screenshot to 1920×1080 canvas

### Timing & Duration Auto Calculation
- Scenes with `"duration": "auto"` correctly calculated based on text reading time
- `targetDuration` feature successfully distributed time across auto scenes to hit 20s total
- Final timing: dashboard-intro (2.5s) + zoom-export (4.5s) + pdf-ready (3.85s) + highlight-stats (5s) + cta (4.15s) = 20s exactly

## 3. Rendering Behavior vs. Specification Expectations

### What Rendered as Expected
- Dashboard screenshot displayed correctly in browser mockup
- Zoom camera smoothly animated from normal view (1x) to zoomed view (2.8x) on Export PDF button
- Interaction cursor appeared and clicked the button at the specified time
- Toast notification slid in from the right with check-circle icon
- focusCycle behavior created spotlight effect, highlighting each stat with dimming and scaling
- Text fading in with fadeUp preset, with proper line breaks and center alignment
- Transitions (crossfade) between scenes worked smoothly

### Surprises/Differences
- **Safe zone warnings on 16:9 format**: Warnings referenced 1080×1920 safe zone margins even though video is 1920×1080. Not critical but confusing context.
- **Toast positioning precision**: Pinning with `inside: 24` placed toast reliably at top-right, though exact positioning differed slightly from estimate due to toast auto-sizing
- **focusCycle dimming**: Dim effect darkened the entire screenshot background (not just the surrounding area), which was more aggressive than anticipated but visually effective

## 4. Workarounds Applied

**Issue**: Total video duration too short relative to target
**Workaround**: Used `"duration": "auto"` on pdf-ready and cta scenes, allowing Sini to calculate duration based on text reading time and targetDuration settings
**Why it worked**: The auto mechanism perfectly distributed time to hit the 20s target while keeping text readable

**Issue**: Camera zoom seemed relatively fast
**Workaround**: Increased zoom-export scene from 3.0s to 4.5s and adjusted camera keyframe from 1.5s to 2.5s
**Why it worked**: Slowed down the animation to match client feedback for a more graceful pacing

**Issue**: CTA text did not include URL
**Workaround**: Added `\n` line break and "ledgerly.app" to the content string
**Why it worked**: Simple text content update; Sini handled multiline text naturally with proper line spacing

## 5. Missing Features or Wishes

**What would have been useful:**

1. **Debug timeline view**: A visual representation showing exact timing of all animations, behaviors, and when elements become visible. Currently used `describe_at()` calls, but a timeline diagram would be faster.

2. **Hotspot visualization tool**: A way to see which regions Sini detected for `{"text": "..."}` hotspots without rendering full video. Would speed up iteration on text-based targeting.

3. **Interaction replay**: A recorded interaction playback marker showing cursor path and timing in rendered output. Currently hard to verify cursor movements matched intended targets.

4. **Preset parameter auto-complete**: When using complex presets like camera or focusCycle, guidance on recommended parameter ranges (e.g., scale 1.02-1.15, dim 0.2-0.6) would help with iteration.

5. **Device screenshot hotspot validation**: Ability to test hotspot definitions against the actual screenshot asset before rendering, to catch text location mismatches early.

6. **Batch rendering with variations**: Ability to render multiple versions with parameter swaps (e.g., different zoom levels, stat order) in one batch job.

7. **Safe zone visualization**: Show safe zone boundaries in contact sheets and rendered frames for 16:9 format, not just default 9:16.

## 6. Ratings

### Final Video Quality: 4/5

**Strengths:**
- Clean, professional appearance with good use of app interface
- Clear information hierarchy: intro → feature (PDF export) → confirmation → key metrics → CTA
- Smooth animations and pacing that feel natural, not rushed
- Good visual contrast and readability at all sizes
- Effective use of spotlight effect to highlight important numbers

**Weaknesses:**
- Stats highlight cycle is somewhat fast (1.2s each); could feel rushed to some viewers
- Toast notification positioned at top-right is slightly off from typical mobile app UX (usually bottom)
- CTA text is large and simple; could benefit from a button element or additional visual emphasis
- No audio or sound design (expected limitation, but worth noting)

**Design choices that worked well:**
- Dark background (#1a1a1a) gives professional tone and lets white dashboard stand out
- Zoom transitions make demo feel interactive rather than just showing screenshots
- Using actual dashboard screenshot creates authenticity
- Hotspot-based interaction requires no custom mockups or coordinates

### Tool Experience & Usability: 3.5/5

**Strengths:**
- Quick iteration cycle: validate → lint → render (draft) → update patches → render final
- Powerful composition tools (camera, focusCycle, interaction) that feel high-level without being limiting
- Asset hotspot detection via text is genuinely useful and time-saving
- Deterministic output; same spec always produces identical video
- Contact sheet provides fast feedback without waiting for full renders

**Weaknesses:**
- Learning curve for animation timing syntax; `"h1.enter.end+0.2"` style references are powerful but take practice
- Safe zone warnings don't account for format aspect ratio (checked against 9:16 even for 16:9 video)
- Patch syntax has some gotchas with array indexing; tool provides helpful corrections but slightly clunky workflow
- Missing some visual debugging tools (no timeline viewer, no hotspot preview)
- Lint messages are clear but can't be easily silenced without editing the spec

**Documentation & Reference:**
- DSL reference is comprehensive and well-organized
- Recipe patterns (§15) are genuinely helpful starting points
- Each section (elements, animation, transitions) is thorough
- Tool suggestions in lint output are actionable and specific

**Workflow friction points:**
- Patch operation addressing requires understanding the data model deeply (paths like `zoom-export.timeline[1].at` vs `click-export.at`)
- No live preview or web-based editor; all work through JSON editing and tool calls
- Rendering full video takes ~45s; draft mode (7.7s) is helpful but still feels slow for tight iteration cycles

## 7. Session Log: What Happened

1. **Loaded Sini tool schemas** (ToolSearch) ✓
2. **Read DSL reference sections** (1, 7, 9) ✓
3. **Created initial video spec** with 5 scenes: intro, zoom-export, pdf-ready, highlight-stats, cta
4. **Validated** - passed immediately ✓
5. **Linted** - 4 warnings about duration, readability, safe zone ⚠
6. **Updated** - extended durations, moved toast, adjusted timing ✓
7. **Linted** - reduced to 1 persistent safe zone warning ⚠
8. **Rendered contact sheet** - verified flow and visual progression ✓
9. **Applied client feedback patches**:
   - Slowed camera zoom (3.0s → 4.5s, keyframe 1.5s → 2.5s)
   - Updated CTA text to include ledgerly.app
   - Adjusted click timing to occur after zoom
10. **Rendered draft video** (960×540 @ 15fps) - quick verification ✓
11. **Rendered final video** (1920×1080 @ 30fps) - 46.3s render time ✓
12. **Final contact sheet** - confirmed all scenes rendered correctly ✓

---

## Summary

Built a 20-second Ledgerly invoicing app feature demo using Sini's browser mockup, camera zoom, interaction, toast, and focusCycle behaviors. Applied client feedback to slow down the zoom animation and add the website URL to the CTA. Video successfully demonstrates the app's core features (PDF export, key metrics) with professional pacing and clear information hierarchy. The Sini tool proved effective for creating deterministic, interactive demo videos from structured specs, though the learning curve for timing syntax and some rough edges in debugging tools prevent it from being a 5/5 experience.
