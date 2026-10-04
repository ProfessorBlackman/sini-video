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
      const byFile = new Map<string, Word[]>();
      for (const s of todo) {
        if (!byFile.has(s.file)) {
          const { data: page } = await worker.recognize(s.file, {}, { blocks: true });
          const words: Word[] = [];
          for (const b of page.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
          byFile.set(s.file, words);
        }
        const r = findText(byFile.get(s.file)!, s.text);
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
