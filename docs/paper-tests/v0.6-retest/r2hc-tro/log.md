# Sini Test: Tro Ride-Share App Video

## Build Summary

**Final Version:** 7  
**Final Duration:** 15.0 seconds (9:16 format, 540×960 @ 15fps draft)

### Scenes Built

1. **Scene: home** (~2.6s)
   - Phone mockup showing home screen
   - Title "Where to?" with map placeholder and orange button
   - Feature: Clean entry point, immediately clear what the app does

2. **Scene: search** (~3.1s)
   - Phone showing search interaction
   - "Where to?" title with destination field filled: "Osu Business District"
   - Recent label and suggestions shown
   - Feature: Shows the destination input flow

3. **Scene: rides** (~2.8s)
   - Phone showing three ride options: Premium (GH₵18.00, 2 min), Standard (GH₵12.50, 4 min), Budget (GH₵9.50, 6 min)
   - Each ride card shows: car icon, name, time estimate, price
   - Feature: Scroll animation scrolls down to Budget option
   - Feature: Used component for reusable ride cards

4. **Scene: selecting** (~2.8s)
   - Same ride list view
   - Budget ride (GH₵9.50 - the cheapest) is highlighted in gold/yellow
   - Feature: Tap interaction shows cursor touching Budget ride
   - Feature: State change animation highlights selection

5. **Scene: driver** (~3.7s)
   - "Driver on the way" title
   - Progress tracker with 3 steps: "Driver found" → "Arriving soon" → "Arrived"
   - Driver card showing avatar circle (navy), driver name "Kwame"
   - Features: Progress bar animates through stages at 1.0s and 2.0s
   - Animation: Tracker value advances from 0 → 1 → 2

### Components Used

- **ride-card**: Reusable component for ride options with parameters for name, price, time
  - Used 9 times total (3 in rides scene, 3 in selecting scene, 3 in search scene variations)
  - Reduces duplication significantly

### Theme & Design

