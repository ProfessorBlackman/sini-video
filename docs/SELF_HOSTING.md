# Self-hosting Sini for AI chat apps on the web

Run Sini on a server you control, and AI chat apps that connect to MCP servers by URL (Claude on the web, ChatGPT, and others) can make videos with it: you describe the video in the chat, the AI builds and checks it with Sini's tools, and gives you a link to download the MP4.

Locally (Claude Desktop, Claude Code, Cursor) you don't need any of this: those run Sini on your computer over stdio (see the [README](../README.md)).

## What you need

- A server with Docker: a small VPS is enough (2 CPU cores and 2 GB of memory render a 15-second 1080p video in about a minute; more cores render faster).
- A domain or subdomain pointing at it (an A record), with ports 80 and 443 open. HTTPS is required by the chat apps; the setup below gets a certificate automatically.

## Set it up

1. Copy the [`deploy/`](../deploy) folder to the server.
2. Next to `compose.yaml`, create a file named `.env`:

   ```sh
   SINI_DOMAIN=sini.example.com
   SINI_KEY=paste-a-long-random-string-here
   ```

   Make the key with `openssl rand -hex 24`. **Anyone who has the key can use your server**: keep it as private as a password.
3. Start it:

   ```sh
   docker compose up -d
   ```

4. Check it: `https://sini.example.com/health` answers `ok`.

Your connector URL is:

```
https://sini.example.com/mcp/<your SINI_KEY>
```

Projects (specs, versions, uploaded files and rendered videos) are kept in the `sini-projects` Docker volume.

## Connect your AI app

Menu names change from time to time; look for "connectors", "custom connectors" or "MCP servers".

- **Claude (claude.ai)**: Settings → Connectors → Add custom connector. Name it Sini and paste the connector URL. Leave the OAuth fields empty. Then turn Sini on for a chat from the tools menu.
- **ChatGPT**: turn on developer mode (Settings → Apps & Connectors → Advanced settings), then create a connector with the connector URL, and choose no authentication (the key is in the URL).
- **Claude Code or other clients that send headers**: you can keep the key out of the URL:

  ```sh
  claude mcp add --transport http sini https://sini.example.com/mcp --header "Authorization: Bearer <your SINI_KEY>"
  ```

## Using it

Ask for a video as you would locally ("Make a 15-second vertical reel for…"). Over the web, three tools are added for getting files in and out:

- **Your files**: chat apps can show the AI an image you attach, but can't hand the file to a tool. So the AI either fetches it from a link you give it (`add_asset`), or gives you an upload page for the project (`get_upload_link`): open it, drop in your screenshots, photos, logos or fonts, and tell the AI when you're done.
- **The video**: `render_video` answers with a download link (valid for 24 hours). Renders that take longer than about 45 seconds carry on in the background, and the AI checks back with `render_status`. `get_download_link` gives a fresh link for any rendered file.

## Settings

Set these in `.env` (and pass them through in `compose.yaml`) or as `sini serve` options.

| Variable | `sini serve` option | Default | Meaning |
|---|---|---|---|
| `SINI_KEY` | `--key` | (required) | The access key. |
| `SINI_PUBLIC_URL` | `--public-url` | from each request | The address people reach the server at; used to build download and upload links. |
| `PORT` | `--port` | `8080` | The port Sini listens on, behind the HTTPS proxy. |
| `SINI_MAX_RENDERS` | | `1` | Renders at the same time. Each uses Chromium and FFmpeg flat out; raise it on servers with many cores. |
| `SINI_WAIT` | | `45` | Seconds `render_video` waits before answering "still rendering". |
| | `--open` | | Serve without a key: only behind your own authentication, or on a private network. |

## Without Compose

```sh
docker run -d --name sini -p 8080:8080 --shm-size 1g \
  -e SINI_KEY=… -e SINI_PUBLIC_URL=https://sini.example.com \
  -v sini-projects:/work ghcr.io/professorblackman/sini:0.1 serve
```

and put any HTTPS reverse proxy (Caddy, nginx, Traefik, a tunnel) in front of port 8080.

## Security notes

- The key is the only lock. Use a long random one, and change it (and restart) if it leaks. Download and upload links are signed with it and expire (24 hours and 1 hour).
- One server is one workspace: everyone with the key sees the same projects. Run separate servers (or separate keys and volumes) for people who shouldn't see each other's work.
- Sini fetches files from the internet only when asked: fonts named in a spec (Google Fonts, or an https font URL) and files passed to `add_asset`. It accepts only images, SVGs and fonts (checked by content), up to 30 MB each.
- Download links serve only files in a project's `out/` folder.
