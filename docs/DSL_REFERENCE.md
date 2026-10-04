# Sini DSL Reference — v0.4

**Status:** Draft for paper-testing with LLMs. Nothing here is implemented yet.
**Audience:** AI models writing Sini videos. This file is designed to be read in one pass and to be sufficient on its own.

Sini turns a JSON description of a video into a deterministic MP4. You (the AI) describe **what the video shows and when**; Sini handles layout, animation, rendering and encoding. You never write HTML, CSS or JavaScript.

---

## 1. Rules for authors

1. Output **one JSON object** that follows this reference. No comments, no trailing commas.
2. Use only the element types, presets, behaviors, transitions and properties listed here. Do not invent new ones.
3. Every scene, element and timeline item `id` is kebab-case and **unique across the whole video**.
4. Prefer the **highest-level tool** that does the job: theme → components → presets → behaviors → raw `animate`.
5. Prefer **layout** (anchors, relative placement, stacks, `%`) over absolute pixels. To centre a block of several elements, put them in a `stack` and anchor the stack.
6. Prefer **relative timing** (`"h1.enter.end+0.2"`) and `"duration": "auto"` over hand-computed numbers. Let Sini do the arithmetic.
7. If something repeats (cards, stats, speakers), define a **component** once and reuse it (§7.4).
8. If you don't have an image, use a **placeholder asset** (§5). Never leave the video empty waiting for assets.
9. Use only facts from the brief. If you write copy the human didn't give you (claims, prices, features), list it in `notes` (§2).
10. After writing, run `validate`, `lint` and `layout`, then check a contact sheet before showing a human.

---

## 2. Top-level structure

```json
{
  "version": "0.4",
  "video":  { "format": "9:16", "fps": 30 },
  "theme":  { },
  "assets": { },
  "components": { },
  "scenes": [ ],
  "notes": [ ]
}
```

| Key | Required | Description |
|---|---|---|
| `version` | yes | Always `"0.4"` |
| `video` | yes | Canvas and output settings (§3) |
| `theme` | no | Palette, fonts, motion personality, default transition, texture (§4) |
| `assets` | no | Images, SVGs, fonts and placeholders, referenced by ID (§5) |
| `components` | no | Reusable element templates (§7.4) |
| `scenes` | yes | Ordered list of scenes (§6) |
| `notes` | no | Strings for the human: invented copy, assumptions, assets to replace. Not rendered |

The video's total duration is the **sum of the scene durations**.

---

## 3. `video`

```json
"video": { "format": "9:16", "fps": 30, "background": "ink", "targetDuration": 15, "safeZone": "reels", "end": "hold" }
```

| Key | Default | Description |
|---|---|---|
| `format` | `"9:16"` | `"9:16"` (1080×1920), `"1:1"` (1080×1080), `"4:5"` (1080×1350), `"16:9"` (1920×1080) |
| `width`, `height` | from format | Custom size; overrides `format` |
| `fps` | `30` | 24, 25, 30 or 60 |
| `background` | `"#000000"` | Colour behind all scenes. Palette tokens are allowed |
| `seed` | `1` | Seed for anything pseudo-random (e.g. grain). Same seed → same video |
| `targetDuration` | none | Seconds. Sini adjusts the hold of `"auto"` scenes to hit it (§6). Fixed scenes and the `end` fade count inside the total |
| `safeZone` | `"none"` | `"reels" \| "tiktok" \| "shorts" \| "none"`. Lint warns when text or buttons sit under that platform's UI (margins below) |
| `end` | `"hold"` | `"hold"` (last frame stays), `"cut"`, or `{ "type": "fade", "duration": 0.6, "color": "#000000" }` (fade out over the last `duration` seconds) |

**Safe-zone margins** (canvas px on 1080×1920; approximate platform guidance):

| `safeZone` | Top | Bottom | Left | Right |
|---|---|---|---|---|
| `reels` | 220 | 420 | 60 | 140 |
| `tiktok` | 160 | 480 | 60 | 160 |
| `shorts` | 180 | 400 | 60 | 140 |

All pixel values are in **canvas pixels** of the chosen size, except inside devices (§7.3). The origin is the top-left corner.

---

## 4. `theme`

The theme makes a video coherent. Set it once; elements inherit from it.

```json
"theme": {
  "palette": { "ink": "#1E1512", "bone": "#EEE6DA", "wine": "#5B1A24", "sand": "#C9B39A" },
  "fonts":   { "display": "Instrument Serif", "body": "Inter Tight" },
  "motion":  "editorial",
  "transition": { "type": "wipe", "angle": 15, "bar": "bone", "duration": 0.55 },
  "texture": { "grain": 0.075, "vignette": 0 }
}
```

### 4.1 Colours

Anywhere a colour is accepted you can use:
- a palette token: `"wine"`
- a token with opacity (0–1): `"bone/0.6"`. `"ink/0"` is fully transparent
- a hex value: `"#5B1A24"` or `"#5B1A2499"`
- a linear gradient: `{ "linear": ["wine", "ink"], "angle": 180 }`. `angle` follows CSS: `180` = top to bottom (default), `90` = left to right. Two or more stops, spread evenly
- a radial gradient: `{ "radial": ["wine/0.35", "ink/0.75"] }`. The first stop is the centre, the last is the edge

Palette values must be hex.

### 4.2 Fonts and text roles

`fonts` maps three slots to font families: `display`, `body`, `mono`. Families must be bundled with Sini or declared as font assets (§5).

Bundled fonts (all SIL Open Font License, each with regular, bold and italic, and Latin Extended coverage including `₵ € £ ✓ • … → ▶ — “ ”`; no emoji, use `icon` instead): Inter Tight, Instrument Serif, Bricolage Grotesque, Fraunces, DM Serif Display, Space Grotesk, Manrope, JetBrains Mono.

Text elements pick a **role**, which sets font, size, weight and line height.

| Role | Font slot | Canvas size | In-device size | Line height | Notes |
|---|---|---|---|---|---|
| `display` | display | 150 | 44 | 0.92 | Hero statements, 2–6 words |
| `title` | display | 104 | 32 | 0.95 | Scene headlines |
| `subtitle` | display | 64 | 24 | 1.05 | |
| `body` | body | 40 | 17 | 1.3 | |
| `caption` | body | 26 | 13 | 1.4 | |
| `label` | body | 22 | 11 | 1.2 | Uppercase, letter-spacing 0.08em |
| `mono` | mono | 28 | 14 | 1.4 | |

- **Canvas sizes** are for a canvas whose **short side** is 1080px, which is every standard format (9:16, 1:1, 4:5 and 16:9). They do **not** change between formats. On a custom canvas they scale with the short side.
- **In-device sizes** apply to text inside a `phone` or `browser` (§7.3), in that device's logical pixels.
- Override roles in `theme.roles`, e.g. `"roles": { "title": { "size": 120 } }`. Partial overrides merge with the defaults.

### 4.3 Motion personality

