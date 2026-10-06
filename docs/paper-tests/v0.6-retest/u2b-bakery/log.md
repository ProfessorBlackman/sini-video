# u2b-bakery — Cinnamon Roll Box promo (Sini session log)

Final: **version 7**, `u2b-bakery/out/draft.mp4` (15.00s, 9:16, draft 540x960 @ 15fps, rendered in 17.8s, lint clean).

## 1. What I built

Fully illustrated, flat-vector style (no photos or footage supplied). Palette is warm cocoa, kraft and cream, with a kente-inspired gold/green/red stripe as the Ghanaian brand accent. Fonts: Fraunces (display) and Manrope (body). Motion: `editorial`. Wipe transition with a gold bar, light grain and vignette, `safeZone: reels`.

| Scene | Time | Content | Features |
|---|---|---|---|
| `oven` | 0–4s | Dark oven with a glowing radial interior and a smooth zigzag heating element. A steel tray of 6 rolls (gripped by red oven mitts) slides forward and scales up out of the oven. Three steam wisps draw in over the rolls and drift up while fading. Serif kicker "Fresh out of the oven" | `roll` component (circle + arc-spiral `path` via SVG `d`), `grid`, `group`, raw `animate` (y/scale), `pulse` on the oven glow, `drawOutline` with stagger on smooth paths, `z` |
| `icing` | 4–7.5s | Top-down close-up of one large roll on a plate. A piping bag travels a zigzag path while the icing line draws in behind it, then the bag flies off. Slow camera push-in | `camera` behavior on a `group`, `drawOutline` + `follow` behavior on the same path with matching duration and ease, raw animate for the bag exit |
| `packing` | 7.5–11.5s | Flat-lay of an open kraft box. The lid shows a placeholder brand (croissant icon, "Your Bakery", kente stripe). Five rolls drop into slots with stagger. Two arms with green cuffs rise from the bottom of frame carrying the sixth roll, set it in its slot and withdraw | `stack` lid card, `stripe` component, `grid` box, `slideIn` stagger with `back.out`, a hands `group` pinned to slot `p6` with a y-offset animation, and a swap from the carried roll to the slot roll (opacity + `fadeIn`) |
| `final` | 11.5–15s | Café at night: two pendant lamps with pulsing glows, floating bokeh, a wooden table, the closed branded box in 3/4 view (trapezoid top `path` + front `stack`), and a coffee mug with rising steam. Copy: "Cinnamon / Roll Box" (display) and "— This *Weekend.*" (gold subtitle), in the open space above the box | `wordReveal`, `fadeUp` chained with `title.enter.end`, `float`, `pulse`, `path` closed shapes, blur |

Notes in the spec record the placeholder brand, the invented kicker, the assumption of six rolls, and that everything is illustrated.

## 2. Brief vs delivery

Delivered:
- All four beats in order and on time: oven with steam, icing close-up, hands packing a branded box, and the box on a table in a warm café with space for the exact copy "Cinnamon Roll Box — This Weekend.".

Not delivered, or delivered differently:
- **Photographic or live-action look.** The brief reads like a food-video shoot (freshly baked, steam, hands). Sini has no footage, no video assets and no image generation, and no assets were supplied. I made a stylised illustrated animation instead. For the client: "This is an animated illustrated version, which works well as a social promo and keeps everything on-brand. For a photo-real look we'd need footage or photos from a shoot (or licensed stock). The same structure and timing can then be rebuilt with those as image backgrounds."
- **Branding.** No bakery name or logo was given, so the box carries a clearly-placeholder "Your Bakery" wordmark, a croissant icon and a kente-style stripe. Client action: send the logo as an SVG and the exact name.
- **"Several rolls"**: I chose six (a 3x2 box). Confirm the real box size.
- **Hands** are simple stylised arms and palms. They are readable as hands carrying a roll but are the weakest drawing in the piece.
- **Invented copy**: "Fresh out of the oven" kicker in scene 1 (flagged in notes; easy to remove).
- No audio, since Sini has none. The client would need to add music in their social editor.

