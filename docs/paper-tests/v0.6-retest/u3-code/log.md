# u3-code: "Code becomes a network, a city, a sphere" (20s, 16:9)

Final version: **v13**. Draft render: `u3-code/out/draft.mp4` (20.00s, 960x540 @ 15fps, 300 frames, rendered in 39.1s).

## 1. What I built

Format 16:9, 30fps. Palette: void #03050C, deep #0A1230, cyan #38E1FF, violet #8B5CFF, plus code colours. Fonts: JetBrains Mono for code. Theme grain 0.04, vignette 0.45, video `end` fade 0.8s. I built the spec with a Python generator in my scratchpad (needed for line geometry: each connection is a `line` shape with its midpoint, length and rotation computed) and sent it to Sini through `create_video`, `update_video` spec and patch ops (`addScene`, `remove`, `set`, `add`, `addTimeline`).

| Scene | Time | Content | Features used |
|---|---|---|---|
| `code` | 0–5.2s | Six lines of syntax-coloured pseudo-Python type in. From 2.2s, 22 characters lift out of the code: each is a separate mono `text` glyph placed exactly over its source character, while a void-coloured "eraser" rect hides the original. Glyphs drift, rotate, grow, turn cyan, blur, and fade. Where each lands, a glowing particle (white core plus blurred cyan halo) pops in. The code then blurs out, and 28 hairlines `wipeIn` between nearby particles so they start to form a network. | `typewriter` (cps 60, no caret), `[word]{token}` colour markup, raw `animate` keyframes (opacity/x/y/rotation/color/scale/blur), `blurOut` with list target and stagger, `wipeIn` on lines |
| `network` | 5.2–10.0s | A "3D" node graph in three parallax layers: back (36 small violet nodes, blurred), mid (24 cyan nodes), front (9 large, blurred bokeh nodes). Each layer scales from the centre at a different rate, so nodes stream outward past the camera, which reads as a fly-through. A few nodes pulse. | Groups as depth layers, raw `scale`/`rotation`/`opacity` animation, components (`nd4/6/7/8/14`, one glowing-node component per size, with a colour param), `pulse`, crossfade |
| `city-scene` | 10.0–14.6s | The network becomes a city. The faint violet node network stays in the sky. Below it: a perspective ground grid with a horizon glow, a back row of 19 dim towers, a mid row of 13 towers with light strips and spires, and 4 big framing towers in front. Towers grow up from the ground (`scaleY` from the bottom origin), lights fade in, rooftop nodes pop, and links wipe in between rooftops and down to the back row. Data packets travel along the links. Each layer scales at its own rate (front 1.9x, mid 1.35x, back 1.12x), so the camera keeps pushing in. | 5 parallax groups, `scaleY` grow with `origin: bottom`, `fadeIn`/`popIn`/`wipeIn` with list targets, repeating packet motion (`repeat: 2`), crossfade 1.0s |
| `sphere-scene` | 14.6–20.0s | Pull-back reveal: the sphere group starts at 3.2x scale and -25° and eases to 1x (expo.out), then settles to 0.94x. A wireframe globe: rim circle, 4 meridian ellipses whose `scaleX` yo-yos to suggest spin, 5 latitude ellipses, 29 glowing nodes on the grid intersections joined by links, a tilted orbit ring that rotates, a blurred pulsing glow, and a starfield. The video ends on a 0.8s fade to black. | Group scale/rotation, `repeat: -1` + `yoyo` + stagger, `pulse`, `popIn`/`wipeIn`/`fadeIn` |

Notes in the spec say that the code is invented and that "3D" is simulated, and explain which lint warnings I kept on purpose.

## 2. Brief vs delivery

- **Dark screen with lines of code**: delivered (dark editor look, line numbers, syntax colours, typed on).
- **Characters float off and become glowing particles**: delivered and convincing. Real characters visibly leave holes in the code and turn into glowing dots.
- **Particles form a three-dimensional network of nodes and connections**: partly delivered. The particles link up at the end of scene 1, then the network scene fakes depth with three parallax layers (size, blur and brightness by depth). It is a 2.5D illusion: nothing rotates in 3D and nodes do not occlude each other in depth. There is also a cut/crossfade rather than the same particles literally moving into the network.
- **Camera flies through the network**: approximated by scaling layers from the centre at different speeds. It reads as forward motion, but it is not a true camera path (no banking, no passing *between* nodes in perspective).
- **Network gradually transforms into a futuristic city**: approximated. A 1s crossfade, the network kept in the sky, rooftop nodes and links that continue the node language, and towers that grow up out of the ground. It is a "dissolve and grow", not a morph where nodes become buildings.
- **Pull back to reveal the whole network as a glowing digital sphere**: delivered as a 2D wireframe globe with a strong pull-back and some spin (meridians breathing). It is not a true rotating 3D sphere, and its nodes don't move with the meridians.

What I'd tell the client: "Sini is a 2D motion engine, so the 3D parts are stylised illusions built from parallax and perspective. The story beats are all there and the code-to-particles opening is literal. If you need real 3D camera moves through a volumetric network, or a morph from network to city, that needs a 3D pipeline (Blender, Cinema 4D, three.js). This cut can be the animatic or a lighter alternative." No audio was asked for, and none was added.

