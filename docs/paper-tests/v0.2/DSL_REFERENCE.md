# Sini DSL Reference — v0.2

**Status:** Draft for paper-testing with LLMs. Nothing here is implemented yet.
**Audience:** AI models writing Sini videos. This file is designed to be read in one pass and to be sufficient on its own.

Sini turns a JSON description of a video into a deterministic MP4. You (the AI) describe **what the video shows and when**; Sini handles layout, animation, rendering and encoding. You never write HTML, CSS or JavaScript.

---

## 1. Rules for authors

1. Output **one JSON object** that follows this reference. No comments, no trailing commas.
2. Use only the element types, presets, behaviors, transitions and properties listed here. Do not invent new ones.
3. Every scene and element has an **`id`**: kebab-case, **unique across the whole video**.
4. Prefer the **highest-level tool** that does the job: theme → presets → behaviors → raw `animate`.
5. Prefer **layout** (anchors, relative placement, `%`) over absolute pixels.
6. Prefer **relative timing** (`"h1.enter.end+0.2"`) over hand-computed numbers.
7. If you don't have an image, use a **placeholder asset** (§5). Never leave the video empty waiting for assets.
8. After writing, run `validate` and `lint`, then check a contact sheet before showing a human.

---

## 2. Top-level structure

```json
{
  "version": "0.2",
  "video":  { "format": "9:16", "fps": 30 },
  "theme":  { },
  "assets": { },
  "scenes": [ ]
}
```

| Key | Required | Description |
|---|---|---|
| `version` | yes | Always `"0.2"` |
| `video` | yes | Canvas and output settings (§3) |
| `theme` | no | Palette, fonts, motion personality, default transition, texture (§4) |
| `assets` | no | Images, SVGs, fonts and placeholders, referenced by ID (§5) |
| `scenes` | yes | Ordered list of scenes (§6) |

The video's total duration is the **sum of the scene durations**. You never declare it.

---

## 3. `video`

```json
"video": { "format": "9:16", "fps": 30, "background": "ink", "seed": 1 }
```

| Key | Default | Description |
|---|---|---|
| `format` | `"9:16"` | `"9:16"` (1080×1920), `"1:1"` (1080×1080), `"4:5"` (1080×1350), `"16:9"` (1920×1080) |
| `width`, `height` | from format | Custom size; overrides `format` |
| `fps` | `30` | 24, 25, 30 or 60 |
| `background` | `"#000000"` | Colour behind all scenes |
| `seed` | `1` | Seed for anything pseudo-random (e.g. grain). Same seed → same video |

All pixel values in this DSL are in **canvas pixels** of the chosen size. The origin is the top-left corner.

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
- a token with opacity: `"bone/0.6"`
- a hex value: `"#5B1A24"` or `"#5B1A2499"`
- a gradient: `{ "linear": ["wine", "ink"], "angle": 180 }` or `{ "radial": ["wine/0.35", "ink/0.75"] }`

### 4.2 Fonts and text roles

`fonts` maps three slots to font families: `display`, `body`, `mono`. Families must be bundled with Sini or declared as font assets (§5).

Bundled fonts (all SIL Open Font License): Inter Tight, Instrument Serif, Bricolage Grotesque, Fraunces, DM Serif Display, Space Grotesk, Manrope, JetBrains Mono.

Text elements pick a **role**, which sets font, size, weight and line height. Sizes assume a 1080px-wide canvas.

| Role | Font slot | Size | Line height | Notes |
|---|---|---|---|---|
| `display` | display | 150 | 0.92 | Hero statements, 2–6 words |
| `title` | display | 104 | 0.95 | Scene headlines |
| `subtitle` | display | 64 | 1.05 | |
| `body` | body | 40 | 1.3 | |
| `caption` | body | 26 | 1.4 | |
| `label` | body | 22 | 1.2 | Uppercase, letter-spacing 0.08em |
| `mono` | mono | 28 | 1.4 | |

Override any of these in `theme.roles`, e.g. `"roles": { "title": { "size": 120 } }`.

### 4.3 Motion personality

`motion` sets default easing, durations, stagger and text reveal for every animation that doesn't specify them.

