# Brief 1: Crumb & Co. cinnamon roll box (15 s, 9:16 reel)

## First attempt
- validate: **0 errors**
- lint: **4 warnings**: `safe-zone` x2 (hook-title right edge; new-badge top/right), `edge-margin` x1 (new-badge), `low-contrast` x1 (new-badge, 4.0:1, white on the berry red)
- Video length 15.00 s (targetDuration 15)

## Round 1: contact sheet review and restructure
- **Checked:** the first contact sheet. The hook was 4.5 s of static type with the bottom 45% of the frame empty. The product scene was a flat beige placeholder that read as nothing. The CTA was a small cluster of tiny text in the middle of a large orange field. The 22 px `label` text was unreadable at reel size, and the product didn't show up until about 5.5 s.
- **Changed:**
  - Added a `roll` component, a cinnamon roll drawn from concentric stroked circles with an icing pill, so the hook has a bakery visual even without photos. It pops in and rotates slowly.
  - Added a "Fresh for the weekend" scene on cocoa to carry the "weekend" message.
  - Made the CTA title `display` size and enlarged the button (size 48 → 56).
  - Raised the `label` role to 30 px, darkened the berry red to fix contrast, and inset the badge.
- **Why:** gives the hierarchy one hero per scene, brings the product idea in earlier, and makes the small text readable.

## Round 2: overlap found visually, not by lint
- **Checked:** the sheet showed the drawn roll **sitting on top of the hook headline**. `layout` showed the component instance's group as 260×260 with children at positions outside the group box, because instance `layout` *replaces* the root's layout, so my `width/height: 520` on the component root was lost. **Lint reported no overlap.** `layout` also showed hook-title was 812 px wide at 150 px, so it crossed the reels right margin.
- **Changed:**
  - Put `width`/`height` on the instance layout.
  - Set the `display` role to 136 px.
  - Cut "presents" and shortened the weekend copy, because lint said targetDuration was short by 0.6 s (then 0.2 s).

## Round 3: timing and pacing
- **Checked:** the sheet at 0.63 s showed only a tiny label, and the product scene opened on a lone kicker for about 1 s. `at` and `layout` confirmed that the default `prev.enter.end-0.2` chain was staggering everything late.
- **Changed:**
  - Gave explicit `at` times: the title at 0.1 s, the box at 0.5 s, and the badge at box end.
  - Removed the "Introducing" kicker. Lint then came out clean at exactly 15.00 s.
  - Added `drift` to the weekend title.
  - Replaced "Limited boxes", an invented scarcity claim, with "The weekend box".

## Round 4: polish
- **Checked:** the weekend scene was a lone centred line on a dark field, and the CTA brand name was small and came in late.
- **Changed:**
  - Moved the hook block down 80 px.
  - Added a second roll instance that slides up and bleeds off the bottom of the weekend scene, rotating.
  - Made the CTA button size 56 and the brand name 76 px, and timed the brand to the button's entrance.

## Final
- validate: **0 errors**; lint: **0 warnings**
- Video length: **15.00 s**, 4 scenes
- Draft render: **8.7 s** for 225 frames at 540×960 / 15 fps
- Remaining weaknesses:
  - The box placeholder is still a featureless gradient square, which is the weakest frame.
  - The CTA is still a fairly small centred cluster.
  - The circle transition is the only "playful" transition; it reads fine.

## Tools
- **Most helpful:**
  - The `sheet` caught the roll/title overlap that lint missed.
  - `layout` gave real text widths: the 812 px hook title, and the component group's wrong box.
  - The lint `targetDuration` message told me exactly how many seconds to cut.
- **Still guessed:**
  - How big the drawn roll should be, since components can't take numeric size params in a useful way.
  - The badge offset needed to clear the safe zone, which took two tries.
  - Whether `swing` on a badge would look good.
- `at` was useful for checking the visibility of individual elements, but it doesn't print scene start/end times, so I couldn't read off scene durations directly.

## Problems with Sini
1. **Lint missed an obvious overlap** between a component instance (a group of shapes) and a display text. The overlap check doesn't seem to cover groups/components, or shapes.
2. **Component root layout is silently replaced** by the instance's `layout`, so size keys on the root are lost. The resulting `group` reported 260×260 while its anchored children were laid out 520 px wide and outside the box. Either merge layout (as style is merged) or warn.
3. An auto-sized `group` whose children use `anchor` produces a nonsensical box (half the child size, mispositioned) with no warning.
4. The edge-margin message says "closer than 71px" but the suggestion says "at least 72px": an off-by-one wording inconsistency.
5. Lint text output has no codes; you need `--json` to see `safe-zone`, `edge-margin` and so on.
6. Placeholders render as a plain radial gradient; the `hint` is not visible at all, so a viewer or reviewer can't tell what the square is meant to be.
