/**
 * Text hotspots ({ "text": "Export PDF" }): found by reading the screenshot with OCR
 * (tesseract.js, bundled English data, no network). Results are cached in
 * <project>/out/.cache/hotspots.json, keyed by image content and text, so `plan()`
 * stays synchronous and OCR runs once per screenshot.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Spec } from "@sini/schema";
import { load, SiniError } from "./project.js";

const require = createRequire(import.meta.url);
type Rect = [number, number, number, number];
type Cache = Record<string, Rect | null>;

interface TextSpot { asset: string; name: string; text: string; file: string }

function textSpots(spec: Spec, dir: string): TextSpot[] {
  const out: TextSpot[] = [];
  for (const [id, a] of Object.entries((spec.assets ?? {}) as Record<string, any>)) {
    if (!a || typeof a !== "object" || !a.hotspots) continue;
    const candidates = [a.src, typeof a.fallback === "object" ? a.fallback?.src : a.fallback].filter((x): x is string => typeof x === "string");
    const file = candidates.map((c) => resolve(dir, c)).find((f) => existsSync(f));
    if (!file) continue;
    for (const [name, h] of Object.entries<any>(a.hotspots)) {
      if (h && typeof h === "object" && !Array.isArray(h) && typeof h.text === "string") out.push({ asset: id, name, text: h.text, file });
    }
  }
  return out;
}

const cacheFile = (dir: string) => join(dir, "out", ".cache", "hotspots.json");
const readCache = (dir: string): Cache => {
  try {
    return JSON.parse(readFileSync(cacheFile(dir), "utf8")) as Cache;
  } catch {
    return {};
  }
};
const hashes = new Map<string, string>();
function fileHash(file: string): string {
  const key = file;
  if (!hashes.has(key)) hashes.set(key, createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16));
  return hashes.get(key)!;
}
const keyOf = (s: TextSpot) => `${fileHash(s.file)}:${s.text}`;

/** Text hotspots already located (from the cache), as numeric rects per asset. */
export function cachedTextHotspots(spec: Spec, dir: string): Record<string, Record<string, Rect>> {
  const cache = readCache(dir);
  const out: Record<string, Record<string, Rect>> = {};
  for (const s of textSpots(spec, dir)) {
    hashes.delete(s.file); // the file may have changed since last time
    const r = cache[keyOf(s)];
    if (r) (out[s.asset] ??= {})[s.name] = r;
  }
  return out;
}

const norm = (w: string) => w.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j]!;
      row[j] = Math.min(up + 1, row[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length]!;
}

interface Word { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }

/** The best run of consecutive words matching `text` (OCR may misread a letter). */
export function findText(words: Word[], text: string): Rect | null {
  const tokens = text.split(/\s+/).map(norm).filter(Boolean);
  if (!tokens.length) return null;
  let best: { cost: number; rect: Rect } | null = null;
  for (let i = 0; i + tokens.length <= words.length; i++) {
    let cost = 0;
    let ok = true;
    for (let k = 0; k < tokens.length && ok; k++) {
      const w = norm(words[i + k]!.text);
      const d = editDistance(w, tokens[k]!);
      if (d > Math.max(1, Math.floor(tokens[k]!.length / 4))) ok = false;
      cost += d;
    }
    if (!ok) continue;
    const run = words.slice(i, i + tokens.length).map((w) => w.bbox);
    const x0 = Math.min(...run.map((b) => b.x0));
    const y0 = Math.min(...run.map((b) => b.y0));
    const x1 = Math.max(...run.map((b) => b.x1));
    const y1 = Math.max(...run.map((b) => b.y1));
    if (!best || cost < best.cost) best = { cost, rect: [x0, y0, x1 - x0, y1 - y0] };
  }
  return best?.rect ?? null;
}

type Tile = { left: number; top: number; width: number; height: number };

/**
 * Overlapping tiles at half steps, so every label sits whole inside at least one. Coarse: half the
 * width and height. Fine: a quarter of the width and an eighth of the height, for labels on coloured
 * buttons, which only threshold cleanly in a small window around them.
 */
