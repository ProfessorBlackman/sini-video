# Ama Owusu Photography: portfolio reel (Sini test log)

## 1. What I built (final version: v3, 15.00s, 9:16)

Theme: warm editorial palette (ink, bone, stone, clay, sage, umber), Instrument Serif and Inter Tight, `motion: "calm"`, crossfade 0.8s as the default transition, grain 0.06 and vignette 0.15. `video.targetDuration: 15`, `safeZone: "reels"`, ending with a 0.8s fade to ink. The three photos are `placeholder` assets (clay, umber, sage), each with a hint for the client.

- **Scene 1 `triptych` (fixed 5.0s, bone background):** a small uppercase `label` kicker "Ama Owusu Photography" (fadeIn). A horizontal `stack` of three `image` strips, 296×700, centred with an anchor. The strips enter through one timeline `fadeUp` preset with a list target and stagger 0.25. An italic subtitle "*Selected work*" is placed with `below`/`align: center`. A raw `animate` dims the outer two strips to 0.35 opacity, timed relative to the strips' entrance (`"strips-in.end+1.0"`), so the eye lands on the middle photo. A `drift` ambient preset moves the stack slowly.
- **Scene 2 `open` (fixed 4.2s):** a `matchCut` transition from `strip-2` to `background` (1.0s, expo.inOut). The middle strip grows to fill the screen. The background is the same photo-2 asset with a subtle bottom gradient overlay and `kenBurns` zoom 1.08.
- **Scene 3 `signoff` (auto, about 5.8s after targetDuration, bone background):** a centred vertical `stack` containing "Ama Owusu" (display 190, blurIn), a "Photography" label, a 220px `line` shape (wipeIn), and "Bookings open for *2027*" (subtitle, fadeUp). A `drift` preset scales the block up slightly (1.03) so the scene never sits fully still.
- `notes`: the photos are placeholders, and "Selected work" is copy I added.

Versions: v1 is the first full spec. v2 made the strips taller, made the label legible, enlarged the name, rebalanced timing and added drift. v3 tightened timing to hit 15s. Draft render: `out/draft.mp4` (540×960, 15fps, 225 frames, 7.4s to render).

## 2. Tool errors, warnings and surprises

- No validation errors at any point. The spec validated on the first try.
- v1 lint: `! kicker: 'kicker' has a contrast of 3.2:1 against its background (minimum 4.5:1). Use a lighter or darker text colour from the palette.` and the same warning for `discipline`. Fix: switched both to `umber` and raised their size to 26.
- v2 lint: `! video.targetDuration: targetDuration 15s can't be reached: the video is 15.50s (long by 0.50s). Cut copy, shorten animations, or raise targetDuration.` Cause: the signoff `auto` scene was long. Its texts entered late, and the 0.8s crossfade doesn't count as reading time. Fix: started the signoff text 0.1–0.4s earlier and shortened the fixed scenes to 5.0 and 4.2. v3 lint: `✓ No problems found; video is 15.00s.`
- Surprise: `get_reference` returned 57KB. That is more than the tool output limit, so the harness saved it to a file and I had to read that file in pieces. It also starts with "Status: Draft ... Nothing here is implemented yet.", which is confusing because everything I used worked.
- The tools report paths inside the container (`/work/.sini-tests/m4-ama/...`), not host paths. That is a minor point, but the paths can't be opened directly from the host.

## 3. Renders that differed from what I expected

- **Contact-sheet banding:** in every contact sheet, scene `open` (for example 6.09s, 7.03s, 7.97s, 6.30–9.20s) showed what looked like a hard horizontal seam across the photo-2 placeholder, at about 60% of its height. A full-scale `render_frame` at 6.5s (scale 0.5) and at 7.0s (scale 1) showed a smooth gradient with no seam. The seam seems to be a downscale or compression artifact in the contact sheet. It cost a verification round because it looked like a real rendering bug.
- **MatchCut edges:** at 5.16s (v1) and 5.6s (v3) the expanding strip shows a thin bone frame round all four edges until the very end of the transition. That is expected for an ease, but at 0.6s into a 1.0s transition it looks like a bordered card rather than an image opening up.
- **Strip entrance:** at 0.47–0.6s only strip-1 is visible, as a pale rectangle at the left with nothing else on screen. This matches the 0.25s stagger but looks lopsided for a moment.
- **Scene start:** before the v3 retiming, the signoff opened on an empty bone frame (about 10.17s in v2), because blurIn started at 0.5s while the crossfade was already done.
- **Placeholders:** they look like flat colour gradients, so the "hero" scene `open` is 4.2s of plain brown. I expected that, but it makes the most important shot impossible to judge before the real photos arrive.

## 4. Workarounds

- To hit 15s, I set fixed durations on the two picture scenes and left only the text scene on `auto`. Otherwise targetDuration would have stretched the triptych and the open-up shot unevenly.
- I moved the signoff text entrances under the incoming crossfade, because time under a transition doesn't count as reading time and was making the scene too long.
- I dimmed the side strips with a raw `animate` on opacity, because no preset means "de-emphasise the others". `focusCycle` cycles through items and then restores them, which is not what I wanted.
- I used `drift` on otherwise static blocks to avoid dead frames.

## 5. Wishes

- A `get_reference` that fits the tool output limit, or a section-by-section reference (for example `get_reference(section: "transitions")`).
- Contact sheets that don't introduce banding, or a note that they are lossy previews.
- A `matchCut` option to open edge-to-edge sooner, or a "fill" style that removes the frame border earlier.
- A `focus`/`dim-others` preset that holds, as a non-cycling `focusCycle`.
- A way for placeholders to show their hint text (a debug overlay), so a client preview makes clear "your hero photo goes here".
- Lint telling me which auto scene is causing the targetDuration overflow, and by how much.

## 6. Ratings

- **Final video: 3.5/5.** The structure matches the brief (triptych, then open-up, then sign-off). It is calm and editorial, with good type and a coherent palette, and the matchCut is the right move for "one opens up". With placeholders, though, the middle 4 seconds are a flat brown field. The kicker label is small on a phone, and the triptych is a bit static between the entrance and the dim. It will only really work once the real photos are in.
- **Tool experience: 4/5.** The DSL is expressive and predictable. The spec validated on the first try, patches were painless, lint was precise and actionable (contrast, targetDuration), and the draft render was fast (7.4s). Points off for the oversized reference, the misleading banding in the contact sheet, and the unclear interplay between transition time and auto-duration reading time.