`motion` sets default easing, durations, stagger and text entrance for every animation that doesn't specify them.

| Personality | Default ease | Enter duration | Stagger | Default text enter |
|---|---|---|---|---|
| `editorial` | `expo.out` | 0.75 | 0.08 | `wordReveal` |
| `snappy` | `back.out` | 0.45 | 0.04 | `popIn` |
| `calm` | `cubic.inOut` | 1.1 | 0.12 | `fadeUp` |
| `playful` | `spring` | 0.6 | 0.06 | `bounceIn` |

Override individual values: `"motion": { "base": "editorial", "duration": 0.6 }`.

The **default text enter** applies to every `text` element placed directly in a scene's `elements` that has no `enter` (§7.1). Text inside containers, devices and components does not get it.

### 4.4 Default transition and texture

- `transition`: used by every scene that doesn't set its own (§10). Use one signature transition; switch type only to mark a change of section.
- `texture.grain`: film grain opacity, 0–0.2. `texture.vignette`: 0–1.

---

## 5. `assets`

Assets are declared once and referenced by ID.

```json
"assets": {
  "hero":   "assets/hero.jpg",
  "logo":   { "type": "svg", "src": "assets/logo.svg" },
  "serif":  { "type": "font", "src": "fonts/MySerif.ttf", "family": "My Serif" },
  "dress":  { "type": "placeholder", "hint": "satin dress, flat lay", "color": "wine" },
  "dash":   { "type": "image", "src": "assets/dashboard.png",
              "hotspots": { "export": [1520, 96, 180, 52], "invoices": { "text": "Invoices" } },
              "fallback": { "type": "placeholder", "hint": "invoicing dashboard", "color": "bone" } }
}
```

| Form | Meaning |
|---|---|
| `"path"` | Shorthand for an image; type inferred from extension |
| `{ "type": "image" \| "svg" \| "font", "src": ... }` | Explicit asset |
| `{ "type": "placeholder", "hint": ..., "color": ... }` | Procedural stand-in (textured gradient). `hint` is kept so a human can swap in a real asset later |
| `fallback` | Used automatically if `src` is missing |
| `hotspots` | Named regions inside an image (see below) |

Paths are relative to the project folder. Remote URLs are not allowed (they break determinism).

### Hotspots

A hotspot names a region of an image so it can be clicked, focused, zoomed into or pinned to, like an element.

- `[x, y, width, height]` in the **image's own pixels**. Only use this if you have seen the image or the human gave you the coordinates.
- `{ "text": "Export PDF" }`: Sini finds the region by reading the text in the image. Use this when you haven't seen the image.

Refer to a hotspot as `"<element-id>#<hotspot>"`, where the element shows that image (an `image`, or a `browser`/`phone` whose `content` is that image): e.g. `"click": "dashboard#export"`.

---

## 6. Scenes

```json
{
  "id": "intro",
  "duration": "auto",
  "background": "ink",
  "transition": "theme",
  "cues": { "reveal": 1.6 },
  "elements": [ ],
  "timeline": [ ]
}
```

| Key | Required | Description |
|---|---|---|
| `id` | yes | Unique ID |
| `duration` | yes | Seconds (typical: 2–5), or `"auto"` |
| `background` | no | Colour, gradient, or `{ "asset": "hero", "fit": "cover", "overlay": <colour>, "blur": 12 }` |
| `transition` | no | How this scene **enters** (§10). Default: `"theme"`. Ignored on the first scene |
| `cues` | no | Named time points for this scene (§8) |
| `elements` | yes | What's on screen (§7) |
| `timeline` | no | Extra animations, behaviors and state changes (§9) |

**`"duration": "auto"`** is computed as the latest of:
- each text block's enter end + its reading time (`0.5s + 0.3s × words`)
- the end of every behavior and timeline item

plus a 0.4s hold, rounded up to 0.1s, minimum 1.5s.

- Ambient presets (which run to scene end) and cursor fade-outs **don't** extend an `auto` scene.
- With `video.targetDuration`, each `auto` scene's hold can shrink to 0.2s or grow by up to 3s. The difference is shared equally between `auto` scenes. Fixed scenes don't change. If the target can't be reached, lint says by how much.

**Scene overlap.** A transition starts at the incoming scene's `t = 0`. During the transition, the outgoing scene keeps playing underneath, past its own `duration`. Time under an incoming transition, and under the video's `end` fade, doesn't count as reading time.

**Words** for reading time are whitespace-separated pieces containing a letter or digit (`—` and `·` don't count; `GH₵ 4,500` is two). Button, badge and toast text count as text blocks.

---

## 7. Elements

### 7.1 Common properties

Every element accepts:

| Key | Description |
|---|---|
| `id` | Required. Unique |
| `type` | Required. See §7.3. (Component instances use `use` instead, §7.4) |
| `layout` | Position and size (§7.2) |
| `style` | Visual properties (below) |
| `enter` | Preset that brings it in (§9.2), or `"none"` |
| `exit` | Preset that takes it out (§9.2) |
| `states` | Named visual states (§9.5) |
| `z` | Stacking order. Default: declaration order (later = on top) |

`style` accepts:

| Key | Values |
|---|---|
| `opacity` | 0–1 |
| `rotation` | degrees, clockwise |
| `scale`, `scaleX`, `scaleY` | 1 = natural size |
| `origin` | Pivot for rotation and scale: an anchor name (§7.2). Default `"center"` |
| `radius` | px. A value of half the height or more makes a pill or circle |
| `fill`, `stroke` | colours |
| `strokeWidth` | px |
| `shadow` | `"none" \| "soft" \| "deep"` |
| `blur` | px |
| `blend` | `"normal" \| "multiply" \| "screen" \| "overlay"` |
| `padding` | Containers and buttons only. px, `[vertical, horizontal]` or `[top, right, bottom, left]`. (Devices set screen padding with their own `padding` key, §7.3) |

**Visibility.**
- An element with an enter preset (on its `enter` key **or** in the timeline) is **hidden until that preset starts**. If it has several, the earliest counts.
- A top-level `text` element with no `enter` gets the theme's default text enter (§4.3). Use `"enter": "none"` to keep it static.
- Every other element is visible from scene start.
- Children are hidden while their container is hidden.
- An element with no `exit` stays until the scene ends.

### 7.2 Layout

Choose **one** placement method. `offset: [dx, dy]` can be added to any of them to nudge the result.

**Anchor to the canvas (or parent):**

```json
"layout": { "anchor": "top-left", "inset": [430, 84], "width": "84%" }
```

- `anchor`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. Default `top-left`. The element's own matching point sits on the parent's matching point.
- `inset`: distance from the anchored edges, `[vertical, horizontal]` or one number for both. Ignored on centred axes. Negative values push the element past the edge (bleed).

**Relative to another element:**

```json
"layout": { "below": "h1", "gap": 120, "align": "start", "width": 952 }
```

- One of `below`, `above`, `leftOf`, `rightOf`: an element in the same scene and the same parent. Declaration order doesn't matter.
- `gap`: distance in px. Default 32.
- `align`: `start | center | end` on the other axis, relative to the referenced element. Default `start`.

**Pinned to a point of another element:**

```json
"layout": { "pin": { "to": "box-img", "point": "top-right" }, "offset": [-20, 20] }
```

- By default the element's **centre** is placed on `point` (an anchor name) of the `to` element.
- With `"inside": 24`, the element's own matching corner or edge sits 24px **inside** that point instead (e.g. a toast 24px in from a browser's bottom-right corner). `"inside": 0` aligns them exactly.
- `to` can also be a hotspot, chart bar or progress step (`"dashboard#export"`, `"meals#Q4"`).
- Good for stickers, badges, toasts and callouts.

