# Brief 3 — Pulse fitness app (9:16, 15s) — authoring notes

Structure: `intro` (3.2s wordmark) → `demo` (7.6s phone: pick goal, Continue, home scrolls to today's workout) → `outro` (4.2s CTA). Total 15.0s, all fixed durations.

## Guesses

- **Component paths in interaction `set`.** §9.4 shows `set: { element: state }` and §7.4 says component internals are addressed as `<instance-id>/<local-id>` "from outside", with examples for time refs and `click`. I assumed `"goal-strength/goal-dot": "on"` is also valid as a `set` key.
- **States declared inside a component definition.** §7.4 says the *instance's* `states` apply to the root. I put `states` on the component root (and on the inner `goal-dot`) in the definition, assuming they're inherited by every instance. Not stated.
- **`{{param}}` in non-content string values.** I used `"variant": "{{variant}}"` and `"asset": "{{photo}}"`. §7.4 says params are "replaced anywhere in string values", and the speaker-card example shows `asset`, so I assumed `variant` works too, but enum-valued keys being templated isn't shown.
- **`navigate` inside an interaction step: which transition?** §9.4 `navigate` behavior has `transition` (`push | fade | none`), but the step option form `{ device-id: screen }` has nowhere to put it. I assumed it defaults to `push`.
- **Interaction cursor fade-in timing.** "It fades in over 0.2s before the first step" — I assumed `at` is the start of the first step's move (so the fade happens at `at-0.2`), not that the fade starts at `at`.
- **Is a navigated-away screen's scroll position / the scroll target in a non-initial screen OK?** I scroll to `today-label`, which lives in the `home` screen, after navigation. Assumed scroll targets resolve within the currently shown screen.
- **Scroll limit.** "scrolled until its top sits 24 logical px below the top ... (or as far as the page allows)". I added the "Up next" card partly so the page is long enough for the scroll to actually reach `today-label`.
- **Button `width` inside a phone page.** "Page children ... stretch to the screen width minus padding, unless they set their own width." I set `"layout": { "width": "auto" }` on the goal chip hoping that means "shrink to content" rather than "stretch".
- **`align: "stretch"` on a vertical stack** — I assumed it makes children (button) full width; `stack` default `align` is not documented.
- **`style.shadow` on a phone.** §7.1 says every element accepts `style`, so I put `shadow: "deep"` on the phone; unclear whether devices render it.
- **Text `states` changing `content` on a top-level caption** with an explicit `\n`. §9.5 says content rolls vertically; I assumed a two-line → two-line roll works and doesn't re-run the enter.
- **Radial gradient with a translucent first stop** (`["coral/0.22", "ink"]`) as a scene background — assumed it composites over `video.background`.
- **`pulse` with `ring: true` on a button inside a component in a phone** — assumed the ring draws in device space and isn't clipped awkwardly.
- **Where the reels safe zone is.** The reference names `"reels"` but gives no pixel numbers. I guessed ~200px top / ~300px bottom and kept the caption at y=200 and the important phone content above ~y=1400.

## Invented

- Nothing outside the reference in terms of keys/types/presets, as far as I can tell. Borderline items:
  - `"variant": "{{variant}}"` (templating an enum; see Guesses).
  - `"layout": { "width": "auto" }` on a button inside a phone (listed as a size value, but used to opt out of stretch — semantics invented).
  - A transparent `rect` shape (`fill: "paper/0"`, height 90) as a **spacer** to push the Continue button down. Spacer isn't a concept in the reference.
- Copy: all of it except "Pulse", "Build strength" and "Continue" (listed in `notes`).

## Missing

- **Per-screen background / padding** on a phone. `background`, `padding`, `gap` are device-level, so onboarding and home share a white background; I'd have wanted the home screen on a light grey with white cards. I flipped it: white screen, grey (`mist`) cards.
- **Pinning content to the bottom of a phone screen** (Continue button at the bottom like a real onboarding screen). Screens only stack top-down; used the spacer hack.
- **Navigate transition choice inside an interaction step** (see Guesses).
- **A "selected" state that cascades to children** — I had to set the root state and the dot's state separately in `set`.
- **Conditional/optional children in a component** — both workout cards must have a button; gave the second one "Preview" (outline) rather than none.
- **Status bar content** (time, battery) — unknown what it shows; left default.

## Hard parts

- **Phone geometry.** Outer height "≈ width × 2.1" (600 → ~1260), bezel thickness unknown, so the screen scale (~570/390 ≈ 1.46) and where the Continue button lands on canvas (~y 1340) are estimates. Needed this to keep the tap target and button out of the reels bottom UI.
- **Logical page height** to judge whether the scroll can reach `today-label`: summed status bar 54 + padding + estimated text heights + 220 hero + ~97 week card + ~330 per workout card ≈ 1280 logical, vs. 844 viewport. Pure guesswork without `layout`.
- **Hand timing** of the interaction: move 0.5 + press 0.18 per click, wait 0.45, navigate 0.45 → used to size the 7.6s scene. Relative refs (`tap-continue.end+0.9`, `to-today.end`) helped, but the fixed scene length still required summing everything by hand to hit exactly 15s.
- **Reading-time check for the intro** (`wordReveal` per-word duration + stagger, then 0.5 + 0.3 × words) to make sure 3.2s isn't flagged.
- **Caption width:** guessing whether "Today's workout, ready." at 104px fits; forced explicit line breaks instead.