export function tiles(width: number, height: number, fine = false): Tile[] {
  const tw = Math.min(width, fine ? Math.max(160, Math.round(width / 4)) : Math.max(320, Math.round(width / 2)));
  const th = Math.min(height, fine ? Math.max(100, Math.round(height / 8)) : Math.max(200, Math.round(height / 2)));
  const out: Tile[] = [];
  const steps = (total: number, size: number) => {
    const xs: number[] = [];
    for (let v = 0; v + size < total; v += Math.round(size / 2)) xs.push(v);
    xs.push(Math.max(0, total - size));
    return [...new Set(xs)];
  };
  for (const top of steps(height, th)) for (const left of steps(width, tw)) out.push({ left, top, width: tw, height: th });
  return out;
}

/** Pixel size of a PNG, JPEG or WebP, read from its header (no image library). */
export function imageSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      const len = b.readUInt16BE(i + 2);
      // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

/** Locate every uncached text hotspot of a project with OCR. Returns the ones it couldn't find. */
export async function resolveTextHotspots(target: string): Promise<{ resolved: number; missing: string[] }> {
  const { spec, dir } = load(target);
  const spots = textSpots(spec, dir);
  if (!spots.length) return { resolved: 0, missing: [] };
  const cache = readCache(dir);
  for (const s of spots) hashes.delete(s.file);
  const todo = spots.filter((s) => !(keyOf(s) in cache));
  const missing = spots.filter((s) => cache[keyOf(s)] === null).map((s) => `${s.asset}#${s.name}`);
  if (todo.length) {
    const { createWorker } = await import("tesseract.js");
    const data = require("@tesseract.js-data/eng") as { langPath: string; gzip: boolean };
    let worker: Awaited<ReturnType<typeof createWorker>>;
    try {
      // errorHandler: without it, a worker failure is rethrown asynchronously and kills the process.
      worker = await createWorker("eng", 1, { langPath: data.langPath, gzip: data.gzip, cacheMethod: "none", logger: () => {}, errorHandler: () => {} });
    } catch (e) {
      // OCR unavailable: text hotspots fall back to the element's centre (compile warns).
      return { resolved: spots.length - todo.length - missing.length, missing: [...missing, ...todo.map((s) => `${s.asset}#${s.name}: OCR failed (${(e as Error).message})`)] };
    }
    try {
      // Word lists per file: the whole page first; tiles are read only if some text isn't found there.
      const whole = new Map<string, Word[][]>();
      const tiled = new Map<string, Word[][]>();
      const fineTiled = new Map<string, Word[][]>();
      const read = async (file: string, rectangle?: Tile): Promise<Word[]> => {
        const { data: page } = await worker.recognize(file, rectangle ? { rectangle } : {}, { blocks: true });
        const words: Word[] = [];
        for (const b of page.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
        return words;
      };
      const search = (lists: Word[][], text: string) => {
        for (const l of lists) {
          const r = findText(l, text);
          if (r) return r;
        }
        return null;
      };
      const sparse = async (file: string, memo: Map<string, Word[][]>, fine: boolean) => {
        if (!memo.has(file)) {
          const lists: Word[][] = [];
          const size = imageSize(file);
          if (size) {
            await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
            for (const t of tiles(size.width, size.height, fine)) lists.push(await read(file, t));
            await worker.setParameters({ tessedit_pageseg_mode: "3" as never });
          }
          memo.set(file, lists);
        }
        return memo.get(file)!;
      };
      for (const s of todo) {
        if (!whole.has(s.file)) whole.set(s.file, [await read(s.file)]);
        let r = search(whole.get(s.file)!, s.text);
        if (!r) {
          // Whole-page layout analysis drops small isolated labels (buttons, tabs, badges).
          // Sparse-text mode over overlapping tiles finds them.
          r = search(await sparse(s.file, tiled, false), s.text);
        }
        if (!r) r = search(await sparse(s.file, fineTiled, true), s.text);
        cache[keyOf(s)] = r;
        if (!r) missing.push(`${s.asset}#${s.name}`);
      }
    } finally {
      await worker.terminate();
    }
    mkdirSync(join(dir, "out", ".cache"), { recursive: true });
    writeFileSync(cacheFile(dir), `${JSON.stringify(cache, null, 2)}\n`);
  }
  return { resolved: spots.length - missing.length, missing };
}

// ---------------------------------------------------------------- reading a whole screenshot

export interface TextLine { text: string; box: Rect; words: { text: string; box: Rect }[] }
interface ScoredWord extends Word { confidence: number }

const real = (w: ScoredWord) => w.confidence >= 55 && /[\p{L}\p{N}]/u.test(w.text);
const overlaps = (a: Word["bbox"], b: Word["bbox"]) => {
  const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ix <= 0 || iy <= 0) return false;
  const area = (r: Word["bbox"]) => (r.x1 - r.x0) * (r.y1 - r.y0);
  return (ix * iy) / Math.min(area(a), area(b)) > 0.4;
};

