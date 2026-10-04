# Brief 2 — Ledgerly launch, 16:9 (authoring notes)

Structure: hook (wordmark + subline) → demo (browser with the screenshot, camera zooms to Export PDF, cursor clicks, camera pulls back, toast slides in and rolls "Exporting PDF..." → "PDF exported" with a check) → one-click (claim line) → cta ("Start free at [ledgerly.app]" with pulse ring). All `auto`, `targetDuration: 20`, fade to night at the end.

## Guesses

- **§9.4 interaction `at` vs cursor fade-in**: "It fades in over 0.2s before the first step". Unclear whether `at: 2.0` is when the fade starts or when the first move starts. I assumed the move starts at `at`, so `click.end` = 2.0 + 0.5 + 0.18 = 2.68.
- **§9.4 camera + interaction**: I timed the camera to reach the zoomed key at 2.1, while the cursor's move runs 2.0–2.5. I assumed the cursor follows the hotspot on screen during the zoom ("follow their targets on screen").
- **§8 `"cam.end"`**: camera end = last key's `at` = `click.end+1.2`. I assumed a key's `at` can itself be an expression referring to another timeline item, as in the §13.3 example, and that chaining (toast → cam → click) resolves.
- **§7.2 pin inside a `group` used as a camera**: I put the toast inside `stage` so it's in the same parent as `dashboard`. That means the toast is also zoomed by the camera. I timed the toast to enter only as the camera finishes zooming out (`cam.end-0.2`) so it's at normal size. I don't know whether pinning to an element whose `enter` is `scaleIn` uses the final or the animated box.
- **§7.3 browser height with `content`**: "Default viewport height: 800". I assumed that with a screenshot `content`, the browser still shows an 800-logical-px viewport (cropping a taller image) rather than growing to the image height. Browser outer height ≈ (44 + 800) × 1240/1280 ≈ 818px.
- **§9.5 states on a stack and on a text child**: I set separate `done` states on `toast-icon`, `toast-check` and `toast-msg`, each switched by its own timeline item at the same time. I assumed a state can't cascade to children, and that a state changing only `style.opacity` is valid.
- **§9.5 + §9.3 combining**: `toast-pop` animates `scale` on `toast-icon` while its state changes `fill`. I assumed these don't conflict ("most recent wins" is per property).
- **§9.2 `slideIn` with `distance: 80`**: distance defaults to off-canvas. I assumed a numeric px value is allowed.
- **§10 transitions**: `slide` + `push` as the theme, and `circle` only on the CTA to mark "end of section", per §4.4's advice.
- **Timeline item ids**: I gave state items ids (`toast-done-icon`, …) because §1 says timeline item ids must be unique. I assumed ids are optional on state items.
- **§7.3 button `style.weight`**: listed as overridable, so I set 700.
- **§6 auto duration in `demo`**: the reading time of `toast-msg` probably starts at its enter end, not at the state change, so the "PDF exported" text might get less hold than it needs. I'm relying on `targetDuration` stretching it.

## Invented

- Copy: "Introducing", "Invoicing, *without the paperwork.*", "Exporting PDF...", "PDF exported", "From invoice to PDF in one click." Listed in `notes`.
- Palette values and fonts.
- No keys or presets outside the reference that I'm aware of. Borderline: `"justify": "center"` on a fixed-size stack to centre the check glyph (same doubt as brief 1).

## Missing

- **A toast / notification element**: the brief's key moment. There's no toast type, so I built one from a horizontal stack, an icon stack and a text, with three coordinated states. This is the most likely thing in the file to look wrong.
- **A spinner / loading state**: I wanted the icon to spin while "Exporting...". I could do a repeating `rotation` animation, but a check glyph rotating looks wrong and there's no spinner element. I used a grey dot that turns mint instead.
- **Overlaying UI on the screenshot in device coordinates**: a toast should live *inside* the browser viewport, at a logical position (e.g. 24px from the bottom-right of the viewport). `browser` can have `content` OR `children`, not both, so the toast can't be a child. I placed it in canvas px with a pin + offset, which is pixel guessing.
- **Pressed state on the screenshot button**: the click can't visibly change the Export PDF button itself (it's pixels in an image). Only the cursor press shows.
- **Wait-until-camera-arrives**: I'd like "click when the camera has settled" as a relation. I used hand-tuned numbers (camera key 2.1 vs interaction `at` 2.0).

## Hard parts

- **Toast offset**: pin places the toast's *centre* on the dashboard's bottom-right corner. To sit it 40px inside the corner I needed its size: width fixed at 520 → half 260 + 40 = 300; height ≈ 56 + 2 × 20 padding = 96 → half 48 + ~50 → −100. Hand-computed and fragile. A `pin` with an "inside, inset N" option, or anchoring to a sibling's box, would remove this.
- **Toast width**: I fixed it at 520px so it doesn't resize when the text rolls from "Exporting PDF..." (16 chars) to "PDF exported" (12 chars). An auto-sized stack would shrink, and because pin centres it, it would shift left and right. Estimated 16 chars × ~0.5 × 40px ≈ 320px of text + 56 icon + 20 gap + 52 padding ≈ 450 → rounded to 520.
- **Interaction timing**: computing `click.end` from the pace table (move 0.5 + press 0.18), then lining up the camera keys around it. Expressions helped, but the first camera key (2.1) and interaction start (2.0) are coupled by hand.
- **Glyph check**: §4.2 lists the guaranteed glyphs. `…` isn't on the list, so I wrote "..." instead. `✓` is on the list.
- **CTA row width**: "Start free at" at 104px (~13 chars × 0.55 × 104 ≈ 745) + 32 gap + button (12 chars × 0.55 × 56 + 2 × 1.2 × 56 ≈ 504) ≈ 1280px, inside 1920 − 144. These character-width ratios are pure guesses.
