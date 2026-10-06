# MedVerify launch video: Sini test log

Project: `m1b-launch` (server root `/work`). Only `mcp__sini__*` tools were used. Final: `m1b-launch/out/video.mp4`, 29.0s, 1920×1080 @ 30fps (spec version 11). Draft: `out/draft.mp4`, 25.0s (version 9).

## Process
1. `get_reference` (essentials), then §7 and §9.
2. Created a stub spec that declared only the assets, so I could run `read_image_text` on all three screenshots. A stub frame placing the three screenshots side by side let me see them, because the files live inside the Docker `/work` and I couldn't open them locally.
3. Wrote the full spec (v3), then ran validate, lint and contact sheets, and fixed things with patches (v4–v9). Rendered the draft.
4. Client feedback (v10–v11): added a logo scene at the start and held the end longer. Rendered the final.

## What I built and why
- **brand** (2.4s, added after feedback): the logo next to a "MedVerify" wordmark on a forest/deep radial background.
- **problem** (~5.7s): "In Ghana" kicker, then two lines with icon tiles. The bus icon stands for trotros and the shopping-basket icon for roadside trays: "Medicine is sold from trotros…" and "…and from trays at the roadside." The scene ends on the big line "Is it even **registered?**", with "registered?" in mint.
- **app** (~14.4s, one scene with **one phone that switches screens**, as the recipe and lint suggest):
  - Right column: "Three ways to check any medicine" and three white rounded cards (a `way-row` component).
  - Phone: home screen. Leaf outlines are pinned to hotspots: first the search bar ("Search by name"), then the Scan Medication card ("Scan the barcode").
  - Push navigation to Manual Search. The screen scrolls to the bottom and a spotlight falls on the input ("Type what you can read").
  - A touch tap on "Search Drug" navigates to the result screen. The column swaps to "Its registration status, from the official record", and a `focusCycle` spotlight steps through the product card, the licence number and the approval/expiry dates.
- **outro** (6.5s fixed after feedback, was 4.8s auto): logo + wordmark, then "Free · No account · No phone number", a mint "Get the app for Android" button with a gentle pulse, and medverify.versatechq.com in white at 56px.
- Brand palette tokens, with Plus Jakarta Sans downloaded through a `google` font asset (worked first time: "Downloaded Plus Jakarta Sans (2 files…)"). Theme transition: a leaf-bar wipe.

## Handling "Verified Safe" and other risky words
- I ran OCR first and found more than the brief warned about:
  - Result screen: "Verified Safe" and "Authenticity confirmed by FDA Ghana" in its header.
  - Home screen: a **"Safe" pill** on the Panadol Extra row in Recent Scans.
  - Also "Batch … Verified" and "Unverified".
- I set `lint.avoid: ["safe", "verified safe", "genuine", "authentic", "authenticity"]`.
- Result screen: shown as two cropped images stacked: the app bar `[0,0,390,76]` plus the body `[0,282,390,714]`. The status header never appears, so the label isn't hidden behind anything that draws attention to it. It just isn't in frame.
- Home screen: covered the "Safe" pill with a white rect inside a group with the screenshot (x302 y588 66×28 in image px, measured from OCR plus a full-scale frame). In frames it reads as an empty row end.
- I left "Batch #B-99201 Verified" (small, not a banned phrase) and the "Unverified" pill. Worth raising with the client, because "Batch verified" also implies more than registration.
- My own copy only says "registration status", "official record" and "register".

## Tool errors and surprises
1. **Spotlight dims the screenshot but not shapes drawn over it.** With `focusCycle` on home hotspots, the white badge patch stayed bright white on a dimmed screen and was obvious.
2. **`dim: 0` still dimmed.** I set it to switch dimming off, and the frame looked the same as with 0.45. Either 0 is treated as "use the default", or `dim` doesn't mean what §9.4 says ("darkens the rest of the screenshot by `dim`"). Workaround: on home I replaced the spotlight with pinned outline shapes (`pin` with `inside: 0` on the hotspot, plus `scaleIn`/`fadeOut`). That worked well.
3. **`avoided-word` OCR ignores covers.** The message: *"Screenshot 'home' shows "sate" (OCR's reading of "safe") in 'home-img' at 5.9–12.4s … cover it"*. It still fires after I covered it, even though the message itself suggests covering. I accepted it with a reason. Also, the time range was the whole span the element is laid out, not when the home screen actually shows (it leaves at ~6.75s local). It was good that it caught "Safe" on the *home* screen, which the brief didn't mention. It also correctly did not flag "Safety tips".
4. **The phone notch covered the screenshot's greeting** with `statusBar: false`. Switching to `statusBar: true` fixed it. The reference doesn't warn that the island is drawn over content.
5. **`trackIn` on text in a horizontal stack slides its neighbours.** The stack re-centres as the letter-spacing tightens, so the logo slid sideways. I switched to `wordReveal`.
6. Stub frame: a logo `image` with `width: 120` and no height rendered about 400px tall and cover-cropped. Images seem to need both width and height. I didn't investigate further.
7. Helpful: the patch warning *"'app.timeline[0].dim' reaches 'spot-home' by position… Use 'spot-home.dim' instead"*. Also `target-unreachable` gave a per-scene breakdown, so trimming to exactly 25s/29s was easy.
8. Contact-sheet thumbnails made the push navigation look as if it spilled out of the phone. A full-scale `render_frame` showed it was clipped correctly.

## How the real assets behaved
- OCR was good enough for orientation but garbled text ("Sean", "sate", "Er nest"). The boxes were enough to derive hotspots. I still checked against a full-scale frame because card bounds aren't text bounds.
- Tall screenshots: home/manual (884 tall) ran past the 790 visible area. `scroll to: "bottom"` on Manual Search brought the button into view nicely. The 1317px result screen worked well as two crops.
- The webp logo rendered fine. It has its own mint rounded-square background, so it sits well on forest green.

## Wishes
- A **redact/cover region on an image asset** (e.g. `hotspots: {"badge": …}` + `"hide": ["badge"]` filled with a sampled colour). It would be dimmed by spotlights and understood by `avoided-word` lint.
- Spotlight should dim overlay content inside the same group/screen, or `dim: 0` should work.
- `avoided-word` should check what's actually visible (after crop, scroll and covers), using the times the screen actually shows.
- A way to view an asset image directly (`render_asset`) instead of building a stub scene.
- A stack option to lay out using final (post-enter) sizes, so `trackIn` doesn't reflow siblings.

## Lint warnings accepted
- `avoided-word` on `home-img`: the "Safe" pill is covered by `hide-badge`. Verified visually at 9.0s and 10.5s; lint OCRs the raw screenshot.

## Ratings
- **Video: 4/5.** It's clean, on-brand, every beat of the brief is there and the claims are careful. It loses a point for one screen with a hand-placed cover patch, a mild style switch (outline highlights on home vs dim spotlight later), and a middle scene that is long and dense for LinkedIn.
- **Tools: 4/5.** The reference, validate/lint loop, OCR, hotspots, crops, screens, navigate/scroll/interaction and patch hints are excellent. Points off for spotlight/cover interplay, `dim: 0`, and OCR lint that can't see covers.