**Absolute:**

```json
"layout": { "x": 64, "y": 1010, "width": 952, "height": 520 }
```

**Size**, for all methods:
- `width`, `height`: px, `"%"` of parent, or `"auto"`.
- `maxWidth`: text wraps at this width. Default for top-level text: canvas width minus 2 × 72.
- `aspect`: e.g. `"3:4"`; height is derived from width.
- `grow`: children of a `stack` or a device page only. `1` = take the remaining space along the stack's direction (shared between all growing children). Use it to push a button to the bottom of a screen or to split the canvas into equal panels.

Text, buttons and containers are `"auto"`-sized by default: they size to their content.

`x`, `y` in **animations** are offsets from the laid-out position, so animation never breaks layout.

### 7.3 Element types

#### `text`

```json
{ "id": "h1", "type": "text", "role": "display",
  "content": "YOUR CLOTHES\nHAVE A *LOOK.*",
  "style": { "color": "bone", "align": "left" } }
```

| Key | Description |
|---|---|
| `content` | String. `\n` = line break. `*italic*`, `**bold**`, and `[words]{color}` to colour part of the text (palette token or hex), e.g. `"The [ultimate]{gold} sophistication"` |
| `role` | §4.2. Default `body` |
| `style.color`, `align` (`left \| center \| right`), `size` (px), `weight` (100–900), `lineHeight`, `letterSpacing` (em, may be negative; replaces the role's value), `uppercase` (bool), `italic` (bool) | Overrides on top of the role |
| `fit` | `"none"` (default) or `"shrink"`: reduce size until the text fits `maxWidth` (and `maxLines` if set) |
| `maxLines` | Optional limit used with `fit: "shrink"` |

**Numbers in text.** Content containing a number (`"12,000"`, `"GH₵ 4,500/month"`, `"+81%"`, `"4.9★"`) works with `countUp` and with state changes. Sini animates the **first number** in the string and keeps everything around it, including thousands separators and decimals.

#### `image`

```json
{ "id": "hero-img", "type": "image", "asset": "hero",
  "layout": { "anchor": "center", "width": "100%", "height": "100%" },
  "fit": "cover", "focus": [50, 30] }
```

`fit`: `cover | contain`. `focus`: `[x%, y%]` point kept in view when cropping. `style.radius` rounds the corners; animations such as `kenBurns` stay clipped inside the frame.

#### `shape`

```json
{ "id": "rule", "type": "shape", "shape": "line",
  "layout": { "below": "sub", "gap": 40, "align": "center", "width": 360 },
  "style": { "stroke": "bone/0.6", "strokeWidth": 2 } }
```

`shape`: `rect | circle | ellipse | line | pill`. A `line` is horizontal across its `width` unless rotated.

#### `svg`

`{ "type": "svg", "asset": "logo" }`. Stroke-based SVGs work with `drawOutline`.

#### `button`

```json
{ "id": "add-btn", "type": "button", "label": "Add to bag", "variant": "solid",
  "style": { "fill": "ink", "color": "bone" } }
```

- `variant`: `solid | outline | ghost`.
- Label uses the `body` font at weight 600. Defaults: canvas size 34 (in-device 16), height 2.4 × size, horizontal padding 1.2 × size, `radius` 0.3 × height. Override with `style.size`, `style.weight`, `style.padding`, `style.radius`.

#### `badge`

Short text inside a shape: stickers, tags, "New!", counters.

```json
{ "id": "new-badge", "type": "badge", "label": "New!", "shape": "circle",
  "style": { "fill": "cinnamon", "color": "cream", "rotation": -12 },
  "layout": { "pin": { "to": "box-img", "point": "top-right" } } }
```

- `shape`: `pill` (default), `circle`, `rect`. A circle sizes to fit its label.
- Label uses the `label` role. Override with `style.size`, `style.weight`, `style.padding`.
- A numeric label (`"1"`) works with state changes and `countUp`.

#### `icon`

A line icon from the bundled **Lucide** set (ISC licence), by name.

```json
{ "id": "cart-icon", "type": "icon", "name": "shopping-cart", "style": { "color": "ink", "size": 32 } }
```

- `name`: any Lucide icon name, e.g. `check`, `check-circle`, `shopping-cart`, `shopping-bag`, `map-pin`, `bike`, `clock`, `calendar`, `heart`, `star`, `download`, `file-text`, `bell`, `user`, `home`, `search`, `arrow-right`, `play`, `sparkles`.
- `style.color` and `style.size` (px, default 1 × the `body` size). `style.strokeWidth` (default 2).
- Works with `drawOutline`.

#### `toast`

A notification card: optional icon, a title, and an optional line of detail.

```json
{ "id": "export-toast", "type": "toast", "icon": "loader", "title": "Exporting PDF…",
  "states": { "done": { "icon": "check-circle", "title": "PDF exported", "body": "INV-2041.pdf" } },
  "style": { "fill": "night", "color": "bone" },
  "layout": { "pin": { "to": "dashboard", "point": "bottom-right", "inside": 24 } },
  "enter": { "preset": "slideIn", "from": "right", "distance": 60 } }
```

- `icon` (Lucide name; `loader` spins), `title`, `body`.
- Sized to its content (title uses `body` role, weight 600; detail uses `caption`), with padding, radius and a soft shadow by default.
- States can change `icon`, `title` and `body`; text rolls and the box resizes smoothly.
- Inside a device `overlay`, a toast uses in-device sizes.

#### `progress`

A horizontal step tracker (order status, onboarding steps).

```json
{ "id": "track", "type": "progress",
  "steps": ["Paid", "Packed", "On the way", "Delivered"], "value": 0,
  "style": { "fill": "sand", "color": "bone" } }
```

- Dots joined by a line, with labels underneath. Height: about 2.5 × the `caption` size.
- `style.fill` colours completed and current steps; `style.color` colours labels.
- `value` is the index of the current step. Animate it (`"animate": { "value": 3 }`): the line glides forward and each dot and label switches to "done" as the line reaches it.
- Steps are addressable by label for `pin`, `focus` and presets: `"track#On the way"`.

#### `chart`

```json
{ "id": "meals", "type": "chart", "kind": "bar",
  "data": [["Q1", 2100], ["Q2", 2800], ["Q3", 3300], ["Q4", 3800]],
  "highlight": "Q4",
  "style": { "fill": "sand/0.5", "stroke": "sun", "color": "bone" },
  "layout": { "anchor": "bottom", "inset": [120, 0], "width": "70%", "height": 560 },
  "enter": "grow" }
```

| Key | Description |
|---|---|
| `kind` | `bar` (vertical), `hbar` (horizontal), `line` |
| `data` | `[[label, value], ...]` |
| `highlight` | Optional label to emphasise; drawn with `style.stroke` as its fill colour |
| `showValues` | Default `true`. Values use the same formatting rules as text numbers |
| `format` | Optional value template, e.g. `"GH₵ 0,0"`, `"0%"`, `"0.0"` |
| `max` | Axis maximum. Default: the largest value |
| `style.fill`, `stroke`, `color` | Bar/line colour, highlight colour, label colour |

Sini computes bar sizes, label positions and the baseline; labels sit inside the layout box. Bars are addressable by label like hotspots (`"meals#Q4"`) for `pin`, `focus`, and presets such as `pulse`. Use the `grow` preset to animate it: bars grow from the baseline (lines draw left to right) with stagger, and values count up.

#### `browser` and `phone` (device mockups)

```json
{ "id": "dashboard", "type": "browser", "url": "ledgerly.app", "content": "dash",
  "chrome": "light", "layout": { "anchor": "center", "width": 1400 } }
```

```json
{ "id": "phone", "type": "phone", "layout": { "anchor": "bottom", "inset": [-120, 0], "width": 620 },
  "background": "#FFFFFF", "padding": [0, 24], "gap": 16,
  "screen": "menu",
  "screens": {
    "menu": [ ],
    "cart": [ ]
  } }
```

| Key | Description |
|---|---|
| `content` | Asset ID of a screenshot, shown at the screen's width. Tall screenshots can be scrolled (§9.4) |
| `children` | Instead of a screenshot: elements laid out as a vertical page inside the screen |
| `screens` + `screen` | Several named pages and the one shown first. Each page is an array of elements, or `{ "background", "padding", "gap", "children" }` to override the device's settings for that page. Switch with `navigate` (§9.4). Use instead of `children` |
| `overlay` | Elements drawn on top of the screen (over `content`, `children` or `screens`), laid out in the device's logical pixels with the usual layout methods. Use for toasts, highlights and notifications on a screenshot |
| `background` | Screen background colour. Default `"#FFFFFF"` |
| `padding`, `gap` | Page padding and spacing between children. Default 0 |
| `url` | Browser only. Shown in the address bar |
| `chrome` | `light \| dark \| none`. Frame and toolbar colour. Default `light` |
| `statusBar` | Phone only. Default `true`: the top 54 logical px are a status bar and content starts below it |

**Logical screen.** Everything inside a device is laid out in the device's own **logical pixels**, then scaled to fit:
- `phone`: screen is **390 × 844** logical px. The screen is 92% of the device's outer width, inset 4% of the width on every side, so outer height = `width × 2.07`. Canvas px per logical px = `width × 0.92 / 390`.
- `browser`: viewport is **1280** logical px wide and fills the device's outer width. The toolbar is 44 logical px tall. Default viewport height: 800. Canvas px per logical px = `width / 1280`.
- Text inside uses the **in-device** role sizes (§4.2). All px values inside (`height`, `gap`, `padding`, `inset`) are logical.

Page children stack vertically and stretch to the screen width minus padding, unless they set their own `width`. They can use any element type, including containers and components.

**IDs inside devices are plain.** Elements in a device's `children`, `screens` or `overlay` are referenced by their own ID everywhere (`"click": "add-btn"`), like any other element in the scene. Only component instances create `/` paths (§7.4).

#### Containers: `group`, `stack`, `grid`

```json
{ "id": "cards", "type": "grid", "columns": 2, "gap": 16,
  "layout": { "below": "h2", "gap": 48, "width": "86%" },
  "style": { "fill": "bone", "radius": 24, "padding": 32, "shadow": "soft" },
  "children": [ ] }
```

| Type | Behaviour |
|---|---|
| `group` | Children use their own `layout`, relative to the group's box (inside its padding). Use for cameras and for moving things together. Size: `auto` fits the children |
| `stack` | Children placed in a row or column. Keys: `direction` (`vertical` default, or `horizontal`), `gap`, `align` (`start` default, `center`, `end`, `stretch`, `baseline`), `justify` (`start` default, `center`, `end`, `space-between`). Size: `auto` fits the children plus padding |
| `grid` | Children fill cells left to right and stretch to the column width. Keys: `columns`, `gap`, `rowGap`. Row height = tallest child in the row |

- All containers draw `style.fill`, `stroke`, `radius` and `shadow`, so a container is also a card.
- Children of `stack` and `grid` ignore their own placement keys but keep size keys.
- A container's `enter` animates it as one unit. Children can also have their own `enter`, timed independently (they're hidden until the container appears).
- In a horizontal stack, `align: "baseline"` lines up the first text baseline of each child.

