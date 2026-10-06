/**
 * Downloaded fonts: { "type": "font", "google": "Plus Jakarta Sans" } or { "type": "font", "url": "https://…", "family": "…" }.
 * Each is fetched once into <project>/fonts/ and pinned in fonts/fonts.lock.json (file, weight, style, sha256),
 * so renders never touch the network again and stay deterministic. The fetch runs before rendering, like OCR.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Spec } from "@sini/schema";
import { load, SiniError } from "./project.js";

export interface Face { file: string; weight: string; style: "normal" | "italic"; sha256: string }
interface LockEntry { family: string; source: string; faces: Face[] }
type Lock = Record<string, LockEntry>;

const GOOGLE = "https://raw.githubusercontent.com/google/fonts/main";
const LICENCE_DIRS = ["ofl", "apache", "ufl"];
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 40;

interface Wanted { asset: string; key: string; family: string; google?: string; url?: string; weight?: string; style?: "normal" | "italic" }

function wanted(spec: Spec): Wanted[] {
  const out: Wanted[] = [];
  for (const [id, a] of Object.entries((spec.assets ?? {}) as Record<string, any>)) {
    if (!a || typeof a !== "object" || a.type !== "font") continue;
    if (typeof a.google === "string") out.push({ asset: id, key: `google:${a.google}`, family: a.family ?? a.google, google: a.google });
    else if (typeof a.url === "string" && typeof a.family === "string") {
      out.push({ asset: id, key: `url:${a.url}`, family: a.family, url: a.url, ...(a.weight !== undefined ? { weight: String(a.weight) } : {}), ...(a.style ? { style: a.style } : {}) });
    }
  }
  return out;
}

const lockFile = (dir: string) => join(dir, "fonts", "fonts.lock.json");
function readLock(dir: string): Lock {
  try {
    return JSON.parse(readFileSync(lockFile(dir), "utf8")) as Lock;
  } catch {
    return {};
  }
}
const present = (dir: string, e: LockEntry | undefined) => !!e && e.faces.length > 0 && e.faces.every((f) => existsSync(resolve(dir, f.file)));

/** Faces of downloaded fonts, per asset id, as absolute paths (for compile). */
export function cachedFontFaces(spec: Spec, dir: string): Record<string, { src: string; weight: string; style: "normal" | "italic" }[]> {
  const lock = readLock(dir);
  const out: Record<string, { src: string; weight: string; style: "normal" | "italic" }[]> = {};
  for (const w of wanted(spec)) {
    const e = lock[w.key];
    if (present(dir, e)) out[w.asset] = e!.faces.map((f) => ({ src: resolve(dir, f.file), weight: f.weight, style: f.style }));
  }
  return out;
}

/** Font file kind from its first bytes, or null if it isn't one. */
export function fontKind(b: Uint8Array): "ttf" | "otf" | "woff" | "woff2" | null {
  const tag = String.fromCharCode(...b.slice(0, 4));
  if (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) return "ttf";
  if (tag === "true") return "ttf";
  if (tag === "OTTO") return "otf";
  if (tag === "wOFF") return "woff";
  if (tag === "wOF2") return "woff2";
  return null;
}

/** The font entries and weight axis of a Google Fonts METADATA.pb (text protobuf). */
export function parseMetadata(text: string): { name?: string; fonts: { style: "normal" | "italic"; weight: number; filename: string }[]; wght?: [number, number] } {
  const fonts: { style: "normal" | "italic"; weight: number; filename: string }[] = [];
  for (const m of text.matchAll(/fonts\s*\{([^}]*)\}/g)) {
    const body = m[1]!;
    const filename = /filename:\s*"([^"]+)"/.exec(body)?.[1];
    if (!filename) continue;
    fonts.push({ style: /style:\s*"italic"/.test(body) ? "italic" : "normal", weight: Number(/weight:\s*(\d+)/.exec(body)?.[1] ?? 400), filename });
  }
  let wght: [number, number] | undefined;
  for (const m of text.matchAll(/axes\s*\{([^}]*)\}/g)) {
    if (!/tag:\s*"wght"/.test(m[1]!)) continue;
    wght = [Number(/min_value:\s*([\d.]+)/.exec(m[1]!)?.[1]), Number(/max_value:\s*([\d.]+)/.exec(m[1]!)?.[1])];
  }
  const name = /^name:\s*"([^"]+)"/m.exec(text)?.[1];
  return { ...(name ? { name } : {}), fonts, ...(wght ? { wght } : {}) };
}

