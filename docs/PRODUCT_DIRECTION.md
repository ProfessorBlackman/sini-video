# Sini — Product Direction v0.2

**Status:** Draft
**Supersedes:** parts of [`MVP_SPEC.md`](MVP_SPEC.md) (noted inline)

This document records product decisions and reshapes the MVP around them. Where it conflicts with the MVP spec, this document wins.

---

## 1. Decisions

| Decision | Choice |
|---|---|
| Distribution | **Open-source product** |
| Audio | **Out of scope for v1** (keep the timing model ready for it) |
| Interface | **AI-only.** No human editor, no scrubber UI. People describe what they want; the AI builds and iterates |
| Licence | **Apache-2.0** |
| Packaging | **Docker image first** (pinned Chromium, FFmpeg, fonts → strongest determinism). npm package later as an alternative |
| Name | **Sini** (Twi for "movie"). CLI: `sini`; image: `ghcr.io/<org>/sini` |

One-line pitch:

> Describe a video in plain language. Your AI writes it, checks it, shows you, and fixes it, all with a deterministic engine and no video-generation model.

---

## 2. What "AI-only" means

The human never touches JSON. The human talks to the AI and gets back **frames and videos**. The engine's real users are therefore two parties:

1. **The AI**, which needs discoverability, compact docs, precise errors, cheap visual feedback and small edits.
2. **The human**, who needs fast drafts to react to and a way to point at things ("at 0:07 the text is too fast").

### The loop

```text
Human: "15s reel for my bakery, warm, playful"
   │
   ▼
AI ── reads docs/schema via MCP (or llms.txt)
   │
   ▼
AI ── writes spec ──► validate + lint ──► errors? ──► patch ─┐
   │                                                       │
   │  ◄──────────────────────────────────────────────────── ┘
   ▼
AI ── contact sheet ──► self-critique ──► patch (repeat ≤ N)
   │
   ▼
Draft render (low-res, fast) ──► shown to human
   │
   ▼
Human feedback ("logo bigger", "0:07 too fast", "warmer colours")
   │
   ▼
AI ── describe_at(7.0) → finds elements ──► patch ──► new version
   │
   ▼
Final render (full quality)
```

### Consequences

- **No `preview` browser server as a product feature.** Keep it as a contributor debug command only. The product preview is the **contact sheet** plus the **draft render**.
- **Versioning is required.** "Go back to the previous one" or "combine v2's intro with v4's ending" must work. Every patch creates a new version on disk.
- **Time → element mapping is required.** Humans give feedback by timestamp and by what they see, not by element ID.
- **Self-critique must be cheap.** One contact-sheet image is far fewer tokens than a dozen frames.

---

## 3. Open-source implications

### Drop GSAP

The Novaé reel already proves GSAP is unnecessary. Its whole timeline is a pure `render(t)` built from progress windows, interpolation and easing functions. Reasons to drop it:

- **Licensing.** GSAP is free but not OSI open source, and its licence restricts use in tools that compete with Webflow's visual animation builder. An open-source motion engine is exactly the kind of project where that is risky. *(Verify the current licence text before deciding; the other reasons stand regardless.)*
- **Determinism.** A pure `value(t)` evaluator needs no seeking or internal timeline state.
- **Portability.** The same evaluator drives a future Canvas/WebGL renderer.

### Other open-source concerns

- **Licence:** **Apache-2.0** (decided 2026-10-04): explicit patent grant from contributors, patent retaliation, and no trademark rights to the Sini name.
- **Fonts:** bundle a small curated set of OFL fonts (Instrument Serif and Inter Tight from the reel are both OFL). Fonts must be local for determinism.
- **Example assets:** the Novaé photos are client/brand material. Do not ship them in the repo without rights. Ship examples that use the **procedural placeholder fallback** the reel already has, plus permissively licensed images.
- **Model-agnostic:** MCP is the primary interface, but many users will paste into ChatGPT or another chat UI. Ship:
  - `llms.txt` / `DSL_REFERENCE.md`: a single compact file an AI can read in one go
  - the JSON Schema
  - a CLI that coding agents (Claude Code, Codex, Cursor) can call directly
- **Extensibility:** third-party components, presets, transitions and themes as packages. This is how the vocabulary grows without the core team writing everything.