## 3. Tool errors, warnings, surprises

1. **Leading spaces in text are stripped when rendered, even ` ` (NBSP).** Code indentation vanished, but `get_layout` still reported box widths that included the spaces (e.g. code-1 width 816 = 34 chars × 24). Workaround: I dropped the stack and placed every line absolutely at `x = 560 + indent × 24`.
2. **Radial-gradient fills on shapes render as a dark, opaque-looking disc.** A circle with `{"radial": ["cyan/0.16","void/0"]}` (and later `["cyan/0.14","cyan/0"]` with `blend: "screen"` and `z: 500`) drew a big dark disc that covered the particles. Scene *backgrounds* with radial gradients worked. Workaround: removed it, and used solid translucent fills with `blur` for every glow.
3. **Linear-gradient fill on rects rendered as plain near-black** (towers with `{"linear": ["#12204A","void"]}` looked flat black). Switched to solid hex fills.
4. **Validation error (exact):** `scenes[3].elements[28].children[1].style.fill: Colour '#0E2A5A/0.55' is not hex or a palette token.` The `/opacity` suffix only works on palette tokens. Fixed by using 8-digit hex `#0E2A5A8C`.
5. **The from-value of a keyframe array applies from scene start.** This is documented, but it bit me: glyphs with `opacity: [1,1,1,0]` were visible from t=0, scattered over the code. Fixed with `[0,1,1,1,1,0]`.
6. **`blurOut` on a list target staggers with the theme default (calm, 0.12s)**, so the later code lines stayed sharp for about 1.3s longer. Fixed by setting stagger 0.04.
7. Eraser rects faded out too early, so the "holes" in the code refilled. That was my logic error, not a tool bug; I kept the erasers visible.
8. **Lint warnings I kept (29):** 22× overlap of `code-*` with `g-*` (intentional: each glyph starts on its source character), 6× contrast of the `ln-*` line numbers ("contrast of 3.0:1 ... minimum 4.5:1", intentional dim gutter), 1× reading time on code-1 ("readable for 2.1s but needs about 2.3s"). The reasons are in `notes`. `render_video` still lists them as "still open" even though notes explain them; there is no way to mark a warning as accepted.
9. **My generator hung** in a rejection-sampling loop that could never finish; I stopped it with TaskStop. My bug, not Sini's.
10. **Payload size.** Every line needs its own element, so specs were large (one scene patch was about 34KB). This made each iteration slow and token-heavy. Components helped for nodes but can't take numeric params.

## 4. Rendered differently from what I expected

- Leading whitespace and NBSP collapse (above).
- Gradient fills on shapes (radial and linear) look dark/opaque rather than glowing.
- `blend: "screen"` did not prevent the darkening of the radial circle.
- The first city version, with uniform towers in a single row and a sequential rooftop polyline, looked exactly like a **bar chart with a line chart on top**. I redesigned it with depth rows, spires, light strips and framing towers, and softened the sequential chain.
- `wipeIn` on rotated lines works well (it clips along the line's own axis).

## 5. What I wished the tools or DSL did

- A **line/path element defined by two points** (`from: [x,y], to: [x,y]`), or a polyline/curve, plus a `drawOn` progress. That would remove the midpoint/angle/length maths and shrink specs a lot. A "connect A to B" shape that follows pinned elements would be ideal.
- A **particle/scatter primitive** (N copies with seeded random positions, sizes and drift), or a `repeat`/`generate` construct in components with numeric params and expressions.
- **Numeric component params** (e.g. `{{r}}` in layout), so one node component could cover every size.
- Whitespace preservation for text (`whiteSpace: "pre"`), which code needs.
- Working **radial gradients on shapes**, and a real `glow` style (outer glow/bloom) instead of faking it with blurred duplicate circles.
- A **2.5D camera**: per-layer depth (`z` depth / `parallax` factor) so one `camera` behavior drives all layers with correct parallax, plus a simple 3D transform (rotateX/rotateY with perspective) for spheres and tilted grids.
- **Motion along a path** (move an element along a line or between two elements) for data packets.
- A way to **mark lint warnings as accepted** so final renders don't keep reporting them.

## 6. Ratings

- **Video vs brief: 3/5.** Every story beat is present and in order, the code-to-particles opening is literal and nice, and the city and sphere look clean and on-palette. But the core promise of the brief is 3D (a volumetric network, a camera flying *through* it, a morph into a city, a 3D sphere), and here it is a 2.5D parallax illusion with crossfades between stages rather than continuous transformations.
- **Tool experience: 3/5.** Validation errors are precise, patches are atomic, versioning and contact sheets are excellent for iterating, and `get_layout` gave me exact character positions. But this brief pushes far beyond the DSL's sweet spot (UI/promo motion). There is no line-by-endpoints, particle or 3D primitive, gradient fills on shapes render wrongly, whitespace collapses silently, and the specs get huge.
