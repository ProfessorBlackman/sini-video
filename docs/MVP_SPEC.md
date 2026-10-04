# Sini — MVP Specification

**Status:** MVP Definition  
**Version:** 0.1  
**Note:** [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md) supersedes parts of this spec (GSAP is dropped, the browser preview is replaced by contact sheets and draft renders, Docker-first packaging, and more). Where they conflict, PRODUCT_DIRECTION.md wins.  
**Purpose:** Define the minimum viable product for a deterministic, AI-programmable motion/video engine that can be accessed through both a CLI and MCP.

---

## 1. Product Vision

Sini is a programmable video rendering engine designed to let any capable AI model create short-form motion graphics and product/brand videos without requiring a dedicated video-generation model.

The core model is:

```text
AI Model
   ↓
Video Specification (DSL / JSON)
   ↓
Sini Engine
   ↓
Deterministic Renderer
   ↓
FFmpeg
   ↓
MP4 / WebM
```

The AI model is responsible for **creative direction and composition**.

Sini is responsible for **layout, animation, timing, rendering, and export**.

The engine must be deterministic: given the same specification, assets, fonts, renderer version, and configuration, it should produce the same result.

---

## 2. MVP Goal

The MVP should prove that an AI model can reliably generate useful marketing/product motion videos by producing a structured video specification rather than arbitrary HTML/CSS/JavaScript.

The MVP is successful when:

1. An LLM can generate a valid video specification using the documented DSL.
2. The specification can be validated without rendering.
3. The same specification can be rendered deterministically.
4. The engine can produce an MP4.
5. The engine can generate preview frames.
6. The engine can be controlled from the CLI.
7. The same engine can be controlled through MCP.
8. The Novaé and Cualitas example videos can be represented using the DSL.
9. The system can be used without knowing whether the underlying renderer uses GSAP, DOM, SVG, Canvas, or another implementation.
10. CLI and MCP produce equivalent results because both call the same core API.

---

# 3. Non-Goals for the MVP

The MVP should deliberately avoid becoming a full video-generation platform.

Do **not** build initially:

- AI video generation
- AI image generation
- AI voice generation
- automatic script writing
- automatic music generation
- advanced 3D rendering
- WebGL rendering
- physics simulation
- particle systems
- character animation
- facial animation
- automatic editing of arbitrary source videos
- cloud rendering infrastructure
- collaborative editing
- browser-based visual editor
- complex audio mixing
- multiple rendering backends

These may become future capabilities.

The MVP is primarily a **deterministic motion graphics compiler and renderer**.

---

# 4. Core Architecture

```text
                       ┌──────────────────┐
                       │      AI Model    │
                       │ GPT / Claude /   │
                       │ Gemini / Local   │
                       └────────┬─────────┘
                                │
                                │ JSON DSL
                                ▼
                    ┌────────────────────────┐
                    │     Sini Core          │
                    │                        │
                    │ Schema Validation      │
                    │ Timeline               │
                    │ Scene Graph            │
                    │ Interpolation          │
                    │ Easing                 │
                    │ Asset Resolution       │
                    └───────────┬────────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
             ┌───────────┐             ┌───────────┐
             │    CLI    │             │    MCP    │
             └─────┬─────┘             └─────┬─────┘
                   │                         │
                   └────────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   Browser Renderer     │
                    │                        │
                    │ HTML / SVG / GSAP      │
                    └───────────┬────────────┘
                                │
                                ▼
                           Chromium
                                │
                                ▼
                             FFmpeg
                                │
                                ▼
                       MP4 / WebM / Frames
```

### Architectural principle

The CLI and MCP must **never implement their own rendering logic**.

Both should call the same public core API.

```text
CLI ───────┐
           ├──> Sini Core ──> Renderer ──> Exporter
MCP ───────┘
```

This guarantees feature parity.

---

# 5. Package Structure

Recommended monorepo structure:

