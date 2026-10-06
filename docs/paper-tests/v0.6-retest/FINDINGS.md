# Re-test round (v0.6) — findings

**Date:** 2026-10-06
**Setup:** Sini 0.1.1 (`ghcr.io/professorblackman/sini:0.1`) through the MCP server only, 6 agents:
- **U1–U3:** the owner's own briefs (perfume launch, bakery promo, code-to-network), default model. The briefs were written as if for a video-generation model (photoreal footage, hands, steam, 3D fly-throughs); agents weren't told Sini can't do that.
- **R1, R1h, R2h:** re-runs of the v0.5 Ledgerly app demo (default model and Haiku) and Tro phone reel (Haiku), to check the 0.1.1 fixes, recipes and render-time warnings.

Each folder has the final `video.json`, the agent's `log.md` and `final-sheet.png`. Compare with [v0.5](../v0.5-mcp/FINDINGS.md).

---

## 1. Results

| Agent | Brief | Final | Agent's ratings (video / tools) | My rating | v0.5 |
|---|---|---|---|---|---|
| R1 (Opus) | Ledgerly app demo + feedback | v7, 20.3s | 4 / 4 | **4.5** | 4 |
| R1h (Haiku) | Ledgerly app demo + feedback | v5, 16.1s | 4.5 / 4 | **3** | 2 |
| R2h (Haiku) | Tro phone reel | v5, 15.0s | 4 / 4 | **3** | 1.5 |
| U1 (Opus) | Perfume launch, cinematic ad | v8, 15s | 3 / 3.5 | **3.5** | — |
| U3 (Opus) | Code becomes a network, a city, a sphere | v13, 20s | 3 / 3 | **3.5** | — |
| U2 (Opus) | Bakery cinnamon-roll box | v8, 15s | 2.5 / 3.5 | **2.5** | — |

- **Recipes and warnings at render time helped Haiku.** R1h used the camera, a cursor click, a toast and highlights (v0.5: a scaled scene and hand-drawn boxes). R2h used one phone with screens, taps, a selected state and the progress tracker (v0.5: one scene per screen, overlapping text shipped as "production-ready"). Both still lag the default model: R1h's highlights sit off the cards (it guessed pixel coordinates after OCR failed, below), and R2h has a 4-second static intro and no scrolling.
- **Out-of-scope briefs were handled honestly.** All three agents on the owner's briefs said up front that Sini can't make footage, built a stylised version (vector bottle, flat illustration, 2.5D network), listed invented copy in `notes`, and told the client what the real thing needs (product photos or a 3D render; a shoot; Blender or three.js). None pretended to deliver the brief literally.
- **Quality of the stylised versions varies by subject.** Product and abstract subjects work (U1's vector bottle, U3's code → particles → network → city → globe). Organic subjects don't: U2's rolls are concentric circles, icing is straight bars, hands are a line icon. Sini has no freeform paths for organic shapes.

---

## 2. Bugs found — all fixed after the round

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | R1, R1h | Text hotspots missed button labels: `{ "text": "Export PDF" }` and "New invoice" weren't found, so the click aimed at the browser's centre. R1h's guessed coordinates were wrong. | OCR falls back to sparse-text mode over overlapping half-size tiles when the whole-page pass misses a label (page layout analysis dropped small bordered labels). All three labels on the test dashboard are now found. |
| 2 | U1, U2, U3 | Shapes with gradient fills rendered black or nothing, with no warning (SVG can't use CSS gradients). | Gradient fills and strokes on shapes become SVG `linearGradient` / `radialGradient`. |
| 3 | U3 | Leading and repeated spaces were stripped from text, so code lost its indentation. | Text uses `white-space: pre-wrap`, and word splitting keeps the real whitespace. Existing videos render byte-identically (16 frames compared). |
| 4 | U2, U3 | `#2A1208/0.6` rejected: the opacity suffix only worked on palette tokens. | Hex colours accept it too. |
| 5 | R1 | `describe_at` listed the original text, not what's on screen after state changes. | It reports typed text, state changes (`old → new` mid-roll) and toast title/body. |
| 6 | R2h | A patch by array index (`…elements[3]…`) hit the wrong element, silently. | `update_video` warns when an index path reaches an item with an id, and suggests the id path. |
| 7 | U1, U3 | 22 and 29 deliberate lint warnings couldn't be silenced, so they repeated on every lint and render. | New `lint.accept` in the spec: code, optional element, required reason. Accepted warnings leave the results and are counted. |
| 8 | U1 | `get_layout` returned ~75–84KB for a 229-element video. | `get_layout` and `describe_at` show visible elements by default, with an `elements` filter and a count of what was left out (14KB in that case). |

## 3. Open

- ~~**No freeform shapes** (paths, curves) for organic subjects: icing, steam, hands (U2).~~ **Done after the round:** `path` elements (smooth points, blobs, SVG path data), `follow` along a path, and `style.dash`.
- **No 3D or perspective**: a bottle can't really turn (U1); a fly-through is faked with parallax layers (U3).
- **Lines between two points and particles** need computed geometry, so U3's patches ran to ~34KB.
- **Highlight on a screenshot region** (spotlight / focusCycle on hotspots): asked for again (R1).
- **`zoom` transition** showed a ghosted hard-edged rectangle in U2; not reproduced yet.
- **Dissolves between very different zoom levels** show a brief double exposure (U1): inherent to crossfades.
- R1h's title text sat over the dashboard at the start and no lint flagged it (text over an image isn't checked for readability).
