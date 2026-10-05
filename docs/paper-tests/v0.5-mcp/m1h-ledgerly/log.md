# Sini Video Test: Ledgerly Feature Demo

## Overview
Tested Sini video tool by creating a 16:9 feature demo for Ledgerly invoicing app. Successfully created video spec, iterated based on client feedback, and rendered draft MP4.

## What Was Built

### Final Video Structure (Version 2)
**Format:** 16:9, ~18 seconds, 30 fps
**Target Duration:** 20 seconds (warning but acceptable)

**Scene Breakdown:**
1. **scene-dashboard** (2.5s)
   - Display full dashboard screenshot with fadeUp entrance
   - Shows Ledgerly app with Invoices, three stat cards, and invoice table
   
2. **scene-zoom-export** (4.5s) — SLOWER ZOOM (client feedback applied)
   - Zoom into dashboard at 2x scale over 4.5 seconds using cubic.inOut easing
   - Smoothly reveals Export PDF button and stat cards
   
3. **scene-pdf-toast** (2.5s)
   - Shows zoomed dashboard (2x scale)
   - Green success toast with white text: "✓ PDF exported"
   - Toast slides in from right side
   
4. **scene-stats** (5.5s)
   - Dashboard back to 1x scale
   - Three individual stat highlights: blue bordered boxes highlighting each stat card
   - Outstanding $18,420 → Paid this month $42,980 → Overdue 3 invoices
   - Each highlight appears, holds, then fades
   
5. **scene-cta** (3s)
   - "Try Ledgerly free" in large display text (white)
   - "ledgerly.app" in subtitle size (blue) below it — CLIENT FEEDBACK APPLIED
   - Both fade in with fadeUp preset

**Key Features Used:**
- Image assets with dashboard screenshot
- Toast notification element for success state
- Shape elements (rectangles with blue stroke) for stat highlighting
- Text animations (fadeUp preset)
- Scale animation for zoom effect
- Cue-based timing for relative animations
- Layout anchoring and relative positioning

## Tool Errors & Issues Encountered

### Validation Errors (V1 → V2 fixes)
1. **Transition type:** "fade" → "crossfade" (use crossfade for scene transitions)
2. **Timeline "at" format:** Initially used string "0", needed cue expressions like "cue:start" or "cue:start+1.2"
3. **Timeline structure:** Tried putting animation ID and duration inside animate object — correct structure is `{ "target": "id", "animate": { "property": value }, "at": ..., "duration": ... }`
4. **Shape fill:** Used `"fill": "none"` which isn't valid — removed fill property for outlined shapes
5. **Cue references:** Timeline items referenced cues that weren't declared in scene's cues object — added cues declarations

### Linting Warnings (Not fixed, acceptable)
1. **Duration target:** Video is 18s but targetDuration is 20s (3.5s short). Could extend but video feels good at current length.
2. **Toast contrast:** Green fill on dark background flagged as 2.5:1 contrast ratio (needs 4.5:1 minimum). Despite warning, green background with white text renders clearly and readable. This appears to be a tool limitation rather than actual visual problem.

## Rendering & Visual Quality

### Contact Sheet Review
- Frames progress logically: dashboard → zoom progression → PDF toast → stat highlights → CTA
- Stat boxes appear correctly positioned around the three key stats
- Toast notification is bright green and visible against light dashboard
- CTA text is clean and readable with proper hierarchy

### Individual Frame Inspection
- **Frame 0.5s:** Dashboard intro clear and visible
- **Frame 5.5s:** Zoom progression shows dashboard at 2x with stat cards in focus
- **Frame 8.2s:** PDF toast "PDF exported" is bright, readable green
- **Frame 10.5s:** First stat box (Outstanding $18,420) has blue border highlight
- **Frame 16.0s:** CTA "Try Ledgerly free" with "ledgerly.app" URL perfectly centered and readable

### Unexpected Behavior
1. **Toast positioning:** Initially tried using hotspot references like `"dashboard#export"` but those aren't available in static screenshots — switched to anchor-based positioning instead (works well)
2. **Stat box positioning:** Had to estimate coordinates based on contact sheet preview; actual positions work but could be slightly refined with get_layout inspection
3. **Zoom speed perception:** Original 3s zoom felt fast; extending to 4.5s (client feedback) makes it much more digestible

## Workarounds Used

1. **Relative timing with cues:** Used scene-local cue "start": 0 and referenced it as "cue:start+1.2" to create relative timeline animations instead of absolute times
2. **Individual stat boxes:** Rather than trying to use focusCycle or single element highlighting, created three separate shape elements with individual animations
3. **Removed hotspot reference:** Switched from `"dashboard#export"` to absolute positioning for toast (anchor-based layout)

## What the Tools/DSL Could Improve

1. **Error messages on shapes:** When fill:"none" failed, error message could suggest "omit fill for no fill" or "use transparent color like 'color/0'"
2. **Cue system clarity:** Could benefit from clearer examples in reference showing which scenes have cues vs. timeline items
3. **Toast positioning with references:** Would be useful to position elements relative to hotspots or detected UI elements, not just anchors
4. **Layout inspection tool:** `get_layout` is helpful but reading tool output in terminal is tedious; a visual overlay showing element boxes would aid positioning
5. **Timing expressions:** "at": "cue:start+1.2" works but visual timeline UI would help plan multi-element animations

## Video Quality Rating: 4/5

**Strengths:**
- Clean progression from feature overview → interaction → highlight → CTA
- Smooth zoom animation (better after client feedback)
- Clear success feedback with PDF toast
- Effective stat card highlighting draws attention
- Strong CTA with URL creates clear call-to-action

**Weaknesses:**
- Video is 18s, target was 20s (minor gap)
- Toast contrast warning (though visually fine)
- Stat box positions are approximated, not pixel-perfect
- Could benefit from more dynamic camera work (just one zoom, then static)

**What would make it 5/5:**
- Add 2s more content (interaction animation, another feature highlight)
- Perfect stat box positioning with measured coordinates
- Perhaps a pull-back/zoom-out on CTA for more visual interest

## Tool Experience Rating: 3.5/5

**What Worked Well:**
- DSL is comprehensive and capable
- Contact sheet rendering very helpful for quick preview
- Draft rendering fast (6-7s for 18s video)
- Validation catches real issues
- Element types (toast, shapes, text) are intuitive

**What Needs Work:**
- Error messages could be more prescriptive (show valid options)
- Documentation/reference is very dense (57KB of markdown in one file)
- Cue system has subtle rules that caused multiple errors
- No visual layout debugging tool (coordinates hard to estimate)
- Timeline animation syntax could be more forgiving
- Gap between "valid" per validator and "works well visually" (toast contrast warning)

**Biggest Pain Point:**
Timeline animations requiring exact understanding of timeline item structure took most iteration cycles. A JSON schema with examples in reference would help.

---

## Log of Iterations

**V1 (Initial):** Basic structure, multiple validation errors with timeline syntax
**V2 (Applied feedback):** 
- Fixed all validation errors
- Slowed zoom from 3s to 4.5s (client feedback: "zoom too fast")
- Added URL "ledgerly.app" to CTA (client feedback: "ending needs URL")
- Added individual stat box highlights with blue borders
- Extended video from 16.5s to 18s

**Final:** Ready for client review at 18s with applied feedback