#### `template` (escape hatch)

Use **only** when nothing else, including components, can express the design.

```json
{ "id": "ticket", "type": "template",
  "html": "<div class='t'><b>{{title}}</b><span>{{price}}</span></div>",
  "css": ".t{display:flex;justify-content:space-between;font-size:32px;transform:translateY(calc(var(--lift)*-20px))}",
  "params": { "title": "Satin Dress", "price": "GH₵ 650" },
  "vars": { "--lift": 0 } }
```

- No JavaScript. `<script>`, event handlers, external URLs and CSS `transition`/`animation`/`@keyframes` are rejected.
- Animate it only through its CSS variables: `"animate": { "--lift": [0, 1] }`.

### 7.4 Components

A component is a reusable element tree with parameters. Define it once at the top level; use it any number of times in any scene.

```json
"components": {
  "speaker-card": {
    "params": { "name": "", "photo": "", "title": "Speaker" },
    "root": {
      "id": "card", "type": "stack", "align": "center", "gap": 20,
      "style": { "fill": "night", "radius": 28, "padding": 32 },
      "children": [
        { "id": "photo", "type": "image", "asset": "{{photo}}", "layout": { "width": 180, "height": 180 }, "style": { "radius": 90 } },
        { "id": "name", "type": "text", "role": "body", "content": "{{name}}", "style": { "color": "bone", "weight": 600 } },
        { "id": "title", "type": "text", "role": "label", "content": "{{title}}", "style": { "color": "gold" } }
      ]
    }
  }
}
```

Use it as an element with `use` instead of `type`:

```json
{ "id": "ama", "use": "speaker-card", "with": { "name": "Ama Owusu", "photo": "ama-photo" },
  "layout": { "anchor": "center" }, "enter": "fadeUp" }
```

