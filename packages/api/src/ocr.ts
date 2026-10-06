/**
 * Text hotspots ({ "text": "Export PDF" }): found by reading the screenshot with OCR
 * (tesseract.js, bundled English data, no network). Results are cached in
 * <project>/out/.cache/hotspots.json, keyed by image content and text, so `plan()`
 * stays synchronous and OCR runs once per screenshot.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Spec } from "@sini/schema";
import { load } from "./project.js";

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

/** Pixel size of a PNG or JPEG, read from its header (no image library). */
export function imageSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
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