async function get(url: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  } catch (e) {
    throw new Error(`couldn't reach ${url} (${(e as Error).cause ? String((e as any).cause.code ?? (e as any).cause.message) : (e as Error).message})`);
  }
  if (!res.ok) throw Object.assign(new Error(`${url} answered ${res.status}`), { status: res.status });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`${url} is larger than 20 MB`);
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length > MAX_BYTES) throw new Error(`${url} is larger than 20 MB`);
  return b;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function fetchGoogle(dir: string, w: Wanted): Promise<LockEntry> {
  const id = w.google!.toLowerCase().replace(/[^a-z0-9]/g, "");
  let base = "";
  let meta = "";
  for (const lic of LICENCE_DIRS) {
    try {
      meta = new TextDecoder().decode(await get(`${GOOGLE}/${lic}/${id}/METADATA.pb`));
      base = `${GOOGLE}/${lic}/${id}`;
      break;
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  if (!base) throw new Error(`'${w.google}' isn't a Google Fonts family (check the spelling at fonts.google.com)`);
  const m = parseMetadata(meta);
  if (!m.fonts.length) throw new Error(`no font files listed for '${w.google}'`);
  if (m.fonts.length > MAX_FILES) throw new Error(`'${w.google}' has ${m.fonts.length} files, more than ${MAX_FILES}`);
  const folder = join("fonts", slug(w.google!));
  mkdirSync(resolve(dir, folder), { recursive: true });
  const faces: Face[] = [];
  for (const f of m.fonts) {
    const b = await get(`${base}/${encodeURIComponent(f.filename)}`);
    if (!fontKind(b)) throw new Error(`${f.filename} isn't a font file`);
    const file = join(folder, f.filename.replace(/[[\]]/g, "_"));
    writeFileSync(resolve(dir, file), b);
    const variable = /\[[^\]]*wght[^\]]*\]/.test(f.filename) && m.wght;
    faces.push({ file, weight: variable ? `${m.wght![0]} ${m.wght![1]}` : String(f.weight), style: f.style, sha256: sha(b) });
  }
  // Keep the licence beside the files (OFL requires it to travel with them).
  for (const name of ["OFL.txt", "LICENSE.txt", "UFL.txt"]) {
    try {
      writeFileSync(resolve(dir, folder, name), await get(`${base}/${name}`));
      break;
    } catch {
      /* try the next name */
    }
  }
  return { family: w.family, source: `Google Fonts: ${m.name ?? w.google}`, faces };
}

async function fetchUrl(dir: string, w: Wanted): Promise<LockEntry> {
  const b = await get(w.url!);
  const kind = fontKind(b);
  if (!kind) throw new Error(`${w.url} isn't a font file (TTF, OTF, WOFF or WOFF2)`);
  const folder = join("fonts", slug(w.family));
  mkdirSync(resolve(dir, folder), { recursive: true });
  const base = slug(decodeURIComponent(new URL(w.url!).pathname.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "")) || "font";
  const file = join(folder, `${base}-${sha(b).slice(0, 8)}.${kind}`);
  writeFileSync(resolve(dir, file), b);
  return { family: w.family, source: w.url!, faces: [{ file, weight: w.weight ?? "400", style: w.style ?? "normal", sha256: sha(b) }] };
}

/**
 * Download every font asset that isn't in the project yet. Throws if one can't be fetched (no network, a typo
 * in the family name): rendering with a silent fallback font would be worse. Returns what was downloaded.
 */
export async function resolveFonts(target: string): Promise<{ downloaded: { family: string; files: number; source: string }[] }> {
  const { spec, dir } = load(target);
  const todo = wanted(spec);
  if (!todo.length) return { downloaded: [] };
  const lock = readLock(dir);
  const downloaded: { family: string; files: number; source: string }[] = [];
  const failed: string[] = [];
  for (const w of todo) {
    if (present(dir, lock[w.key])) {
      // The same file under another family name or weight: only the lock's description changes.
      if (w.url) lock[w.key] = { ...lock[w.key]!, family: w.family, faces: lock[w.key]!.faces.map((f) => ({ ...f, weight: w.weight ?? f.weight, style: w.style ?? f.style })) };
      continue;
    }
    try {
      const e = w.google ? await fetchGoogle(dir, w) : await fetchUrl(dir, w);
      lock[w.key] = e;
      downloaded.push({ family: e.family, files: e.faces.length, source: e.source });
    } catch (e) {
      failed.push(`assets.${w.asset}: ${(e as Error).message}`);
    }
  }
  if (downloaded.length || existsSync(lockFile(dir))) {
    mkdirSync(join(dir, "fonts"), { recursive: true });
    writeFileSync(lockFile(dir), `${JSON.stringify(lock, null, 2)}\n`);
  }
  if (failed.length) {
    throw new SiniError(`Couldn't download ${failed.length === 1 ? "a font" : `${failed.length} fonts`}:\n${failed.join("\n")}${failed.some((f) => f.includes("couldn't reach")) ? "\nSini needs network access the first time it fetches a font; afterwards it uses the copy in fonts/." : ""}`);
  }
  return { downloaded };
}
