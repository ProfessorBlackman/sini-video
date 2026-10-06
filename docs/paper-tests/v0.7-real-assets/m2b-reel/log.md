# MedVerify reel — Sini test log

## 0. Setup
- Read `get_reference` (essentials), then §7, §9, §13. Reference is clear; §15 recipe "App demo from a screenshot" matched the brief exactly (phone + crop + hotspots + focusCycle).
- Looked at the four assets myself first:
  - `home.png` 390×884 — header, search, "Scan Medication / Scan Now" card, Quick Actions ("Info Hub — Safety tips & alerts"), Recent Scans with a green **"Safe"** badge and a red "Unverified" badge.
  - `manual-search.png` 390×884 — "Enter Drug Details". Clean, no banned words.
  - `scan-result.png` 390×1317 — **"Verified Safe" / "Authenticity confirmed by FDA Ghana"** hero at the top, then a product card (Amoxicillin Capsules BP, "Batch #B-99201 Verified"), then License Number FDA/GHA/12345, Approval Date, Expiry Date **15 Oct 2025** (already in the past — demo data).
  - `logo.webp` — square app icon, mint tile with forest-green scan corners and a capsule with a tick.
- Risk list from the brief: banned words *safe*, *genuine*, *verified safe*. The home screen has a "Safe" badge too, not just the result screen.

## 1. First contact with the tools
- `create_video` with my own stub spec + a Google font asset: worked first time. "Downloaded Plus Jakarta Sans (2 files, Google Fonts: Plus Jakarta Sans) into fonts/." Nice.
- `read_image_text` on `result` and `home`:
  - Result: "Verified Safe" at [124,215,142,18], "Authenticity confirmed by FDA Ghana" at [72,248,245,12], "Batch #B-99201 Verified" at y 436, "FDA/GHA/12345" at y 521, "15 Oct 2025" at y 667. Boxes were precise enough to plan crops.
  - **Surprise:** on `home`, the green "Safe" badge was OCR'd as **"sate"** (`[331, 597, 22, 8]  sate`). So `lint.avoid: ["safe"]` would probably NOT catch that badge — OCR on small coloured pill text is unreliable. Also "Scan Now" → "Scan Nov", "Scan" → "Sean", "Search" → "E". So I don't trust `{ "text": "Scan Now" }` hotspots; I use pixel boxes instead.
  - "Info Hub — Safety tips & alerts" on home contains "Safety"; curious whether `avoid: safe` flags it as a substring.

## 2. Plan
| Scene | Beat | Idea |
|---|---|---|
| hook | ~3.5s | Forest gradient. "Bought medicine on a trotro?" / "From a roadside tray?" / "Is it **registered?**" (mint) |
| app | ~6s | One phone with 3 `screens`: home (cropped) → tap Scan Now → scanning viewfinder (built from elements) → result (stitched from crops of scan-result.png that skip the "Verified Safe" hero). Spotlight the License Number row. Caption above the phone changes "Scan the pack." → "It tells you if it's registered." |
| perks | ~2.5s | Mint. Free / No account / No phone number with check icons |
| cta | ~3s | Forest. Logo, "Get MedVerify on Android", url pill pulsing |

**"Verified Safe" strategy:** never show rows ~90–285 of the result screenshot. The result screen in the phone is stitched from crops: top bar [0,0,390,72] ("Scan Result"), product card [0,288,390,128] (stops above "Batch … Verified"), details [0,490,390,146] (License + Approval only — the Expiry "15 Oct 2025" is in the past and would look odd in a 2026 ad), and the "Help us improve…" card + FDA-data footnote [0,730,390,330]. Home is cropped to [0,0,390,520] to drop the Recent Scans "Safe" badge. The registration claim is made by MY caption outside the phone, and the spotlight lands on the License Number (the actual registration evidence).

## 3. v2 — first full spec (replaced the stub in one `update_video` with `spec`)
- Validated and saved first try (no schema errors). Good sign for the reference quality.
- `lint_video`: only one warning: "targetDuration 15s can't be reached: the video is 17.60s (long by 2.60s). Scenes: hook 5.1s (auto, at its limit), app 6.6s …" — very actionable, tells me which scene is long.
- Contact sheet (16 frames). My review:
  1. **Bug/surprise:** a text `states.result.content` of `"It tells you if it's\n[registered]{leaf} with the FDA."` renders the markup literally — `[registered]{leaf}` with brackets on screen. Colour markup works in `content` but not in state content. Lint did not catch it. Workaround: two text elements (exit one, enter the other) instead of a state.
  2. Type and phone too small for a 9:16 reel: hook subtitle 64px reads tiny, lots of dead green below; phone 600px wide leaves the screenshot text illegible. Plan: bigger roles, phone in a `group` with a `camera` zoom onto the License Number.
  3. 2.6s over target.
- Crops worked exactly as planned: the stitched result screen looks like a natural app screen; no "Verified Safe" anywhere. The home crop leaves ~1/3 of the screen empty (screen bg) — acceptable, it reads as the app's own background. `focusCycle` on a hotspot of a *cropped* image dims only that cropped image (a grey band), not the whole phone screen — logical but looks a bit odd.
- Lint `avoid` did not fire on anything, as hoped (none of the cropped regions has the words). It also did not flag "Safety tips & alerts" on the home crop — so either substring matching is word-based, or OCR missed it.

