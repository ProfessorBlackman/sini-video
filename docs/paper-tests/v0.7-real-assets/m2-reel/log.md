# MedVerify reel (m2-reel): test log

## 0. Setup
- Loaded the Sini MCP tools via ToolSearch and read `get_reference` (essentials), then sections 7, 9 and 15.
  - Surprise: the `get_reference` tool schema shows **no parameters**, but the text says to call it with `section: "7"`. Passing `section` anyway worked. The schema should declare it.
- Created a throwaway 16:9 "peek" spec (v1) with all four assets side by side and looked at it with `render_frame` (scale 1).

## 1. How the real assets behaved
- `logo.webp` (1254×1254, VP8X): rendered fine, **but with black corners** around the mint rounded square. Checked with PIL: the file is RGB with no alpha channel, so the black is in the file, not a Sini bug. Workaround: give the image `style.radius` so the corners are clipped.
- `home.png` / `manual-search.png` (390×884): exactly the phone's logical width (390), so they map 1:1 to logical px. They are 884 tall, a little taller than the 790 px visible under the status bar.
- `scan-result.png` (390×1317): tall. Top ~250 px is the "Verified Safe / Authenticity confirmed by FDA Ghana" header; below it the product card, then a card with License Number FDA/GHA/12345, Approval Date, Expiry Date.
- Copy in the screenshots that conflicts with the brief: "Verified Safe", "Authenticity confirmed by FDA Ghana" (result header), "Batch #B-99201 Verified" (small), a "Safe" chip on the home screen's Recent Scans, "Verify FDA approval instantly" on the Scan card.
- Brand font Plus Jakarta Sans is **not bundled** and no font file was supplied, so I can't use it (remote URLs are not allowed). Using Manrope (closest bundled geometric sans) and listing it in `notes`.

## 2. What I built (final = version 9, 16.0 s, 1080×1920, 30 fps)
Palette = the brand's seven colours (+ white). Fonts: Manrope for display and body. Motion: editorial (0.6 s). Signature transition: wipe from the bottom with a leaf-green bar. `safeZone: "reels"`, `targetDuration: 16`.
1. **hook** (4.6 s, wash): mint circle with a `pill` icon pops in; "Medicine from / a trotro or / roadside tray?" (ink, 104) then "Is it [registered?]" (forest/leaf, 136) with wordReveal. Faint leaf particles drifting for ambient motion.
2. **app** (≈5.3 s, mint→wash gradient): caption "Scan the pack"; a phone (in a `group` "stage") slides up, bleeding off the bottom, showing `home.png`. A touch cursor taps the Scan Now hotspot and `navigate`s (push) to the result screen. Caption swaps to "On the Ghana / FDA register ✓". Camera zooms (1.2×) onto the License Number / Approval / Expiry card and a `focusCycle` spotlight dims the rest.
3. **perks** (2.1 s, forest): three `perk` component rows (check-circle icon + text): Free / No account / No phone number, staggered fadeUp, rising mint particles.
4. **end** (4.0 s, wash): logo (clipped corners, soft shadow) pops in; "Get MedVerify / on Android"; "Checks the Ghana FDA public register"; forest button "medverify.versatechq.com" with a gentle pulse.

## 3. Handling "Verified Safe"
- The result screen's image is `fit: "cover"` at height 790 (the visible screen height) with `focus: [50, 63]`, i.e. a crop that starts ~330 px down the 1317 px screenshot. The header ("Verified Safe", "Authenticity confirmed by FDA Ghana") is **never on screen**, not even during the push transition (checked frame-by-frame at 5.9–7.0 s).
- The camera + spotlight land on the **License Number FDA/GHA/12345 / Approval / Expiry** card, i.e. the registration data, and the on-screen copy says "On the Ghana FDA register ✓". No "safe", "genuine" or "verified" anywhere in my copy.
- Residual: "Batch #B-99201 Verified" (small, dimmed by the spotlight) is visible on the product card, and "Verify FDA approval instantly" is on the home screen's Scan card. The home screen's "Safe" chip in Recent Scans stays off-frame because the phone bleeds off the bottom. Worth asking the client for an updated screenshot.

