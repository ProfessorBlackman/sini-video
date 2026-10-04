# Brief 3 — Pulse fitness app demo (15s, 9:16) — authoring notes

Structure: `intro` 2.5s → `onboarding` 4.5s → `home` 5s → `outro` 3s = 15s. Onboarding and home are two different phones in two scenes, joined by the theme's push-slide transition; outro enters with a circle reveal from the "Start workout" button.

## Guesses

- **Default text enter.** §4.3 says "Default text enter" for `snappy` is `popIn`, but §7.1 says "An element with no `enter` is visible from scene start." These two conflict: I couldn't tell when the default applies. I set every `enter` myself.
- **`slide` transition `direction` values.** §10 lists `direction` with no allowed values. I guessed `"left"`, meaning the new scene comes in from the right. It might mean the opposite.
- **`circle` transition `origin`.** §10 says "anchor or element ID". The transition belongs to the incoming scene, but I want it to start from `h-start`, which is in the **outgoing** scene. §8 says time references must stay in the same scene, but says nothing about transition references. `matchCut` clearly lets you point into the outgoing scene, so I assumed `circle` does too.
- **Phone screen size.** §7.3 only says "height defaults to `width × 2.1`" (620 → 1302). It doesn't give the bezel, the screen size, or the status bar height. I guessed ~96px top inset for the status bar and used `"100%"` for the onboarding screen group, assuming % means % of the screen.
- **`chrome` on `phone`.** §7.3's table lists `chrome` next to both devices, but its effect on a phone isn't explained. I used `"dark"`, guessing it means a dark frame.
- **`group` with `height: "100%"` as a device child.** I used it to get a full-screen, absolutely laid-out screen inside the phone, assuming "Device children stack vertically… stretch to the screen width" still lets a group take 100% height.
- **`style.fill` on a `group`.** §7.1 says every element accepts `style.fill`, so I used it to paint the background of each section in the home screen. It's unclear whether a group renders a fill. I needed it because a device's screen background colour can't be set (see Missing).
- **Relative layout (`below`) inside a group.** §7.2 says "an element ID in the same scene". I assumed this also works for siblings inside a group or device, and that `width: "86%"` resolves against the group.
- **`inset` with `anchor: "bottom"`.** "Ignored on centred axes", so `[118, 0]` = 118px from the bottom, centred horizontally. With a 1302px phone, the top lands at y≈500. I'm assuming the phone's height includes its frame.
- **`offset` combined with `below`/`rightOf`.** §7.2 only documents `offset` under anchor placement. I used it on `wordmark-dot` and `h-card-title` to nudge them.
- **`align: "end"` for `rightOf`.** I assumed it bottom-aligns the dot with the wordmark's box.
- **Preset on a `stack`'s children.** `{ "target": "ob-goals", "preset": "fadeUp", "stagger": ... }`: I assumed `stagger` applies to a container's children ("multi-part targets"). That isn't stated anywhere.
- **`id` on behavior timeline items.** §8 allows `"a1.end"` for "a timeline item with `id`". I assumed this covers `interaction` and `scroll` behaviors (`ob-tap.end`, `h-scroll.end`), and that their end is computed from the steps.
- **Interaction cursor start `"from": "bottom-right"`.** I assumed it means the canvas corner, not the phone's.
- **Animating `value` on a progress element from the timeline**, at a time relative to the interaction's end. I assumed the indicator moves smoothly.
- **State `style.scale`.** "Any style property" can change and `scale` is a style property, so I used `scale: 0.97` for a "pressed" look.
- **`radius: 999`** for pill-shaped buttons. Shape `pill` exists, but buttons have no pill variant.
- **Scroll `to: "h-card"`** is a grandchild (phone → h-today group → h-card). I assumed nested IDs can be scroll targets and that "into view" puts the card near the top.

## Invented

- `style.size` on a `button` (`h-goal`): `size` is only listed under text style overrides.
- `"style": { "shadow": "deep" }` on a phone: allowed in common style, but I'm guessing it applies to the device frame.
- The status bar inset (96/100px), the bezel assumptions, and the `focus` value on the card photo are all invented numbers.
- `"✓"` and `"▶"` glyphs in button labels: the reference uses ✓ in an example, so ▶ is my extension. I'm assuming the font has it.
- The app content (name "Kofi", stats "4 day streak / 3.2k kcal / 86% recovery", "Upper Body Power 45 min") is invented copy, not from the brief.

## Missing

- **A background colour for a device screen.** I had to fake it with a full-size `rect` (onboarding) or `style.fill` on every section group (home).
- **Padding on containers and devices.** Device children stretch edge to edge with no gap. To get side margins I wrapped every section in a `group` with a fixed height and anchored the contents with `inset [.., 40]`. This was very verbose.
- **Changing what's on the phone screen within one scene** (onboarding → home after tapping Continue). There's no "screen swap" or navigation for devices, so I split it into two scenes with a push transition. A real app transition would slide only the screen content, not the whole phone and headline.
- **A card component** (background + content). Every card is a group with a `rect` plus texts, repeated three times for the stats.
- **Reusing the same phone across scenes.** The phone is redeclared in each scene and has to get the same layout by hand.
- **A disabled button state** as a concept: I used a grey `default` and a `ready` state.
- **No way to say "after the interaction's click on X"** other than the end of the whole interaction. I had to time the progress-bar update off `ob-tap.end`.

## Hard parts

- **Vertical layout arithmetic.** Phone top = 1920 − 118 − 620×2.1 = 500. The headline (title 104 × 0.95 × 2 lines ≈ 198px) at inset 150 ends at ≈348, so the gap is ~150px. I worked all of this out by hand.
- **Estimating how long the interaction takes:** click ≈ 0.5 + 0.18s, so onboarding is 1.5 + 0.68 + 0.35 + 0.68 ≈ 3.2s. That left 1.3s of hold in a 4.5s scene. These are rough guesses from "about 0.5s".
- **Scroll distance.** I had to guess that the section heights (300 + 220 + 400 + 680 + 420 = 2020) are tall enough for `h-card` to scroll into view, without knowing the screen height.
- **Intro reading time.** I chose a 2-word tagline because it enters around 1.0s and needs ≥1.1s on screen in a 2.5s scene.
- **Font sizes inside a 620px phone.** Role sizes "assume a 1080px-wide canvas", so I hand-scaled to 56/52/22. I don't know whether device children get auto-scaled.
