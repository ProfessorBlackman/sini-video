# u1-perfume: Sini test log

## 1. What I built (final: version 8, `out/draft.mp4`, 15.00s, 16:9)

I had no assets, so the bottle is built from vector primitives. It is a reusable `bottle` component: gold gradient cap with a moving shine strip, collar, translucent glass body with stroke, amber liquid gradient, a soft "liquid-core" glow, a meniscus line, a thick glass base, left and right edge highlights, a bone paper label ("NOIR / Eau de Parfum"), and a `glint` strip for light passes.
The bottle sits inside a `studio` component: a radial charcoal wall, a radial amber wall (`wall-warm`, opacity 0 by default), a large soft light-sweep blob, a black floor, a mirrored bottle instance (`scaleY: -1`, opacity 0.45, blur 3) faded out by a gradient overlay, and a horizon line. Every scene puts one studio inside a `group` and drives a `camera` behavior on it. Transitions are 0.45s crossfades, grain is 0.05, vignette 0.5, and the video ends on a 0.6s fade to black.

| Scene | Time | Content |
|---|---|---|
| reveal | 0–3.7 | Fade up from black. The camera pushes in from 1.0 to 1.22 (sine). A soft light sweeps across the wall behind, and a glint travels across the glass. |
| macro-cap | 3.7–5.5 | Camera at 2.6–2.85× on the collar: gold cap, glass shoulders. The cap highlight slides across the metal. |
| macro-label | 5.5–7.3 | 2.9–3.15× on the label, with a glint passing over the glass. |
| macro-liquid | 7.3–9.1 | 3.0–3.3× on the base: amber liquid, thick glass bottom, and its reflection in the black surface. The liquid glow drifts and the meniscus bobs. |
| turn | 9.1–11.5 | The wall cross-dissolves from charcoal to warm amber. A "slight rotation" is simulated: the bottle squashes in scaleX (1 → 0.84 → 0.95), the label slides off-centre and compresses, and the edge highlights migrate. The camera eases out 1.35 → 1.2. |
| hero | 11.5–15 | Amber wall, product centred, slow pull-back 1.12 → 1.04, a final glint, and the signature "NOIR · EAU DE PARFUM" tracks in on the black floor. |

Features used: components (nested, 2 levels), component paths (`s5/b/label`), the `camera` behavior with nested focus targets, raw keyframe animations (x / opacity / scaleX arrays), `trackIn`, `fadeIn`, linear and radial gradients, opacity tokens, blur, theme texture, crossfade transitions, and the end fade.

## 2. Brief vs delivery

- **Minimalist bottle on a reflective black surface:** Delivered as an illustrated vector bottle with a mirrored, faded reflection. It is a stylised render, not photoreal.
- **Slow push-in with dramatic soft light sweeping across:** Delivered with a camera push, a soft light blob sweeping the backdrop, and a glint across the glass. The light doesn't wrap the 3D form; it is a 2D highlight.
- **Macro shots of glass, label, liquid:** Delivered as three close-ups via the camera. Being vector, the "macro" lacks real texture, refraction or caustics.
- **Bottle rotates slightly:** The biggest gap. Sini has no 3D, so true rotation is impossible. I faked a quarter-turn feel with a scaleX squash, the label sliding and compressing, and highlights migrating. It reads as "something shifts", not convincingly as a turn.
- **Background from dark charcoal to warm amber:** Fully delivered, in the turn scene.
- **Clean hero shot, product centred:** Delivered.
- **Brand name:** The brief gave none. "NOIR" and "Eau de Parfum" are placeholders, listed in `notes`.
- **Format:** 16:9 cinematic was my choice. The brief didn't specify one.

**What I'd tell the client:** "This is a motion-design animatic built from an illustrated bottle. It locks timing, camera, light and colour journey. For the final ad, send product photography (ideally a turntable sequence of 8–12 angles) or a 3D render. The rotation and macro glass detail in particular need real imagery or CG; the current rotation is a 2.5D cheat. Please confirm the brand name and the aspect ratios you need."

