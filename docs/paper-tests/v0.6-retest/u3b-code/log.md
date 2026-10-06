# u3b-code: "Code becomes a network, a city, then a sphere" (20s, 16:9)

Final version: **v6**. Draft render: `u3b-code/out/draft.mp4` (960x540 @ 15fps, 20.00s, rendered in 16.7s).

## 1. What I built

Palette: void #03060D, navy, cyan #3FE0FF, violet #8A6CFF, mint, bone. Fonts: JetBrains Mono for code. Motion `calm`, light grain and vignette, `end` fade to black 0.8s.

| # | Scene | Time | What happens | Features used |
|---|---|---|---|---|
| 1 | `code` | 0–5s | Dark radial background, `mind.ts` label, line-number gutter and 6 lines of syntax-coloured code revealed line by line. At 1.6s ten individual glyphs (N, {, 1, (, {, l, ;, k, n, r) flash white, then float up and away on curved paths while spinning, fading out as glowing orbs grow from them. The rest of the code dims, then blurs out. A field of rising particles fades in. | `text` with `[word]{color}` markup; `lineReveal`; ten single-glyph `text` elements positioned exactly over the code, with the matching characters in the code block coloured `void/0` so lifting a glyph leaves a real hole; keyframed `animate` (x/y/rotation/opacity/color); circles with a radial gradient (white > cyan > transparent) `pin`ned to each glyph so they travel with it; `particles` (rise); `blurOut` exit |
| 2 | `network` | 5–11.5s | Crossfade: the orbs land exactly where the network nodes sit. More nodes scale in, and connectors draw themselves between them. Distant nodes (small, dim, violet, dashed links) give some depth. A twinkling dust layer sits outside the camera group. The hub nodes pulse. From 2.4s a `camera` pushes in on the hub, then dives towards another node (zoom 4.5). Two big blurred bokeh orbs swell and slide outward during the push to suggest parallax. | `group` + `camera` behavior; `connector` + `drawOutline` with stagger; `scaleIn`; `pulse`; `particles` (twinkle) |
| 3 | `city` | 11.5–15.5s | `circle` transition that opens out of the zoomed glowing node and reveals a neon skyline. Buildings grow up from the horizon in stagger (scaleY with origin bottom). A perspective floor grid draws in. Twinkling window lights fade in per building. Each rooftop has a glowing node, and arched data links draw between rooftops. Rooftop nodes pulse. The camera pulls back from the tallest tower to the full skyline. | `rect` shapes with gradient fill; an SVG-`d` `path` for the grid; 13 `particles` boxes for windows; `pin` to `top`; `connector` with `curve`; `camera`; `circle` transition with `origin` = element in the outgoing scene |
| 4 | `sphere` | 15.5–20s | Crossfade, with the city briefly visible through the globe. The camera starts tight on a node of a wireframe globe and pulls back to show the whole glowing sphere: rim, latitude rings, a tilted orbit ring, a halo, nodes and connections. Three meridian ellipses animate their widths (sin-based keyframes), so the globe appears to rotate. It ends on a fade to black. | `ellipse` shapes; `animate width` keyframes; `camera`; `pulse` on the halo; `connector` + `drawOutline` |

`notes` record that the code snippet is invented copy, and that the 3D look is simulated in 2D.

## 2. What I could and couldn't deliver

- **Delivered:** dark screen with code; characters lifting off and becoming glowing particles; particles forming a network of nodes and connections; a camera push "through" the network; a transformation into a futuristic connected city; a pull-back reveal of a glowing digital sphere. The emotional arc and the order of beats match the brief.
- **Not truly delivered: real 3D.** Sini is a 2D engine with no z-axis, perspective camera or 3D primitives. What I used instead:
  - Depth comes from node size, opacity, colour temperature and dashed far links.
  - The "fly-through" is a 2D zoom into a node, plus bokeh parallax. You never pass *between* nodes with them streaming past the lens.
  - The sphere is a wireframe built from ellipses, with meridians whose widths animate to fake rotation. The nodes on its surface don't rotate with it.
  - The city is a flat neon skyline with a perspective floor grid, not a 3D city you fly through.
- **"Gradually transforms" into a city** is a transition (a circle reveal out of a glowing node), not a morph. Network nodes don't literally become rooftops. The same is true of city to sphere: a crossfade during which the city shows through the globe.
- **"Characters"**: only 10 glyphs lift off; the rest of the code dissolves with a blur. Animating every character independently would need hundreds of hand-positioned elements, because there is no per-character exit/scatter preset.
- **What I'd tell the client:** "This is a stylised 2.5D take. The story beats are all there, but the network, city and sphere are flat motion graphics with depth cues, not a rendered 3D fly-through. For true 3D camera flight (particles streaming past, a rotating globe of real nodes) we'd need a 3D pipeline (Blender, Cinema 4D, three.js). This version works as an animatic or a lighter-weight final." I also flagged the invented code text in `notes` so it can be swapped for the client's own code.

## 3. Tool errors, warnings, surprises

1. `update_video` add with `parent` but no `scene` gave this error: `Patch operation 55 (add): No scene 'undefined'.` The whole 69-op patch was rejected (atomic, which is good). The fix was to add `"scene": "city"` to every add. The reference says add places inside a container with `parent`, but doesn't say `scene` is still required. The message is also unclear ("undefined").
2. `set` on `lint` (both `lint` and `lint.accept`) gave this error: `Patch operation 1 (set): No scene, element or timeline item with id 'lint'.` §11 says set paths may start with a top-level key, but it apparently only works for keys that already exist. Because the patch was atomic, my `notes` set in the same patch was also lost, and I resent it separately. **I could not add `lint.accept` without replacing the whole spec** (150+ elements), so I left the warnings open.
3. The lint output doesn't print warning **codes**, and §12 doesn't list them, so even with full-spec replacement I would have had to guess codes like `reading-time` and `covered-text` for `lint.accept`.
4. 22 lint warnings remain, all intentional:
   - Reading time: "'code-block' is readable for 1.8s but needs about 5.6s (17 words)" and the gutter needs 2.3s. The code is texture and isn't meant to be read.
   - "'cN' is partly covered by 'dN'", ten times. The glowing orb deliberately grows over its glyph.
   - "'code-block' and 'cN' overlap", ten times. Each glyph sits in its own hole in the code block.
5. The `get_reference` tool schema shows no parameters, but `section: "7"`, `"9"` and `"12"` worked as the brief said.
6. Validation passed first time (150 elements, 30 timeline items).

## 4. Rendered differently than expected

- **`matchCut` from `n3` (zoomed node) to `r8` (rooftop node)** looked broken. A hard-edged square window of the city appeared over the node at 11.5s, a sliver of a building poked out of the orb at 11.9s, and the city then appeared clipped to a rectangle. I suspect matchCut doesn't account for the outgoing camera zoom, or for circles. I replaced it with `circle` with `origin: "n3"`, which looked great: the city opens out of the glowing node.
- `connector` `curve: 0.4` between rooftops sagged downward like power lines. I expected it to bow up. Negative curve (-0.4) gave the arcs I wanted. The sign convention isn't documented.
- A single `particles` box over the whole skyline put "window lights" in the sky between buildings. I switched to one particles element per building, and their opacity has to be animated because particles don't follow the buildings' scaleY grow.
- Glyph overlay alignment was perfect on first try. The JetBrains Mono advance (0.6em) and the lineHeight maths matched, which pleasantly surprised me.
- First pass at 34px mono looked tiny and off-centre on 1920 wide, so I went to 46px, centred by hand.

## 5. What I wished the tools/DSL did

- **Some 3D, even minimal:** a z / depth value on elements with a perspective camera (`camera` keys with `z`/`dolly`), so a fly-through moves things past the lens with real parallax. A `sphere`/`globe` element with points on it that rotate.
- **A per-character scatter/exit preset** (e.g. `charsScatter` with `to: element` or random spread) so "characters float off and become particles" doesn't need 20 hand-placed elements and manual glyph-offset maths.
- **A particle "morph"/"gather" target:** particles that flow from one shape (text) into positions (nodes), then to another layout.
- **A `glow` style** (outer bloom) instead of faking it with radial gradients on circles.
- **Connectors that end at a circle's visible edge**, not its bounding box, and documented `curve` sign.
- **Packets travelling along a connector** (follow a connector, not just a path).
- **Character-index helpers:** get_layout for per-character boxes, or `pin` to `"code-block#char:17"`, so I don't compute monospace offsets myself.
- Lint should print codes, `set` should be able to create top-level `lint`, and `add` with `parent` should infer the scene.

## 6. Ratings

- **Video vs brief: 3/5.** Every beat of the story is present, in order, with a coherent neon look, and some moments land well: glyphs lifting out of holes in the code; orbs landing exactly on the network nodes; the circle reveal of the city out of a node; the city showing through the globe. But the brief is fundamentally a 3D brief (3D network, camera flight through it, a city, a sphere), and the result is clearly 2D motion graphics. The city reads a bit like a stylised bar chart, and the "fly-through" is a zoom.
- **Tool experience: 4/5.** The reference was clear and enough on its own. Validation, contact sheets and frames were fast, and deterministic positioning made precise glyph tricks possible. Camera, connectors, pin, particles and transitions compose well. I took a point off for:
  - the patch gotchas (scene required with parent; can't create `lint`);
  - lint codes being hidden, so there was no practical way to accept intentional warnings;
  - matchCut misbehaving under camera zoom;
  - undocumented connector curve direction.
