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

- **Brand fonts:** Plus Jakarta Sans isn't bundled; the agents substituted Manrope and noted it. Bundling a few common brand sans families (Plus Jakarta Sans, DM Sans, Poppins…) would cover most clients without a font file.
- **Cropping screenshots by pixels** (`crop: [x, y, w, h]` on images) instead of computing a `cover` `focus` percentage: both default agents did this arithmetic by hand.
- **Seeing what's in an asset:** the agents built a throwaway "peek" scene to read screenshots and measure hotspots. A tool returning an asset's OCR'd words with boxes would replace that.
- **Forbidden words:** a brief-level list (`"avoid": ["safe", "genuine"]`) that lint checks in the copy and, via OCR, in screenshots on screen.
- **Lint for a camera move that pushes a spotlighted region out of frame** (M2 cut the licence number at 1.45×).
