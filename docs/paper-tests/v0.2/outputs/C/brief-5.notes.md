# Brief 5 — authoring notes (da Vinci quote, black & gold, calm, 10s 9:16)

Structure: 4 scenes, 2.3 + 2.4 + 1.8 + 3.5 = 10.0s. Each beat is a piece of the quote ("Simplicity" / "is the ultimate" / "sophistication.") and the last scene shows the full quote with the attribution.

## Guesses

- **`video.background: "black"`.** §3 says the default is `"#000000"` and calls it "Colour behind all scenes". §13.2 sets `"background": "ink"` here, so I assumed a palette token is fine even though `video` sits outside `theme`.
- **Radial gradient direction.** §4.1 shows `{ "radial": ["wine/0.35", "ink/0.75"] }`. I assumed the first stop is the centre and the second is the edge. With `["char", "black"]` that gives a soft lit centre.
- **`trackIn` `from` units.** §9.2 says `from (0.4em)`, and §13.2 uses `"from": 0.42`. I assumed a bare number means em.
- **`duration` on multi-part presets** (`charReveal`, `lineReveal`). It's unclear whether `duration` is per part (per char or line) or for the whole reveal. For "sophistication." (15 chars, stagger 0.035) I assumed it's per char, so the total is about 0.035 × 14 + 0.7 ≈ 1.2s. If it means the total, the reveal is faster. The scene's reading time depends on which one is right.
- **`*italic*` inside display text plus `fit: "shrink"`.** I assumed shrink measures the italic glyphs correctly.
- **`maxWidth` inside `layout`.** §7.2 lists `maxWidth` under "Size, for all methods", but §7.3 lists `fit`/`maxLines` as element keys. I put `maxWidth` in `layout` and `fit`/`maxLines` at the element's top level.
- **`drift` with a list target and `at: 0`.** I assumed it applies to each target separately and adds to the enter animation (fadeUp/blurIn) instead of fighting it. §7.2 says animation `y` is an offset, but it doesn't say whether two animations on `y` add together or override each other.
- **`blurIn`'s `amount` and `charReveal`'s `blur: true`.** Taken from the param column. I assumed they're passed as top-level keys of the long-form preset object, the same way `distance` is in §13.2's timeline item.
- **`zoom` transition params.** §10 lists `direction (in | out)`, and I assumed it also accepts `ease` ("All transitions accept duration and ease").
- **Smart quotes and em dashes in `content`.** I assumed any Unicode renders in Fraunces.
- **`letterSpacing` on a `label`.** §4.2 says label already has 0.08em, and I assumed `style.letterSpacing: 0.24` replaces it rather than adding to it.
- **Fraunces italic.** I assumed the bundled Fraunces includes the italic style, and that `*...*` uses a real italic rather than a fake slant.

## Invented

- Nothing outside the reference as far as I can tell. Every key and preset is listed in §3–§10. The palette token names (`char`, `goldlight`, `smoke`) are my own, which §4 allows. `smoke` ended up unused.
- Borderline: I used `"ease": "cubic.out"` on `trackIn`. §9.1 lists the cubic family with `.in/.out/.inOut`, so it should be valid.

## Missing

- **Per-word colour inside one text block.** I wanted "ultimate" in gold inside an ivory sentence, which needs a span-level colour. Markup only supports `*italic*` and `**bold**`. Workaround: split the sentence into separate elements stacked with `below`, which means guessing at baseline spacing.
- **Fade to black at the very end.** There's no "video outro" or end transition. Adding `exit: fadeOut` to every element in the last scene eats into reading time, and I can't fade the scene background out. I left the ending as a hold.
- **Easing for `drift`.** I couldn't tell whether ambient presets accept `ease`. I assumed they're linear.
- **Word-by-word reveal timed to a reading rhythm across scenes.** Kinetic typography usually reveals one phrase per beat. Splitting into scenes works, but each phrase then gets its own transition overlap, and I can't keep "Simplicity" on screen while the next words arrive, unless I use one long scene with manual timing.

## Hard parts

- **Duration arithmetic.** The scenes have to sum to exactly 10.0s while each phrase meets `0.5 + 0.3 × words`. For the final scene (9 words of quote plus attribution), the quote alone needs about 2.0s fully visible and the author line 1.7s. I squeezed the middle scenes to 1.8–2.4s to make this fit. Because of the `duration` ambiguity above, I'm not sure the "sophistication." reveal finishes with 0.8s left to read.
- **Width of "sophistication."** At display size 150 in Fraunces italic, 15 characters is roughly 950–1050px, which is over the 936px safe width. I couldn't measure it, so I used `fit: "shrink"`.
- **Vertical centring of a two-element group.** In "ultimate" and "attribution", the top element is anchored at the centre with a hand-guessed negative `offset` (-130, -90), so the stack only looks roughly centred. There's no "centre this group of elements" option without wrapping them in a `stack`. A centred `stack` would probably have been better, but stack children ignore placement keys, and I wanted separate enter timings (I'm not sure those survive inside a stack).
- **Transition overlap.** The crossfade (0.8s) starts at the incoming scene's t = 0, so the first 0.8s of each scene is half-visible. The enter `at` values (0.1–0.25) mean the reveals partly happen under the dissolve. That's fine visually, but it makes it unclear when the "fully visible" reading time starts.
