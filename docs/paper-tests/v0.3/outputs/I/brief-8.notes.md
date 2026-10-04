# Brief 8: Nonprofit Year-in-Review — Authoring Notes

## Guesses

**Colour scheme** (§4.1)
- Brief provides no colour specification for the nonprofit. Chose green (#2E7D32, "primary") and orange (#FF9800, "accent") as conventional impact/energy colours for nonprofits. These are pure inference from sector context, not from brief.

**Layout: 3-column grid for stats** (§7.2, §7, containers)
- Brief says "highlight" the three numbers but doesn't specify layout. For 16:9 landscape, a 3-column grid is proportional. Alternative: 2 rows or a vertical stack. Chose 3 columns as visually balanced for landscape.

**Bar chart highlighting** (§7.3, charts)
- Brief does not specify which bar (if any) should be highlighted. Chose `highlight: "Q4"` as the final, largest quarter, which creates natural story progression (performance improving over the year). This is editorial inference.

**Duration allocation and pacing** (§3, §6)
- Set `targetDuration: 20` to fit the specified 20 seconds. Divided into two "auto" scenes so Sini stretches holds to reach target.
- Scene 1 (stats): ~9–10 seconds (heading + three countUp animations staggered).
- Scene 2 (chart): ~10 seconds (chart grow animation, then hold).
- Without `targetDuration`, video would likely run 14–16 seconds due to short animations.

**Stagger timing for stat cards** (§8, §9.2)
- Each countUp starts at `prev.enter.end+0.15`, creating a 0.15s overlap/stagger. Brief silent on whether stats should appear together or in sequence. Chose sequence for visual interest.

**countUp duration** (§9.2)
- Set each number's countUp to 1.2 seconds. This is a guess; brief does not specify animation speed. 1.2s feels reasonable for three 3–5 digit numbers.

## Invented

- **Stat card styling**: Card backgrounds use `fill: "primary/0.12"` (faint tinted background) and `radius: 20` (rounded corners). Not specified in brief; chosen for modern card UI.
- **Chart bar stagger**: `stagger: 0.18` divides the grow animation across four bars with this delay per bar. Brief does not specify animation timing.
- **Motion personality**: Chose "calm" (cubic.inOut easing, 1.1s base duration) to suit year-in-review tone. Brief says no motion preference; this is thematic interpretation.
- **Text wrapping**: Heading is "This year's\nimpact" with manual line break. Brief says only "year-in-review" without copy, so this is invented.
- **Spacing and padding**: All gap, padding, inset values are invented to achieve balanced 16:9 composition.

## Missing

- **Context or mission statement**: Brief provides raw numbers but no explanation (e.g., "We served 12,000 meals to food-insecure families"). No room in the DSL to add this context without extending the copy, so numbers stand alone.
- **Year label**: Video does not specify which year ("2024", "2025", etc.). Brief refers to "this year" but does not state the year.
- **Chart legend or units**: Chart bars are unlabeled for values (rely on size and numbers above bars). Brief does not ask for this detail.
- **Call to action**: No CTA button, donation link, or next step. Year-in-review videos often end with "Support us" or similar. Brief does not request it, so omitted.
- **Donation amount or impact metric**: e.g., "GH₵ 50,000 raised" or "Impact per meal: GH₵ 2.50". Brief specifies only activity counts, not financial data.

## Hard Parts

**1. Time reference across scenes** (§8)
- countUp in scene 1 uses `"prev.enter.end+0.15"` to stagger the second and third stats. This reference is **scene-local** (§8: "References must point to the **same scene**"), so it works only within the `impact-stats` scene.
- The chart in scene 2 cannot reference the countUp end times; it must use absolute `at` time. Chart uses `at: 0.5` to start after title settles.

**2. Animating text numbers with text context** (§7.1, §9.2)
- countUp animates only the **first number** in the content string, keeping the rest static. For "12,000", the entire number is first and animates. For "340 volunteers" (if I used that format), only "340" would animate and "volunteers" would appear static mid-animation, which looks odd. Solved by separating number and label into two text elements within the card.

**3. Grid layout and child sizing** (§7, containers)
- Children of a grid ignore their own placement keys but keep size keys (§7: "Children of `stack` and `grid` ignore their own placement keys but keep size keys").
- Each stat card (a stack) sizes itself with `padding: 40`, but the grid will position and space them. Must not set explicit `width`/`height` on cards; they size to content + padding. This required careful reading to avoid over-constraining.

**4. Chart data format and precision** (§7.3, charts)
- Chart `data` is `[["label", value], ...]`. Values are integers (2100, 2800, 3300, 3800). `format: "0,0"` means thousands separator with zero decimals. This matches brief exactly and required no guessing, but the format string syntax is not detailed in the reference (had to infer from example).

**5. "Calm" motion personality side effects** (§4.3)
- `motion: "calm"` sets `duration: 1.1` (base), `stagger: 0.12` (default per-part stagger), and default text enter `fadeUp`. The countUp and grow animations may be slower than ideal for a 20-second video. No way to globally override just easing without repeating `ease` in every animation. This is a tradeoff: calm motion = elegant but possibly sluggish.

## What the reference doesn't address

- **Font licensing for non-bundled fonts**: The reference lists bundled fonts (Inter Tight, Space Grotesk, etc.) but does not detail how to reference custom fonts if needed. Stayed with bundled fonts.
- **Aspect ratio for card photos in stat cards**: If I wanted to add an icon or image above each stat number, the DSL supports it, but no guidance on sizing images within stacks. Avoided by keeping cards text-only.
- **Accessibility of chart labels**: The chart element's `style.color` colors the labels, but no guidance on contrast or readability. Chose light text on dark background (guaranteed good contrast) and relied on the bundled fonts' design.