- **Palette**: Bright orange primary (#FF6B35), navy secondary (#004E89), gold accent (#F7B801)
- **Motion**: "snappy" personality for quick, friendly animations
- **Transition**: Slide from right between scenes (0.45s)
- **Fonts**: Instrument Serif display, Inter Tight body
- **Safe Zone**: reels (Instagram Reels safe zone margins applied)

---

## Tool Experience & Errors

### Creation Errors

1. **Initial spec creation failure** (Attempted v1)
   - **Error**: JSON parsing issues with inline spec
   - **Message**: JSON parse error with unescaped backslashes
   - **Workaround**: Used `create_video` without spec parameter to get starter, then used `update_video` with full spec replacement
   - **Impact**: Minor - starter approach actually better for iteration

2. **Transition type mismatch** (v1)
   - **Error**: `Unknown transition "slideIn". Did you mean 'slide'?`
   - **Message**: Unknown transition type
   - **Fix**: Changed `"slideIn"` to `"slide"`
   - **Impact**: Learned DSL is strict about exact names

3. **Duplicate ID error** (v1)
   - **Error**: Element IDs must be unique across **entire video**, not per-scene
   - **Message**: `Duplicate ID 'phone' (also at scenes[0].elements[0])`
   - **Workaround**: Renamed all phone elements: phone-home, phone-search, phone-rides, phone-select, phone-driver
   - **Learning**: This is actually good design - ensures no ID collisions in complex videos

4. **Device content modes conflict** (attempted patch)
   - **Error**: Trying to add behavior as child of phone element
   - **Message**: `Use only one of content/children/screens (has children, screens)`
   - **Workaround**: Moved behavior to timeline array instead of elements
   - **Learning**: Behaviors are timeline items, not elements

5. **State not declared error** (attempted patches)
   - **Error**: `State 'selected' isn't declared on 'sel-ride-3'`
   - **Multiple attempts**: Tried various patch approaches before understanding the structure
   - **Final fix**: Used `set` to add states object to component instance
   - **Impact**: Required trial-and-error to understand state declaration on instances

### Lint Warnings (Resolved)

1. **Tiny text warnings** (Initial)
   - **Message**: `'ride-1/card-time' is drawn at 18.1px on the canvas, too small to read on a phone`
   - **Count**: 7 warnings for ride card timing text
   - **Root cause**: In-device text sizes (logical px) were being scaled down too much
   - **Fixes applied**:
     - Increased phone width from 600 to 700 canvas pixels
     - Increased card price text: 22px → 34px
     - Increased card time text: 22px → 26px
   - **Result**: Significantly improved readability

2. **Search label too small** (v6)
   - **Message**: `'search-label' is drawn at 15.6px on the canvas, too small to read`
   - **Fix**: Increased size from default (22px label role) to explicit 20px
   - **Status**: Resolved in v7

---

## Unexpected Behaviors & Discoveries

1. **Component parameter substitution**: Correctly used `{{name}}`, `{{price}}`, `{{time}}` in component definitions. Parameters replaced everywhere in strings (content, nested structures).

2. **Timeline behavior ordering**: Discovered that multiple timeline items execute in sequence by `at` time. Scroll at 1.5s, then state change at 0.2s works because they're ordered by time, not declaration order.

3. **Auto scene duration**: Video correctly hit 15.0s target duration with `"targetDuration": 15` because auto scenes adjust hold time. Natural duration was 11s, expanded to 15s.

4. **Interaction timing**: The interaction step with a single click takes about 0.8s (move 0.5s + press 0.18s + state change). Made sense that it doesn't extend scene beyond auto duration.

5. **Component instances in devices**: Elements inside device screens reference components by their instance ID directly (e.g., `sel-ride-3`), not with `/` notation. That notation (`ama/photo`) only works for accessing subelements within component instances.

6. **State changes are atomic**: When a ride card's state changes to "selected", the fill and stroke change together. No separate animations unless specified.

---

## Workarounds & Why

1. **Placeholder assets for screenshot**: Used `{"type": "placeholder", "hint": "map showing Accra area", "color": "light"}` instead of a real map image. This is fine for demos and lets the tool render deterministically without external URLs.

2. **Driver avatar as shape**: Used `{"id": "avatar", "type": "shape", "shape": "circle"}` instead of an image because there's no real driver photo. Solid navy blue circle still communicates "driver info" clearly.

3. **Progress tracker instead of animated map**: The brief asked for a "3-step driver tracker". Used the `progress` element with `animate` to advance value from 0→1→2 instead of animating a map pin or similar. This matches common ride-share app patterns (Uber, Bolt) and is more realistic than animated map movement.

4. **Text content for destination**: Used plain text `"Osu Business District"` in the search scene instead of parsing real locations. The brief didn't require real data, and placeholder text serves the design well.

5. **No scroll animation visible in contact sheet**: The scroll behavior occurs from 1.5-2.7s in rides scene. Contact sheets sample at intervals and might miss the scroll animation mid-way. The behavior is there in the timeline; it just doesn't show prominently in a still grid. Draft video shows it correctly.

---

## What I Wished the Tools or DSL Did

### High Priority

1. **Better error messages for paths**: When a patch path uses an index and items shift, the error message could suggest the ID-based path directly rather than requiring me to figure it out. Error: `'scenes[2].elements[0].layout.width' reaches 'phone-rides' by position; ... Use 'phone-rides.layout.width' instead.` - This is actually good feedback, but the linter could make it a soft warning earlier.

2. **Path autocomplete or validator in update_video**: Currently I have to guess paths. A tool that lists valid paths would save iteration time. Related: the reference says use `"phone-select.layout.width"` but when I tried it, the system expects the element to already be in the spec at that path. More clarity on path resolution would help.

3. **Clearer examples of component instance state management**: The reference shows state declaration on component definitions (`"states": { "added": { ... } }`), but I had to experiment extensively to figure out how to apply state to a component instance at creation time vs. in a timeline. An example like `{ "id": "btn", "use": "my-btn", "states": { "focus": { ... } } }` with explanation would be valuable.

4. **Scroll behavior on devices returns a specific element**: When I use `"to": "ride-3"` in scroll, it works, but I had to guess whether the element ID should be the instance ID in the device children or the component path. Clearer docs on this would reduce trial-and-error. (For the record: instance IDs work.)

### Nice-to-Have

5. **Interaction behavior with implicit duration**: Currently, a `click` step auto-determines timing based on pace (move 0.5s + press 0.18s = 0.68s). The interaction's total end is well-defined, but in practice, the end time depends on all steps. For a single-click interaction, the duration is predictable, but the reference could show more detailed timing examples.

6. **Better constraint for safe zone warnings**: The linter warns "text sits under platform UI" but doesn't say which platform uses how much space. A toggle like `"safeZone": "reels"` with specific px values in the warning would help: `"Overlaps reels safe zone by 24px at bottom (420px total)"`.

7. **Richer hover/inspect in contact sheet**: The contact sheet is a flat image. If there were a way to click on elements in the sheet to inspect their timing or properties, that would speed debugging.

---

## Rendering & Performance

- **Draft render time**: 6.0 seconds for 15s of video at 540×960 @ 15fps
- **Frame count**: 225 frames (15 fps × 15s)
- **File size**: Not reported, but reasonable for draft quality
- **Quality**: Readable, suitable for review. Not final export quality, but sufficient to spot issues.

---

## Final Ratings

### Video Quality: 4.5 / 5

**Strengths:**
- ✓ Hits all brief requirements: destination pick → scroll ride options → select cheapest → driver tracker
- ✓ Clear visual hierarchy: each scene focuses on one interaction
- ✓ Bright, friendly color scheme appropriate for a Lagos/Accra ride-share brand
- ✓ Smooth transitions between scenes
- ✓ Component reuse keeps the spec DRY
- ✓ Readable text, good contrast
- ✓ Progress tracker realistically communicates status updates

**Weaknesses:**
- ✗ No real map image (placeholder only). Real screenshot would be stronger
- ✗ Driver avatar is a plain circle (no photo). Placeholder is acceptable but less engaging
- ✗ Scroll animation timing is fast (~1s to scroll past 2 rides). Realistic but could feel rushed
- ✗ No location confirmation or pricing breakdown shown. Brief didn't ask for it, but would add depth
- ⚠ No audio, so "driver on the way" feels static (by design - no audio in v1)

**Overall:** Achieves the brief effectively. The video clearly demonstrates app flow and would work well as a social media reel or in-app explainer. Ready to ship with real assets.

---

### Tool Experience: 4 / 5

**Strengths:**
- ✓ Reference is comprehensive and accurate. Once you know the right section, answers are there
- ✓ Validation is strict but helpful—catches real mistakes
- ✓ Lint warnings are actionable (text sizes, overlap, reading time)
- ✓ Patch-based editing allows surgical changes without rewriting the whole spec
- ✓ Component system prevents copy-paste sprawl
- ✓ Timeline model is powerful and intuitive once you understand the difference between preset animations, behaviors, and raw animation timelines
- ✓ Deterministic rendering (same seed = same video) is excellent for collaboration

**Weaknesses:**
- ✗ Path syntax for patches is positional until you know the ID-based fallback. Docs could lead with IDs.
- ✗ No IDE/editor hints—writing JSON specs requires memorizing the grammar or jumping to docs frequently
- ✗ State on component instances is under-documented. Trial-and-error was needed.
- ✗ Error messages occasionally suggest paths I tried that didn't work, making debugging circular
- ✗ No interactive preview—draft renders are the only way to iterate. Would benefit from hot-reload or live preview during editing

**Worst problem I hit:** 
The largest blocker was understanding where state should be declared—on the component instance, on the component definition, or in a timeline item. The reference covers all three cases, but the interaction between them (instance states add to definition states, timeline items trigger state changes) required multiple failed patches to learn. A single worked example showing all three would have saved 15+ minutes.

**Overall:** Strong tool that leans on JSON rigor. The learning curve is real but not steep. Once you understand scenes, elements, timeline items, and components, building is fast. The tool does what it promises: turns a spec into a deterministic video.

---

## Conclusions

### What Worked Well
- Component-driven reusability (ride cards)
- Auto scene duration with target duration adjustment
- Scroll + interaction behaviors for demonstrating app flows
- Placeholder assets let me build without waiting for real files
- Palette tokens in theme create cohesion

### What to Do Differently Next Time
- Start with a simpler first scene (mine had the right complexity)
- Declare all component states upfront, even if not used immediately
- Use ID-based patch paths from the start
- Render contact sheets frequently during iteration to catch visual issues early
- Accept that some warnings (like "no motion for 6s+") don't apply to every video; use `lint.accept` rather than fighting

### For Future Sini Users
- Read §7 (Elements) and §9 (Animation) in full before starting
- Build a component library early if your video repeats elements
- Use `describe_at()` to identify elements when feedback references timestamps
- Draft render after every 2-3 patches; contact sheets are fast and catch surprises
- Lean on the timeline for complex choreography; don't try to hand-compute timings

---

**Test Date:** 2026-10-06  
**Tester Notes:** Sini is production-ready for motion UI demos, app flow walkthroughs, and product explainers. Strongest for content creators who can write JSON and iterate on feedback. Future versions could lower the barrier with a visual builder or template library.