```text
sini/
│
├── packages/
│
│   ├── core/
│   │   ├── scene/
│   │   ├── timeline/
│   │   ├── animation/
│   │   ├── easing/
│   │   ├── interpolation/
│   │   ├── assets/
│   │   └── compiler/
│   │
│   ├── schema/
│   │   ├── video.schema.json
│   │   ├── scene.schema.json
│   │   ├── element.schema.json
│   │   ├── animation.schema.json
│   │   └── transition.schema.json
│   │
│   ├── components/
│   │   ├── text/
│   │   ├── image/
│   │   ├── shape/
│   │   ├── svg/
│   │   ├── browser/
│   │   ├── phone/
│   │   ├── device/
│   │   ├── card/
│   │   └── logo/
│   │
│   ├── behaviors/
│   │   ├── word-reveal/
│   │   ├── typewriter/
│   │   ├── image-scroll/
│   │   ├── focus/
│   │   ├── stagger/
│   │   ├── carousel/
│   │   └── process/
│   │
│   ├── transitions/
│   │   ├── wipe/
│   │   ├── circle/
│   │   ├── zoom/
│   │   ├── slide/
│   │   ├── crossfade/
│   │   └── match-cut/
│   │
│   ├── renderer-browser/
│   │   ├── compiler/
│   │   ├── dom/
│   │   ├── svg/
│   │   └── gsap/
│   │
│   ├── exporter/
│   │   └── ffmpeg/
│   │
│   ├── cli/
│   │
│   └── mcp/
│
├── examples/
│   ├── novae.json
│   └── cualitas.json
│
├── docs/
│   ├── DSL.md
│   ├── COMPONENTS.md
│   ├── ANIMATIONS.md
│   ├── MCP.md
│   └── CLI.md
│
└── README.md
```

---

# 6. Video DSL

The Video DSL is the primary contract between AI models and the engine.

The LLM should generate JSON, not arbitrary HTML or JavaScript.

Basic structure:

```json
{
  "version": "0.1",

  "video": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "duration": 15,
    "background": "#000000"
  },

  "assets": {},

  "scenes": []
}
```

---

# 7. Video Configuration

Required:

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 15
}
```

Optional:

```json
{
  "background": "#000000",
  "format": "mp4",
  "quality": "high"
}
```

MVP target formats:

- 1080×1920 — vertical/social
- 1920×1080 — landscape
- 1080×1080 — square

---

# 8. Assets

Assets should be referenced by identifiers rather than embedded directly into the DSL.

Example:

```json
{
  "assets": {
    "hero": {
      "type": "image",
      "src": "assets/hero.jpg"
    },

    "logo": {
      "type": "svg",
      "src": "assets/logo.svg"
    }
  }
}
```

The engine should support:

- images
- SVG
- local fonts
- logos
- screenshots

Base64-embedded assets should not be the normal representation.

---

# 9. Core Elements

MVP elements:

```text
text
image
shape
svg
group
browser
phone
device
card
logo
```

## Text

```json
{
  "id": "headline",
  "type": "text",
  "content": "Ideas deserve better software.",
  "style": {
    "font": "Bricolage Grotesque",
    "size": 120,
    "weight": 500,
    "color": "#17150F"
  },
  "position": {
    "x": 100,
    "y": 300
  }
}
```

## Image

```json
{
  "id": "hero",
  "type": "image",
  "asset": "hero",
  "position": {
    "x": 0,
    "y": 0
  },
  "size": {
    "width": 1080,
    "height": 1080
  },
  "fit": "cover"
}
```

## Browser

```json
{
  "id": "website",
  "type": "browser",
  "content": {
    "url": "example.com",
    "image": "website-screenshot"
  },
  "position": {
    "x": 100,
    "y": 500
  },
  "size": {
    "width": 880,
    "height": 600
  }
}
```

## Phone

```json
{
  "id": "phone",
  "type": "phone",
  "content": {
    "image": "mobile-screenshot"
  },
  "position": {
    "x": 650,
    "y": 600
  }
}
```

---

# 10. Animation System

Animation is separate from elements.

Generic property animation:

```json
{
  "target": "headline",
  "animate": {
    "opacity": [0, 1],
    "y": [100, 0]
  },
  "at": 0.5,
  "duration": 1,
  "ease": "expo.out"
}
```

MVP animatable properties:

```text
x
y
scale
scaleX
scaleY
rotation
rotationX
rotationY
opacity
width
height
blur
letterSpacing
fontWeight
fontWidth
color
```

The animation system should support:

- from/to values
- duration
- delay
- start time
- easing
- stagger
- repeat
- yoyo

---

# 11. Semantic Animation Presets

To make the DSL AI-friendly, the engine should expose high-level animation types.

MVP:

```text
fadeIn
fadeOut
slideIn
slideOut
scaleIn
scaleOut
wordReveal
lineReveal
typewriter
imageScroll
blurIn
stagger
focus
```

Example:

```json
{
  "target": "headline",
  "animation": {
    "type": "wordReveal",
    "duration": 0.8,
    "stagger": 0.07
  },
  "at": 0.4
}
```

The compiler translates this into lower-level property animations.

---

# 12. Behaviors

Behaviors represent coordinated interactions or animation patterns.

MVP behaviors:

```text
focus
carousel
imageScroll
browserScroll
processSteps
cursorClick
typewriter
stagger
cameraPull
```

Example:

```json
{
  "type": "projectShowcase",
  "projects": [
    "novae",
    "aurelle",
    "miles"
  ],
  "behavior": {
    "type": "focus",
    "interval": 0.9
  }
}
```

A behavior may internally control multiple properties and elements.

---

# 13. Transitions

MVP transitions:

```text
wipe
circleReveal
zoom
slide
crossfade
matchCut
```

Example:

```json
{
  "transition": {
    "type": "wipe",
    "direction": "left",
    "duration": 0.6
  }
}
```

Transitions belong between scenes rather than being tied to a particular renderer.

---

# 14. Timeline

The engine must have a deterministic timeline abstraction.

Conceptually:

```text
0s ───────────────────────────────────── 15s