---

## 4. Revised interface surface

CLI and MCP still share one core API. A **video is a project folder on disk**, so CLI, MCP and a user's file system all see the same state.

```text
my-reel/
├── video.json          # current spec
├── versions/           # v1.json, v2.json, ... (immutable)
├── assets/
└── out/                # renders, frames, contact sheets
```

| Core operation | CLI | MCP tool | Notes |
|---|---|---|---|
| Discover | `sini docs [topic]` | resources + `list_*` | components, presets, transitions, themes |
| Create | `sini init` | `create_video` | returns project path |
| Save an edit | `sini save` | (`update_video` with `spec`) | records the current video.json as a version |
| Validate | `sini validate` | `validate_video` | schema errors with JSON path + suggestions |
| Lint | `sini lint` | `lint_video` | design checks (see §6) |
| Patch | `sini patch` | `update_video` | by element ID; creates a new version |
| Versions | `sini versions` / `sini checkout` | `list_versions`, `restore_version` | |
| Inspect | `sini inspect` | `get_video` | tree + timeline summary |
| Describe time | `sini at 7.0` | `describe_at` | which scene/elements are visible and animating at t |
| Layout | `sini layout --time 2.0` | `get_layout` | computed box of every element at t, so the AI checks geometry instead of estimating it |
| Frame | `sini frame --time 7.5` | `render_frame` | returns image |
| Contact sheet | `sini sheet` | `render_contact_sheet` | one grid image, e.g. 12 frames with timestamps |
| Draft | `sini render --draft` | `render_video {draft:true}` | e.g. 540p / 15fps, fast |
| Final | `sini render` | `render_video` | full quality MP4 |

Removed from the product surface: `preview_video` (kept as `sini dev` for contributors).

---

## 5. DSL v0.2 changes

### 5.1 Theme layer (new, highest-impact)

Most of the Novaé reel's quality comes from consistency: one easing family, one text reveal style, one signature transition, grain, palette, type pairing. The theme captures it, so the AI writes less and gets coherent results.

```json
"theme": {
  "palette": { "ink": "#1E1512", "bone": "#EEE6DA", "wine": "#5B1A24" },
  "fonts": { "display": "Instrument Serif", "ui": "Inter Tight" },
  "motion": "editorial",
  "transition": { "type": "wipe", "angle": 15, "bar": "bone", "duration": 0.55 },
  "texture": { "grain": 0.075 }
}
```

`motion` is a **personality preset** that sets default easing, durations and stagger:

| Personality | Ease | Enter duration | Stagger |
|---|---|---|---|
| `editorial` | expo.out | 0.75 | 0.08 |
| `snappy` | back.out | 0.45 | 0.04 |
| `calm` | cubic.inOut | 1.1 | 0.12 |
| `playful` | spring | 0.6 | 0.06 |

Elements reference palette and font tokens by name (`"color": "bone"`, `"role": "display"`).

### 5.2 Relative timing

LLMs are bad at absolute timing arithmetic. Every `at` accepts an expression:

```text
1.2                    scene-local seconds
"scene.start+0.3"
"scene.end-0.25"
"h1.enter.end+0.2"     relative to another element's animation
"cue:reveal"           named cue defined on the scene
```

### 5.3 Layout instead of raw pixels

```json
"layout": { "anchor": "top-left", "inset": [430, 84] }
"layout": { "below": "h1", "gap": 120, "width": "88%" }
"layout": { "anchor": "center", "maxWidth": "80%", "fit": "shrink" }
```

- Absolute `position` stays available.
- Percentages and anchors let **one spec render at 9:16, 1:1 and 16:9**.
- `stack` and `grid` group types handle nested content (e.g. a storefront inside a phone).

### 5.4 Scene overlap and incoming transitions

As in the reel, a scene's transition belongs to the **incoming** scene and overlaps the previous one. `video.duration` is computed from the scenes, not declared.

```json
{ "id": "brand", "duration": 4, "transition": "theme" }
```

### 5.5 Inline enter/exit sugar

Both forms are valid; inline compiles to timeline entries.

```json
{ "id": "h1", "type": "text", "enter": "wordReveal", "exit": "wordsUp" }
```

### 5.6 States and interactions (new)

