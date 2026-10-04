import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { compile } from "@sini/core";
import { launchBrowser, RenderSession } from "./index.js";

const spec = {
  version: "0.4",
  video: { format: "1:1" },
  theme: { palette: { ink: "#111111", bone: "#EEE6DA" }, motion: "editorial" },
  scenes: [
    {
      id: "s",
      duration: 3,
      background: "ink",
      elements: [
        { id: "box", type: "shape", shape: "rect", style: { fill: "bone" }, layout: { anchor: "bottom-right", inset: [100, 50], width: 200, height: 100 } },
        { id: "label", type: "text", content: "Hello", style: { color: "bone" }, layout: { below: "box", gap: 10, align: "end" }, enter: "none" },
        { id: "badge", type: "badge", label: "New", layout: { pin: { to: "box", point: "top-left", inside: 0 } } },
        { id: "fade", type: "shape", shape: "rect", layout: { x: 0, y: 0, width: 100, height: 100 }, enter: { preset: "fadeIn", at: 1, duration: 1, ease: "linear" } },
      ],
    },
  ],
};

let browser: Browser;
let session: RenderSession;

beforeAll(async () => {
  browser = await launchBrowser();
  session = await RenderSession.open(compile(spec as never), { browser });
}, 60_000);
afterAll(async () => {
  await session?.close();
  await browser?.close();
});

describe("layout in the browser", () => {
  it("places anchored, relative and pinned elements", async () => {
    const r = await session.layout(2);
    const get = (ref: string) => r.elements.find((e) => e.ref === ref)!;
    expect(get("box").box).toEqual({ x: 1080 - 50 - 200, y: 1080 - 100 - 100, width: 200, height: 100 });
    const label = get("label").box;
    expect(label.y).toBeCloseTo(880 + 100 + 10, 0); // below the box (bottom edge 980) + gap
    expect(label.x + label.width).toBeCloseTo(1030, 0); // right-aligned with the box
    const badge = get("badge").box;
    expect(badge.x).toBeCloseTo(830, 0); // inside: 0 → top-left corners coincide
    expect(badge.y).toBeCloseTo(880, 0);
  });

  it("reports visibility over time", async () => {
    expect((await session.layout(0.5)).elements.find((e) => e.ref === "fade")!.visible).toBe(false);
    expect((await session.layout(1.5)).elements.find((e) => e.ref === "fade")!.visible).toBe(true);
  });
});

describe("frames", () => {
  it("renders the same pixels for the same time, in any order", async () => {
    const a = await session.frame(1.5);
    await session.frame(2.7);
    await session.frame(0.1);
    const b = await session.frame(1.5);
    expect(a.length).toBeGreaterThan(1000);
    expect(Buffer.compare(a, b)).toBe(0);
  });
});
