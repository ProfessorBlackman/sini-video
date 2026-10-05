# Ledgerly feature demo — Sini test log

## 1. What I built (final: version 6, 20.0s, 16:9, draft at out/draft.mp4)

Theme: palette night/ink/bone/blue/sky/mute, Bricolage Grotesque + Inter Tight, `editorial` motion, wipe transition with blue bar, light grain + vignette, `video.end` fade to night.

**Scene `demo` (14.5s fixed)** — one continuous camera shot on the dashboard.
- `stage` group containing a `browser` (light chrome, url `ledgerly.app/invoices`, `content: dash`), entering with `fadeUp`.
- `dash` image asset with hotspots: `export` (pixel box measured from the PNG) plus three tiny framing hotspots `f-left/f-mid/f-right` used only as camera targets.
- `camera` behavior: hold wide → zoom 2.4 on `dashboard#export` → pull back to zoom 1.6 on the stat row with a small left→right pan (one key per card) → zoom out to full view.
- `interaction` behavior: pointer cursor clicks `dashboard#export`.
- Device `overlay`: a `toast` ("Preparing PDF…" with spinning loader → state `done`: check-circle, "PDF ready", "Invoices-October.pdf"), slid in at `click.end+0.15`, state switch at `toast-in.end+0.7`.
- Three overlay `shape` rects (blue stroke, faint fill) over the stat cards, each `scaleIn` then `fadeOut` in sequence.
- Two caption pills (stack with translucent fill + body text) at the bottom: "Export any invoice to PDF in one click", then "Know where your money stands at a glance".

**Scene `outro` (5.5s fixed)** — radial blue background, centred stack: "LEDGERLY" label, display "Try Ledgerly *free*" (wordReveal), outline button "ledgerly.app" (fadeUp at `outro-cta.enter.end+0.25`), whole block on a slow `drift`.

Round 2 (client feedback, v6): zoom into Export PDF lengthened from 0.9s to 1.9s and camera ease changed from `expo.inOut` to `cubic.inOut`; all downstream beats shifted (click, toast, captions, highlights); the "PDF ready" toast now holds ~1.3s; `ledgerly.app` added to the ending. I located the zoom with `describe_at(1.9)` (it reports "camera (cam)" animating) and `get_video`.

Versions: v1 first draft, v2/v3 diagnostic tests (shadow, chrome), v4 reworked first version (rendered), v5 probe of index paths, v6 final.

## 2. Tool errors, warnings, surprises

- No tool returned an error during the whole session. `create_video` succeeded silently without telling me whether the spec was valid or lint-clean (I had to call validate/lint separately).
- Lint warning (all versions): `! export-toast: 'export-toast' is drawn at 17px on the canvas, too small to read on a phone. Raise its style.size ...` — false alarm in practice: the toast is only ever visible while the camera is at zoom 2.4 (get_layout shows `screenFontSize: 32.4`). Lint ignores camera zoom. Left as is.
- Lint warnings (all versions): `! cap-export-txt: 'cap-export-txt' is partly covered by 'cap-stats', which is drawn on top of it.` and `! cap-export-txt: 'cap-export-txt' and 'cap-stats-txt' overlap while both are on screen.` — false positive: cap-export exits 6.3–6.6, cap-stats enters at 7.2; describe_at confirms they are never visible together. Ignored.
- Patching unnamed timeline items: the reference only documents id-based paths, and my highlight/fadeOut timeline items had no ids. I probed `"demo.timeline[4].at"` and it worked (v5). Useful but undocumented.

## 3. Rendered differently from what the spec/reference led me to expect

