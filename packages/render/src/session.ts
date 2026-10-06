import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Plan } from "@sini/core";
import { fontFaceCss } from "./fonts.js";
import { planIcons } from "./icons.js";
import { planSvgs } from "./svg.js";

const require = createRequire(import.meta.url);

/** Flags that keep Chromium's output identical across runs. */
export const CHROMIUM_ARGS = [
  "--allow-file-access-from-files",
  "--force-color-profile=srgb",
  "--font-render-hinting=none",
  "--disable-lcd-text",
  "--disable-gpu",
  "--hide-scrollbars",
  "--mute-audio",
];

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true, args: CHROMIUM_ARGS });
}

let runtimeSource: string | undefined;
function runtime(): string {
  runtimeSource ??= readFileSync(require.resolve("@sini/runtime/bundle"), "utf8");
  return runtimeSource;
}

export function pageHtml(plan: Plan): string {
  // </script> can't appear inside the inline JSON.
  const json = JSON.stringify(plan).replace(/</g, "\\u003c");
  const icons = JSON.stringify(planIcons(plan)).replace(/</g, "\\u003c");
  const svgs = JSON.stringify(planSvgs(plan)).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss(plan.fontAssets)}</style></head>` +
    `<body><script>window.__SINI_PLAN__=${json};window.__SINI_ICONS__=${icons};window.__SINI_SVGS__=${svgs};</script><script>${runtime()}</script></body></html>`;
}

export interface LayoutBox {
  ref: string;
  type: string;
  scene: string;
  box: { x: number; y: number; width: number; height: number };
  current: { x: number; y: number; width: number; height: number };
  /** Text only: where the words are drawn at time t (letter spacing and wrapping included), which can differ from the box. */
  ink?: { x: number; y: number; width: number; height: number };
  visible: boolean;
  inDevice: boolean;
  text?: string;
  fontSize?: number;
  screenFontSize?: number;
  overflow?: boolean;
  shrink?: number;
}
export interface LayoutReport {
  time: number;
  width: number;
  height: number;
  elements: LayoutBox[];
}

export interface SessionOptions {
  /** Output scale (0.5 for drafts). Layout is always computed at full size. */
  scale?: number;
  /** Reuse a browser (faster when opening many sessions). */
  browser?: Browser;
  /**
   * Layout only, no pictures: the page is hidden so nothing is painted (complex frames can take seconds to
   * paint, and each measurement would wait for it). Element visibility is read from their own styles, so
   * layout reports are unchanged. Don't take frames from such a session.
   */
  measureOnly?: boolean;
}

/** One loaded plan in one page. Frames can be requested in any order. */
export class RenderSession {
  private constructor(
    readonly plan: Plan,
    readonly page: Page,
    private context: BrowserContext,
    private ownBrowser: Browser | null,
    private dir: string,
    readonly scale: number,
  ) {}

  static async open(plan: Plan, opts: SessionOptions = {}): Promise<RenderSession> {
    const scale = opts.scale ?? 1;
    const browser = opts.browser ?? (await launchBrowser());
    const context = await browser.newContext({
      viewport: { width: Math.ceil(plan.width * scale), height: Math.ceil(plan.height * scale) },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      colorScheme: "light",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const dir = mkdtempSync(join(tmpdir(), "sini-"));
    const file = join(dir, "index.html");
    writeFileSync(file, pageHtml(plan));
    await page.goto(`file://${file}`);
    try {
      await page.evaluate("window.sini.ready");
    } catch (e) {
      throw new Error(`The renderer failed to start: ${errors[0] ?? (e as Error).message}`);
    }
    if (scale !== 1) await page.evaluate((f) => window.sini.setScale(f), scale);
    if (opts.measureOnly) await page.evaluate(() => void (document.documentElement.style.visibility = "hidden"));
    return new RenderSession(plan, page, context, opts.browser ? null : browser, dir, scale);
  }

  async render(t: number): Promise<void> {
    await this.page.evaluate((time) => window.sini.render(time), t);
  }

  async frame(t: number, format: "png" | "jpeg" = "png", quality = 92): Promise<Buffer> {
    await this.render(t);
    return this.page.screenshot({
      type: format,
      ...(format === "jpeg" ? { quality } : {}),
      clip: { x: 0, y: 0, width: Math.ceil(this.plan.width * this.scale), height: Math.ceil(this.plan.height * this.scale) },
      animations: "disabled",
      caret: "hide",
    });
  }

  async layout(t: number): Promise<LayoutReport> {
    // As a JSON string: Playwright's object serialisation of a few hundred nested boxes takes up to a second.
    return JSON.parse(await this.page.evaluate((time) => JSON.stringify(window.sini.layout(time)), t)) as LayoutReport;
  }

  /**
   * Layouts at many times in one page call. Between separate calls the browser produces a frame, which for
   * heavy scenes costs far more than measuring; in one call it produces none.
   */
  async layouts(ts: number[]): Promise<LayoutReport[]> {
    return JSON.parse(await this.page.evaluate((times) => JSON.stringify(window.sini.layouts(times)), ts)) as LayoutReport[];
  }

  async close(): Promise<void> {
    await this.context.close();
    if (this.ownBrowser) await this.ownBrowser.close();
    rmSync(this.dir, { recursive: true, force: true });
  }
}

declare global {
  interface Window {
    sini: { ready: Promise<void>; render(t: number): void; layout(t: number): unknown; layouts(ts: number[]): unknown[]; setScale(f: number): void };
  }
}
