# Sini

*Sini* is Twi for "movie".

Describe a video in plain language. Your AI writes it as a Sini spec, checks it, shows you frames, and refines it with you. Sini renders it deterministically to MP4, with no video-generation model involved.

> **Status:** early development. The DSL is specified and paper-tested; the engine is being built ([plan](docs/VERTICAL_SLICE_PLAN.md)).

## How it works

```text
You ──► AI model (Claude, GPT, …) ──► Sini spec (JSON) ──► validate · lint · layout ──► frames / MP4
              ▲                                                         │
              └────────────── contact sheets, errors, feedback ─────────┘
```

The AI describes **what the video shows and when**: scenes, text, images, device mockups, animations, transitions. Sini handles layout, timing, rendering and encoding. The same spec always renders the same frames.

## Documentation

| Doc | What it covers |
|---|---|
| [DSL reference](docs/DSL_REFERENCE.md) | The video language, written for AI models to read in one pass |
| [Product direction](docs/PRODUCT_DIRECTION.md) | Decisions, the AI iteration loop, CLI and MCP interface |
| [Vertical slice plan](docs/VERTICAL_SLICE_PLAN.md) | Architecture and milestones for the first working engine |
| [Paper tests](docs/paper-tests/) | How the DSL was tested with LLMs before building, and what changed |

## Development

Requires Node 22 or 24 and pnpm 10.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
node packages/cli/dist/index.js --version
```

Docker:

```bash
docker build -t sini .
docker run --rm sini --version
```

## Licence

[Apache-2.0](LICENSE). See [NOTICE](NOTICE).