- **Pin to a hotspot inside a device overlay silently fails.** v1: three overlay rects with `layout.pin.to: "dashboard#outstanding" / "#paid" / "#overdue"`. All three rendered at the same place, centred on the browser (get_layout at 7.0s: all three `box` = x 792, y 479), i.e. over the invoice table, not the stat cards. No validate or lint message. The reference (§7.2) says `to` can be a hotspot.
- **`chrome: "dark"` renders a blank light-grey toolbar** with no traffic-light dots and no URL text (frame 1.3s, v1/v2). Switching to `chrome: "light"` (v3) shows dots and `ledgerly.app/invoices` correctly. So dark chrome is broken, not just styled.
- There is a whitish glossy gradient over the top-left and bottom-right of the browser screen (visible at 1.3s and 4.8s). Removing `style.shadow: "deep"` did not change it, so it seems to be a built-in sheen; not in the reference. Mild, I kept it.
- Camera framing with `focus` on a hotspot always centres it, which at useful zoom levels pushes the background past the browser edge for the right-hand card (v1, 11.88s: dark background visible at the right). Not a bug, but no way to clamp to the device bounds.
- During the toast state change (4.8s in v1) the old and new titles roll over each other inside a box that is mid-resize; for one or two frames both strings overlap. Expected from "text rolls", looks slightly messy on a still frame but fine in motion.
- `*free*` in Bricolage Grotesque renders as a synthesized oblique (family has no italic). Acceptable, but not mentioned.

## 4. Workarounds

- Highlights: replaced hotspot pins with absolute `layout.x/y/width/height` in overlay logical px, computed by hand as image px × 1280/1440 (0.889). Works exactly, but requires the arithmetic the DSL is supposed to avoid.
- Camera framing for the stat row: added fake 2×2 px hotspots (`f-left/f-mid/f-right`) purely as camera targets, chosen so the view at zoom 1.6 stays inside the browser while still panning slightly per card.
- Dark chrome: used light chrome.
- Unnamed timeline items: patched by index path (`demo.timeline[N].at`).
- Fixed scene durations instead of `targetDuration`: in v1, `targetDuration: 20` stretched the auto `demo` scene so ~2s of idle zoomed-out dashboard sat before the transition; fixed durations gave me control.

## 5. Wishes

- Pin-to-hotspot inside overlays should work, or at least validate/lint should error when a pin target can't be resolved.
- A `highlight`/`spotlight` behavior for hotspots (outline + dim the rest of the screenshot) — focusCycle only takes elements, and you can't dim regions of a screenshot.
- Camera option to clamp to the target device bounds, and an offset on `focus` (`"focus": "dashboard#overdue", "offset": [-200, 0]`) instead of fake hotspots.
- Per-key `ease` / `duration` on camera keys, so I can slow one move without changing the others.
- describe_at should say which camera segment is running (from key → to key, zoom values) — "camera (cam)" alone doesn't map feedback like "the zoom is too fast" to a key.
- Lint should account for camera zoom when judging in-device text size, and use real visibility windows for overlap checks.
- A way to shift a whole block of timeline items by Δt (retiming after the zoom change took 12 patch ops). I should also have used relative times (`cam`-based) more; but camera keys can't be referenced individually (`cam.key2.end`?), which pushed me toward absolute numbers.
- `create_video` and `update_video` could return validate + lint summaries automatically.
- Document index paths in §11.

## 6. Ratings

- **Final video: 4/5.** Clear story: dashboard → smooth zoom → click → toast resolves to "PDF ready" → each stat card outlined in turn with a gentle pan → clean CTA with URL. Highlights land precisely, timing reads well at 20s. Not 5 because the highlights are just outlines (no dimming of the rest), the browser sheen is slightly cheap-looking, and the ending is static typography only.
- **Tool experience: 3.5/5 (rounding to 3).** The camera, interaction, toast states, contact sheets and get_layout are genuinely good and fast (draft renders in ~9s). get_layout was what exposed the pin bug. But two features failed silently (hotspot pins in overlays, dark chrome) with no validation or lint signal, and lint produced three persistent false positives, which erodes trust in its warnings.

**Worst problem:** pinning overlay shapes to image hotspots (`pin.to: "dashboard#outstanding"`) silently placed all three highlights in the centre of the browser, with no error or warning; only rendering + get_layout revealed it.
