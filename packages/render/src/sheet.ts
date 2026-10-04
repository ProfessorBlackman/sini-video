import type { Plan } from "@sini/core";
import { launchBrowser, RenderSession } from "./session.js";

export interface SheetOptions {
  /** Times to show. Default: `count` evenly spaced frames. */
  times?: number[];
  count?: number;
  /** Width of each thumbnail in pixels. Default: 270 for portrait, 360 for landscape. */
  thumbWidth?: number;
  columns?: number;
}

/** Evenly spaced times, avoiding the very first and last frames. */
export function sheetTimes(duration: number, count = 12): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * duration * 100) / count) / 100);
}

/** A grid of frames with time and scene labels, as one PNG. */
export async function renderSheet(plan: Plan, opts: SheetOptions = {}): Promise<{ png: Buffer; times: number[] }> {
  const times = opts.times ?? sheetTimes(plan.duration, opts.count ?? 12);
  const portrait = plan.height >= plan.width;
  const thumbW = opts.thumbWidth ?? (portrait ? 270 : 360);
  const scale = thumbW / plan.width;
  const columns = opts.columns ?? (portrait ? 6 : 4);
  const browser = await launchBrowser();
  try {
    const session = await RenderSession.open(plan, { scale, browser });
    const shots: { t: number; scene: string; data: string }[] = [];
    for (const t of times) {
      const buf = await session.frame(t, "jpeg", 90);
      const scene = [...plan.scenes].reverse().find((s) => t >= s.start)?.id ?? "";
      shots.push({ t, scene, data: buf.toString("base64") });
    }
    await session.close();
    const thumbH = Math.ceil(plan.height * scale);
    const page = await (await browser.newContext({ viewport: { width: columns * (thumbW + 12) + 12, height: 200 }, deviceScaleFactor: 1 })).newPage();
    const cells = shots
      .map((s) => `<figure><img src="data:image/jpeg;base64,${s.data}"><figcaption><b>${s.t.toFixed(2)}s</b> ${escape(s.scene)}</figcaption></figure>`)
      .join("");
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:#202124;font:13px/1.3 system-ui,sans-serif;color:#e8eaed">` +
        `<div style="display:grid;grid-template-columns:repeat(${columns},${thumbW}px);gap:12px;padding:12px">${cells}</div>` +
        `<style>figure{margin:0}img{display:block;width:${thumbW}px;height:${thumbH}px}figcaption{padding:4px 2px 0}b{color:#fff}</style></body></html>`,
    );
    const png = await page.screenshot({ type: "png", fullPage: true });
    return { png, times };
  } finally {
    await browser.close();
  }
}

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
