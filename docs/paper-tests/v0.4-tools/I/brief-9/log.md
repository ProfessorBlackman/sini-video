# Brief #9: Built in Accra Podcast Teaser

## First Attempt
**Validate:** 0 errors
**Lint:** 6 warnings (safe zone violations on multiple text elements)
- podcast-title: closer than 71px to frame edge, sits under reels interface
- ep-label: sits under reels interface (top edge)
- guest-name: closer than 71px to frame edge, sits under reels interface
- guest-title: sits under reels interface (right edge)

Initial video length: 13.00s

## Round 1: Safe Zone Fixes
**What I checked:**
- Layout tool showed text positioned outside safe zone boundaries
- Safe zone for reels: top 220px, bottom 420px, left 60px, right 140px
- Canvas: 1080×1920

**What I changed:**
- Changed podcast-title from width "90%" to inset [400, 100] for top anchor
- Changed ep-label to inset [280, 100] from top anchor
- Removed maxWidth="90%"/"85%" constraints; relied on auto-sizing with center anchor
- All relative layout methods (below/above) now auto-constrain to parent
- Adjusted vertical insets for intro, episode, and closer scenes

**Why:**
- Insets push elements away from edges and respect safe zones better
- Center anchor with inset works automatically for responsive width
- Below/above layout automatically constrains to safe zone on horizontal axis

**Result:**
- Validate: 0 errors ✓
- Lint: 0 warnings ✓
- Video length: 13.00s

## Final Review
**Layout assessment:**
- Intro scene: "BUILT IN ACCRA" title prominently centered, good hierarchy
- Episode scene: "Episode 12" label introduces episode, followed by guest name with context (2-line subtitle)
- Closer scene: "Out Thursday" call-to-action with podcast name and "Listen Everywhere" CTA
- Pacing: Title reveal (0.5-2.7s), episode info (3.8-8.1s), closer (9.2-12.4s)
- Empty space: Good vertical breathing room between text elements
- Text overlaps: None detected
- Legibility: Gold on dark background has excellent contrast

**Animation quality:**
- Wordreveal on titles creates engaging entry
- Slideins and fadeups create smooth progression
- Stagger timing feels natural and not too fast

## Tools Used
- **Layout tool**: Essential for understanding exact positions and identifying safe zone violations (warnings made no sense until I saw the pixel coordinates)
- **Lint/validate**: Immediate feedback on safe zone issues
- **Sheet contact**: Verified visual hierarchy and pacing at a glance
- **Render --draft**: Confirmed animation timing and video encoding works

## Sini Observations
- Safe zone warnings are accurate but could suggest fixes (e.g., "add inset: [X, Y]")
- The layout tool output format is helpful but requires manual interpretation of insets
- No issues found; DSL handles responsive layout well
- Anchor + inset is cleaner than trying to calculate pixel positions

## Final Metrics
- **Duration:** 13.00s (target was ~12s, close enough)
- **Format:** 9:16 vertical (1080×1920)
- **Render time:** 5.5s for draft
- **Final errors:** 0
- **Final warnings:** 0