Scene 1
████████

        Scene 2
        █████████████

                      Scene 3
                      ████████

                              Scene 4
                              █████████
```

The timeline must support:

- absolute time
- relative time
- scene-local time
- animation duration
- overlapping animations
- stagger
- transitions
- seeking

A renderer must be able to request:

```ts
renderFrame(time: number)
```

and obtain the exact visual state at that time.

This deterministic frame access is a core requirement.

---

# 15. Renderer

The MVP renderer should use:

```text
HTML
CSS
SVG
GSAP
Chromium
```

GSAP is an implementation detail.

The DSL must not contain GSAP-specific concepts.

For example, this should never appear in the DSL:

```json
{
  "gsap": {
    "fromTo": {}
  }
}
```

Instead:

```json
{
  "animate": {
    "opacity": [0, 1]
  }
}
```

The browser renderer translates the DSL into GSAP/DOM/SVG operations.

---

# 16. Rendering Pipeline

```text
video.json
    ↓
Schema validation
    ↓
Asset resolution
    ↓
Scene compilation
    ↓
Timeline compilation
    ↓
HTML/SVG generation
    ↓
Chromium
    ↓
Frame rendering
    ↓
FFmpeg
    ↓
output.mp4
```

The renderer should be able to render:

### Full video

```text
render(0)
render(1/fps)
render(2/fps)
...
render(duration)
```

### Individual frame

```text
renderFrame(7.5)
```

### Preview frames

```text
renderFrames([0, 3, 7.5, 12, 14])
```

---

# 17. Exporter

FFmpeg handles final video encoding.

MVP output:

```text
MP4
H.264
yuv420p
faststart
```

Optional:

```text
WebM
PNG frames
JPEG frames
```

---

# 18. CLI Interface

The CLI is one of the two primary interfaces.

Command:

```bash
sini
```

## Validate

```bash
sini validate video.json
```

Expected output:

```text
✓ Valid Video DSL
✓ 4 scenes
✓ 13 elements
✓ 9 animations
✓ 3 assets
```

## Preview

```bash
sini preview video.json
```

Should launch a local browser preview.

## Render

```bash
sini render video.json
```

Output:

```text
dist/video.mp4
```

## Render specific frame

```bash
sini frame video.json --time 7.5
```

## Render preview frames

```bash
sini frames video.json --times 0,3,7.5,12
```

## Inspect

```bash
sini inspect video.json
```

Should show:

```text
Video
 ├── Scene: intro
 │    ├── headline
 │    └── note
 │
 ├── Scene: projects
 │    └── projectShowcase
 │
 └── Scene: ending
      └── logo
```

---

# 19. MCP Interface

MCP is a first-class interface, not an afterthought.

The MCP server should expose the Sini Engine to AI clients such as Claude Desktop, Cursor, and other MCP-compatible applications.

The MCP server calls the same core APIs used by the CLI.

Architecture:

```text
MCP Client
   │
   ▼
Sini MCP Server
   │
   ▼
Sini Core
   │
   ├── Compiler
   ├── Renderer
   └── Exporter