## 4. Tool errors and surprises (quoted)
- `get_reference` has no declared `section` parameter, yet the text tells you to pass one (it works).
- Text hotspot failed on a real screenshot: `Text hotspot 'scan' ("Scan Now") wasn't found in the image; the cursor aims at the element's centre.` [hotspot-not-found]. The words are clearly there (white text on bright green button). Workaround: measured coordinates from my peek render: `[37, 250, 315, 47]`. Lint caught it, which was good; without lint the tap would have landed in the middle of the screen.
- **State content change ignores wrapping during the roll.** `cap` had `maxWidth: 868` and a state with longer content. Lint: `'cap' grows to 1394px wide at 7.3s, wider than the 1080px frame.` render_frame confirmed: mid-roll the new text is drawn on one line and runs off the right edge ("See if it's on the Ghana F…"), then snaps to two lines. Adding an explicit `\n` did **not** help (`grows to 1464px`). get_layout at that time also reported `"text": "Scan the pack"` (the base content) even though the state had switched. Workaround: two separate text elements (fadeOut the first at `tap.end-0.25`, wordReveal the second at `tap.end`).
- Patch path advice is wrong for component internals: patching `components.perk.root.children[1].style.size` warns `Use 't.style.size' instead. [index-path]`, but `t.style.size` fails with `No scene, element or timeline item with id 't'.` (component-local ids aren't addressable). I kept the index path and ignored the warning (it repeats on every such patch).
- `targetDuration 15s can't be reached: the video is 18.50s` at first. The message is very useful (per-scene breakdown). Cut copy (9→6 words hook, shorter end sub-line, faster tap), got to 16.0 s and set targetDuration 16 rather than starving reading time. Brief said "~15 s", so 16 s is within tolerance.
- `'cap' is readable for 1.3s but needs about 1.4s` after I moved the tap earlier: the transition time doesn't count as reading. Fixed by tapping at 1.2 s.
- `edge-margin` / `safe-zone` on "No phone number" at 88 px; fixed by 80 px and 80 px left inset.
- Logo: no alpha in the webp, so corners were black (asset issue, not Sini). `style.radius` on the image clipped it cleanly.
- Camera zoom 1.45 / 1.35 pushed the phone wider than the frame and cut "FDA/GHA/12345" at the right; get_layout showed `current.width: 986`. 1.2 fits. A lint for "focused hotspot clipped by the frame during a camera move" would have caught this.

## 5. What I wished the tools did
- Text hotspots that actually find button labels (or return the OCR'd candidates so I can pick).
- State content changes that respect `maxWidth` during the roll.
- Patch paths / `set` addressing for ids inside component definitions (`perk/t` or `components.perk.t`).
- A way to crop a device-screen image by pixel offset (`crop: [x,y,w,h]` or `scrollStart`) instead of computing a `focus` percentage: (330 / (1317-790)) ≈ 63%.
- `get_reference` schema declaring `section`.
- Plus Jakarta Sans bundled (popular brand font), or a clear lint/notes hint when a brand font is unavailable.
- Lint for a camera focus target leaving the frame.

## 6. Output
- Draft: `m2-reel/out/draft.mp4` (540×960, 15 fps, 7.7 s render).
- Final: `m2-reel/out/video.mp4` (1080×1920, 30 fps, 16.0 s, 480 frames, 49.5 s render). Lint: no problems, no accepted warnings.

## 7. Ratings
- Video: **4/5**. Clean, on-brand, every beat of the brief in order, no "safe/verified" claims in our copy. Loses a point for the substitute font, a slightly plain perks scene, the small "Batch … Verified" line still visible, and 16 s instead of 15.
- Tools: **4/5**. validate/lint/contact sheets/describe_at/get_layout made iteration fast and precise; lint caught every real problem (hotspot miss, overflow during the roll, reading time, safe zone). Minus one for the text-hotspot miss, the state-roll wrapping bug and the misleading index-path advice.