## 4. v3–v7 — patches
- v3 patch (roles bigger, motion faster, caption swap, phone moved into a `stage` group, `camera` zoom onto `res-details#license`). First attempt rejected atomically: "scenes[1].timeline[3].state: State 'result' isn't declared on 'app-cap'. [unknown-state]" — fair: I removed the state but not the timeline item that used it. Added `{op:remove, path:"app.timeline[3]"}` and it saved. Nice that nothing half-applied.
- `move` of an existing element into a freshly `add`ed group in the same patch worked.
- Lint on v3: "'hook-3' sits under the reels interface (right edge)" (fixed with `maxWidth: 850`), "'app-cap' and 'app-cap-2' overlap while both are on screen" (fixed: cap-2 enters at `app-cap.exit.end`), and still 2.3s long (app scene 8.1s because of a 9-word caption + 2s focusCycle). Cut caption to "It checks the / Ghana FDA register." (from the brief's own wording), shortened the scan sweep.
- Contact sheet v4 showed two things lint missed:
  1. **Camera zoom pushed the phone up under the caption** (phone frame/status bar behind "Ghana FDA register."). No overlap/covered-text warning — I think because the caption is z:10 on top so it isn't "covered", and overlap checks may not use camera-transformed boxes. Fix: made the `stage` group start below the caption (`inset [430,0]`, height 1490) so the camera centres the focus lower. `get_layout` at 9.6s confirmed: phone `current.y` 458.7 vs caption bottom 384.4. `get_layout` reporting both `box` and camera-transformed `current` is excellent.
  2. `focusCycle` dim on a cropped image = grey stripe. Replaced with a `rect` in the phone's `overlay`, pinned to `res-details#license`, drawn with `drawOutline` after the camera lands. Pinning to a hotspot on a cropped image placed it exactly right.
- Removing a timeline item by its id with `{op:"remove", id:"spot"}` worked (the reference only shows `id` for elements; nice that it also works for timeline ids).
- Hit 15.00s exactly by trimming tap time and the CTA logo start → "✓ No problems found; video is 15.00s."

## 5. Testing the banned-word guard (v8 → restored v9)
Deliberately exposed the "Verified Safe" hero and the full home screen, then linted:
- "Screenshot 'home' shows "sate" (OCR's reading of "safe") in 'home-img' at 4.1–5.4s, and lint.avoid rules out "safe". Crop it out …" — **it fuzzy-matched the OCR misread**, which I'd predicted it would miss. Great.
- "Screenshot 'result' shows "Verified Safe" in 'res-card' at 6.6–10.1s …" and "… "Authenticity" …" — with time ranges and concrete remedies.
- `restore_version 7` → saved as v9, lint clean again. The non-destructive history made this experiment free.
- Still not flagged: "Safety tips & alerts" on the home crop. Arguably correct (it's not a claim about a medicine), but worth knowing that `avoid: "safe"` doesn't catch "safety".

## 6. Final polish (v10–v11)
- Bigger perks (124px + 100px icons). Lint: "'perk-acct/word' sits under the reels interface (right edge)". `get_layout` showed the stack right edge at 954 (> 940); nudged `offset [-40,-60]`. Clean.
- Patched a component's internals via `components.perk.root.children[1].style.size` — worked.
- Draft render: 540×960 @ 15fps in 11.0s. Final: `out/video.mp4`, 1080×1920 @ 30fps, 450 frames, 81.6s. "Lint: no problems."

## 7. How I handled "Verified Safe"
- Never show the result screenshot's hero. The phone's result screen is stitched from 4 crops (top bar, product card above the "Batch … Verified" row, License + Approval rows, the "Help us improve" card + FDA-data footnote). It reads as a natural screen.
- Also cut: the past expiry date (15 Oct 2025), the home screen's "Safe" badge (cropped above Recent Scans).
- The claim is carried by our own copy, "It checks the Ghana FDA register.", plus an outline on the **License Number** row — registration evidence, not a safety claim.
- `lint.avoid: ["safe","genuine","verified safe","authenticity"]` stays in the spec as a guard for future edits. Everything is listed in `notes` for the client (they should send a redesigned result screenshot).

## 8. Wishes
- Colour markup (`[word]{color}`) in **state** `content` should work (or validation should reject it) — it rendered the brackets literally and lint was silent.
- Overlap/covered-text lint should account for camera transforms (phone zoomed under a caption wasn't flagged).
- `focusCycle` on a hotspot of a cropped image could dim the whole device screen, not just that image.
- `avoid` option for stems/substrings ("safe" → "safety") or a note that matching is whole-word.
- A "stitch crops" helper for tall screenshots, or `crop` accepting several regions, would make hiding a band of a screenshot a one-liner.
- When `targetDuration` is unreachable, say which items in the long scene are setting its end (e.g. "app ends at caption reading time" vs "focusCycle end").
- OCR quality on small text is shaky ("Scan Nov", "Sean", "E" for "Search"); `{text:…}` hotspots would have failed on "Scan Now".

## 9. Ratings
- **Video: 4/5.** On-brief, on-brand, clean and readable, exactly 15s, no banned wording. Loses a point because the app scene is functional, not exciting (the scanning screen is a simple viewfinder I built; no real camera footage), and the home screen has some empty space below the crop.
- **Tools: 4.5/5.** Reference is complete enough to write a valid spec first try; patches are atomic with clear errors; `get_layout` with camera-aware `current` boxes and the OCR-backed `avoid` lint are standout features. Deductions: the silent state-markup bug and the camera-overlap blind spot.

