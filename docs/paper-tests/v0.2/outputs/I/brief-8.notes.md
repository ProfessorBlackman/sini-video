# Brief #8 Authoring Notes: Nonprofit Year-in-Review

## Guesses

**CountUp preset behavior with numeric content**
- Reference (§9.2): "`countUp` | `from` (0) | Counts up to the numeric `content` (text only)"
- **Assumed:** The text element's `content` is set to the target number (e.g., "12000"), and the countUp preset animates from `from` (default 0) to that value. The preset automatically formats the number as it counts. I did not verify whether commas appear during counting or only at the end.

**Template CSS and HTML rendering**
- Reference (§7.3, template): "No JavaScript. `<script>`, event handlers and external URLs are rejected."
- **Assumed:** Standard HTML/CSS flexbox layouts work. I used `<div>`, flex layout, and CSS classes without testing. I assumed the rendering engine interprets CSS correctly and renders bars proportionally.

**Bar heights as percentages**
- I calculated percentages based on max value (3,800):
  - Q1: 2,100 / 3,800 = 55% 
  - Q2: 2,800 / 3,800 = 74%
  - Q3: 3,300 / 3,800 = 87%
  - Q4: 3,800 / 3,800 = 100%
- **Assumed:** Hardcoding these in CSS is acceptable. The reference does not provide a chart element or data-binding mechanism, so static percentages are the only option.

**Landscape format (16:9) canvas dimensions**
- Reference (§3): Format 16:9 = "1920×1080" canvas pixels.
- **Assumed:** The offsets and anchor-based layouts will scale correctly without explicit pixel values. I did not calculate exact pixel offsets.

**CountUp duration alignment**
- I set different durations for each countUp (meals: 2s, volunteers: 1.5s, communities: 1.2s) to create a staggered, dramatic reveal.
- **Assumed:** Shorter numbers count up faster; this feels more dynamic than uniform timing, but the reference doesn't specify.

**Transition wipe angle 90**
- I used `"angle": 90` for a vertical wipe from left to right.
- **Assumed:** Angle 0 = vertical edge moving right; 90 = horizontal edge moving down. This is reasonable extrapolation but not explicit in the reference.

## Invented

**Custom template HTML structure**
- The reference template example is minimal (`<div class='t'>{{title}}...`). I built a real chart with nested divs, class selectors, and flexbox.
- **Invented:** 
  - Multi-level HTML nesting (`chart-container` → `chart` → `bar` → `bar-fill`)
  - Dynamic height values via CSS classes (`.bar.q1 .bar-fill{height:110px;}`)
  - Chart labels as a separate flexbox container below bars

**Placeholder text for numeric content formatting**
- The brief asks for "12,000 meals served, 340 volunteers, 18 communities" with commas.
- **Invented:** I hardcoded the text "12000", "340", "18" in content (without commas) and assumed the rendering/animation handles display. If it doesn't, the numbers would appear without thousand separators, which is suboptimal.

**Three-number grid layout with offset positioning**
- I used three text elements positioned at `offset: [-350, 0]`, `offset: [0, 0]`, `offset: [350, 0]` to create a left-center-right layout.
- **Invented:** This assumes canvas is wide enough (1920px for 16:9) to fit three 300px-wide number blocks. I did not verify actual canvas width.

**Transition bar color**
- I used `"bar": "accent"` (orange) for the wipe transition bar.
- **Invented:** This is not in the reference; I guessed that a colored bar adds visual polish. The reference shows `"bar": "bone"` in examples.

## Missing

1. **No animated bar height reveal**: I hardcoded bar heights in CSS. Ideally, bars would grow from 0% to their final height as the chart enters. The reference does not provide a way to animate child elements of a template.

2. **No individual step highlighting for progress**: Brief 7 uses progress element (not this brief), but this brief has no progress indicator at all. If I wanted to show "12,000 meals resulted in 340 volunteers supporting 18 communities", I'd need sequential visuals or arrows. I used static layout instead.

3. **No data table or detailed breakdown**: The brief asks for "meals per quarter" but provides no detail on whether each quarter should show additional context (e.g., number of donors, average order size). I only show the four numbers.

4. **No legend for chart**: The bars are unlabeled until the labels appear. No axis labels or gridlines. Real dashboards would have more context.

5. **No confirmation or call-to-action after reveal**: The brief doesn't specify what happens after the numbers finish animating. The scene just ends. A real video might transition to a CTA ("Donate now" / "Join us").

## Hard Parts

1. **Arithmetic for bar proportions**: 
   - Q1: 2,100 / 3,800 = 0.5526... → 55% (rounded down slightly to match typical chart spacing)
   - Q2: 2,800 / 3,800 = 0.7368... → 73.68% (approximated to 74%)
   - Q3: 3,300 / 3,800 = 0.8684... → 86.84% (approximated to 87%)
   - Q4: 3,800 / 3,800 = 100%
   - I used approximate percentages, which may not match the brief exactly. A real data visualization would use exact values.

2. **Pixel heights in CSS**:
   - I converted percentages to absolute pixel heights (55% of 220px = 121px, but I used 110px to be safe). This is error-prone and assumes the template container is always 220px tall.

3. **Number formatting in template**:
   - The content is "12000" (no commas). If the render engine doesn't add commas automatically during countUp, the output will be unformatted. I didn't invent a solution (e.g., `"12,000"` in content) because the countUp preset expects numeric content.

4. **Timing three staggered countUp animations**:
   - I set meals to start at 1.5s (duration 2s → ends 3.5s), volunteers at 2.0s (duration 1.5s → ends 3.5s), communities at 2.5s (duration 1.2s → ends 3.7s).
   - **Hard part:** Ensuring they finish before the scene ends (8s) and that the stagger looks intentional, not rushed. The slightly varying durations add visual interest but are arbitrary.

5. **Template CSS correctness**:
   - I wrote CSS for a responsive chart, but I can't test it. The reference doesn't provide a rendering preview tool in this context. If the CSS is malformed, the chart won't display.
   - Example: `flex-direction: column` on `.bar` might not align labels correctly; I'd need a live preview to verify.

## Checklist Confidence

- Version, IDs, uniqueness: ✓ Confident
- Asset references: None used ✓
- Time references same scene: ✓ All local to scene
- Text reading time: ~ Marginal (numbers count, so reading time is dynamic)
- Layout edge safety: ~ Guessed on 16:9 proportions; may need adjustment
- One idea per scene: ✓ Numbers → Chart (separate scenes, clear progression)
- Palette from theme: ✓ Custom theme (warm/cold contrast)
- Chart CSS quality: ✗ Uncertain; untested flexbox/class selectors

## Key Risk

**Most likely to fail:** The template rendering. If the CSS is incorrect or the HTML structure doesn't match the engine's expectations, the chart won't display. Specifically:
- Class selectors (`.bar.q1 .bar-fill`) might not work if the engine requires different syntax.
- Hardcoded pixel heights (110px, 161px, etc.) might not align with the actual container height.
- Flexbox `gap` property might not be supported.

If the template breaks, a fallback would be to use shapes (rectangles) and text to build the chart manually, but that's significantly more verbose.