/** Group words into lines: rows of vertically overlapping words, split where the gap is wider than ~1.5 letters' height. */
export function toLines(words: Word[]): TextLine[] {
  const bands: Word[][] = [];
  for (const w of [...words].sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1))) {
    const mid = (w.bbox.y0 + w.bbox.y1) / 2;
    const band = bands.find((r) => r.some((x) => mid > x.bbox.y0 && mid < x.bbox.y1));
    if (band) band.push(w);
    else bands.push([w]);
  }
  const rows: Word[][] = [];
  for (const band of bands) {
    band.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let row: Word[] = [];
    for (const w of band) {
      const prev = row[row.length - 1];
      if (prev && w.bbox.x0 - prev.bbox.x1 > 1.5 * Math.max(w.bbox.y1 - w.bbox.y0, prev.bbox.y1 - prev.bbox.y0)) {
        rows.push(row);
        row = [];
      }
      row.push(w);
    }
    if (row.length) rows.push(row);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const x0 = Math.min(...r.map((w) => w.bbox.x0));
    const y0 = Math.min(...r.map((w) => w.bbox.y0));
    const x1 = Math.max(...r.map((w) => w.bbox.x1));
    const y1 = Math.max(...r.map((w) => w.bbox.y1));
    return {
      text: r.map((w) => w.text).join(" "),
      box: [x0, y0, x1 - x0, y1 - y0] as Rect,
      words: r.map((w) => ({ text: w.text, box: [w.bbox.x0, w.bbox.y0, w.bbox.x1 - w.bbox.x0, w.bbox.y1 - w.bbox.y0] as Rect })),
    };
  }).sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
}

/**
 * Every line of text in an image asset, with boxes in the image's own pixels: the whole page, plus labels on
 * buttons and chips that only the fine tiles read. Cached per image content in out/.cache/.
 */
/**
 * An image named by asset id (from the spec) or by its path in the project ("assets/hero.png"), so files
 * uploaded before any video exists can be read too. Returns the project folder and the path inside it.
 */
export function imageRef(target: string, ref: string): { dir: string; src: string; spec?: Spec } {
  let spec: Spec | undefined;
  let dir: string;
  try {
    ({ spec, dir } = load(target));
  } catch {
    const abs = resolve(target);
    dir = existsSync(abs) && statSync(abs).isDirectory() ? abs : dirname(abs);
  }
  const a = (spec?.assets ?? {})[ref] as unknown;
  const declared = typeof a === "string" ? a : a && typeof a === "object" && ((a as { type?: string }).type ?? "image") === "image" ? (a as { src?: string }).src : undefined;
  const path = resolve(dir, declared ?? ref);
  if ((declared || /\.(png|jpe?g|webp|gif)$/i.test(ref)) && (path === dir || path.startsWith(dir + sep)) && existsSync(path) && statSync(path).isFile()) {
    return { dir, src: relative(dir, path).split(sep).join("/"), ...(spec ? { spec } : {}) };
  }
  const ids = Object.entries((spec?.assets ?? {}) as Record<string, any>).filter(([, v]) => typeof v === "string" || (v && typeof v === "object" && v.src && (v.type ?? "image") === "image")).map(([k]) => k);
  const files = existsSync(join(dir, "assets")) ? readdirSync(join(dir, "assets")).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).map((f) => `assets/${f}`) : [];
  throw new SiniError(`'${ref}' isn't an image of this project.${ids.length ? ` Image assets: ${ids.join(", ")}.` : ""}${files.length ? ` Files: ${files.join(", ")}.` : ""}`);
}

