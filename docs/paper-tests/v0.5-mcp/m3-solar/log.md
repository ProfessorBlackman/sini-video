# Sini test log: m3-solar (Accra Solar Co. 2026 in numbers)

Format 1:1, 12.7 s, final version **8**. Draft render: `out/draft.mp4` (540x540, 15 fps, 191 frames, 3.7 s to render).

## 1. What I built

Theme: palette forest/leaf/deep/lime/sage/mint/white/paper. Fonts are Bricolage Grotesque (display) and Inter Tight (body). Motion is `editorial`, grain 0.04. Signature transition is a `wipe` at 12° with a lime bar, 0.55 s, ease `quart.out`. The video ends on a 0.3 s fade to forest.

1. **intro (2.4 s)**: radial leaf-to-forest background. A large lime circle bleeds off the top-right corner as a "rising sun" (`scaleIn` from 0.6, then the ambient `drift`). Top-left kicker label "Accra Solar Co." uses `fadeUp`. A bottom-left `stack` holds "2026" (display, 300 px, tight tracking, `wordReveal`) over "in numbers." (130 px, mint, `wordReveal`).
2. **installs (2.8 s)**: paper background. Label "Installs per quarter", then the title "120 to *410.*" (italic emphasis). A bar `chart` with Q1 to Q4 values 120/180/260/410: `highlight: Q4`, sage bars with a leaf highlight, and the `grow` enter with stagger.
3. **homes (2.5 s)**: forest background. A centred stack with the Lucide `house` icon (`popIn`), "2,400" at 280 px (`countUp`, expo.out) and "homes powered" (`fadeUp`).
4. **growth (2.4 s)**: paper background in an editorial left-aligned layout. Top-left label "Growth since 2024", top-right `trending-up` icon (`drawOutline`). A lime rule (`wipeIn`, placed with `above`) sits over a 540 px "3.4x" (`countUp` with `from: 1`).
5. **outro (2.6 s)**: radial background, `sun` icon (`popIn`, then a raw `rotation` animation of 0 to 45°) and the wordmark "Accra Solar Co." (`wordReveal`).

Features used: theme palette/fonts/motion/transition/texture, radial gradients, stacks, anchors with insets and negative-inset bleed, relative `above` layout with `offset`, chart + `grow`, `countUp` (including `from`), icons, `drawOutline`, `wipeIn`, `drift`, a raw `animate`, `video.end` fade, patches (`set`/`add`/`remove`) and a full-spec replace.

Versions: v1 was the first draft (17.6 s). v2 was a full rewrite to fixed durations and a stronger design. v3 and v4 rebalanced timing for reading time. v5 to v7 rebuilt the growth scene and fixed its alignment. v8 set the wipe easing.

## 2. Tool errors, warnings, surprises

- There were no hard errors. Every patch validated first time.
- Lint on v1: `targetDuration 12s can't be reached: the video is 17.60s (long by 5.60s).` All-`auto` scenes with reading time, plus a 5.1 s outro, overshot badly. I removed `targetDuration` and moved to fixed scene durations that I tuned against lint.
- Lint on v1: `'inst-label' has a contrast of 4.1:1 against its background (minimum 4.5:1).` I added a darker `deep` green for labels on paper.
- Lint on v2: reading-time warnings, e.g. `'outro-h' is readable for 0s but needs about 1.4s (3 words).` The cause was the incoming transition plus the end fade eating the whole readable window. I started the text enters earlier, made them shorter, shortened the fade and lengthened the outro (it took two rounds: `readable for 1.2s but needs about 1.4s`).
- Lint on v5/v6: `'growth-num' is closer than 71px to the edge of the frame.` My own error: I thought I'd changed the horizontal inset, but I re-sent the same `[70, 80]` and it was the 70 px *bottom* inset that tripped it. The message doesn't say which edge, which would have saved a round. (Also, the message says 71px while the rule is 72.)
- `validate_video` accepted `style.size` on a `chart`. The reference doesn't list it for charts. `get_layout` then reported `fontSize: 34` for the chart, so it does appear to work, but this is undocumented.
- Output paths come back as `/work/.sini-tests/...` (container path), not the host path. That's a bit confusing when reporting files to a user.

## 3. Rendered differently from what I expected

- **Wipe transition has dead time at the start (default ease).** On v7, at 2.42/2.47/2.52 s (installs entering at 2.4 s, wipe 0.45 s), the frame was still 100% intro. The wipe edge first appeared around 2.57 s and then swept to about 85% by 2.65 s. Roughly the first third of the transition showed nothing, which reads as a hesitation at each cut. Setting `theme.transition.ease: "quart.out"` fixed it (at 2.45 s the edge was already about 30% across). The reference doesn't say what the default transition ease is.
- `countUp` on the chart overshoots oddly mid-grow. At 4.95 s on v1 the Q4 value read 409, and at 3.3 s on v2 Q3 read 96 while Q2 read 135. That is stagger working as designed, but the values counting at different moments looked busy in stills. It's fine in motion.
- The text box includes the glyph side bearing, so a 540 px "3.4x" anchored at an 80 px inset shows its ink at about 88 px. Matching the visual left edge of the label above needed trial and error with `offset`. This was expected, but the tools give no "ink box".
- `drawOutline` on the `trending-up` icon looks like two stray dots in its first frames (8.2 s on v7). It's harmless in motion, but stills look like a glitch.
- I first thought the contact sheet drew chart labels smaller than `render_frame` did. Measuring proved me wrong: it's just thumbnail scale. No real discrepancy.

## 4. Workarounds

- **Fixed durations instead of `auto` + `targetDuration`.** `auto` with reading time can't get five scenes of stats under about 17 s, and `targetDuration` can only shrink holds. I picked fixed durations and used lint's reading-time warnings as the feedback loop.
- **A custom `deep` palette colour** to pass the contrast check for small labels on paper.
- **`offset` on the rule** to line it up with the visible glyph edge of "3.4x" rather than its box.
- **Transition easing override** to remove the dead start of the wipe.
- **Dropped invented copy.** The v1 outro tagline ("Powering Accra, one roof at a time") was invented, so I removed it rather than ship unapproved copy. The installs headline "120 to 410." only restates brief figures; I noted that in `notes`.

## 5. Wishes

- A transition's default ease and timing curve documented, or a sane default with no dead first third.
- Edge-specific lint messages ("bottom edge: 70px").
- `get_layout` returning an ink/glyph bounding box for large display text, so optical alignment doesn't need guessing.
- Chart styling documented: label/value font size, bar radius, bar gap, and hiding the baseline or axis labels.
- A `targetDuration` mode that can also tighten text-enter timings, or a lint hint saying "minimum achievable duration is X s".
- A countUp option for charts to start all values together, or to count only after each bar lands.
- Host-relative output paths.

## 6. Ratings

- **Final video: 4/5.** It's clean and confident and on-palette, the hierarchy is clear, each stat gets its moment, and the growth scene breaks the centred-layout monotony. It falls short of 5 because the homes scene is a fairly standard centred-stat card, the 0.3 s fade is a bit abrupt, and there's no sound or extra flourish (out of scope).
- **Tool experience: 4/5.** The reference was sufficient on its own. Patches are pleasant, and validate, lint, layout and contact sheet make a tight loop, with lint catching real issues (contrast, reading time, edge). Renders are fast (3.7 s draft). It loses a point for the undocumented default wipe easing that creates dead time, the vague edge warning, `targetDuration` being unable to reach a realistic target, and undocumented-but-accepted chart `style.size`.
