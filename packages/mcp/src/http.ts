/**
 * `sini serve`: the MCP server over HTTP (streamable HTTP, stateless), for AI chat apps on the web
 * (Claude, ChatGPT and others) that connect to a URL. Also serves signed download links for rendered
 * files and an upload page for the human's screenshots, logos and fonts.
 *
 * Access: a key, either in the connector URL (/mcp/<key>, for apps that only take a URL) or as
 * `Authorization: Bearer <key>`. Download and upload links are signed with it and expire.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as api from "@sini/api";
import { createServer, type Remote } from "./server.js";

export interface HttpOptions {
  root?: string;
  port?: number;
  host?: string;
  /** The access key. Required unless `open` is set. */
  key?: string;
  /** Serve without a key (only behind your own authentication, or on a private network). */
  open?: boolean;
  /** The address people reach the server at (https://sini.example.com); otherwise taken from each request. */
  publicUrl?: string;
  /** Seconds render_video waits before answering "still rendering". */
  waitSeconds?: number;
}

const DOWNLOAD_TTL = 24 * 3600;
const UPLOAD_TTL = 3600;
const MAX_BODY = 45 * 1024 * 1024; // add_asset with base64 data, or one uploaded file
const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json" };

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const parts: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(Object.assign(new Error("Request too large (over 45 MB)."), { status: 413 }));
        req.destroy();
      } else parts.push(c);
    });
    req.on("end", () => ok(Buffer.concat(parts)));
    req.on("error", fail);
  });
}

const send = (res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
};