- `params` declares every parameter with its default. `{{param}}` is replaced anywhere in string values.
- The instance's `layout`, `style`, `enter`, `exit` and `states` apply to the component's root. Instance `style` is **merged** over the root's style; instance `states` are added to any states declared in the definition.
- States declared anywhere inside the definition belong to every instance. Switch them with component paths: `"set": { "ama/photo": "focused" }`.
- `{{param}}` works in any string value, including enum values (`"variant": "{{variant}}"`) and `at` expressions. `params` may be empty (`{}`).
- IDs inside the component are **local**. From outside, refer to them as `<instance-id>/<local-id>`: `"ama/name"`, `"ama/name.enter.end"`, `"click": "ama/photo"`.
- A component can contain other components, devices and charts.

---

## 8. Time

All times are **scene-local seconds**: `0` is the start of the scene.

Anywhere a time is expected (`at`), you can write a number or an expression:

| Expression | Meaning |
|---|---|
| `1.2` | 1.2s after scene start |
| `"scene.end-0.4"` | 0.4s before scene end. `scene.start` is 0 |
| `"h1.enter.start"`, `"h1.enter.end"` | When element `h1`'s enter starts / fully finishes (including stagger) |
| `"h1.exit.start"`, `"h1.exit.end"` | Same for its exit |
| `"prev.enter.end"` | The previous element in declaration order that has an enter (including default text enters) |
| `"tap.start"`, `"tap.end"` | A timeline item or interaction step with `"id": "tap"`. A raw animation or preset item ends at `at + duration + stagger × (targets − 1)`; §9.4 gives behavior end times |
| `"ama/name.enter.end"` | An element inside a component instance |
| `"cue:reveal"` | A cue declared in `scene.cues` |

Add or subtract one number: `"h1.enter.end+0.2"`, `"cue:reveal-0.1"`.

`<id>.enter.start/end` works whether the element's enter is on its `enter` key or comes from a timeline preset item (including one item with a list of targets: each target gets its own staggered times).

References must point to the **same scene**.

**Default timing.** If you omit `at`:
- The first enter in a scene starts at `0.3`.
- Each following enter starts at `"prev.enter.end-0.2"` (slight overlap).
- An `exit` ends exactly at `scene.end`.
- An ambient preset runs from its `at` to the end of the scene.

So a scene whose elements all have enter presets and no `at` plays them in order automatically.

---

## 9. Animation

### 9.1 Easing

`linear`, and `<family>.in | .out | .inOut` for families `sine`, `cubic`, `quart`, `expo`, `back`; plus `spring` (optionally `{ "spring": { "bounce": 0.3 } }`). Default: from the theme's motion personality. Every preset and timeline item accepts `ease`.

### 9.2 Presets

Use on an element's `enter` / `exit`, or in a timeline item with `preset`.

Short form: `"enter": "wordReveal"`.
Long form: `"enter": { "preset": "wordReveal", "at": 0.4, "duration": 0.8, "stagger": 0.07, "ease": "expo.out" }`. Preset parameters go in the same object.

All presets accept `at`, `duration`, `ease` and `stagger`.

**Duration and stagger.** For presets that split their target into parts (words, lines, characters, chart bars, or a list of targets), `duration` is **per part**. The whole preset takes `duration + stagger × (parts − 1)`, and `.enter.end` is when the last part finishes.

Directions (`from`, `to`) always name a **side of the element**: `from: "down"` means it starts at, or comes from, the bottom.

**Enter presets**

| Preset | Params | Effect | Splits into |
|---|---|---|---|
| `fadeIn` | | Opacity 0 → 1 | |
| `fadeUp` | `distance` (40 px) | Fades in while rising | |
| `slideIn` | `from` (`up \| down \| left \| right`, default `down`), `distance` (default: off-canvas) | Slides in from that side | |
| `scaleIn` | `from` (0.8, a scale factor) | Scales up while fading in | |
| `popIn` | | Scales from 0 with overshoot | |
| `bounceIn` | | Drops in from above with a bounce | words, for text |
| `blurIn` | `amount` (18 px) | Unblurs while fading in | |
| `wordReveal` | | Each word rises from behind a mask (text only) | words |
| `lineReveal` | | Same, line by line (text only) | lines |
| `charReveal` | `blur` (true) | Character by character; good for wordmarks (text only) | characters |
| `typewriter` | `cps` (40), `caret` (true) | Types out characters; `duration` is ignored (text only) | |
| `countUp` | `from` (0) | Counts the first number in the text up from `from` (text only) | |
| `trackIn` | `from` (0.4, in em) | Letter-spacing tightens into place while fading in (text only) | |
| `drawOutline` | | Strokes draw themselves (shape, svg, browser, phone frames) | |
| `wipeIn` | `from` (`left \| right \| up \| down`, default `left`) | Revealed by a clip edge starting at that side | |
| `grow` | | Bars grow from the baseline, values count up (chart only) | bars |

With a list `target`, a preset splits across the targets in order. To stagger a container's children, list them as the target.

**Exit presets**

`fadeOut`, `slideOut` (`to`, default `up`), `scaleOut` (`to`, default 0.8), `blurOut` (`amount`), `wordsUp` (words exit upward through the mask; text only, splits into words), `wipeOut` (`to`, default `right`).

**Ambient presets** (default `duration`: from `at` to the end of the scene)

| Preset | Params | Effect |
|---|---|---|
| `kenBurns` | `zoom` (1.12), `pan` (`[dx, dy]` px over the duration) | Slow zoom/pan on images and backgrounds |
| `float` | `amplitude` (10 px), `period` (5 s) | Gentle up-down drift |
| `pulse` | `scale` (1.06), `every` (0.75 s), `ring` (false) | Repeating pulse. With `ring: true`, an outline ring expands and fades behind the element instead |
| `swing` | `angle` (7°), `damping` (2.6) | Damped swing that settles. Pivots on `style.origin` (default `"top"` for this preset) |
| `drift` | `x` (0), `y` (-30), `scale` (1) | Slow constant movement to these offsets over the duration |

### 9.3 Timeline items

`scene.timeline` holds anything beyond `enter` / `exit`. Any item can have an `id`.

**Preset on one or more targets:**

```json
{ "target": ["strip-1", "strip-2", "strip-3"], "preset": "slideIn", "from": "down", "stagger": 0.12, "at": 0.7 }
```

