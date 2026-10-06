# m1-launch — MedVerify launch video (Sini test log)

## 1. Getting started
- `get_reference` returns the "essentials" part and says to call it again with `section: "7"` / `"9"`. The tool's JSON schema
  declares **no parameters at all**, yet passing `section` worked. Surprise: an agent that trusts the schema would never
  find §7/§9 (elements, animation). Schema should declare `section`.
- Project lives at `.sini-tests/m1-launch`; Sini sees it as `/work/m1-launch`.
- Asset files are mode 600 (owner-only). The Docker server still read them fine.
- Brand font **Plus Jakarta Sans** is not bundled and no font file was supplied, so I used **Manrope** (closest bundled
  geometric sans) for headings, Inter Tight for body. Logged in `notes` so the client can send the TTF.

## 2. Probing the real assets (v1, a throwaway probe scene)
Put logo + three screenshots side by side in one frame and rendered it at scale 1 to read them and derive hotspot
coordinates by hand (image px = (canvas px - offset) / scale).
- **logo.webp**: WebP decoded fine. But its corners outside the rounded mint square render **black**, not transparent
  (either the file has opaque black corners or alpha is lost). Workaround: clip it with `style.radius` on the image.
- **home.png**: has "Search brand or generic name" bar, "Scan Medication / Scan Now" card, and a small green **"Safe"**
  badge on a recent scan, plus "Verify FDA approval instantly".
- **manual-search.png**: "Enter Drug Details" + "Drug Name or License Number" field + examples card.
- **scan-result.png** (390x1317): top ~270px is the shield + **"Verified Safe" / "Authenticity confirmed by FDA Ghana"**.
  Below: product card (Amoxicillin Capsules BP, Ernest Chemists), record card (License Number, Approval Date, Expiry Date).
- Hotspots: I computed `[x,y,w,h]` by hand from the probe frame. They mapped correctly even through an `image` with
  `fit: cover` + `focus` crop inside a phone screen (spotlight landed exactly on the cards). Nice.

## 3. What I built (v2 -> v10) and why
Scenes (16:9, brand palette as tokens, Manrope 800 headings, wipe transition with a leaf-green bar):
1. **street** (forest gradient): three icon dots (bus = trotro, basket = roadside tray, pill), "In Ghana, medicine is sold
   from trotros and trays by the road." then big "Is it even **registered?**" (mint). Faint pill-bottle motif drifting at right.
