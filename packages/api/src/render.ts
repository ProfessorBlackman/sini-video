import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RenderSession, renderSheet, renderVideo, type LayoutReport, type VideoResult } from "@sini/render";
import type { CompiledPlan } from "@sini/core";
import { plan, SiniError } from "./project.js";

export function outDir(projectDir: string): string {
  const d = join(projectDir, "out");
  mkdirSync(d, { recursive: true });
  return d;
}

function checkTime(p: CompiledPlan, t: number) {
  if (!Number.isFinite(t) || t < 0 || t > p.duration) {
    throw new SiniError(`Time ${t} is outside the video (0–${p.duration.toFixed(2)}s).`);
  }
}

/** Render one frame to a PNG. Returns the file path and the PNG bytes. */
export async function renderFrame(target: string, t: number, opts: { out?: string; scale?: number } = {}): Promise<{ file: string; png: Buffer }> {
  const { loaded, plan: p } = plan(target);
  checkTime(p, t);
  const session = await RenderSession.open(p, { scale: opts.scale ?? 1 });
  try {
    const png = await session.frame(t);
    const file = opts.out ?? join(outDir(loaded.dir), `frame-${t.toFixed(2)}.png`);
    writeFileSync(file, png);
    return { file, png };
  } finally {
    await session.close();
  }
}

/** Computed boxes of every element at t. */
export async function layoutAt(target: string, t: number): Promise<LayoutReport> {
  const { plan: p } = plan(target);
  checkTime(p, t);
  const session = await RenderSession.open(p);
  try {
    return await session.layout(t);
  } finally {
    await session.close();
  }
}

/** Render the whole video to MP4 (out/video.mp4, or out/draft.mp4 for drafts). */
export async function renderMp4(
  target: string,
  opts: { draft?: boolean; out?: string; workers?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<VideoResult & { warnings: string[] }> {
  const { loaded, plan: p } = plan(target);
  const file = opts.out ?? join(outDir(loaded.dir), opts.draft ? "draft.mp4" : "video.mp4");
  const result = await renderVideo(p, file, {
    ...(opts.draft ? { draft: true } : {}),
    ...(opts.workers ? { workers: opts.workers } : {}),
    ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
  });
  return { ...result, warnings: p.report.map((r) => `${r.path}: ${r.message}`) };
}

/** A contact sheet: a grid of frames with timestamps, as one PNG (out/sheet.png). */
export async function contactSheet(target: string, opts: { times?: number[]; count?: number; out?: string } = {}): Promise<{ file: string; png: Buffer; times: number[] }> {
  const { loaded, plan: p } = plan(target);
  for (const t of opts.times ?? []) checkTime(p, t);
  const { png, times } = await renderSheet(p, { ...(opts.times ? { times: opts.times } : {}), ...(opts.count ? { count: opts.count } : {}) });
  const file = opts.out ?? join(outDir(loaded.dir), "sheet.png");
  writeFileSync(file, png);
  return { file, png, times };
}