`target` can be an element ID, a list of IDs, `"background"` (the current scene's background), or a component path (`"ama/photo"`).

**Raw property animation:**

```json
{ "id": "lift", "target": "phone", "at": 2.9, "duration": 0.6, "ease": "cubic.inOut",
  "animate": { "scale": [1, 1.04], "y": [0, -20] } }
```

Animatable properties: `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotation`, `opacity`, `blur`, `width`, `height`, `radius`, `color`, `fill`, `stroke`, `letterSpacing`, `fontWeight`, `value` (progress), and template CSS variables.

Values:
- `1.04`: animate **to** this value from the current one.
- `[1, 1.04]`: from → to.
- `[0, 1, 0.8]`: three or more values = keyframes spread evenly over the duration.
- Colours can be palette tokens.

Optional: `stagger` (with a list target), `repeat` (count, or `-1` for the rest of the scene), `yoyo` (bool).

**Combining animations.** Offsets (`x`, `y`, `rotation`) from different animations **add up**. For every other property, the animation that started most recently wins.

**Behavior** (§9.4): `{ "behavior": "scroll", ... }`.

**State change** (§9.5): `{ "target": "add-btn", "state": "added", "at": 2.1 }`.


### 9.4 Behaviors

Behaviors coordinate several things at once. Each has a defined end time, usable as `"<id>.end"`.

**`scroll`**: scroll the content of a `phone`, `browser` or tall image.

```json
{ "id": "to-card", "behavior": "scroll", "target": "phone", "to": "edit-card", "at": 1.15, "duration": 0.9 }
```

- `to`: logical px, an element ID inside the target, `"top"` or `"bottom"`. An element is scrolled until its top sits 24 logical px below the top of the visible area (or as far as the page allows).
- `duration` default 0.9. End: `at + duration`.

**`interaction`**: a cursor or finger performs steps, one after another.

```json
{ "id": "buy", "behavior": "interaction", "at": 0.95, "cursor": "touch", "from": "bottom-right", "pace": "normal",
  "steps": [
    { "id": "pick-m", "click": "size-m", "set": { "size-m": "selected" } },
    { "wait": 0.2 },
    { "id": "add", "click": "add-btn", "set": { "add-btn": "added", "bag-count": "one" } },
    { "id": "search", "type": "search-field", "text": "linen dress" },
    { "id": "go-cart", "click": "bag-icon", "navigate": { "phone": "cart" } }
  ] }
```

Step kinds:
- `click`: move to the target's centre, then press. Target: an element, component path or hotspot.
- `type`: move to a text element, press, then type `text` into it.
- `wait`: pause for that many seconds.

On `click` and `type` steps, optional:
- `set`: `{ element: state }`, applied at the end of the press.
- `navigate`: `{ device-id: screen }`, applied at the end of the press, with optional `transition` on the same step (`push` default, `fade`, `none`). The step ends when the screen change finishes (0.45s later).

Exact timings by `pace` (default `normal`):

| `pace` | Move | Press | Typing |
|---|---|---|---|
| `slow` | 0.7s | 0.2s | 8 chars/s |
| `normal` | 0.5s | 0.18s | 12 chars/s |
| `fast` | 0.35s | 0.15s | 18 chars/s |

- A `click` step takes move + press. A `type` step takes move + press + typing.
- `cursor`: `arrow | pointer | touch`. `from`: canvas anchor where the cursor first appears.
- `at` is when the first move **starts**. The cursor fades in during the 0.2s before `at`, and fades out over 0.3s after the last step (the fade-out doesn't count towards the interaction's end).
- A step with an `id` can be referenced: `"add.end"` is the moment its press ends and `set` applies.
- The interaction's end is the end of its last step.

**`navigate`**: switch a device to another screen (also usable as an interaction step option).

```json
{ "id": "to-home", "behavior": "navigate", "target": "phone", "to": "home", "transition": "push", "at": 3.0 }
```

`transition`: `push` (new screen slides in from the right, default), `fade`, `none`. Duration 0.45s; end = `at + 0.45`. Only the screen content changes; the device stays put. Elements on screens that aren't showing yet can still be referenced; they're positioned when their screen appears.

**`camera`**: move and zoom a `group` like a camera.

```json
{ "id": "cam", "behavior": "camera", "target": "stage", "ease": "expo.inOut",
  "keys": [ { "at": 0, "focus": "hero-title", "zoom": 2.3 }, { "at": 1.45, "focus": "center", "zoom": 1 } ] }
```

- `focus`: an element, component path or hotspot inside the group, or an anchor name of the group (`"center"` = the group's centre).
- Keys interpolate pairwise with `ease`. Two identical keys in a row = hold. End: the last key's `at`.
- Interaction cursors are drawn on top of the camera, at normal size, and follow their targets on screen.

**`focusCycle`**: highlight items one after another, dimming the rest.

```json
{ "id": "speakers", "behavior": "focusCycle", "targets": ["ama", "kwame", "efua", "yaw"], "at": 0.8, "interval": 0.9, "dim": 0.35, "scale": 1.05 }
```

- Each target is highlighted for `interval` seconds. Scaled items overlap their neighbours; layout doesn't reflow.
- After the last item, everything returns to normal over 0.3s. End: `at + interval × count`.

### 9.5 States

Declare named states on an element. The base state is `"default"`. A state can change any `style` property, `content`, `label`, `variant`, `value`, or a toast's `icon`, `title` and `body`.

```json
{ "id": "add-btn", "type": "button", "label": "Add to bag",
  "states": { "added": { "label": "Added to bag ✓", "style": { "fill": "wine" } } } }
```

Switching state animates automatically:
- text and labels roll vertically
- colours blend
- numbers roll
- sizes ease

Switch states with a timeline item (`"state": "added"`) or an interaction step (`"set"`). Optional `duration` (default 0.35).

---

## 10. Transitions

Set on the **incoming** scene. `"theme"` (default) uses `theme.transition`.

```json
"transition": { "type": "wipe", "angle": 15, "bar": "wine", "duration": 0.55 }
```

| Type | Params | Effect |
|---|---|---|
| `cut` | | Instant |
| `crossfade` | | Dissolve |
| `wipe` | `from` (`left \| right \| up \| down`, default `left`), `angle` (−45 to 45°, tilts the edge clockwise, default 0), `bar` (colour or `null`), `barWidth` (46) | An edge sweeps across from that side, optionally with a coloured bar on it |
| `slide` | `from` (`left \| right \| up \| down`, default `right`), `push` (bool) | New scene slides in from that side; with `push` the old scene is pushed out the opposite side |
| `circle` | `origin` (anchor name, or an element in either scene; default `"center"`) | Expanding circle reveal |
| `zoom` | `direction` (`in \| out`) | Zoom through to the next scene |
| `matchCut` | `from` (element in the outgoing scene), `to` (element in the incoming scene, or `"background"`) | The `from` element expands into the `to` element's position and size, joining the two scenes |

All transitions accept `duration` (default from theme, else 0.55) and `ease`.

---

## 11. Editing an existing video (patches)

When a human asks for changes, send a **patch** instead of rewriting the whole spec. Paths start with a unique ID.

```json
[
  { "op": "set", "path": "h1.style.size", "value": 140 },
  { "op": "set", "path": "h1.enter.duration", "value": 1.0 },
  { "op": "set", "path": "intro.duration", "value": 3.5 },
  { "op": "set", "path": "ama.with.name", "value": "Ama K. Owusu" },
  { "op": "add", "scene": "intro", "after": "h1", "element": { "id": "kicker", "type": "text", "content": "New season" } },
  { "op": "remove", "id": "tag" },
  { "op": "move", "id": "tag", "scene": "outro", "after": "cta" },
  { "op": "addScene", "after": "intro", "scene": { "id": "detail", "duration": "auto", "elements": [] } }
]
```

Every patch creates a new version. Use `describe_at(time)` to find which elements a human means when they refer to a timestamp ("at 0:07 the text is too fast").

---

## 12. Tools, errors and lint

Use the tools instead of estimating:
- `validate`: schema and reference errors.
- `lint`: design problems (below).
- `layout`: the computed box (`x`, `y`, `width`, `height`) of every element at a given time. Use it instead of computing text heights by hand.
- `render_contact_sheet`: one image of about 12 frames, to check the look.

Errors are structured. Fix them and resubmit.

```json
{ "level": "error", "path": "scenes[1].elements[0].enter", "code": "unknown-preset",
  "message": "Unknown preset 'wordreveal'.", "suggestion": "Did you mean 'wordReveal'?" }
```

Lint checks include:
- element off-canvas or inside the platform `safeZone`
- unintended overlap
- low text contrast
- too little reading time (`0.5s + 0.3s × words`, not counting time under a transition)
- element never visible
- broken time reference
- missing glyph in the chosen font
- missing asset (placeholder used)
- low motion: a scene longer than 6s with nothing animating

---

## 13. Examples

### 13.1 Minimal

```json
{
  "version": "0.4",
  "video": { "format": "9:16" },
  "scenes": [
    { "id": "hello", "duration": "auto", "background": "#111111",
      "elements": [
        { "id": "msg", "type": "text", "role": "display", "content": "Hello\nworld.",
          "style": { "color": "#FFFFFF" }, "layout": { "anchor": "center" } }
      ] }
  ]
}
```

`msg` gets the default `editorial` text enter (`wordReveal`), and the scene lasts as long as it needs to be read.

### 13.2 Product reel (opening of the Novaé reel)

```json
{
  "version": "0.4",
  "video": { "format": "9:16", "fps": 30, "background": "ink", "safeZone": "reels" },
  "theme": {
    "palette": { "ink": "#1E1512", "bone": "#EEE6DA", "paper": "#F6F1E9", "wine": "#5B1A24", "cocoa": "#6B4532", "sand": "#C9B39A", "mute": "#8C7B6E" },
    "fonts": { "display": "Instrument Serif", "body": "Inter Tight" },
    "motion": "editorial",
    "transition": { "type": "wipe", "angle": 15, "bar": "bone", "duration": 0.55 },
    "texture": { "grain": 0.075 }
  },
  "assets": {
    "hero":      { "type": "image", "src": "images/hero.jpg", "fallback": { "type": "placeholder", "hint": "model in burgundy satin", "color": "wine" } },
    "editorial": { "type": "image", "src": "images/editorial.jpg", "fallback": { "type": "placeholder", "hint": "editorial portrait", "color": "cocoa" } },
    "dress":     { "type": "placeholder", "hint": "satin draped dress", "color": "wine" },
    "blazer":    { "type": "placeholder", "hint": "sculpted blazer", "color": "ink" }
  },
  "scenes": [
    {
      "id": "intro", "duration": 3, "background": "ink",
      "elements": [
        { "id": "h1", "type": "text", "role": "display", "content": "YOUR CLOTHES\nHAVE A LOOK.",
          "style": { "color": "bone" }, "layout": { "anchor": "top-left", "inset": [430, 84] },
          "enter": { "preset": "wordReveal", "at": 0.1, "stagger": 0.09 },
          "exit": { "preset": "wordsUp", "duration": 0.4, "stagger": 0.03 } },
        { "id": "site", "type": "browser", "url": "novae-seven.vercel.app", "chrome": "dark", "background": "ink",
          "padding": [60, 60], "layout": { "x": 64, "y": 1010, "width": 952, "height": 520 },
          "enter": { "preset": "drawOutline", "at": 1.0, "duration": 0.55 },
          "children": [
            { "id": "h1b", "type": "text", "role": "display", "content": "**YOUR WEBSITE\nSHOULD TOO.**",
              "style": { "color": "bone", "size": 150, "letterSpacing": -0.045 },
              "enter": { "preset": "wordReveal", "at": 1.55, "ease": "back.out" } }
          ] }
      ],
      "timeline": [
        { "target": "site", "preset": "fadeUp", "at": 0.9, "distance": 30, "duration": 0.7 }
      ]
    },
    {
      "id": "brand", "duration": 4,
      "background": { "asset": "hero", "fit": "cover", "overlay": { "radial": ["wine/0.35", "wine/0.75"] } },
      "elements": [
        { "id": "brand-block", "type": "stack", "align": "center", "gap": 36,
          "layout": { "anchor": "center" },
          "children": [
            { "id": "mark", "type": "text", "role": "display", "content": "NOVAÉ",
              "style": { "color": "bone", "size": 300 },
              "enter": { "preset": "charReveal", "at": 0.35, "stagger": 0.07 } },
            { "id": "sub", "type": "text", "role": "subtitle", "content": "*A fashion ecommerce concept.*",
              "style": { "color": "bone", "align": "center" }, "enter": "wordReveal" },
            { "id": "rule", "type": "shape", "shape": "line", "layout": { "width": 360 },
              "style": { "stroke": "bone/0.6", "strokeWidth": 2 }, "enter": "wipeIn" },
            { "id": "tag", "type": "button", "variant": "outline", "label": "Concept project by Cualitas",
              "style": { "color": "bone", "stroke": "bone/0.55", "size": 24 }, "enter": "fadeUp" }
          ] }
      ],
      "timeline": [
        { "target": "mark", "preset": "trackIn", "from": 0.42, "at": 0.35, "duration": 1.25 },
        { "target": "mark", "at": 1.6, "duration": 2.4, "ease": "cubic.inOut", "animate": { "scale": [1, 1.06] } }
      ]
    },
    {
      "id": "discover", "duration": 4, "background": "bone",
      "elements": [
        { "id": "h3", "type": "text", "role": "title", "content": "Designed for\ndiscovery.",
          "style": { "color": "ink" }, "layout": { "anchor": "top-left", "inset": [150, 84] } },
        { "id": "phone", "type": "phone", "background": "paper", "gap": 0,
          "layout": { "x": 230, "y": 500, "width": 620 },
          "enter": { "preset": "slideIn", "from": "down", "at": 0.2, "duration": 0.9 },
          "children": [
            { "id": "p-hero", "type": "image", "asset": "hero", "layout": { "height": 470 } },
            { "id": "p-intro", "type": "stack", "gap": 16, "style": { "padding": [28, 20] }, "children": [
              { "id": "p-title", "type": "text", "role": "subtitle", "content": "Pieces worth repeating.", "style": { "color": "ink" } },
              { "id": "p-grid", "type": "grid", "columns": 2, "gap": 10, "children": [
                { "id": "p1", "type": "image", "asset": "dress",  "layout": { "aspect": "3:4" } },
                { "id": "p2", "type": "image", "asset": "blazer", "layout": { "aspect": "3:4" } }
              ] }
            ] },
            { "id": "edit-card", "type": "image", "asset": "editorial", "layout": { "height": 380 } }
          ] }
      ],
      "timeline": [
        { "id": "scroll-1", "behavior": "scroll", "target": "phone", "to": "p-title", "at": 1.15, "ease": "expo.inOut" },
        { "id": "scroll-2", "behavior": "scroll", "target": "phone", "to": "edit-card", "at": "scroll-1.end+0.25", "duration": 0.75, "ease": "expo.inOut" },
        { "id": "tap", "behavior": "interaction", "cursor": "touch", "at": "scroll-2.end+0.1", "steps": [ { "click": "edit-card" } ] }
      ]
    },
    {
      "id": "experience", "duration": "auto",
      "transition": { "type": "matchCut", "from": "edit-card", "to": "background", "duration": 0.55 },
      "background": { "asset": "editorial", "fit": "cover", "overlay": { "linear": ["ink/0.55", "ink/0.15", "ink/0.35"], "angle": 180 } },
      "elements": [
        { "id": "h4a", "type": "text", "role": "title", "content": "Not just a store.",
          "style": { "color": "bone" }, "layout": { "anchor": "top-left", "inset": [170, 84] } },
        { "id": "h4b", "type": "text", "role": "title", "content": "*A brand experience.*",
          "style": { "color": "bone" }, "layout": { "below": "h4a", "gap": 24 },
          "enter": { "preset": "wordReveal", "at": "h4a.enter.end+0.5" } }
      ],
      "timeline": [
        { "target": "background", "preset": "kenBurns", "zoom": 1.12, "at": 0 }
      ]
    }
  ]
}
```

### 13.3 Components, hotspots, overlays, toasts and charts

```json
{
  "version": "0.4",
  "video": { "format": "16:9", "targetDuration": 14, "end": { "type": "fade", "duration": 0.6, "color": "night" } },
  "theme": {
    "palette": { "night": "#0E1626", "bone": "#F2EFE8", "sun": "#F2B544", "mute": "#8A93A6" },
    "fonts": { "display": "Space Grotesk", "body": "Inter Tight" },
    "motion": "snappy",
    "transition": { "type": "slide", "from": "right", "push": true, "duration": 0.5 }
  },
  "assets": {
    "dash": { "type": "image", "src": "assets/dashboard.png",
              "hotspots": { "export": { "text": "Export PDF" } },
              "fallback": { "type": "placeholder", "hint": "invoicing dashboard", "color": "bone" } }
  },
  "components": {
    "stat": {
      "params": { "value": "0", "label": "" },
      "root": { "id": "box", "type": "stack", "gap": 8, "style": { "fill": "bone/0.06", "radius": 20, "padding": [28, 36] },
        "children": [
          { "id": "num", "type": "text", "role": "title", "content": "{{value}}", "style": { "color": "sun" }, "enter": "countUp" },
          { "id": "lbl", "type": "text", "role": "label", "content": "{{label}}", "style": { "color": "mute" } }
        ] }
    }
  },
  "scenes": [
    {
      "id": "demo", "duration": "auto", "background": "night",
      "elements": [
        { "id": "stage", "type": "group", "layout": { "anchor": "center", "width": "100%", "height": "100%" },
          "children": [
            { "id": "dashboard", "type": "browser", "url": "ledgerly.app", "content": "dash", "chrome": "dark",
              "layout": { "anchor": "center", "width": 1400 }, "enter": "fadeUp",
              "overlay": [
                { "id": "export-toast", "type": "toast", "icon": "loader", "title": "Exporting PDF…",
                  "states": { "done": { "icon": "check-circle", "title": "PDF exported", "body": "INV-2041.pdf" } },
                  "style": { "fill": "night", "color": "bone" },
                  "layout": { "anchor": "bottom-right", "inset": 24 } }
              ] }
          ] }
      ],
      "timeline": [
        { "id": "cam", "behavior": "camera", "target": "stage", "ease": "expo.inOut",
          "keys": [ { "at": 1.0, "focus": "center", "zoom": 1 }, { "at": 1.8, "focus": "dashboard#export", "zoom": 1.8 },
                    { "at": "click.end+0.6", "focus": "dashboard#export", "zoom": 1.8 }, { "at": "click.end+1.2", "focus": "center", "zoom": 1 } ] },
        { "id": "click", "behavior": "interaction", "cursor": "pointer", "from": "bottom-right", "at": 1.9,
          "steps": [ { "click": "dashboard#export" } ] },
        { "id": "toast-in", "target": "export-toast", "preset": "slideIn", "from": "right", "distance": 60, "at": "click.end+0.1" },
        { "target": "export-toast", "state": "done", "at": "toast-in.end+0.9" }
      ]
    },
    {
      "id": "stats", "duration": "auto", "background": "night",
      "elements": [
        { "id": "stats-title", "type": "text", "role": "subtitle", "content": "Invoices sent this year",
          "style": { "color": "bone" }, "layout": { "anchor": "top-left", "inset": [100, 120] } },
        { "id": "stat-row", "type": "stack", "direction": "horizontal", "gap": 32,
          "layout": { "below": "stats-title", "gap": 48 },
          "children": [
            { "id": "s-total", "use": "stat", "with": { "value": "12,480", "label": "Invoices" } },
            { "id": "s-paid", "use": "stat", "with": { "value": "94%", "label": "Paid on time" } }
          ] },
        { "id": "per-q", "type": "chart", "kind": "bar",
          "data": [["Q1", 2100], ["Q2", 2800], ["Q3", 3300], ["Q4", 4280]], "highlight": "Q4", "format": "0,0",
          "style": { "fill": "bone/0.25", "stroke": "sun", "color": "bone" },
          "layout": { "anchor": "bottom-right", "inset": [100, 120], "width": 820, "height": 560 },
          "enter": { "preset": "grow", "at": "s-paid/num.enter.end", "stagger": 0.1 } }
      ]
    }
  ],
  "notes": ["Stats and quarterly numbers are illustrative; replace with real figures."]
}
```

---

## 14. Author checklist

Before submitting, check:

- [ ] `version` is `"0.4"`; every `id` is unique and kebab-case
- [ ] Every asset ID used is declared in `assets` (placeholders are fine)
- [ ] Repeated structures use a component, not copy-paste
- [ ] Every time reference points to something in the **same scene**
- [ ] Scenes use `"duration": "auto"` unless a fixed length matters
- [ ] Key content stays at least 72px from the canvas edges, and outside the `safeZone`
- [ ] One idea per scene; scenes of 2–5 seconds
- [ ] Colours come from the theme palette
- [ ] `template` is used only where nothing else works
- [ ] Invented copy is listed in `notes`