2. **meet** (wash): "MedVerify" charReveal + "Looks it up in the Ghana FDA register."
3. **demo** (11 s, fixed): ONE phone with three `screens` (home / manual / result), each an image of the screenshot.
   Left: "Three ways to check" + 3 component cards (search by name / scan the barcode / type what's on the pack) whose
   `dim`/`on` states follow a `focusCycle` spotlight on the matching hotspot (search bar, Scan Medication card, manual
   entry field), with a touch `interaction` tapping the search bar and scan card and `navigate` push transitions. Then
   left swaps to "THE RESULT / Registration status, from the register" + Product and manufacturer / Licence number /
   Approval and expiry dates, and the spotlight moves over the product card and the record card.
4. **outro** (forest): logo, MedVerify, "Free · No account · No phone number", white "Get the app for Android" button
   (pulse), medverify.versatechq.com.

### "Verified Safe" handling
- The result screen image is shown in a 390x790 box with `fit: cover, focus: [50, 51.2]`, i.e. the top 270 image px
  (shield, "Verified Safe", "Authenticity confirmed by FDA Ghana") are cropped off **before** the screen ever appears,
  so even the push transition never reveals it (a `scroll` after navigating would have flashed it).
- The product card shows a small "Batch #B-99201 Verified" line; I shrank the `product` hotspot (h 186 -> 140) so the
  spotlight does not frame it. Home screen still has a tiny "Safe" chip in Recent Scans; never highlighted.
- None of my copy says safe / genuine / verified. (The brand name "MedVerify" itself is unavoidable.)

### Lint / timing iterations
- v2 lint: `targetDuration 25s can't be reached: the video is 36.00s (long by 11.00s)` — the reading-time rule
  (0.5 s + 0.3 s/word) made the 20-word meet subtitle cost 10 s. Also `reading-time` on res-h, `low-motion` on meet,
  `low-contrast` (leaf #17915a on wash = 3.8:1 — the brand's own icon green fails for text; used forest instead).
- Fixes: merged problem + question into one scene, cut copy, sped up enters. Natural length bottomed out at 26 s with
  every auto scene "at its limit", so targetDuration = 26 (brief said ~25).
- Contact sheet / get_layout caught that my decorative icon with `"z": -1` was **invisible**: z -1 draws it *behind the
  scene background*. describe_at still reported it `visible: true` and lint said nothing. Fixed by removing z and
  declaring it first. Wish: lint "element hidden behind scene background", or z relative to background documented.
- get_layout's `current` box for a rotated, drifting icon is the rotated bounding box (620 -> 752 px) — correct but
  confusing at first.
- Draft render (v10): `out/draft.mp4`, 26.00 s, 960x540@15, rendered in 22.3 s, lint clean.

## 4. Client feedback: "logo at the start too, hold the ending longer for the URL"
- `addScene` with `"before": "street"` added an **open** scene (2.0 s, wash background): logo (300 px, radius 70 clip,
  soft shadow) popIn + "MedVerify" fadeUp, slow drift. Logo corners now clean thanks to the radius clip.
- Because the opener now shows the wordmark, the old meet scene repeated it; changed it to "Look it up." +
  "MedVerify checks the Ghana FDA public register." so it answers "Is it even registered?".
- Outro changed from auto (4.1 s) to fixed **6.5 s**; URL is fully in by ~1.9 s, so ~4.6 s of readable hold
  (plus `end: hold`).
- Lint then said `targetDuration 29s can't be reached: the video is 30.20s (long by 1.20s)` — every auto scene was at its
  limit. Trimmed opener to 2.0 s and set targetDuration 30. Final is **30.0 s**, ~5 s over the brief's "~25 s", which is
  the cost of the two requested additions; the reading-time rule leaves no slack elsewhere.
- Final render (v13): `out/video.mp4`, 30.00 s, 1920x1080@30, 900 frames, 125.5 s, "Lint: no problems."
- Accepted lint warnings: **none** (lint was clean on draft and final).

## 5. Tool surprises / errors (quoted)
- `get_reference` schema has no `section` param although the text tells you to pass one (it works anyway).
- No validation errors at all across 13 versions: every patch was accepted first time, including `addScene` with `before`
  (only `after` is documented in §11) and `set ... value: null` to delete a key.
- `"z": -1` silently puts an element behind the scene background (invisible); describe_at says `visible: true`, lint silent.
- `targetDuration` lint is useful but the reading-time model (0.3 s/word) is strict for 16:9 web video where viewers
  can re-watch; it was the main force pushing the length up.
- render_contact_sheet errors helpfully on out-of-range times: `Time 30.7 is outside the video (0–30.20s).`
- WebP logo with black (non-transparent) corners — not flagged by anything; needed a radius clip.

## 6. Wishes
- A way to crop/offset a screenshot *by image px* (e.g. `crop: [0, 270, 390, 790]`) instead of computing a cover
  `focus` percentage (I did 270/527 = 51.2% by hand).
- Hotspot discovery: `{ "text": ... }` exists, but a tool that returns OCR'd text boxes of an asset (or a
  `describe_asset`) would avoid the probe-scene + manual pixel math.
- A lint/notes hook for "forbidden words" (brief said never 'safe', 'genuine', 'verified safe') that also OCRs screenshots
  shown on screen, to flag "Verified Safe" if it ever becomes visible.
- Lint warning for elements drawn under the scene background, and for image assets with opaque black corners.
- Brand fonts: allow Google-Fonts-by-name download at create time, or at least lint that the brief's font isn't bundled.

## 7. Ratings
- Video: **4/5** — on-brand, clear three-ways demo with a real spotlight, honest about registration; loses a point for
  running 30 s instead of ~25 s and the headings not being in Plus Jakarta Sans.
- Tools: **4/5** — validate/lint/contact sheet/get_layout loop is fast and trustworthy, patches by id are pleasant;
  minus the hidden `section` param, silent z-behind-background, and manual pixel work for screenshot crops/hotspots.