| Personality | Default ease | Enter duration | Stagger | Default text enter |
|---|---|---|---|---|
| `editorial` | `expo.out` | 0.75 | 0.08 | `wordReveal` |
| `snappy` | `back.out` | 0.45 | 0.04 | `popIn` |
| `calm` | `cubic.inOut` | 1.1 | 0.12 | `fadeUp` |
| `playful` | `spring` | 0.6 | 0.06 | `bounceIn` |

Override individual values: `"motion": { "base": "editorial", "duration": 0.6 }`.

### 4.4 Default transition and texture

- `transition`: used by every scene that doesn't set its own (§10).
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
  "site":   { "type": "image", "src": "assets/site-full.png", "fallback": { "type": "placeholder", "color": "bone" } }
}
```

| Form | Meaning |
|---|---|
| `"path"` | Shorthand for an image; type inferred from extension |
| `{ "type": "image" \| "svg" \| "font", "src": ... }` | Explicit asset |
| `{ "type": "placeholder", "hint": ..., "color": ... }` | Procedural stand-in (textured gradient). `hint` is kept so a human can swap in a real asset later |
| `fallback` | Used automatically if `src` is missing |

Paths are relative to the project folder. Remote URLs are not allowed (they break determinism).

---

## 6. Scenes

```json
{
  "id": "intro",
  "duration": 3,
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
| `duration` | yes | Seconds. Typical: 2–5 |
| `background` | no | Colour, gradient, or `{ "asset": "hero", "fit": "cover", "overlay": <colour> }` |
| `transition` | no | How this scene **enters** (§10). Default: `"theme"`. Ignored on the first scene |
| `cues` | no | Named time points for this scene (§8) |
| `elements` | yes | What's on screen (§7) |
| `timeline` | no | Extra animations and behaviors (§9) |

**Scene overlap.** A transition starts at the incoming scene's `t = 0`. During the transition, the outgoing scene keeps playing underneath, past its own `duration`. You don't need to account for this.

---

## 7. Elements

### 7.1 Common properties

Every element accepts:

| Key | Description |
|---|---|
| `id` | Required. Unique |
| `type` | Required. See §7.3 |
| `layout` | Position and size (§7.2) |
| `style` | Visual properties (below) |
| `enter` | Preset that brings it in (§9.2) |
| `exit` | Preset that takes it out (§9.2) |
| `states` | Named visual states (§9.5) |
| `z` | Stacking order. Default: declaration order (later = on top) |

`style` accepts: `opacity` (0–1), `rotation` (deg), `scale`, `radius` (px), `fill`, `stroke`, `strokeWidth`, `shadow` (`"none" | "soft" | "deep"`), `blur` (px), `blend` (`"normal" | "multiply" | "screen" | "overlay"`).

An element with no `enter` is visible from scene start. An element with no `exit` stays until the scene ends.

### 7.2 Layout

Choose **one** placement method.

**Anchor to the canvas (or parent):**

```json
"layout": { "anchor": "top-left", "inset": [430, 84], "width": "84%" }
```

- `anchor`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. Default `top-left`.
- `inset`: distance from the anchored edges, `[vertical, horizontal]` or one number for both. Ignored on centred axes.
- `offset`: `[dx, dy]` nudge after placement.

**Relative to another element:**

```json
"layout": { "below": "h1", "gap": 120, "align": "start", "width": 952 }
```

- One of `below`, `above`, `leftOf`, `rightOf`: an element ID in the same scene.
- `gap`: distance in px. Default 32.
- `align`: `start | center | end` on the other axis, relative to the referenced element. Default `start`.

**Absolute:**

```json
"layout": { "x": 64, "y": 1010, "width": 952, "height": 520 }
```

**Size**, for all methods:
- `width`, `height`: px, `"%"` of parent, or `"auto"` (default for text and buttons).
- `maxWidth`: text wraps at this width. Default for text: canvas width minus 2 × 72.
- `aspect`: e.g. `"3:4"`; height is derived from width.

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
| `content` | String. `\n` = line break. `*italic*`, `**bold**` |
| `role` | §4.2. Default `body` |
| `style.color`, `align` (`left | center | right`), `size`, `weight`, `lineHeight`, `letterSpacing` (em), `uppercase`, `italic` | Overrides on top of the role |
| `fit` | `"none"` (default) or `"shrink"`: reduce size until it fits `maxWidth` and `maxLines` |
| `maxLines` | Used with `fit: "shrink"` |

Numeric `content` (e.g. `"0"`) can be changed by states and animated with `countUp`.

#### `image`

```json
{ "id": "hero-img", "type": "image", "asset": "hero",
  "layout": { "anchor": "center", "width": "100%", "height": "100%" },
  "fit": "cover", "focus": [50, 30] }
```

`fit`: `cover | contain`. `focus`: `[x%, y%]` point kept in view when cropping.

#### `shape`

```json
{ "id": "rule", "type": "shape", "shape": "line",
  "layout": { "below": "sub", "gap": 40, "align": "center", "width": 360 },
  "style": { "stroke": "bone/0.6", "strokeWidth": 2 } }
```

`shape`: `rect | circle | ellipse | line | pill`.

#### `svg`

`{ "type": "svg", "asset": "logo" }`. Stroke-based SVGs work with `drawOutline`.

#### `button`

```json
{ "id": "add-btn", "type": "button", "label": "Add to bag", "variant": "solid",
  "style": { "fill": "ink", "color": "bone" } }
```

`variant`: `solid | outline | ghost`.

#### `progress`

A step tracker (order status, onboarding steps, timelines).

```json
{ "id": "track", "type": "progress",
  "steps": ["Paid", "Packed", "On the way", "Delivered"], "value": 0,
  "style": { "fill": "sand", "color": "bone" } }
```

`value` is the index of the current step. Animate it (`"animate": { "value": [0, 2] }`) to move the indicator.

#### `browser` and `phone` (device mockups)

```json
{ "id": "site", "type": "browser", "url": "novae.shop",
  "content": "site-screenshot",
  "chrome": "light",
  "layout": { "x": 64, "y": 1010, "width": 952, "height": 520 } }
```

```json
{ "id": "phone", "type": "phone",
  "layout": { "anchor": "bottom", "inset": [-120, 0], "width": 620 },
  "children": [ ] }
```

| Key | Description |
|---|---|
| `content` | Asset ID of a screenshot. Tall screenshots can be scrolled (§9.4) |
| `children` | Instead of a screenshot: elements laid out as a vertical page inside the screen, like a mini website |
| `url` | Browser only. Shown in the address bar |
| `chrome` | `light | dark | none`. Default `light` |

A phone's height defaults to `width × 2.1`. Device `children` stack vertically with no gap and stretch to the screen width unless they set their own `width`.

#### Containers: `group`, `stack`, `grid`

```json
{ "id": "cards", "type": "grid", "columns": 2, "gap": 16,
  "layout": { "below": "h2", "gap": 48, "width": "86%" },
  "children": [ ] }
```

| Type | Behaviour |
|---|---|
| `group` | Children use their own `layout`, relative to the group's box. Use for cameras and for moving things together |
| `stack` | Children placed in a row or column. Keys: `direction` (`vertical | horizontal`), `gap`, `align` (`start | center | end | stretch`), `justify` (`start | center | end | space-between`) |
| `grid` | Children fill cells left to right. Keys: `columns`, `gap`, `rowGap` |

Children of `stack` and `grid` ignore their own placement keys but keep size keys.

#### `template` (escape hatch)

Use **only** when nothing else can express the design.

```json
{ "id": "ticket", "type": "template",
  "html": "<div class='t'><b>{{title}}</b><span>{{price}}</span></div>",
  "css": ".t{display:flex;justify-content:space-between;font-size:32px;transform:translateY(calc(var(--lift)*-20px))}",
  "params": { "title": "Satin Dress", "price": "GH₵ 650" },
  "vars": { "--lift": 0 } }
```

- No JavaScript. `<script>`, event handlers and external URLs are rejected.
- Animate it through its CSS variables: `"animate": { "--lift": [0, 1] }`.

---

## 8. Time

All times are **scene-local seconds**: `0` is the start of the scene.

Anywhere a time is expected (`at`), you can write a number or an expression:

| Expression | Meaning |
|---|---|
| `1.2` | 1.2s after scene start |
| `"scene.end-0.4"` | 0.4s before scene end. `scene.start` is 0 |
| `"h1.enter.start"`, `"h1.enter.end"` | When element `h1`'s enter animation starts / ends |
| `"h1.exit.start"`, `"h1.exit.end"` | Same for its exit |
| `"prev.enter.end"` | The previous element (in declaration order) that has an `enter` |
| `"a1.start"`, `"a1.end"` | A timeline item with `"id": "a1"` |
| `"cue:reveal"` | A cue declared in `scene.cues` |

Add or subtract one number: `"h1.enter.end+0.2"`, `"cue:reveal-0.1"`.

References must point to the **same scene**.

**Default timing.** If you omit `at`:
- The first `enter` in a scene starts at `0.3`.
- Each following `enter` starts at `"prev.enter.end-0.2"` (slight overlap).
- An `exit` ends exactly at `scene.end`.

So a scene whose elements all have `enter` presets and no `at` plays them in order automatically.

---

## 9. Animation

### 9.1 Easing

`linear`, and `<family>.in | .out | .inOut` for families `sine`, `cubic`, `quart`, `expo`, `back`; plus `spring` (optionally `{ "spring": { "bounce": 0.3 } }`). Default: from the theme's motion personality.

### 9.2 Presets

Use on an element's `enter` / `exit`, or in a timeline item with `preset`.

Short form: `"enter": "wordReveal"`.
Long form: `"enter": { "preset": "wordReveal", "at": 0.4, "duration": 0.8, "stagger": 0.07, "ease": "expo.out" }`.

All presets accept `at`, `duration`, `ease`, `stagger` (for multi-part targets).

**Enter presets**

| Preset | Params | Effect |
|---|---|---|
| `fadeIn` | | Opacity 0 → 1 |
| `fadeUp` | `distance` (40) | Fade in while rising |
| `slideIn` | `from` (`up | down | left | right`), `distance` (default: off-canvas) | Slides in |
| `scaleIn` | `from` (0.8) | Scales up while fading in |
| `popIn` | | Scales from 0 with overshoot |
| `bounceIn` | | Drops in with a bounce |
| `blurIn` | `amount` (18) | Unblurs while fading in |
| `wordReveal` | `stagger` | Each word rises from behind a mask (text only) |
| `lineReveal` | `stagger` | Same, line by line (text only) |
| `charReveal` | `stagger`, `blur` (true) | Character by character with blur; good for wordmarks (text only) |
| `typewriter` | `cps` (40), `caret` (true) | Types out characters (text only) |
| `countUp` | `from` (0) | Counts up to the numeric `content` (text only) |
| `drawOutline` | | Strokes draw themselves (shape, svg, browser, phone frames) |
| `wipeIn` | `from` (`left | right | up | down`) | Revealed by a moving clip edge |
| `trackIn` | `from` (0.4em) | Letter-spacing tightens into place while fading in (text only) |

**Exit presets**

`fadeOut`, `slideOut` (`to`), `scaleOut`, `blurOut`, `wordsUp` (words exit upward through the mask), `wipeOut` (`to`).

**Ambient presets** (default `duration`: from `at` to the end of the scene)

| Preset | Params | Effect |
|---|---|---|
| `kenBurns` | `zoom` (1.12), `pan` (`[dx, dy]`) | Slow zoom/pan on images |
| `float` | `amplitude` (10), `period` (5) | Gentle up-down drift |
| `pulse` | `scale` (1.06), `every` (0.75) | Repeating pulse, e.g. a CTA ring |
| `swing` | `angle` (7), `damping` (2.6) | Damped pendulum swing that settles |
| `drift` | `y` (-30) | Slow constant movement |

### 9.3 Timeline items

`scene.timeline` holds anything beyond `enter` / `exit`. Each item is one of three kinds.

**Preset on one or more targets:**

```json
{ "target": ["strip-1", "strip-2", "strip-3"], "preset": "slideIn", "from": "down", "stagger": 0.12, "at": 0.7 }
```

`target` can be an element ID, a list of IDs, or `"background"` for the current scene's background.

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

Optional: `repeat` (count, or `-1` for the rest of the scene), `yoyo` (bool).

**Behavior** (§9.4): `{ "behavior": "scroll", ... }`.

**State change** (§9.5): `{ "target": "add-btn", "state": "added", "at": 2.1 }`.

### 9.4 Behaviors

Behaviors coordinate several things at once.

**`scroll`**: scroll the content of a `phone`, `browser` or tall image.

```json
{ "behavior": "scroll", "target": "phone", "to": "edit-card", "at": 1.15, "duration": 0.9 }
```

`to`: pixels, an element ID inside the target (scrolls it into view), `"top"` or `"bottom"`.

**`interaction`**: a cursor or finger performs steps.

```json
{ "behavior": "interaction", "at": 0.95, "cursor": "touch", "from": "bottom-right",
  "steps": [
    { "click": "size-m", "set": { "size-m": "selected" } },
    { "wait": 0.2 },
    { "click": "add-btn", "set": { "add-btn": "added", "bag-count": "one" } },
    { "type": "search", "text": "linen dress" }
  ] }
```

- `cursor`: `arrow | pointer | touch`.
- `click` moves to an element (about 0.5s), presses it (0.18s) and applies `set` (element → state).
- `type` types into a text element.
- `wait` pauses.
- `pace`: `slow | normal | fast`.

**`camera`**: move and zoom a `group` like a camera.

```json
{ "behavior": "camera", "target": "stage", "ease": "expo.inOut",
  "keys": [ { "at": 0, "focus": "hero-title", "zoom": 2.3 }, { "at": 1.45, "focus": "center", "zoom": 1 } ] }
```

**`focusCycle`**: highlight items one after another, dimming the rest.

```json
{ "behavior": "focusCycle", "targets": ["p1", "p2", "p3"], "at": 0.8, "interval": 0.9, "dim": 0.35, "scale": 1.05 }
```

### 9.5 States

Declare named states on an element. The base state is `"default"`. Any style property, `content` or `label` can change.

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
| `crossfade` | `duration` | Dissolve |
| `wipe` | `angle` (deg, 0 = vertical edge moving right), `bar` (colour or null), `barWidth` (46) | A slanted edge sweeps across, optionally with a coloured bar on the edge |
| `slide` | `direction`, `push` (bool) | New scene slides in; with `push` the old scene is pushed out |
| `circle` | `origin` (anchor or element ID) | Expanding circle reveal |
| `zoom` | `direction` (`in | out`) | Zoom through to the next scene |
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
  { "op": "add", "scene": "intro", "after": "h1", "element": { "id": "kicker", "type": "text", "content": "New season" } },
  { "op": "remove", "id": "tag" },
  { "op": "move", "id": "tag", "scene": "outro", "after": "cta" },
  { "op": "addScene", "after": "intro", "scene": { "id": "detail", "duration": 3, "elements": [] } }
]
```

Every patch creates a new version. Use `describe_at(time)` to find which elements a human means when they refer to a timestamp ("at 0:07 the text is too fast").

---

## 12. Errors and lint

Validation and lint return structured messages. Fix them and resubmit.

```json
{ "level": "error", "path": "scenes[1].elements[0].enter", "code": "unknown-preset",
  "message": "Unknown preset 'wordreveal'.", "suggestion": "Did you mean 'wordReveal'?" }
