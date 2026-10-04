# Brief 8 — Nonprofit year in review (authoring notes)

The brief's "Exercises" column expected a missing chart element, but v0.3 has `chart` with `kind: "bar"` and the `grow` preset. I used it directly; no shapes or template were needed.

## Guesses

- **`countUp` on a text that's inside a component, driven from the timeline.** I removed `enter` from the component's `num` and started `countUp` on `"s-vol/num"` in the timeline instead. That way each card's count starts in sync with its card fading in. §9.3 says a target can be a component path, and §7.1 says a timeline enter preset hides the element until it starts. I assumed both hold for a component's inner element.
- **Referencing a list-target timeline item for timing.** I used `"cards-in.start"` and `"cards-in.start+0.2"` (the stagger) to sync each card's countUp. It's unclear whether `s-vol.enter.start` would work when the enter comes from a timeline item with a list target, so I avoided it and hand-added the 0.2 stagger.
- **`countUp` duration semantics.** `countUp` doesn't split into parts, so I assumed `duration` is the full count time (1.8s for the big 12,000 number).
- **`countUp` and text width.** I assumed that while counting, the number reserves its final width (tabular figures, or a box laid out at the final value), so "1,234" → "12,000" doesn't shift the stack or the label below. The reference doesn't say.
- **Reading time for a counted number.** I assumed "12,000" counts as 1 word, and that reading time starts after the count finishes (enter end).
- **Ambients and `auto`.** `kenBurns` on the intro background and on `m-img` runs "to the end of the scene". I assumed this doesn't extend an auto scene's length (otherwise it's circular).
- **`targetDuration` 20.** My hand estimate of the auto scenes is about 20.2s: intro ≈4.0, meals ≈3.3, people ≈3.8, quarters ≈4.6, thanks ≈4.5. I assumed Sini trims holds to hit 20 and that the fade end (`end.duration 0.6`) happens inside that time, not added on top.
- **`chart` `format: "0,0"`.** Taken from the §13.3 example. I assumed it gives "2,100".
- **Chart axis and label space.** I assumed the 1000×720 box includes the category labels (Q1…Q4) and value labels, and that there's no y-axis or gridlines. The reference says Sini "computes bar sizes, label positions and the baseline" but not whether labels sit inside or outside the box.
- **`grow` duration is per bar.** From §9.2 "duration is per part". The total is 0.8 + 0.15 × 3 = 1.25s.
- **`layout.maxWidth` on a text that's a child of a stack.** §7.3 says stack children "ignore their own placement keys but keep size keys". I assumed `maxWidth` counts as a size key.
- **Stack `width: 560` with `anchor: "left"` and `inset: [0, 140]`.** I assumed the vertical inset is ignored (centred axis) and the 140 sets the left margin.
- **Interpolation in a component param.** `"*{{label}}*"`: I assumed substitution happens before markdown italics are parsed.
- **The radial gradient with a bare token `"night"`** as the last stop: I assumed opacity 1.
- **The `stat` component name is the same as in §13.3.** I assumed that's fine, since components are per video.

## Invented

- No keys, presets or types outside the reference, as far as I can tell. Borderline:
  - `"distance": 20` on `fadeUp`: documented param.
  - `"pan"` on `kenBurns`: documented.
  - `"from": "right"` on `wipeIn` for the image: documented values.
  - `"vignette": 0.2`: documented range 0–1.
- Copy: headlines listed in `notes`. The nonprofit name and year are deliberately left out.

## Missing

- **Highlight a bar after the chart grows.** I wanted to pulse or callout the Q4 bar ("+81% since Q1"). Bars aren't addressable: there's no `meals-chart#Q4` path, and hotspots are only for images. I used `highlight: "Q4"` (a static colour) instead and kept the growth fact in the side text.
- **Axis or gridlines.** No option to show or hide a y-axis or gridlines. I left the defaults.
- **Overriding a component child's enter from an instance.** No way to pass timing into a component (other than putting `{{param}}` in a string `at`, which felt too hacky). I moved the countUps to the scene timeline instead.
- **Nonprofit identity.** No logo or name was given. I used generic copy and flagged it in `notes`.
- **Number formatting for counts like "12,000+".** Not needed, but there's no format template for text numbers like the one on charts.

## Hard parts

- **Horizontal fit on the meals scene.** "12,000" at 240px in Fraunces: I guessed about 0.6em per digit, which makes it about 860px wide starting at x=140. The image starts at 1920 − 140 − 680 = 1100. I first tried 300px (≈1080px wide), which would have overlapped the image. Pure guesswork without `layout`.
- **Chart scene split.** Left text column 140 + 560 = 700, chart starts at 1920 − 140 − 1000 = 780, so an 80px gutter. "Every quarter," at 72px in Fraunces: I guessed about 14 chars × 0.5em ≈ 500px, under 560. I dropped the `title` role (104px) because it would wrap badly.
- **People scene height.** Title (104 × 0.95 ≈ 99) + gap 72 + card (48 + 180 × 0.92 + 12 + 64 × 1.05 + 48 ≈ 341) ≈ 512px, which fits 1080. Two 560px cards + 48 gap = 1168px wide, inside the 1920 − 2 × 72 limit.
- **Total duration.** Getting close to 20s needed summing reading times (0.5 + 0.3 × words), editorial enter durations (0.75, stagger 0.08) and preset stagger arithmetic per scene by hand. Each scene's total is a ±0.5s estimate.
- **Syncing countUp with a staggered list enter.** I had to hand-add the stagger offset (`+0.2`) to line up the second card's count with its card. If the stagger changes, the two drift apart.
