import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RenderSession, type LayoutReport } from "@sini/render";
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
