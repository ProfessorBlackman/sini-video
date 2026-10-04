# Brief 2 — Ledgerly launch (16:9, 20s)

Structure: intro (3.5s) → demo (8.5s: dashboard, zoom, click Export PDF, toast) → features (4s) → outro (4s) = 20s.

## Guesses

- **The big one: clicking a button that lives inside a screenshot.** §7.3 `browser` takes either a screenshot (`content`) or `children`, and §9.4 `interaction.click` takes an element ID. A button drawn inside `dashboard.png` has no ID, so it can't be clicked. My workaround: wrap the browser in a `group` (`app-wrap`) and lay a real `button` element (`export-btn`) on top of where I *guess* the Export PDF button is in the screenshot (`x: 916, y: 78` inside a 1140×712 browser). I have never seen the screenshot, so this position is a guess. If it's wrong there will be two "Export PDF" buttons, or my button will cover some other UI.
- **§7.3 browser `height` and chrome** — I don't know if `height` includes the address bar, or how tall the bar is. I guessed about 52px, so the overlay button sits at y = 78.
- **§7.3 browser `style.radius` / `shadow`** — assumed they apply to the device frame.
- **§7.3 group children with `x`/`y`** — "Children use their own layout, relative to the group's box". I assumed absolute `x`/`y` inside a group are relative to the group's top-left.
- **Nested groups and camera focus** — §9.4 `camera` `focus: "export-btn"`. `export-btn` is two levels deep (stage → app-wrap → export-btn). I assumed focus can target any descendant of the camera group.
- **Camera keyframe semantics** — I assumed keys are interpolated pairwise with the top-level `ease`, and that two identical consecutive keys mean "hold". Also assumed `"focus": "center"` is the group's centre (it's used in the example but not defined).
- **§4.2 role sizes on a 1920px canvas** — "Sizes assume a 1080px-wide canvas." Unclear whether they scale up by 1920/1080 on 16:9 or stay as written. I assumed they **don't** scale and set explicit sizes where it mattered (title 84/96, intro mark 240). If they do scale, everything will be ~1.78× bigger and the demo title will overflow its 520px column.
- **Interaction cursor in a zoomed camera** — the cursor moves to `export-btn` while the camera is zoomed 1.8×. I assumed the cursor is drawn in screen space and goes to the button's *on-screen* (zoomed) position, at normal cursor size.
- **Interaction `from: "bottom-right"`** — assumed this is a canvas anchor, as in the example.
- **Interaction timing** — "click moves to an element (about 0.5s), presses it (0.18s)". So with `at: 3.7` the press lands about 4.38s and `set` fires then. "About" makes everything after it uncertain.
- **`id` on a behavior timeline item** (`export-click`) — §8 says `a1.start/end` work for "a timeline item with id", so I assumed behaviors can have ids too. I ended up not referencing it (see Hard parts).
- **State change `done` via timeline** while `loading` is set by the interaction — assumed states can chain this way and the label rolls again.
- **Timeline enter preset vs element visibility** — not an issue here (I used `enter` on every card), but I avoided timeline `slideIn` on the grid cards because §7.1 says elements with no `enter` are "visible from scene start". It's unclear whether a timeline preset hides them before its `at`.
- **Enter on group children inside a grid** — assumed each card's `enter` works even though the card is a grid cell.
- **`grid` width 1600 and card width** — assumed cells are (1600 − 2×32)/3 ≈ 512px wide and that `maxWidth: 420` text fits.
- **`radius: 999`** — assumed it clamps to a pill shape.
- **`"Exporting…"` / `"✓"` glyphs** — assumed the bundled fonts have them.
- **`role: "mono"` with `color` override** — fine per §7.3, assumed it uses the mono font slot (JetBrains Mono).
- **The URL `ledgerly.app/dashboard`** — the brief only gives `ledgerly.app`. I assumed a path in the address bar is OK and looks realistic.
- **`circle` transition `origin: "center"`** — assumed anchor names work there ("anchor or element ID").

## Invented

- **Copy that the user didn't give**: "Invoicing, minus the busywork.", "Create, send and track every invoice.", the feature cards ("Auto-numbered invoices", "Your logo, your colours", "Send or download"), the toast text "INV-2041.pdf saved to Downloads". These are product claims I can't verify — the user should check them.
- **The Export PDF button's position** — invented coordinates (see above).
- No DSL keys or values outside the reference, as far as I can tell. Closest calls: `style.weight` as a number (600/700) and `letterSpacing: -0.03` (the units — em — are documented, but I'm not sure negative values are allowed).

## Missing

- **A way to target a region of a screenshot.** Something like hotspots on an image asset (`"hotspots": { "export": [x, y, w, h] }`) would let me click "Export PDF" in the real screenshot instead of overlaying a fake button.
- **A toast / notification element.** I had to build it from group + rect + circle group + 2 texts (6 elements with hand-placed insets). A `toast` type (icon, title, subtitle) would be one line.
- **A "loading" state for buttons** (spinner). I used a label change "Exporting…" and a faded fill instead.
- **No way to say "zoom back out once the click finishes"** relative to the interaction. The camera keys use absolute times, and the interaction duration is only "about" known, so I hard-coded numbers.
- **No audio** (a click sound / music bed is typical for a SaaS launch).
- **No visual of the PDF itself** (for example, a document flying out of the button). I could have built it from rects, but it would have been a lot of pixel work.

## Hard parts

- **Overlay button pixel math**: browser at x = 680–1820, y = 184–896 (centred vertically: (1080 − 712)/2 = 184). Button at group-local (916, 78) = 1140 − 40 − 184 for x. The y depends on unknown chrome height. Entirely guesswork, and it has to match an image I can't see.
- **Toast layout**: placing the icon, title and meta text inside a 420×96 box with insets (`[18, 92]`, etc.) needed font-height estimates (28px × 1.3 + 4 + 22 × 1.4 ≈ 72px, so it should fit 96px with ~12px top and bottom).
- **Choreographing camera + interaction + state + toast** in one scene, all with absolute numbers: zoom in 2.9→3.6, cursor starts 3.7, press ≈ 4.38 (loading), done at 5.0, zoom out 5.2→5.8, toast at 5.9. Relative refs would have been nicer (`"export-click.end+0.6"`), but I don't know when the interaction "ends" (after the press? after `set` animates for 0.35s?), so I gave up and used numbers. Changing any one of these means updating four others by hand.
- **Reading time during the camera move**: the demo title and subtitle are pushed off-screen by the zoom at 2.9s, which gives the subtitle only ~1.4s of the 2.3s it needs before the zoom. It's visible again after 5.8s. I don't know whether lint would flag this.
- **Durations adding up to 20s exactly** while respecting reading times — juggled by hand again.
