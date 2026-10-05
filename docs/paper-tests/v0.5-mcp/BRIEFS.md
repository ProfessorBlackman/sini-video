# MCP test round (v0.5): briefs

**Setup:** Sini 0.1.0 from `ghcr.io/professorblackman/sini:0.1`, used only through its MCP server. Projects live in `.sini-tests/` at the repo root (git-ignored; the MCP server mounts the repo as `/work`). Each brief has its own project folder there, with assets pre-copied where listed.

**Goal:** first test of the features no AI has used yet (devices with screens, cursor and touch interactions, scrolling, toasts, progress, charts, camera, focusCycle, matchCut, svg, template), and of the MCP workflow itself (tool results, inline images, patches).

| # | Project | Format | Brief | Assets | Features it should reach for |
|---|---|---|---|---|---|
| M1 | `m1-ledgerly` | 16:9, ~20s | "Feature demo for Ledgerly, our invoicing app. Start on the dashboard, zoom in on **Export PDF**, click it and show that the PDF is ready. Then highlight the three numbers at the top one by one. End with 'Try Ledgerly free'." Then a feedback round: *"The zoom is too fast, and the ending needs our URL, ledgerly.app."* | `assets/dashboard.png` (1440×900 screenshot) | browser, camera, text hotspot, interaction, toast, focusCycle, patches |
| M2 | `m2-tro` | 9:16, ~15s | "Reel for Tro, a ride-share app in Accra. Show the app on a phone: pick a destination, scroll through ride options, tap the cheapest, then a 3-step 'driver on the way' tracker. Bright and friendly." | none | phone, screens, navigate, taps, scroll, progress |
| M3 | `m3-solar` | 1:1, ~12s | "Accra Solar Co. 2026 in numbers: installs per quarter were 120, 180, 260 and 410; 2,400 homes powered; growth of 3.4× since 2024. Clean, confident, green and white." | none | chart (bar/line), countUp, highlight |
| M4 | `m4-ama` | 9:16, ~15s | "Portfolio reel for Ama Owusu Photography: three photos side by side, then one opens up to fill the screen, then her name and 'Bookings open for 2027'. Editorial and calm." | none (placeholders) | grid, images, matchCut |
| M5 | `m5-devfest` | 1:1, ~10s | "Announcement for DevFest Accra 2026: 14 November, Accra International Conference Centre. Use our logo. Show something like a ticket with the date and venue, end on 'Get tickets'." | `assets/logo.svg` | svg, template or composed card, badge, button |

Agents: M1–M5 with the default model; M1 and M2 repeated with Haiku (`m1h-ledgerly`, `m2h-tro`).

Each agent writes `log.md` next to its project: what it did, every tool error or surprise, workarounds, and what it wished the tools did. Results go in `FINDINGS.md` here.
