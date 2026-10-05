# Tro reel — Sini test log (m2-tro)

Final version: **v8**, 16.00 s, 9:16, lint clean. Draft render: `out/draft.mp4` (540×960 @ 15 fps, rendered in 7.0 s).

## 1. What I built

Theme: palette sun/ink/coral/leaf/cream, Bricolage Grotesque + Manrope, `motion: snappy`, `circle` default transition, light grain, `safeZone: reels`, `targetDuration` (15, later 16).

- **intro (2.4 s, sun yellow)**: centred `stack` of a `car-front` icon (popIn), the "tro" wordmark (charReveal, 300 px, weight 800) and the tagline "Rides across Accra." (fadeUp).
- **app (auto, about 10.8 s, sun to cream gradient)**: enters with `slide` from down with `push`. A top caption `step-title` uses **states** to roll through "Pick a destination" → "Pick your ride" → "Tap the cheapest" → "Driver on the way". A `phone` (width 660) has three `screens`:
  - *home*: header, "Akwaaba, Ama", a search field, three suggestions (Oxford Street, Kotoka Airport, Accra Mall), a yellow promo card, and a map at the bottom.
  - *rides*: a map, "Choose a ride", six ride rows (Comfort, XL, Go, Taxi, Lux, Pool), and a "Confirm Tro Pool" button.
  - *tracking*: a map with the car moving, a status text with states, a 3-step `progress` (Assigned / On the way / Arrived), a driver card (badge avatar, name, car, call icon), a trip line and a "Message Kwame" outline button.

  Timeline:
  - `interaction` 1: `type` "Oxford St" into the field (with `set` for a typing state), then `click` the suggestion with `set` pressed and `navigate` to rides.
  - `scroll` to `opt-pool`.
  - `interaction` 2: `click` Pool (`set` selected: mint fill, green stroke), then `click` Confirm and `navigate` to tracking.
  - `progress` value is animated 0 → 1 → 2, the status text changes state, and a raw `animate` (x/y) moves the car along the route.
- **outro (2.8 s, ink)**: `circle` transition. Icon, a yellow "tro" mark, "Your ride across Accra." and a "Get the app" button, with popIn and fadeUp entrances and a `pulse` on the button.
- **Components**: `map` (a group built from shapes and icons: park, roads, coral route, origin dot, pin, car), used 3 times. `ride-info` (name, detail and price) is used by the 6 ride rows.

## 2. Errors, warnings and surprises

1. **create_video error (v0)**: `components.ride.root[0].children[0].children[0].name: Unknown icon '{{icon}}'. Use a Lucide icon name (lucide.dev/icons).`
   - Reference §7.4 says `{{param}}` works "in any string value, including enum values", so this should have worked. The validator checks the icon name in the definition before substituting the parameter.
   - Fix: I moved the icon box out of the component. Each ride row is now a hand-written stack (icon box + `ride-info` instance). That is more copy-paste than the reference recommends.
2. **Lint (v1)**:
   - 11 warnings like `'sug-osu-area' is drawn at 18.4px on the canvas, too small to read on a phone...`. These are caption and label roles inside a 600 px phone.
   - `'tagline' is readable for 1.3s but needs about 2s (5 words)`.
   - `targetDuration 15s can't be reached: the video is 16.40s (long by 1.40s)`.

   Fixes: phone width 660, caption text overridden to 15 and labels to 13 (in-device), shorter tagline, intro moved earlier. The lint messages were precise and useful.
3. **Lint (v7)**: `'end-line' is readable for 1.5s but needs about 1.7s` and `'end-cta' ... needs about 1.4s`. I moved the entrances earlier and made the outro 2.8 s.
4. I raised `targetDuration` to 16 to clear the "can't be reached" warning (final 16.0 s, still "about 15 s"). Surprise: the auto scene then grew its hold to fill exactly 16.0 s, so raising the target made the video longer than its natural length.

## 3. Rendered differently from what I expected

- **Phone slideIn overshoot, which hid the caption (v2, about 3.3 s)**:
  - The phone's `slideIn from down` with the snappy theme's `back.out` ease overshot about 130 canvas px above its final position. For a moment it covered `step-title`.
  - `describe_at(3.3)` reported `step-title` as `visible: true`, but it was not visible in the frame. describe_at doesn't take occlusion into account.
  - Fix: `ease: expo.out`. I later removed the enter entirely in favour of the scene's slide transition.