```

---

# 20. MCP Tools

MVP MCP tools should include:

## `create_video`

Create a video specification.

Input:

```json
{
  "spec": {}
}
```

Returns:

```json
{
  "video_id": "vid_123",
  "status": "created"
}
```

---

## `validate_video`

Validate a video specification.

Input:

```json
{
  "spec": {}
}
```

Returns validation errors or success.

---

## `preview_video`

Compile and prepare a browser preview.

Input:

```json
{
  "video_id": "vid_123"
}
```

Returns the preview location.

---

## `render_video`

Render a video.

Input:

```json
{
  "video_id": "vid_123",
  "format": "mp4"
}
```

Returns:

```json
{
  "status": "complete",
  "output": "dist/video.mp4"
}
```

---

## `render_frame`

Render a frame at a specific time.

```json
{
  "video_id": "vid_123",
  "time": 7.5
}
```

---

## `get_video`

Retrieve the current video specification.

---

## `update_video`

Modify a video specification.

---

## `list_components`

Return available components.

Example:

```json
{
  "components": [
    "text",
    "image",
    "browser",
    "phone",
    "device",
    "card",
    "logo"
  ]
}
```

---

## `list_animations`

Return available animation presets.

---

## `list_transitions`

Return available transitions.

---

# 21. MCP Resources

The MCP server should also expose documentation/schema resources so an AI client can discover how to use the engine.

Potential resources:

```text
sini://schema/video
sini://schema/scene
sini://schema/element
sini://schema/animation
sini://components
sini://animations
sini://transitions
sini://examples/novae
sini://examples/cualitas
```

This is important.

The AI should not need a massive system prompt containing the entire Sini Engine API.

It should be able to discover the capabilities through MCP.

---

# 22. MCP Prompts

Optional MVP prompts:

```text
create-social-reel
create-product-demo
create-portfolio-reel
create-brand-film
```

Example:

```text
create-social-reel

Inputs:
- brand
- message
- duration
- format
- assets
- tone
```

The prompt should guide the AI to produce a Video DSL specification using the available engine primitives.

---

# 23. CLI and MCP Parity

The same operation should map cleanly between interfaces.

| Core operation | CLI | MCP |
|---|---|---|
| Validate | `sini validate` | `validate_video` |
| Preview | `sini preview` | `preview_video` |
| Render | `sini render` | `render_video` |
| Frame | `sini frame` | `render_frame` |
| Inspect | `sini inspect` | `get_video` |
| Components | `sini components` | `list_components` |
| Animations | `sini animations` | `list_animations` |
| Transitions | `sini transitions` | `list_transitions` |

No duplicated business logic.

---

# 24. AI Workflow

The intended workflow is:

```text
User
 │
 │ "Create a 15 second reel for my website"
 ▼
AI Model
 │
 │ discovers Sini capabilities
 ▼
MCP
 │
 │ generates Video DSL
 ▼
Sini Core
 │
 │ validates
 ▼
Renderer
 │
 │ generates preview
 ▼
AI Model
 │
 │ evaluates preview
 │
 ├── good ────────> render final
 │
 └── bad ─────────> modify DSL
                       │
                       └──> render again
