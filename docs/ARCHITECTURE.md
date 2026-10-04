                    ┌─────────────────┐
                    │    Any LLM      │
                    │ Claude / GPT /  │
                    │ Gemini / local  │
                    └────────┬────────┘
                             │
                             ▼
                 ┌──────────────────────┐
                 │   Video DSL / JSON    │
                 │                      │
                 │ scenes               │
                 │ elements             │
                 │ animations           │
                 │ transitions          │
                 │ assets               │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │    Video Compiler    │
                 │                      │
                 │ validate             │
                 │ resolve assets       │
                 │ calculate timeline   │
                 │ compile components   │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │    Sini Engine       │
                 │                      │
                 │ text                │
                 │ images              │
                 │ browsers            │
                 │ phones              │
                 │ SVG                 │
                 │ transitions         │
                 └──────────┬───────────┘
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
          Browser Renderer       Future Renderer
          HTML/SVG/GSAP          Canvas/WebGL
                  │
                  ▼
                FFmpeg
                  │
                  ▼
              MP4 / WebM