export function createHttpApp(opts: HttpOptions = {}): Server {
  const ROOT = resolve(opts.root ?? process.env.SINI_ROOT ?? process.cwd());
  const key = opts.key ?? process.env.SINI_KEY ?? "";
  if (!key && !opts.open) throw new api.SiniError("Set an access key (--key or SINI_KEY), or pass --open to serve without one.");
  // Links are signed with the key (or, when open, a secret that lasts as long as the process).
  const secret = key || randomBytes(32).toString("hex");
  const sign = (path: string, exp: number) => createHmac("sha256", secret).update(`${path}\n${exp}`).digest("hex").slice(0, 40);
  const signed = (path: string, ttl: number) => {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return `${path}?exp=${exp}&sig=${sign(path, exp)}`;
  };
  const verify = (path: string, q: URLSearchParams) => {
    const exp = Number(q.get("exp"));
    const sig = q.get("sig") ?? "";
    const want = sign(path, exp);
    return exp > Date.now() / 1000 && sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
  };
  const keyOk = (given: string) => !key || (given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key)));
  const base = (req: IncomingMessage) => {
    const pub = opts.publicUrl ?? process.env.SINI_PUBLIC_URL;
    if (pub) return pub.replace(/\/+$/, "");
    const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0]!.trim();
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
    return `${proto}://${host}`;
  };
  // Paths inside the root, as URL paths ("medverify/out/video.mp4").
  const relPath = (abs: string) => relative(ROOT, abs).split(sep).map(encodeURIComponent).join("/");
  const inRoot = (rel: string) => {
    const abs = resolve(ROOT, decodeURIComponent(rel));
    return abs === ROOT || abs.startsWith(ROOT + sep) ? abs : null;
  };
  const remoteFor = (req: IncomingMessage): Remote => ({
    link: (file) => `${base(req)}${signed(`/files/${relPath(file)}`, DOWNLOAD_TTL)}`,
    uploadLink: (dir) => `${base(req)}${signed(`/upload/${relPath(dir)}`, UPLOAD_TTL)}`,
    waitSeconds: opts.waitSeconds ?? Number(process.env.SINI_WAIT ?? 45),
  });

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const path = url.pathname;

      if (path === "/health") return send(res, 200, "ok");

      // ---- MCP ----
      const m = /^\/mcp(?:\/([^/]+))?\/?$/.exec(path);
      if (m) {
        const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ""))?.[1] ?? "";
        if (!keyOk(m[1] ? decodeURIComponent(m[1]) : bearer)) return send(res, 401, "Wrong or missing key. Use https://<host>/mcp/<key>, or send Authorization: Bearer <key>.");
        const body = req.method === "POST" ? JSON.parse((await readBody(req)).toString("utf8") || "null") : undefined;
        const server = createServer(ROOT, remoteFor(req));
        // Stateless: a fresh server per request (no session id), so any number of clients can connect.
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined } as never);
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport as never);
        await transport.handleRequest(req, res, body);
        return;
      }

      // ---- downloads: /files/<project>/out/<file>?exp&sig ----
      if (path.startsWith("/files/") && (req.method === "GET" || req.method === "HEAD")) {
        if (!verify(path, url.searchParams)) return send(res, 403, "This link has expired or isn't valid. Ask for a new one.");
        const file = inRoot(path.slice("/files/".length));
        if (!file || !file.split(sep).includes("out") || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, "Not found.");
        const size = statSync(file).size;
        const headers: Record<string, string | number> = {
          "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
          "accept-ranges": "bytes",
          "content-disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${file.split(sep).pop()}"`,
        };
        // Ranges, so browsers can play and seek the video.
        const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
        if (range && (range[1] || range[2])) {
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (start > end || start >= size) {
            res.writeHead(416, { "content-range": `bytes */${size}` });
            return void res.end();
          }
          res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
          if (req.method === "HEAD") return void res.end();
          return void createReadStream(file, { start, end }).pipe(res);
        }
        res.writeHead(200, { ...headers, "content-length": size });
        if (req.method === "HEAD") return void res.end();
        return void createReadStream(file).pipe(res);
      }

      // ---- uploads: /upload/<project>?exp&sig (page), PUT …&name=<file> (one file) ----
      if (path.startsWith("/upload/")) {
        if (!verify(path, url.searchParams)) return send(res, 403, "This upload link has expired or isn't valid. Ask the AI for a new one.");
        const dir = inRoot(path.slice("/upload/".length));
        if (!dir || dir === ROOT) return send(res, 404, "Not found.");
        if (req.method === "GET") return send(res, 200, uploadPage(relative(ROOT, dir)), "text/html; charset=utf-8");
        if (req.method === "PUT") {
          const name = url.searchParams.get("name") ?? "";
          try {
            const r = api.saveAsset(dir, name, await readBody(req));
            return send(res, 200, JSON.stringify(r), "application/json");
          } catch (e) {
            return send(res, (e as { status?: number }).status ?? 400, JSON.stringify({ error: (e as Error).message }), "application/json");
          }
        }
        return send(res, 405, "Method not allowed.");
      }

      return send(res, 404, "Sini is running. The MCP endpoint is /mcp/<key>.");
    } catch (e) {
      if (!res.headersSent) send(res, (e as { status?: number }).status ?? 500, `Error: ${(e as Error).message}`);
      else res.end();
    }
  });
}

export async function serveHttp(opts: HttpOptions = {}): Promise<Server> {
  const app = createHttpApp(opts);
  const port = opts.port ?? Number(process.env.PORT ?? 8080);
  const host = opts.host ?? "0.0.0.0";
  await new Promise<void>((ok) => app.listen(port, host, ok));
  const where = opts.publicUrl ?? process.env.SINI_PUBLIC_URL ?? `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
  console.error(`Sini MCP server on ${where}/mcp/${opts.key || process.env.SINI_KEY ? "<key>" : ""}  (root: ${resolve(opts.root ?? process.env.SINI_ROOT ?? process.cwd())})`);
  return app;
}

/** The upload page: pick or drop files; each is PUT to this URL with its name. */
function uploadPage(project: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upload to ${esc(project)} · Sini</title>
<style>
:root{--bg:#f6f6f3;--card:#fff;--ink:#16181d;--dim:#5d636e;--line:#dcdcd5;--accent:#2f5bea;--ok:#13804a;--bad:#c0332b}
@media (prefers-color-scheme:dark){:root{--bg:#121316;--card:#1b1d22;--ink:#ecedf0;--dim:#9aa0ab;--line:#2c2f36;--accent:#7a9bff;--ok:#4cc38a;--bad:#ff7a70}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:0 auto;padding:48px 16px}h1{font-size:22px;margin:0 0 4px}p{color:var(--dim);margin:0 0 24px}
label.drop{display:block;border:2px dashed var(--line);border-radius:14px;background:var(--card);padding:40px 16px;text-align:center;cursor:pointer}
label.drop.over{border-color:var(--accent)}label.drop b{color:var(--accent)}input{display:none}
ul{list-style:none;padding:0;margin:20px 0 0}li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:15px}
.ok{color:var(--ok)}.bad{color:var(--bad)}code{font:14px ui-monospace,monospace}
</style></head><body><main>
<h1>Upload files for the video</h1>
<p>Project <code>${esc(project)}</code>. Screenshots, photos, logos (PNG, JPEG, WebP, GIF, SVG) or fonts, up to 30 MB each. When you're done, tell the AI.</p>
<label class="drop" id="drop"><input type="file" id="pick" multiple accept="image/*,.svg,.ttf,.otf,.woff,.woff2"><b>Choose files</b> or drop them here</label>
<ul id="list"></ul>
</main><script>
const list=document.getElementById("list"),drop=document.getElementById("drop");
async function send(f){const li=document.createElement("li");li.innerHTML="<span></span><span>Uploading…</span>";li.firstChild.textContent=f.name;list.appendChild(li);
try{const r=await fetch(location.pathname+location.search+"&name="+encodeURIComponent(f.name),{method:"PUT",body:f});const j=await r.json();
if(!r.ok)throw new Error(j.error||r.statusText);li.lastChild.textContent="✓ "+j.path;li.lastChild.className="ok"}catch(e){li.lastChild.textContent=e.message;li.lastChild.className="bad"}}
document.getElementById("pick").onchange=e=>[...e.target.files].forEach(send);
drop.ondragover=e=>{e.preventDefault();drop.classList.add("over")};drop.ondragleave=()=>drop.classList.remove("over");
drop.ondrop=e=>{e.preventDefault();drop.classList.remove("over");[...e.dataTransfer.files].forEach(send)};
</script></body></html>`;
}
