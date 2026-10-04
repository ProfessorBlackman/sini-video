# Brief 5 — authoring notes (Leonardo quote, 10s, 9:16, calm, black & gold)

Structure: 3 scenes, crossfade between them, fixed durations 2.4 / 3.4 / 4.2 = 10.0s.
1. "Simplicity" builds character by character, gold rule wipes in under it.
2. "is the ultimate" (small italic) then "sophistication." tracks in, bone→gold colour settle.
3. Full quote recap with a large gold opening quote mark, rule, and "— Leonardo da Vinci".

## Guesses

- **`duration: "auto"` vs `targetDuration`** (§3: "Sini stretches or shrinks the hold time of `auto` scenes to hit it"). My hand-computed auto durations sum to ~10.9s. It's unclear whether "hold time" means only the 0.4s hold (max 1.2s available to shrink across 3 scenes, so 0.9s would leave ~0.1s hold each) or all time after the last enter. I gave up on `auto` + `targetDuration` and used fixed durations, going against rule 6 / checklist "Scenes use auto unless a fixed length matters" (I argue a fixed length matters here).
- **Reading time vs transitions** (§6: "Time under an incoming transition doesn't count as reading time"). I took this to mean the first `transition.duration` seconds of the *incoming* scene don't count, so I started all text after 0.5s in scenes 2 and 3. Unclear whether it also means the outgoing scene's text, which keeps playing underneath, gets credit for that time.
- **Reading time vs `video.end` fade.** The last 0.5s fades to ink while `q-author` is (by my maths) still in its reading window (ends 4.1, scene ends 4.2, fade starts 3.7). Lint might or might not count fade time as readable. Not specified.
- **What counts as a "word"** for `0.5 + 0.3 × words`: is "—" a word? Is "“" (a lone glyph) zero words (= 0.5s)? I assumed "—" counts, to be safe.
- **`charReveal` duration**: "duration is per part", so with calm's default 1.1s per character, "Simplicity" would take 1.1 + 0.12×9 = 2.18s. I overrode to 0.8/0.05. I'm assuming `stagger` overrides the theme's stagger too.
- **`drift` with `scale`** on an element that is also doing `charReveal`/`trackIn`: §9.3 says non-offset properties "most recent wins". I'm unsure whether drift's scale conflicts with anything inside the text presets; assumed not.
- **`drift` `y` param** shares its name with the animatable property `y`; assumed it's read as the preset param.
- **`trackIn` `from: 0.3`** is in em; I assumed the end state is the role's normal letter-spacing.
- **`animate.color` on a text element** — §9.3 lists `color` as animatable; I assumed it targets the text colour (vs `fill`). It starts at `w-sophistication.enter.start`, the same moment `trackIn` starts fading in; I assumed both can run at once.
- **`fit: "shrink"` needs a `maxWidth`**; top-level text defaults to 936 (1080 − 2×72). Inside a stack I set `layout.maxWidth: 936` explicitly because I wasn't sure stack children get the same default.
- **`radial` background** without size/position: assumed centred on the canvas.
- **`wipeIn` on a `line` shape**: assumed this draws the line left-to-right (rather than `drawOutline`). Either seemed plausible.
- **Scene background repetition**: each scene repeats the same radial; assumed there is no "inherit previous scene background" option (none is documented), and `video.background` is only what's *behind* scenes.

## Invented

- Nothing outside the reference as far as I can tell. Small risk items:
  - `layout.maxWidth` on a child of a stack (reference says stack children "keep size keys"; I'm treating `maxWidth` as a size key).
  - `fit`/`maxLines` placed at element top level (per the `text` table), not inside `style` or `layout`.
  - `"ease": "sine.inOut"` on the theme transition object (§10 says all transitions accept `ease`; I assumed it works in `theme.transition` too).

## Missing

- **Per-word colour inside one text block.** In the recap I wanted "sophistication." in gold within the bone sentence. Only `*italic*` / `**bold**` inline markup exist, so it's just italic. The alternative (splitting it into two text elements in a horizontal stack) breaks the natural line wrap.
- **Per-word kinetic choreography within one line** (e.g. each word with a different preset or position). Got around it by splitting the quote across scenes/elements.
- **Glow / text shadow** for a "gold" feel: `shadow` is only `none | soft | deep` and unclear on text; skipped.
- **Gradient text fill** (metallic gold): `color` on text — unclear if gradients are allowed there (§4.1 says "anywhere a colour is accepted", so maybe?). Didn't risk it.
- **Making the same background persist across scenes** without a visible crossfade of identical backgrounds — no option, so I repeated it.

## Hard parts

- **All of the timing arithmetic.** To check reading time I had to hand-compute enter ends using the per-part duration formula (`duration + stagger × (parts − 1)`), know how many parts (characters vs words vs lines) each preset splits into, add reading time per text block, and avoid the transition window. E.g. scene 2: `w-is-the` ends 0.5 + 0.7 + 0.12×2 = 1.44; `w-sophistication` starts 1.14, ends 2.44, + 0.8 reading = 3.24 ≤ 3.4. One slip in counting characters or lines and lint fails.
- **Whether "sophistication." fits at display size**: 15 characters at 150px in Instrument Serif. I couldn't know the width, so I added `fit: "shrink"`, which may make it smaller than "Simplicity" in scene 1 (inconsistent scale).
- **Line count of `q-full`** for `lineReveal` timing depends on wrapping. I forced it with `\n` so it's 2 lines, assuming "Simplicity is the ultimate" fits in 936px at 64px (I think it does, but couldn't check).
- **Hitting exactly 10s** meant giving up on `auto`, which pushed me back into the manual arithmetic the reference tells me to avoid.