## 3. Tool errors, warnings, surprises

1. Lint v1: `! kicker-1: 'kicker-1' is readable for 1.7s but needs about 2s (5 words). Lengthen the scene by 0.4s, start the text earlier, or use "duration": "auto".` I moved its enter from 1.6s to 1.1s, which fixed it.
2. `get_layout` with an `elements` filter: `MCP error -32602: Input validation error: Invalid arguments for tool get_layout: Invalid input: expected array, received string at elements`. With `visibleOnly: true`: `... expected boolean, received string at visibleOnly`. The tool schema doesn't declare these params, so my client sent them as strings and the server rejected them. Calling `get_layout` with no filters worked but returned a very long dump (about 30 elements for one scene).
3. **Lint missed a real overlap.** In v5 the "Fresh out of the oven" text sat on top of the tray's bottom edge, which was obvious in `render_frame`, but lint reported "No problems found". I found it visually and moved the text.
4. `cup` with `"radius": [0, 0, 40, 40]` (per-corner) validated with no error but rendered as a plain square. The value was silently ignored. I replaced it with a single radius.
5. Grid surprise: a component root with `layout.width: 200` inside a `grid` kept its 200px width rather than stretching, so the rolls sat left-aligned in their cells and the tray looked off-centre. I only discovered this through `get_layout`. Fix: root layout `{ "aspect": "1:1" }` only.
6. Group sizing surprise: a `group` with children at negative x (mitt at x=-70) sized its auto box from x=0 only, so the group's centre wasn't the visual centre. I fixed it by giving the group an explicit width equal to the grid.
7. `get_layout` reported the tray group's `current.height: 0` while its box height was 508. That looks odd, possibly a reporting bug for scaled groups.

## 4. Rendered differently than expected

- Hands v1: two pills rotated ±15° looked like splayed leaves or tongs, not arms. v2 had palms above the roll like "bunny ears". v3 (near-vertical arms extending off-canvas, palms angled outward under the roll sides, green cuffs) was acceptable.
- Steam v1 rose from the oven interior rather than from the rolls (the tray sat below it). I moved it to overlap the rolls with `z`.
- Mid-transition frames are labelled with the incoming scene but show the outgoing one (e.g. 11.5s "final" shows packing). This is correct per the docs (the outgoing scene plays under the wipe), just surprising on a contact sheet.
- `follow` + `drawOutline` with the same duration and ease kept the piping-bag tip on the drawn line end. Better than I expected.

## 5. Wishes

- Per-corner `radius`, or at least a validation error when an array is given.
- Lint should catch text overlapping a shape or container drawn under it (it caught nothing here).
- `get_layout`/`describe_at` schemas should declare `elements`/`visibleOnly` so MCP clients send the right types.
- Stretch-to-cell, or a warning, when a fixed-width child is narrower than its grid cell.
- A small illustration library (hands, cups, steam, boxes), or an "isometric box" shape. Drawing hands from pills and ellipses is the hardest part of a food brief.
- Some route to photographic content: stock search, or simple image generation into a placeholder. Without it, food briefs always end up as illustration.
- Audio track support (even a single music bed).

## 6. Ratings

- **Video vs brief: 3/5.** Every beat and the exact end-card copy are there, timing is tight at 15s, and the palette, kente accent and café end card feel warm and on-theme. But it's illustration, not the appetising photo-real food footage the brief implies. The hands are crude, and the brand is a placeholder.
- **Tool experience: 4/5.** The reference is excellent and complete. Patches, versioning, contact sheets and frame renders made iteration fast (7 versions, draft render in under 20s). `follow`, `camera` and components worked first time. I took a point off for the silent radius ignore, the missed overlap in lint, the filter params rejected by schema mismatch, and grid/group sizing behaviour I could only discover through `get_layout`.