```

This iterative loop is one of the major reasons the engine should expose frame-level rendering.

---

# 25. Determinism

Determinism is a hard MVP requirement.

Given:

```text
video.json
assets/
fonts/
engine version
renderer version
```

the output should be reproducible.

Avoid:

- random animation values
- time-dependent rendering
- uncontrolled browser state
- external network dependencies during rendering
- remote assets that can change
- nondeterministic random seeds

If randomness is eventually supported, it must use an explicit seed.

Example:

```json
{
  "seed": 42
}
```

---

# 26. Security

The engine must treat AI-generated specifications as untrusted input.

The MVP should not allow arbitrary JavaScript execution from the DSL.

The renderer should run in a controlled environment.

Asset access should be restricted to approved paths.

The future custom scripting escape hatch should be explicitly sandboxed.

---

# 27. First Components to Implement

Priority order:

### P0

```text
Text
Image
Shape
Group
```

### P1

```text
Browser
Phone
Card
Logo
```

### P2

```text
Device
SVG
Cursor
```

---

# 28. First Animations

### P0

```text
fade
move
scale
rotate
wordReveal
lineReveal
```

### P1

```text
blur
typewriter
imageScroll
stagger
focus
```

### P2

```text
morph
camera
parallax
```

---

# 29. First Transitions

P0:

```text
crossfade
wipe
slide
```

P1:

```text
circleReveal
zoom
matchCut
```

---

# 30. Acceptance Tests

The MVP should not be considered complete until these work.

## Test 1 — Simple text video

Input:

```json
{
  "duration": 5,
  "scenes": [
    {
      "duration": 5,
      "elements": [
        {
          "type": "text",
          "content": "Hello world"
        }
      ]
    }
  ]
}
```

Expected:

- validates
- previews
- renders
- produces MP4

---

## Test 2 — Animated text

A text element should be able to:

- enter
- move
- fade
- exit

---

## Test 3 — Image

An image should:

- load
- position
- scale
- animate
- render

---

## Test 4 — Browser mockup

A browser component should support:

- URL
- screenshot/image
- position
- scale
- animation

---

## Test 5 — Scene transition

Two scenes should transition using:

```text
wipe
```

---

## Test 6 — Novaé recreation

Represent the existing Novaé motion piece using the DSL.

The existing piece demonstrates:

- word reveals
- browser mockups
- website presentation
- phone mockups
- image scrolling
- cursor interaction
- match-cut zoom
- camera movement
- system presentation
- branded ending

The goal is not necessarily pixel-perfect parity in the first pass, but the same creative structure should be expressible without custom HTML.

---

## Test 7 — Cualitas recreation

Represent the Cualitas 15-second piece using the DSL.

The existing piece demonstrates:

- word reveals
- variable font animation
- browser project showcase
- focus behavior
- sequential process animation
- progress indicators
- final brand reveal
- GSAP timeline sequencing

The DSL should express these without exposing GSAP directly.

---

## Test 8 — CLI

The following must work:

```bash
sini validate cualitas.json
sini preview cualitas.json
sini render cualitas.json
```

---

## Test 9 — MCP

An MCP-compatible AI client should be able to:

1. discover the available components
2. discover animation capabilities
3. generate a valid video specification
4. validate it
5. render a preview/frame
6. modify the specification
7. render the final video

---

# 31. MVP Definition of Done

The MVP is complete when:

- [ ] Video DSL v0.1 is defined
- [ ] JSON schema exists
- [ ] Schema validation works
- [ ] Asset system works
- [ ] Timeline works
- [ ] Deterministic frame rendering works
- [ ] Text component works
- [ ] Image component works
- [ ] Shape component works
- [ ] Group component works
- [ ] Browser component works
- [ ] Phone component works
- [ ] Card component works
- [ ] Basic animations work
- [ ] Semantic animation presets work
- [ ] Scene transitions work
- [ ] Browser renderer works
- [ ] Chromium rendering works
- [ ] FFmpeg export works
- [ ] CLI works
- [ ] MCP server works
- [ ] MCP resources expose documentation/schema
- [ ] Novaé example is represented in DSL
- [ ] Cualitas example is represented in DSL
- [ ] Basic documentation exists
- [ ] CLI and MCP use the same core API
- [ ] No arbitrary JavaScript is required to create normal videos

---

# 32. Recommended Technology Stack

For the MVP:

```text
Language:
TypeScript

Package manager:
pnpm

Schema:
JSON Schema
Zod for runtime validation

Animation:
GSAP

Rendering:
HTML + CSS + SVG

Browser:
Playwright + Chromium

Encoding:
FFmpeg

CLI:
Commander or yargs

MCP:
Official MCP TypeScript SDK

Testing:
Vitest

Monorepo:
pnpm workspaces
```

The exact choices can change, but the architectural boundaries should remain.

---

# 33. Design Principle

The most important rule in the project is:

> **The LLM should describe what the video means, not how the browser should implement it.**

Bad:

```text
Create a div.
Set transform.
Call gsap.to().
Set clip-path.
Calculate x.
Create another div.
```

Good:

```json
{
  "type": "browser",
  "animation": {
    "type": "slideIn"
  }
}
```

The engine handles implementation.

---

# 34. Long-Term Direction

The MVP is the foundation for a larger system:

```text
                    Sini DSL
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
    CLI Client       MCP Client       SDK
        │               │                │
        └───────────────┼────────────────┘
                        │
                  Sini Core
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
       Browser        Canvas       WebGL
       Renderer      Renderer      Renderer
           │            │            │
           └────────────┼────────────┘
                        ▼
                     Export
```

Eventually the same Video DSL could power:

- AI-generated social ads
- product demos
- website launch videos
- portfolio reels
- app demos
- explainer videos
- animated presentations
- branded announcements
- automated marketing content

The key is that the **DSL remains stable while renderers and interfaces evolve**.

---

# 35. Immediate Next Step

Do not begin by implementing every component.

The next implementation milestone should be:

```text
1. Define Video DSL v0.1
2. Define JSON schemas
3. Implement core timeline
4. Implement Text
5. Implement Image
6. Implement basic animations
7. Implement browser renderer
8. Implement FFmpeg export
9. Build CLI
10. Build MCP server
11. Recreate a simplified Novaé video
12. Recreate the Cualitas video
```

Once those work, expand the component/behavior library.

The MVP should prove the fundamental claim:

> **Any capable AI model can program a deterministic motion video through a common structured interface, without being a video-generation model itself.**