- **A group's explicit height is overridden by its children (v3)**:
  - The `map` component root had `layout.height: 280`. I made one road rectangle 700 tall, and all map instances grew to about 720 logical px. The ride map then filled the whole screen and pushed the tracking cards off-screen.
  - I expected the explicit height to win, or the group to clip.
- **Instance layout height ignored (v4)**:
  - I set `trk-map.layout = { height: 420 }` on the component instance. `get_layout` still reported 498 canvas px, which is the component's 320 logical × 1.557.
  - §7.4 says the instance's `layout` applies to the root. Fix: I changed the height in the component definition (390) for all instances.
  - Earlier, `grow: 1` on the instance did take effect, combined with the oversized group.
- **Map width slightly narrower**: map groups were 538.7 canvas px wide while sibling page children were 544.9. A small, unexplained difference of 6 px.
- **Button width mismatch**: `get_layout` said `msg-btn` was 544.9 px wide (stretched to the page), but the render shows an auto-width button of about 265 px. Either layout or render is wrong. The render looked better, so I left it.
- **Leftover state-roll glyph (v2, about 12.6–12.8 s)**: after `trk-status` rolled from "Kwame is 3 min away" to "Kwame has arrived", the descender of the outgoing text's "y" stayed visible above the new line until the scene ended. The roll clip doesn't seem to cover descenders. After I raised `lineHeight` to 1.4 it no longer appeared.
- **Typing doesn't filter suggestions**: expected, given the DSL, but realism is limited. The cursor types "Oxford St" and taps a suggestion that was already listed.

## 4. Workarounds

- Icon-in-component bug: hand-written row stacks with a smaller `ride-info` component (see 2.1).
- `typing` state with `content: ""` on the placeholder text before the `type` step, so the placeholder "Where to?" is replaced. This worked; the caret and typed text rendered well.
- Map height changed in the component definition, because the instance override was ignored.
- `lineHeight: 1.4` on rolling status text to hide the descender artefact.
- Car start and end computed by hand from the rotated route rectangle (trigonometry) so the car follows the line. Pinning or a path animation would have been nicer.
- Patching inside component definitions with numeric index paths (`components.map.root.children.7.layout`). This worked even though the reference only documents id paths. It is brittle: an index silently changes meaning if children are reordered.

## 5. What I wished for

- `{{param}}` in icon names (as documented).
- Instance `layout.height` that actually overrides the component root, and groups that respect an explicit size and clip their children (`clip: true`).
- A way to move an element along a path or toward another element (`"animate": { "to": "trk-map/pin" }`), so I don't have to do trigonometry.
- A per-device text scale (e.g. `phone.textScale: 1.15`) instead of overriding sizes on a dozen captions. Also a progress `style.size` for label size: its labels stay at about 20 canvas px.
- `describe_at` and `get_layout` reporting occlusion and the rendered button width.
- An `input` or `searchField` element with placeholder handling, so I don't need the empty-state trick.
- Easier patch addressing for component internals (ids such as `map/route` in definitions).
- Large tool outputs (`get_reference`, `get_layout`, `describe_at`) overflow the context: describe_at at one time listed all 100+ elements including hidden screens. A `visibleOnly` filter would help.

## 6. Ratings

- **Final video: 4/5.** Bright, friendly and on-brief: the destination is typed and picked, the list scrolls, the cheapest ride is tapped (it visibly highlights), and the 3-step tracker advances while the car drives the route. The caption above the phone explains each step. Remaining weaknesses:
  - in-device secondary text is still small on a phone screen;
  - the intro and outro are simple typographic cards;
  - on the home and rides maps the car icon sits on top of the origin dot;
  - the bottom of the tracking screen has some empty white space.
- **Tool experience: 4/5.**
  - Good: validate/lint/contact sheet loop is fast and the messages are actionable. Interactions, scroll, navigate and states did almost exactly what the reference promised, with little effort. Draft render took 7 s.
  - Points lost: the documented `{{param}}` in icons fails, instance layout overrides are ignored, groups grow past their explicit size, `get_layout` and the render disagree on button width, and the state-roll descender artefact.