export async function assetText(target: string, assetId: string): Promise<{ asset: string; file: string; width?: number; height?: number; lines: TextLine[] }> {
  const { dir, src } = imageRef(target, assetId);
  const file = resolve(dir, src);
  hashes.delete(file);
  const cached = join(dir, "out", ".cache", `text-${fileHash(file)}.json`);
  const size = imageSize(file) ?? undefined;
  if (existsSync(cached)) return { asset: assetId, file: src, ...(size ?? {}), lines: JSON.parse(readFileSync(cached, "utf8")) as TextLine[] };
  const { createWorker } = await import("tesseract.js");
  const data = require("@tesseract.js-data/eng") as { langPath: string; gzip: boolean };
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker("eng", 1, { langPath: data.langPath, gzip: data.gzip, cacheMethod: "none", logger: () => {}, errorHandler: () => {} });
  } catch (e) {
    throw new SiniError(`OCR is unavailable: ${(e as Error).message}`);
  }
  const words: ScoredWord[] = [];
  try {
    const read = async (rectangle?: Tile): Promise<ScoredWord[]> => {
      const { data: page } = await worker.recognize(file, rectangle ? { rectangle } : {}, { blocks: true });
      const out: ScoredWord[] = [];
      for (const b of page.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) out.push({ text: w.text, bbox: w.bbox, confidence: w.confidence });
      return out;
    };
    words.push(...(await read()).filter(real));
    if (size) {
      await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
      for (const t of tiles(size.width, size.height, true)) {
        for (const w of (await read(t)).filter(real)) {
          // The same word read twice: keep the more confident reading.
          const i = words.findIndex((x) => overlaps(x.bbox, w.bbox));
          if (i < 0) words.push(w);
          else if (w.confidence > words[i]!.confidence + 5) words[i] = w;
        }
      }
    }
  } finally {
    await worker.terminate();
  }
  const lines = toLines(words);
  mkdirSync(join(dir, "out", ".cache"), { recursive: true });
  writeFileSync(cached, `${JSON.stringify(lines)}\n`);
  return { asset: assetId, file: src, ...(size ?? {}), lines };
}

// ---------------------------------------------------------------- inspecting an image's layout

/** Width / height from "9:16", "4:5", "1.91:1" or a number. */
export function parseAspect(a: string | number | undefined): number | undefined {
  if (typeof a === "number") return a > 0 ? a : undefined;
  const m = /^\s*([\d.]+)\s*[:/x]\s*([\d.]+)\s*$/.exec(a ?? "");
  return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : undefined;
}

/**
 * Photos, graphics and text blocks in an image asset, with suggested crops for the video's shape (or `aspect`),
 * and an annotated picture (coordinate grid, numbered boxes, dashed crops).
 */
export async function inspectAsset(target: string, assetId: string, opts: { aspect?: string | number } = {}) {
  const { spec, dir } = imageRef(target, assetId);
  const t = await assetText(target, assetId);
  const format = (spec?.video as { format?: string; width?: number; height?: number } | undefined) ?? {};
  const aspect = parseAspect(opts.aspect) ?? parseAspect(format.format) ?? (format.width && format.height ? format.width / format.height : undefined) ?? 9 / 16;
  const { inspectImage } = await import("@sini/render");
  const r = await inspectImage(resolve(dir, t.file), t.lines.map((l) => ({ box: l.box, text: l.text })), aspect);
  return { asset: assetId, file: t.file, ...r };
}
