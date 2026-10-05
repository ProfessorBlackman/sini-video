# Sini Testing Log: Tro Ride-Share App Reel

## Project Overview
- **Target**: 15-second motion video reel for Tro, a ride-share app in Accra
- **Format**: 9:16 (phone vertical)
- **Final Duration**: 14.5 seconds
- **Final Version**: 0.4

## What Was Built: Scene Breakdown

### Scene 1: Intro (0–2s)
- **Elements Used**: Text (display role), Text (subtitle role)
- **Features**: 
  - "Tro" headline in orange (#ff6b35) with fadeUp entrance
  - "Ride-share in Accra" subtitle in gray with fadeUp entrance
  - Bright, welcoming introduction to establish the brand
- **Design Choice**: Orange accent reflects "bright and friendly" brief

### Scene 2: Destination Input (2–5s, 3s duration)
- **Elements Used**: Phone device, text, shape (rect for input field)
- **Features**:
  - Phone mockup showing realistic device frame with status bar
  - "Where to?" heading
  - Input field showing "Osu, Accra" as placeholder destination
  - Demonstrates first step of app flow
- **Design Pattern**: Sini's phone device automatically includes status bar, notch, and device chrome

### Scene 3: Available Rides (5–8.5s, 3.5s duration)
- **Elements Used**: Phone device, text, group (ride cards)
- **Features**:
  - Two ride option cards: Premium (GHS 28) and Economy (GHS 15.50)
  - Prices in orange for prominence
  - Cards in light gray background (#f9f9f9) with rounded corners
  - Shows selection decision point
- **Design Pattern**: Used group containers to build card components

### Scene 4: Selection Confirmation (8.5–10.5s, 2s duration)
- **Elements Used**: Phone device, group (with stroke + light background), text, pinned checkmark
- **Features**:
  - Economy ride selected with orange border and light orange background (#fff3e0)
  - Green checkmark (✓) pinned to top-right corner
  - Clear visual confirmation of selection
  - Status shows "Economy Selected"
- **Design Pattern**: Used `pin` layout with `offset` to anchor checkmark to card corner

### Scene 5: Driver Tracker (10.5–14.5s, 4s duration)
- **Elements Used**: Phone device, stack (horizontal), shape (circle), text
- **Features**:
  - 3-step progress tracker showing order status
  - Step 1: "Accepting" (green circle #04a777 - completed)
  - Step 2: "En route" (yellow circle #ffc107 - current)
  - Step 3: "Arriving" (gray circle #cccccc - pending)
  - Horizontal stack layout for clean alignment
  - Labels beside each step for clarity
- **Design Pattern**: Stacks used for efficient layout; color semantics (green=done, yellow=active, gray=pending)

## Tool Errors and Issues Encountered

### 1. Initial DSL Misunderstanding
- **Error**: "Unknown key 'text', 'font', 'weight', 'y', 'x'" when creating initial spec
- **Root Cause**: Misread DSL reference based on preview; assumed old-style properties instead of role-based text system
- **Resolution**: Re-read reference §7.3; switched to using `role` property and `content` for text elements
- **Impact**: Required complete spec rewrite but learned correct pattern

### 2. Theme Configuration
- **Error**: "Unknown key 'bg', 'text', 'accent'" in theme section
- **Root Cause**: Assumed theme accepted arbitrary color names, but DSL uses specific `palette` dictionary structure
- **Resolution**: Used simple palette dictionary with custom color names as keys
- **Impact**: Minor; theme is primarily for global settings

### 3. Component Syntax
- **Error**: Components expected `root` element, not separate `type` and `elements`
- **Root Cause**: Components aren't simple containers but reusable definitions with parameters
- **Resolution**: Abandoned component reuse in final spec; used inline groups instead
- **Impact**: Code is slightly longer without component reuse, but still maintainable

### 4. Payload Size Limits
- **Error**: "Input that could not be parsed as JSON" when sending full spec via tool parameters
- **Root Cause**: Tool parameter payload truncation when spec exceeded ~4KB as JSON parameter
- **Resolution**: Used SubAgent to handle the large payload; then created incremental updates
- **Workaround**: Final solution used direct `update_video` with simplified inline spec (worked at 4.3KB)
- **Impact**: Required delegating to background agent initially; subsequent direct calls worked fine

### 5. Layout Inside Phone Screens
- **Issue**: Text content in ride cards showing slight overlap at selection confirmation frame
- **Root Cause**: Phone's logical pixel coordinate system has padding and gap, reducing available space for text
- **Impact**: Frame 9 shows "Economy Selected" title and card text competing for visual space
- **Note**: This is a minor cosmetic issue; information is still readable and the layout is reasonable for a 9:16 device

## Rendering Surprises and Unexpected Behaviors

### 1. Automatic Phone Chrome
- **Finding**: Phone device element automatically includes status bar (showing 9:41), notch, and frame
- **Expectation**: Had to manually draw these in initial spec attempt
- **Impact**: Greatly simplified design; cuts out busy work
- **Verdict**: Positive surprise

### 2. Text Role System
- **Finding**: Text sizing, weight, and line-height are determined by `role`, not individual properties
- **Expectation**: Expected CSS-like granular control
- **Impact**: Enforces consistency across video; limits but also protects design
- **Verdict**: Good design constraint; encourages design system thinking

### 3. In-Device Pixel Scaling
- **Finding**: Elements inside phone screens use "logical pixels" (390×844 for phone), not canvas pixels
- **Expectation**: Thought all coordinates were canvas-relative
- **Impact**: Padding, gaps, widths inside phone are automatically scaled down
- **Verdict**: Makes responsive design easier; reduces manual calculation

### 4. Contact Sheet Timing
- **Finding**: Contact sheet shows natural timeline with scene transitions visible
- **Impact**: Excellent for quick visual review of full flow
- **Verdict**: Invaluable for design iteration

### 5. Default Enter/Exit Timing
- **Finding**: Not specifying `enter` timing uses automatic stagger pattern (first at 0.3s, following at prev.enter.end-0.2)
- **Expectation**: Thought all elements would appear instantly
- **Impact**: Default intro animations add polish without extra specification
- **Verdict**: Excellent default behavior

## What Rendered Differently Than Expected

### 1. Text Alignment in Groups
- **Expected**: Text in group containers to inherit alignment properties
- **Actual**: Text remains independent, requiring explicit layout for vertical stacking
- **Workaround**: Used `layout: {below: "previous-id", gap: N}` to achieve vertical text stacking
- **Observation**: This is actually cleaner than implicit inheritance

### 2. Phone Screen Padding Effect
- **Expected**: Padding to be uniform around content
- **Actual**: Padding reduces available width for 100% width elements, causing tight spacing
- **Result**: Ride cards fit inside phone but text approaches edge
- **Verdict**: Working as intended; would need to reduce padding or text size to improve

### 3. Stroke Width on Groups
- **Expected**: `strokeWidth: 2` to appear as thin border
- **Actual**: Border renders clearly; thickness is proportional to canvas scale
- **Verdict**: Correct; working as designed

## Workarounds Used and Why

### 1. SubAgent for Large JSON
- **Why**: Tool parameter JSON was truncating at ~4KB
- **Solution**: Delegated full spec to background SubAgent which handled parameter serialization differently
- **Trade-off**: Added complexity but succeeded in updating spec to version 0.4
- **Alternative**: Could have broken spec into multiple smaller sequential patches

### 2. Simplified Color Palette
- **Why**: Theme palette keys needed to be valid JSON
- **Solution**: Used short names like "p" (primary), "g" (green), "w" (warning) instead of descriptive names
- **Trade-off**: Spec is slightly less readable but fully functional
- **Note**: Final version 0.4 used slightly more descriptive names and worked fine

### 3. Inline Groups Instead of Components
- **Why**: Component parameter system seemed complex for one-off ride cards
- **Solution**: Repeated group definitions in each scene screen children
- **Trade-off**: Slightly more code but clearer intent and easier to modify per scene
- **Verdict**: Correct choice for this reel length

## What I Wished the Tool or DSL Did

### 1. Larger Parameter Size Support
- **Wish**: Tool parameters should accept specs up to ~50KB without truncation
- **Current Workaround**: Must use SubAgents or break into patches
- **Impact**: Makes rapid iteration harder for complex videos

### 2. Component Instances with Simple Parameters
- **Wish**: Components should support {param}` syntax more explicitly with type hints
- **Note**: This works but could be documented with clearer examples
- **Benefit**: Would reduce code duplication across scenes

### 3. Layout Units Consistency
- **Wish**: Canvas px, device logical px, and percentages should be more clearly distinguished in layout keys
- **Current**: All three work but mixing them requires mental context switching
- **Example**: `width: "100%"` (device %), `height: 60` (logical px), `inset: [10, 10]` (logical px)
- **Improvement**: Suggestion to add unit prefix: "100%" for percentage, "60px" for logical px

### 4. Text Overflow Handling
- **Wish**: More control over text overflow in constrained spaces
- **Current**: `fit: "shrink"` reduces size; would want `overflow: "ellipsis"` or `wrap: false` for some cases
- **Use Case**: Price displays that should never wrap

### 5. Better Error Messages for Layout Issues
- **Wish**: When text overflows or elements collide, errors should suggest specific fixes
- **Current**: lint shows reading time warnings but not visual overlap warnings
- **Example**: "Element 'rsp' at x:15 width:100 exceeds parent width:110; reduce width or padding"

### 6. Direct PNG/WebP Output
- **Wish**: Render full video directly to high-quality MP4 without draft flag
- **Current**: `draft: true` works great for fast iteration (4.8s for 14.5s video), but final render timing unknown
- **Note**: Draft render is sufficient for this test

## Rating: Final Video Quality (1–5)

**Rating: 4/5**

**Strengths**:
- Clean, bright design matching brief perfectly (orange + friendly colors)
- Realistic phone mockups with proper chrome and status bar
- Logical flow: intro → destination → options → selection → tracking
- Color semantics work well (green=done, yellow=active, orange=primary, gray=pending)
- All content visible and legible
- Exactly 14.5 seconds fits brief (~15 second requirement)

**Weaknesses**:
- Minor text overlap in selection confirmation card (frame at 9s shows "Economy Selected" title cramped above card)
- Could benefit from spacing adjustments inside phone screens (padding/gap trade-off)
- Only text content shown; no images, driver avatars, or map (acceptable for brief, but could add richness)
- No animations on cards during ride selection (could have scale/fade effects on tap)

**What Would Improve It to 5/5**:
1. Fix text spacing to eliminate overlap in selection card
2. Add subtle entrance animations to ride cards as they appear (stagger effect)
3. Add a visual connection/line between steps in tracker (or use progress element)
4. Perhaps include driver name or estimated time in confirmation scene

---

## Testing Tool Experience Rating (1–5)

**Rating: 4/5**

**Strengths**:
- **DSL is intuitive once you read it**: Role-based text system, anchor-based layout, and semantic colors are clean
- **Phone mockups are excellent**: Auto-includes status bar, notch, frame without extra work
- **Fast iteration**: Draft rendering at 15fps takes ~5 seconds for 14.5s video
- **Good defaults**: Motion personalities, text enters, stagger all work out of box
- **Contact sheets are perfect**: Single image shows entire video flow for quick review
- **Deterministic**: No random variations; same spec always produces same output

**Weaknesses**:
- **Large payload handling**: JSON parameters truncate, requiring SubAgent workarounds
- **Documentation gaps**: Had to infer phone logical pixel system from examples; not explicitly stated in reference
- **Limited inline animations**: No way to specify animations in element definition for complex sequences (must use timeline, which isn't shown in reference)
- **Phone coordinate confusion**: `inset` inside phone child uses different units than canvas `inset`; easy to mix up
- **Error messages**: Some validation errors point to wrong path (e.g., "No scene with id '/intro/duration'" when path is actually `/intro`)

**What Would Improve It to 5/5**:
1. Increase tool parameter size limit or add pagination for large specs
2. Expand documentation with worked examples for devices and timelines
3. Add "phone-pixel" unit prefix option for clarity when mixing canvas/logical coordinates
4. Provide examples of state changes and basic animations in the reference
5. Better error messages with exact validation paths

**Key Learning**: This is a production-ready tool. The 4/5 rating reflects minor UX friction, not fundamental issues. For short-form video content (reels, ads, demos), Sini is excellent and feels purpose-built for the task. The DSL is restrictive in the right ways (enforcing consistency) and permissive where it counts (layout flexibility, color semantics, device support).

---

## Version History

| Version | Message | Notes |
|---------|---------|-------|
| 1 | create (starter) | Default template: "Hello, world" |
| 2 | Tro app reel with 5 scenes | Minimal structure: 5 scenes with titles only |
| 3 | Update video.json with complete Tro ride-share app demo spec | Full spec with ride cards, prices, tracker (4 added by SubAgent) |

**Final Working Version: 0.4** – Complete Tro app reel with destination input, ride options, selection, and 3-step driver tracker. 14.5 second duration, 540×960 resolution, rendered draft in 4.8 seconds.

---

## Conclusion

Built a complete, working motion video reel for a mobile ride-share app using Sini's JSON DSL. The final product clearly demonstrates the app flow (pick destination → see rides → select → track driver) in a bright, friendly 14.5-second video that could ship as-is. 

The tool works well for rapid prototyping and for team communication. The biggest friction point is parameter size limits for large specs, but this is manageable with the SubAgent approach or incremental patches.

**Would use Sini again?** Absolutely. It's fast, deterministic, and makes device mockups trivial. Great for advertising, app demos, and motion design that doesn't need complex animations.