```

Lint checks include: element off-canvas, unintended overlap, low text contrast, too little reading time, element never visible, broken time reference, missing asset (placeholder used).

**Reading time rule of thumb:** a text block should stay fully visible for at least `0.5s + 0.3s × words`.

---

## 13. Examples

### 13.1 Minimal

```json
{
  "version": "0.2",
  "video": { "format": "9:16" },
  "scenes": [
    { "id": "hello", "duration": 3, "background": "#111111",
      "elements": [
        { "id": "msg", "type": "text", "role": "display", "content": "Hello\nworld.",
          "style": { "color": "#FFFFFF" }, "layout": { "anchor": "center" }, "enter": "wordReveal" }
      ] }
  ]
}
```

### 13.2 Product reel (opening of the Novaé reel)

```json
{
  "version": "0.2",
  "video": { "format": "9:16", "fps": 30, "background": "ink" },
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
          "exit": { "preset": "wordsUp", "duration": 0.4 } },
        { "id": "site", "type": "browser", "url": "novae-seven.vercel.app", "chrome": "dark",
          "layout": { "x": 64, "y": 1010, "width": 952, "height": 520 },
          "enter": { "preset": "drawOutline", "at": 1.0, "duration": 0.55 },
          "children": [
            { "id": "h1b", "type": "text", "role": "display", "content": "**YOUR WEBSITE\nSHOULD TOO.**",
              "style": { "color": "bone", "size": 112, "letterSpacing": -0.045 },
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
        { "id": "mark", "type": "text", "role": "display", "content": "NOVAÉ",
          "style": { "color": "bone", "size": 300, "align": "center" },
          "layout": { "anchor": "center", "offset": [0, -150] },
          "enter": { "preset": "charReveal", "at": 0.35, "stagger": 0.07 } },
        { "id": "sub", "type": "text", "role": "subtitle", "content": "*A fashion ecommerce concept.*",
          "style": { "color": "bone", "align": "center" },
          "layout": { "below": "mark", "gap": 30, "align": "center" }, "enter": "wordReveal" },
        { "id": "rule", "type": "shape", "shape": "line",
          "style": { "stroke": "bone/0.6", "strokeWidth": 2 },
          "layout": { "below": "sub", "gap": 40, "align": "center", "width": 360 },
          "enter": "wipeIn" },
        { "id": "tag", "type": "button", "variant": "outline", "label": "Concept project by Cualitas",
          "style": { "color": "bone", "stroke": "bone/0.55" },
          "layout": { "below": "rule", "gap": 48, "align": "center" }, "enter": "fadeUp" }
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
          "style": { "color": "ink" }, "layout": { "anchor": "top-left", "inset": [150, 84] }, "enter": "wordReveal" },
        { "id": "phone", "type": "phone",
          "layout": { "x": 230, "y": 500, "width": 620 },
          "enter": { "preset": "slideIn", "from": "down", "at": 0.2, "duration": 0.9 },
          "children": [
            { "id": "p-hero", "type": "image", "asset": "hero", "layout": { "height": 760 } },
            { "id": "p-title", "type": "text", "role": "subtitle", "content": "Pieces worth repeating.", "style": { "color": "ink" } },
            { "id": "p-grid", "type": "grid", "columns": 2, "gap": 16, "children": [
              { "id": "p1", "type": "image", "asset": "dress",  "layout": { "aspect": "3:4" } },
              { "id": "p2", "type": "image", "asset": "blazer", "layout": { "aspect": "3:4" } }
            ] },
            { "id": "edit-card", "type": "image", "asset": "editorial", "layout": { "height": 620 } }
          ] }
      ],
      "timeline": [
        { "behavior": "scroll", "target": "phone", "to": "p-title", "at": 1.15, "duration": 0.9, "ease": "expo.inOut" },
        { "behavior": "scroll", "target": "phone", "to": "edit-card", "at": 2.3, "duration": 0.75, "ease": "expo.inOut" },
        { "behavior": "interaction", "cursor": "touch", "at": 3.1, "steps": [ { "click": "edit-card" } ] }
      ]
    },
    {
      "id": "experience", "duration": 4,
      "transition": { "type": "matchCut", "from": "edit-card", "to": "background", "duration": 0.55 },
      "background": { "asset": "editorial", "fit": "cover", "overlay": { "linear": ["ink/0.55", "ink/0.15", "ink/0.35"], "angle": 180 } },
      "elements": [
        { "id": "h4a", "type": "text", "role": "title", "content": "Not just a store.",
          "style": { "color": "bone" }, "layout": { "anchor": "top-left", "inset": [170, 84] }, "enter": "wordReveal" },
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

---

## 14. Author checklist

Before submitting, check:

- [ ] `version` is `"0.2"`; every `id` is unique and kebab-case
- [ ] Every asset ID used is declared in `assets` (placeholders are fine)
- [ ] Every time reference points to an element or cue in the **same scene**
- [ ] Text has enough reading time (`0.5s + 0.3s × words`)
- [ ] Key content stays at least 72px from the canvas edges
- [ ] One idea per scene; scenes of 2–5 seconds
- [ ] Colours come from the theme palette unless there's a reason
- [ ] `template` is used only where nothing else works
