# u2-bakery — Cinnamon Roll Box promo (15s, 9:16)

Final version: **v8**. Draft render: `u2-bakery/out/draft.mp4` (540x960, 15 fps, 15.00s, lint clean).

## 1. What I built

Flat, illustrated motion-graphics piece. Warm palette (cocoa, amber, kraft, icing), Fraunces display plus Inter Tight, `calm` motion, light grain and vignette, safeZone `reels`, 0.5s fade to near-black at the end. I defined two components: `roll` (four concentric circles that suggest a top-down swirl) and `steam` (a blurred translucent pill). A third, `carried`, nests a `roll` with a Lucide `hand-grab` icon.

| # | Scene | Time | What happens | Features |
|---|---|---|---|---|
| 1 | `oven` | 0–4s | Steel oven with a glowing amber mouth (solid rect plus a blurred ellipse glow). A tray of 6 rolls pulls out toward the viewer (raw `y` and `scale` animation). From 1.2s, six steam wisps fade in and rise, sway and stretch. | shapes, group, grid, component instances, raw animate with keyframes, staggered `fadeIn` |
| 2 | `icing` | 4–7s | Close-up of one big roll with a slow push-in. A piping bag zig-zags across it, and each icing line is revealed (`wipeIn` from alternating sides) in step with the bag's tip. | 8 chained relative raw animations on the bag (offsets add up), 4 timed `wipeIn`s, crossfade in |
| 3 | `pack` | 7–11s | Top-down open kraft box with a kente-style red/gold/green stripe on the lid and a cream liner. Six rolls slide in from below, one at a time, each "held" by a hand icon. The hand drops away after each roll lands, then a gentle push-in on the box. | nested component (`carried` → `roll`), staggered `slideIn` on instances, staggered `slideOut` exit on component paths `p1/hand`…, hard `cut` transition |
| 4 | `final` | 11–15s | Café setting: warm wall with floating amber bokeh, wooden table. The closed branded box sits on the table with a coffee cup beside it and steam rising from the cup. Headline "Cinnamon / Roll Box" (lineReveal), a gold rule that grows, then *This Weekend.* in gold italics. | `float` ambient, `kenBurns` on a group, `lineReveal`, `fadeUp` with relative timing (`headline.enter.end-0.4`), `scaleX [0,1]` rule |

## 2. What I could and couldn't deliver from the brief

The brief reads as a live-action food shoot: a real oven, real steam, icing drizzle, hands and a café. Sini has no footage, video clips or photographic generation. Its only stand-in for missing images is a "placeholder" textured gradient. No assets were supplied. So I made the closest honest equivalent: a stylised, illustrated animatic/promo that follows the brief's four beats, timing and final text space exactly.

- **Delivered:** all four beats in order, with the brief's pacing (4/3/4/4s). The steam rises, the icing drizzle is synchronised to a piping bag, six rolls get packed into a branded box, and the final shot is the box on a table with a warm café background and space for the text. The text reads "Cinnamon Roll Box" / "This Weekend." I split the em dash into a gold rule between the two lines. That is a typographic choice, and the words are the client's.
- **Not delivered:** anything photographic. The rolls are concentric circles, not appetising baked goods. The oven is a rectangle with a glow. **Hands are a line icon (Lucide `hand-grab`), not real hands.** This is the weakest beat. There is no audio (not in scope).
- **Invented, listed in `notes`:** the brand name "The Bakery" (placeholder for the client's logo), "Cinnamon rolls · 6 pack" (the pack size is assumed), and the kente-inspired stripe (my design nod to Ghana, not client branding).
- **What I'd tell the client:** "This is an illustrated version you can post as-is, or use as an animatic/storyboard for a shoot. For the appetising, real-food look in the brief, we need footage or photos of your rolls, icing, hands packing and your actual box. Send your logo and real pack size too. With photos, I can drop them into the same timing and text layout."

## 3. Tool errors, warnings, surprises

1. `create_video` v1 rejected: `✗ scenes[0].elements[2].style.stroke: Colour '#2A1208/0.6' is not hex or a palette token.` The `/opacity` suffix only works on palette tokens. I added `char` to the palette and used `char/0.6`. Small annoyance: on any error I have to resend the entire spec.
2. **Big surprise: gradient fills on shapes rendered solid BLACK.** Every `shape` with `fill: {linear: [...]}` or `{radial: [...]}` came out black: the oven body, oven mouth, tray plate (hex stops), roll base, piping bag, box lid and table. Scene backgrounds with gradients rendered fine. Validate and lint gave no warning at all. Reference §4.1 says gradients are allowed "anywhere a colour is accepted". I switched to solid fills and faked glows with blurred shapes (v2/v3).
3. Lint (v1): `! when: 'when' is readable for 0.6s but needs about 1.1s (2 words)...` I moved its enter to `headline.enter.end-0.4`. Fixed.
4. Lint (v6): `! bc-sub: 'bc-sub' has a contrast of 3.9:1 against its background (minimum 4.5:1).` Changed to solid `cocoa`. Fixed.
5. The `zoom` transition (`direction: in`) into the icing scene showed the outgoing scene as a ghosted, shrunken rectangle with a visible hard edge. It looked like a glitch, so I replaced it with a crossfade.
6. Patching component definitions via `components.roll.root.children.0.style.fill` worked, which was not obvious from §11. Adding a whole new component via `set components.carried` also worked.

## 4. Rendered differently than expected

- Shape gradient fills → black (see above). This is the main rendering bug.
- Steam: blurred pills read as vertical streaks rather than billowing steam, and they nearly vanish against the amber oven glow.
- `hand-grab` at 170px reads as a small fist/glove outline, not as a hand holding a roll.
- The icing is straight pills, so it reads as rigid sticks rather than a fluid drizzle. There is no path/curve primitive to do better.
- Positive: the chained relative raw animations made the piping-bag tip track the `wipeIn` lines very precisely, and `slideOut` on component paths worked first time.

## 5. Wishes

- Shape gradients that work, or a validator/lint error if they're unsupported.
- A path/curve shape (or inline SVG path data without needing an asset file) for drizzles, steam curls, hands and organic forms. Many food/organic briefs depend on it.
- A particle/smoke ambient preset (steam, sparkles, crumbs).
- Hex-with-opacity shorthand (`#2A1208/0.6`) for consistency with tokens.
- Patch errors that let me fix one field without resending the whole spec on `create_video`.
- A per-element `clip`/mask (to keep icing inside the roll, or show rolls through a box window).
- Some way to bring in stock/generated imagery for briefs that are inherently photographic, or at least a lint/info note saying "this brief requires footage".

## 6. Ratings

- **Video vs brief: 2.5/5.** The structure, timing, beats, branding space and final text are all there, and it looks coherent and warm. But the brief is about appetite appeal (real steam, glossy icing, hands), and flat circles can't deliver that. The hands beat is the weakest.
- **Tool experience: 3.5/5.** The reference is clear and complete enough to work without the source. Components, relative timing, additive offsets and the contact sheet make iteration fast (8 versions, about 17s draft render). Lint caught real issues. Points off for the silent black-gradient bug (validate/lint passed while 7 elements rendered wrong), the zoom-transition artifact, and having no organic shape primitives.