## 3. Tool errors, warnings and surprises

- **Biggest surprise: gradient fills on `shape` elements render nothing.** In v1, every gradient-filled shape was invisible: rect, circle and ellipse, linear and radial, with or without alpha tokens, top-level or inside a component. The frame was black apart from the solid-filled pieces. `validate` passed and `lint` said nothing. I isolated it in v2–v4 with test elements:
  - a `shape` with `{"linear": ["honey","ember"]}` was invisible;
  - a `shape` with a solid `"amber"` fill rendered;
  - a `group` with no children, a size and the same gradient fill rendered.

  The reference (§4.1) says gradients work "anywhere a colour is accepted". Workaround: every gradient shape became an empty `group` with `style.fill` and `radius`.
- **`get_layout` output was too large for the tool result** (74,537 chars, 3,955 lines), because components multiply elements (204 elements). It was saved to a file and I had to filter it myself. A `filter`/`ids` parameter would help.
- **Lint false positives for product details.** Lint repeatedly warned that the bottle-label text was too small, didn't have enough reading time, and that the mirrored reflection's label "extends past the canvas" (`'s1/refl/name' extends past the canvas (894.7,1236 130.7×51.3 on 1920×1080)`). The label is product art, not copy, and the reflection is intentionally cropped. There is no way to mark text as decorative or exempt it from lint, so I documented this in `notes`. `render_video` still reports "22 lint warning(s) still open".
- **The signature reading-time warning was legitimate.** The end fade plus the late enter left 1.0s against the 1.7s needed. I fixed it by retiming the scenes.
- The `get_reference` description doesn't mention the `section` parameter, and the tool's schema shows no parameters, but it works.

## 4. Rendered differently than expected

- Gradient shapes were invisible (see 3).
- **Reflection placement.** `scaleY: -1` flips around the element's own centre, so the mirrored bottle only shows its base just below the floor line. That happens to be physically right, but I had to reason it out: the lint "extends past canvas" is a consequence of it.
- **Light-sweep disc edge.** The first light sweep (an 800px radial disc, blur 30) showed a visible circular edge. It needed blur 90 and a three-stop falloff to read as soft light.
- **Crossfades between very different camera scales** (macro → wide) produce a busy double exposure mid-dissolve. I shortened them to 0.45s and kept them; a hard cut might be better for some editors.
- **Turn scene.** Halfway through the warm-up, the charcoal-to-amber mix passes through a muddy brown-grey.

## 5. Wishes

- Gradient fills on shapes (the bug), or at least a validate or lint error when a fill won't render.
- Some 3D or pseudo-3D: `rotateY` with perspective on groups. This alone would make the "rotates slightly" brief achievable.
- A `clip` / `mask` option on groups, so glints and light sweeps can be confined to the glass silhouette.
- A built-in `reflection` style (mirror plus fade) on elements.
- Animatable gradient stops, or animating a scene background colour, for background colour journeys without layering two walls.
- A lint suppression per element (`"lint": { "ignore": ["reading-time","small-text"] }`) or a `decorative: true` flag for text.
- `get_layout` filtering by id prefix.
- Blend modes on light layers (`screen`) were available, but there was no light or "spec highlight" primitive. A soft-light element would help product work.

## 6. Ratings

- **Video vs brief: 3/5.** The structure, pacing, camera language, colour journey (charcoal to amber), reflective floor and centred hero all match the brief, and it looks clean and premium as an animatic. But it is an illustration, not a cinematic product film: no real glass refraction, the macro shots are flat, and the "rotation" is a weak 2.5D cheat.
- **Tool experience: 3.5/5.** Components, component paths, the camera behavior and patches were genuinely good: building six camera setups on one reusable studio was fast, and patching by id was pleasant. Contact sheets and frames were quick and useful. It loses points for the silent gradient-on-shape bug, which cost four iterations and would have produced an all-black video if I hadn't looked; for noisy lint on decorative or component text with no way to silence it; and for the oversized `get_layout` output.