Product and website reels are mostly simulated UI. Elements declare **states**, and an `interaction` behavior drives a cursor through them.

```json
{ "id": "add-btn", "type": "button", "label": "Add to bag",
  "states": { "added": { "label": "Added ✓", "background": "wine" } } }

{ "type": "interaction", "cursor": "pointer", "steps": [
  { "click": "size-M",  "set": { "size-M": "selected" } },
  { "click": "add-btn", "set": { "add-btn": "added", "bag-count": 1 } }
]}
```

State changes animate automatically (text roll, fill, counter roll), like smart-animate in Figma.

### 5.7 Additional primitives found in the reel

| Primitive | Reel example |
|---|---|
| `matchCut` | editorial card in the phone expands to full screen (needs measured geometry) |
| `camera` group | s7 pull-out from headline to full storefront |
| `spring`, `oscillate`, `loop` modifiers | hanger swing, strip breathing, CTA pulse ring |
| `drawOutline` | browser frame strokes itself in |
| `typewriter` + caret | URL bar |
| letter-spacing / per-char reveal | NOVAÉ and CUALITAS wordmarks |
| `texture` overlay | grain with deterministic per-frame jitter |
| asset `fallback` | procedural placeholder when an image is missing |

### 5.8 Escape hatch: template components

When the vocabulary runs out, allow an HTML/CSS template with declared parameters and CSS variables. **No JavaScript.** It's animated only through DSL tracks on the variables it exposes. This is how the reel's in-phone storefront would be expressed.

---

## 6. Lint: design checks beyond the schema

Schema validation catches malformed JSON. The linter catches bad videos, and is the AI's main self-correction signal before it spends tokens on images.

| Rule | Example message |
|---|---|
| off-canvas | `h1` overflows right edge by 64px at 1080w |
| overlap | `h1` and `site` overlap 0.4–1.1s |
| contrast | `sub` on `hero` image: contrast 2.1 (min 4.5) |
| reading time | `tl` shows 9 words for 0.8s (min ~2.4s) |
| never visible | `tag` enters after its scene ends |
| unknown reference | `"at": "hl.end"`: no element `hl` (did you mean `h1`?) |
| missing asset | `hero.jpg` not found, using placeholder |

Every error includes a **JSON path**, **what was expected** and a **suggested fix**.

---

## 7. Revised MVP

### Step 0: test the DSL with LLMs before building

1. Write [`DSL_REFERENCE.md`](DSL_REFERENCE.md) (compact, single file). ✅ v0.2 and v0.3 paper-tested (see [paper-tests/](paper-tests/)); v0.4 has the fixes from the v0.3 round.
2. Ask Claude, GPT and one open model to author 10 varied briefs against it, on paper.
3. Catalogue failure modes and revise the DSL.

This is cheap and will reshape the DSL more than anything else.

### Vertical slice

Scenes 1–2 of the Novaé reel, from JSON to MP4, through both CLI and MCP:

- theme layer with `editorial` motion personality
- text with masked `wordReveal` / `wordsUp`
- `browser` component with `drawOutline` and `typewriter` URL
- image with placeholder fallback
- signature `wipe` transition with overlap
- per-char wordmark reveal with letter-spacing
- grain texture
- relative timing expressions
- `validate`, `lint` (3–4 rules), `frame`, `contact sheet`, draft and final render
- versioned patches and `describe_at`

### Then expand

States/interactions → phone + scroll → matchCut → camera → modifiers → template components → multi-aspect output → community packages.

---

## 8. Open questions

- **Name: Sini** (Twi for "movie"). Name checks (2026-10-04):
  - npm: unscoped `sini` is taken (an inactive synonyms CLI, last updated 2022); the `@sini` scope is free → publish as `@sini/cli`
  - PyPI: `sini` is free
  - GitHub: `sini` and `sini-dev` are taken; `sinihq`, `getsini` and `sini-video` are free
  - Docker Hub: the `sini` namespace is taken, so publish to GHCR
  - Domains: `sini.dev` and `sini.io` are registered; `sini.ai`, `sini.video`, `sini.so`, `sini.sh` and `getsini.dev` have no DNS servers and may be free
  - Searchability: "sini" means "here" in Malay/Indonesian, so web searches will be noisy; use "Sini video" or a tagline in docs and SEO
