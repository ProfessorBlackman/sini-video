/**
 * Adding files to a project from outside it: a link the AI was given, bytes it has, or an upload from the
 * human's browser (served by `sini serve`). Files land in <project>/assets/ after their type is checked.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { SiniError } from "./project.js";
import { fontKind } from "./fonts.js";
import { imageSize } from "./ocr.js";

const MAX_BYTES = 30 * 1024 * 1024;

/** What a file really is, from its first bytes (not its name). */
export function assetKind(b: Uint8Array): "png" | "jpg" | "webp" | "gif" | "svg" | "font" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (fontKind(b)) return "font";
  const head = new TextDecoder().decode(b.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}

/** A safe file name: letters, digits, dot, dash, underscore; no folders. */
export function cleanName(name: string): string {
  const base = basename(name).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  if (!base || !/\.[A-Za-z0-9]+$/.test(base)) throw new SiniError(`'${name}' isn't a usable file name: give one with an extension, like 'logo.png'.`);
  return base.slice(0, 120);
}

/** Save bytes as <project>/assets/<name>, after checking they're an image, SVG or font. */
export function saveAsset(projectDir: string, name: string, bytes: Uint8Array): { path: string; kind: string; size?: { width: number; height: number } } {
  if (bytes.length > MAX_BYTES) throw new SiniError(`'${name}' is larger than 30 MB.`);
  const kind = assetKind(bytes);
  if (!kind) throw new SiniError(`'${name}' isn't an image (PNG, JPEG, WebP, GIF), SVG or font file.`);
  const file = cleanName(name);
  mkdirSync(join(projectDir, "assets"), { recursive: true });
  writeFileSync(join(projectDir, "assets", file), bytes);
  const size = kind === "png" || kind === "jpg" || kind === "webp" ? imageSize(join(projectDir, "assets", file)) ?? undefined : undefined;
  return { path: `assets/${file}`, kind, ...(size ? { size } : {}) };
}

/** Download a file from an https link into <project>/assets/. */
export async function fetchAsset(projectDir: string, url: string, name?: string): Promise<ReturnType<typeof saveAsset>> {
  if (!/^https:\/\/[^\s]+$/.test(url)) throw new SiniError("The link must start with https://.");
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  } catch (e) {
    throw new SiniError(`Couldn't reach ${url}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new SiniError(`${url} answered ${res.status}.`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new SiniError(`${url} is larger than 30 MB.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const fromUrl = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  const kind = assetKind(bytes);
  // Name from the caller, else the link; add the real extension when the link has none.
  const ext = kind === "font" ? (fontKind(bytes) ?? "ttf") : kind ?? "bin";
  const base = name ?? (fromUrl && /\.[A-Za-z0-9]+$/.test(fromUrl) ? fromUrl : `${fromUrl || "asset"}.${ext}`);
  return saveAsset(projectDir, base, bytes);
}
