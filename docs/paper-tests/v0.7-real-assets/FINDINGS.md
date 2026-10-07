# Real-assets round (v0.7) — findings

**Date:** 2026-10-06
**Setup:** Sini 0.1.7 through the MCP server only, 3 agents, briefs in [BRIEFS.md](BRIEFS.md). The first round with a real client's material: MedVerify's logo and three app screenshots, and a real copy rule (say *registered*, never *safe*), which one screenshot breaks ("Verified Safe").

Each folder has the final `video.json`, the agent's `log.md` and `final-sheet.png`.

---

## 1. Results

| Agent | Brief | Final | Agent's ratings (video / tools) | My rating |
|---|---|---|---|---|
| M1 (default) | 16:9 launch video + feedback round | v13, 30s | 4 / 4 | **3.5** |
| M2 (default) | 9:16 reel | v9, 16s | 4 / 4 | **3.5–4** |
| M2h (Haiku) | 9:16 reel | 19s | 4 / 4 | **2.5** |

- **The copy rule separated the models.** Both default-model agents found every conflicting word in the screenshots ("Verified Safe", "Authenticity confirmed", a "Safe" chip, "Batch … Verified"), cropped the result screenshot below its header so the label is never on screen (checked through the transition), and pointed the camera and spotlight at the licence, approval and expiry rows. Haiku showed the "Verified Safe" header full-size and called that "defensible".
- **Real screenshots worked.** Tall screenshots scrolled and cropped inside the phone; hand-measured `[x, y, w, h]` hotspots landed exactly, even through a cropped `cover` image; the push between screens was clean.
- **Neither default agent accepted a lint warning.** Haiku accepted 9 (7 `safe-zone`, `target-unreachable`), against the reference's rule, used the reference example's fonts instead of the brand's, made the phone ~15% of the frame and declared the logo without showing it.
- **Length:** reading times pushed both reels past 15s (16s, 19s) and the launch video to 30s after the "hold the ending" feedback. The agents raised `targetDuration` rather than starving reading time, and said so.
- **M1's weak spots:** small supporting text in 16:9 frames (card descriptions, the outro line) and a problem scene whose text sits in the top third.

## 2. Bugs found — fixed after the round

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | M2 | Text hotspot `"Scan Now"` not found on the home screenshot (dark label on a bright green button; whole-page and coarse-tile OCR both missed it). | A third OCR pass over fine tiles (a quarter of the width, an eighth of the height) when the first two miss: thresholding in a small window reads labels on coloured buttons. Found in ~11s, once; cached. |
| 2 | M2 | A text `state` with longer content ran off the frame on one line while rolling in, then snapped to two lines (`grows to 1394px wide`). | Text elements roll with wrapping at their width; buttons and badges still roll on one line. |
| 3 | M2 | Patching inside a component definition by index warned `Use 't.style.size' instead`, but component-local ids can't be patched. | The index-path warning only suggests an id path that reaches the same item. |
| 4 | M1 | `"z": -1` drew an element behind the scene background (invisible), while `describe_at` reported it visible. | The background sits below every element; negative `z` orders elements among themselves. |

Not Sini bugs:
- `get_reference` looked parameterless to both agents: the server declares `section`, but the test session had cached tool definitions from an older version (as in the 0.1.2 round).
- The logo's black corners are in the file (RGB WebP, no alpha). Both default agents clipped them with `style.radius`. WebP itself decoded fine.

## 3. Open

- ~~**Brand fonts:** Plus Jakarta Sans isn't bundled; the agents substituted Manrope.~~ **Done after the round:** font assets can name any Google Fonts family (`"google": "Plus Jakarta Sans"`) or an https font file (`"url"`), downloaded once into the project's `fonts/` and pinned in `fonts.lock.json`.
- ~~**Cropping screenshots by pixels**, **seeing what's in an asset**, **forbidden words**, **camera moves cutting off a spotlight**~~ **Done after the round:** image `crop: [x, y, w, h]`; `read_image_text` / `sini text` (every line of text with its box); `lint.avoid` checking the copy and visible screenshots (it flags Haiku's "Verified Safe" at 9.6–10.4s and M1's "Safe" chip, and passes M2); `spotlight-cut` / `camera-target-cut` (it flags M2's 1.35× zoom, 87% of the licence row on screen, and passes the fixed 1.2×).

---

## 4. Re-test on 0.1.8 (M1b, M2b, M2hb)

Same briefs and prompts, no hints about the new features. Each agent ran as its own headless Claude Code session (the test session had cached the 0.1.7 tool list), connected to the 0.1.8 MCP server.

| Run | Before | 0.1.8 (mine) | Agent's ratings | Notes |
|---|---|---|---|---|
| M2b reel (default) | 3.5–4 | **4** | 4 / 4.5 | Exactly 15s, no warnings accepted. The result screen is built from 4 crops that leave out the header, the "Batch … Verified" row and the past expiry date; the home screen is cropped above its "Safe" chip. The agent tested the avoid lint by putting the hidden labels back: it caught all of them, including "sate". |
| M1b launch (default) | 3.5 | **3.5–4** | 4 / 4 | Two crops of the result screen, a white patch over the home screen's "Safe" chip (found with `read_image_text`), spotlights on the screenshots. 16:9 supporting text still small; one near-empty frame while copy enters. |
| M2hb reel (Haiku) | 2.5 | **2** | 4 / 5 | 26s for a 15s brief; "Verified Safe" shown full-size again, with `avoided-word` accepted ("not emphasized"; "OCR misread"). Empty frames between scenes. |

**Adoption without hints:** all three used `"google": "Plus Jakarta Sans"`, `read_image_text` and `lint.avoid` (the default model added "authentic"/"authenticity" itself); both default runs used `crop`.

Found and fixed after the re-test:
- Colour and bold markup in a state's `content` showed its brackets literally (M2b). State text now carries styled runs.
- `avoided-word` ignored covers: M1b's patch over the "Safe" chip still warned, so it had to accept the warning. The region check now samples what's drawn on top; an opaque shape, card or image over the word counts as hidden.
- `avoided-word` can no longer be accepted (Haiku accepted it with a false reason). Reword, crop, keep off screen, or cover.
- The reference said a spotlight "darkens by `dim`"; `dim` is how much stays visible (`1` = none), as for elements (M1b set `dim: 0` expecting no darkening).

Still open:
- ~~A spotlight doesn't dim shapes drawn over the screenshot (M1b's patch stayed bright).~~ **Done:** a spotlight on a screenshot in a device darkens the whole device screen.
- ~~No lint for an element moving under another during a camera zoom (M2b's phone went under the caption).~~ **Done:** `overlap-in-motion` (flags M2b's v3 and v4, passes the fixed versions and the perfume video's zoomed bottle).
- Haiku still treats warnings as negotiable and runs long; the default model is the one to use for client work.
