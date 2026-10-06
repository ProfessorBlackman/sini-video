# r1-ledgerly test log

## 1. What I built (final: version 7, 20.3 s, 16:9, draft at out/draft.mp4)

Theme: night/bone/blue palette, Manrope display + Inter Tight body, `editorial` motion, crossfade transition, `end` fade 0.6 s.
Asset `dash` = assets/dashboard.png with 4 hotspots (export, outstanding, paid, overdue). All are given as pixel boxes; the text hotspot for export failed (see section 2).

**Scene `demo` (about 15.3 s, auto)**
- A `group` "stage" holds a dark-chrome `browser` (url ledgerly.app/invoices, content = dash, deep shadow, fadeUp enter).
- A caption sits outside the group: "Export every invoice in one click". A `state` switches it to "Your numbers, at a glance".
- `camera` behavior on stage: center → zoom 1.9 on `dashboard#export` → hold → pan/zoom to `dashboard#paid` at 1.7 → hold → back to center at 1.
- `interaction` with a pointer cursor clicks `dashboard#export`.
- Browser `overlay` toast pinned to the left of the export hotspot. It slides in as "Generating PDF…" (loader icon), then a state change makes it "Your PDF is ready / Invoices-October.pdf" (check-circle), then it fades out.
- Three overlay `shape` rects pinned to the stat-card hotspots. Each one scales in and fades out one after another, about 1.8 s apart.

**Scene `outro` (5.0 s, fixed)**
- Centered `stack`: "LEDGERLY" label, "Try Ledgerly free" display (weight 700), a "Start free" button with a pulse, and the URL "ledgerly.app" (added in round 2).

**Round 2 (client feedback):** I ran `describe_at(1.9)` to confirm the zoom is `camera (cam)` on `stage`. Then I patched `cam.ease` from expo.inOut to cubic.inOut, stretched the zoom-in from 0.9 s to 2.1 s, slowed the later camera moves (1.0 s to 1.6 s), reduced the zoom from 2.1 to 1.9, and moved the click to 3.1. I also added the `cta-url` text to the outro stack.

Versions: v1 create, v2 hotspot/contrast/edge fixes, v3 toast placement + stats zoom + timing, v4 removed targetDuration + bolder rings, v5 ring/camera ordering, v6 typography + descender fix, v7 client feedback.

## 2. Errors, warnings, surprises
- Lint on v1: `Text hotspot 'export' ("Export PDF") wasn't found in the image; the cursor aims at the element's centre.` The text "Export PDF" is clearly in the screenshot as a crisp, high-contrast button label, so OCR failing on it is surprising. Recipe §15 promotes `{ "text": "Export PDF" }` as the easy path. I replaced it with `[1116, 32, 132, 40]`, which I got by looking at the image myself.
- Lint: `'caption' is closer than 71px to the top (70px) edge`. The checklist says 72 px, but the message says "closer than 71px". It's an off-by-one in the wording. I changed the inset to 80.
- Lint: `'cta-btn' has a contrast of 4.2:1 ... (minimum 4.5:1)`. I darkened the blue to #2459E8. This one was useful.
- `get_reference` with `section` worked even though the schema doesn't declare it, as I'd been told it would. An agent without that tip would only see the "essentials" part and would have to guess.
- `describe_at` reports text ignoring states. At t=14 it listed the caption as "Export every invoice in one click" even though the `stats` state had been applied at about 7 s, and the toast as "Generating PDF…" after its `done` state. The rendered frames are correct. This undermines describe_at for "what is on screen at 0:xx" feedback.
- `render_contact_sheet` with an out-of-range time is an error (`Time 18.6 is outside the video (0–18.20s)`). That's fair, but the whole sheet fails instead of clamping.
- With `targetDuration: 20` and a fixed outro, all the extra time (about 3 s) went into the demo scene as a static hold after the final zoom-out. That was dead air. I removed targetDuration and set the outro length by hand.

## 3. Rendered differently from expectations
- Display role in Manrope renders quite light (looks like weight 300–400). "Try Ledgerly free" looked thin until I set weight 700. The default role weight isn't documented.
- Display line height 0.92 inside a stack caused the "y" descender to touch the button below (gap 36). I fixed it with lineHeight 1.1 and gap 40. Lint didn't flag the collision.
- The first toast placement (overlay top-right under the button) covered the "3 invoices" figure, which I highlight later. Lint didn't report the overlap, probably because the screenshot is one image and not elements.
- Everything else (camera on hotspot, overlay pinning to hotspots under camera zoom, toast state roll, cursor) rendered as the reference described. The camera focus centred the hotspot exactly.

## 4. Workarounds
- Pixel hotspots instead of text hotspots (OCR miss).
- Stat-card highlights done with pinned outline rects plus scaleIn/fadeOut, because `focusCycle` only accepts elements, not hotspots. That means there's no "dim the rest" for regions of a screenshot.
- Removed `targetDuration`; padded the fixed outro instead.
- Edited timeline items by index (`demo.timeline[7].at`) for the unnamed fadeOut items. Fragile; I should have given them ids. Behavior ids worked nicely as paths (`cam.keys[1].at`, `click.at`).

## 5. Wishes
- OCR text hotspots that actually find plain UI labels, or a lint/tool that lists the text it detected, so I can see what it can read.
- `focusCycle` (with dimming) over hotspots, or a `spotlight` overlay that dims everything outside a hotspot.
- `describe_at` / `get_layout` should reflect the active state's content.
- `targetDuration` should let me choose which scene absorbs the slack, or spread it into holds after key beats rather than at a scene end.
- A per-key ease or duration on camera keys, so I could make the zoom-in gentle and the pans brisk.
- A lint check for text overlapping text inside a screenshot (toast over a stat value), plus descender/stack-gap collisions.
- Declare `section` in the get_reference schema.

## 6. Ratings
- **Final video: 4/5.** It has a clean, coherent dark theme. The camera move onto Export PDF reads well, the toast loader → "ready" state is a nice touch, the three stat highlights are clear, and the end card is tidy with the URL. It loses a point because the stat highlights are simple outline boxes with no dimming or callouts. Also, the demo scene is one long shot, so the middle can feel a little static.
- **Tool experience: 4/5.** The reference is excellent and sufficient. Patches, versions, lint and contact sheets make iteration fast (a draft render takes about 10 s), and the camera/hotspot/overlay model is genuinely the right abstraction. It loses a point for the OCR hotspot failing on the documented happy path, describe_at ignoring states, and targetDuration putting slack in the wrong place.
