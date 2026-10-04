# Sini

*Sini* is Twi for "movie".

Describe a video in plain language. Your AI writes it as a Sini spec, checks it, shows you frames, and refines it with you. Sini renders it deterministically to MP4, with no video-generation model involved.

> **Status:** early development. The vertical slice works end to end ([plan](docs/VERTICAL_SLICE_PLAN.md)), plus icons, cursor/finger interactions, device screens with `navigate`, device overlays, scrolling, toasts and progress trackers. Specified but not rendered yet: `camera`, `focusCycle`, `matchCut`, and the `chart`, `svg` and `template` elements (lint warns when a spec uses them).

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

## Quick start

Sini runs in Docker (it bundles Chromium, FFmpeg and the fonts):

```bash
docker build -t sini .
```

### With an AI client (MCP)

Claude Desktop (`claude_desktop_config.json`), with `~/videos` as the folder Sini may use:

```json
{
  "mcpServers": {
    "sini": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "/Users/you/videos:/work", "sini", "mcp"]
    }
  }
}
```

Claude Code, from the folder you want to work in:

```bash
claude mcp add sini -- docker run -i --rm -v "$PWD":/work sini mcp
```

Then ask: *"Make a 15-second vertical reel for my bakery's weekend cinnamon box."* The `create-video` prompt walks the model through create → validate → lint → contact sheet → fix → render.

Tools: `get_reference`, `create_video`, `get_video`, `validate_video`, `update_video`, `lint_video`, `describe_at`, `get_layout`, `render_frame`, `render_contact_sheet`, `render_video`, `list_versions`, `restore_version`.

### From the command line

```bash
alias sini='docker run --rm -v "$PWD":/work sini'
sini init my-video          # starter project
sini validate my-video      # DSL errors with suggestions
sini lint my-video          # reading time, edges, safe zones, overlaps, contrast, glyphs
sini at 2.5 my-video        # what's on screen at 2.5s
sini layout 2.5 my-video    # exact element boxes
sini sheet my-video         # contact sheet → my-video/out/sheet.png
sini render my-video --draft
sini render my-video        # → my-video/out/video.mp4
sini patch fix.json my-video && sini versions my-video
```

Examples: [examples/novae](examples/novae/video.json) (scenes 1–2 of a real product reel) and [examples/gallery](examples/gallery/video.json) (every preset, transition and state change).

## Development

Requires Node 22 or 24, pnpm 10 and FFmpeg.

```bash
pnpm install
pnpm --filter @sini/render exec playwright install chromium
pnpm build
pnpm test
node packages/cli/dist/index.js --help
```

| Package | Role |
|---|---|
| `@sini/schema` | DSL vocabulary, types and validator |
| `@sini/core` | Timeline compiler and pure frame evaluator |
| `@sini/runtime` | In-browser renderer (bundled into the page) |
| `@sini/render` | Chromium sessions, frames, layout, contact sheets, MP4 export |
| `@sini/api` | Operations shared by the CLI and MCP: projects, versions, patches, lint |
| `@sini/cli` | The `sini` command |
| `@sini/mcp` | The MCP server |

## Licence

[Apache-2.0](LICENSE). See [NOTICE](NOTICE).
