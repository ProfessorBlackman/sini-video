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

describe("video", () => {
  it("renders byte-identical frames on every run", async () => {
    const { renderVideo } = await import("./index.js");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const small = compile({
      ...spec,
      video: { width: 270, height: 270, fps: 24 },
      theme: { ...spec.theme, texture: { grain: 0.08 } },
      scenes: [
        spec.scenes[0],
        { id: "b", duration: 1, background: "bone", transition: { type: "wipe", angle: 15, bar: "ink" }, elements: [{ id: "t", type: "text", content: "Same every time" }] },
      ],
    } as never);
    const dir = mkdtempSync(join(tmpdir(), "sini-det-"));
    try {
      const a = await renderVideo(small, join(dir, "a.mp4"), { hashes: true, workers: 3 });
      const b = await renderVideo(small, join(dir, "b.mp4"), { hashes: true, workers: 2 });
      expect(a.frames).toBe(96);
      expect(a.frameHashes).toEqual(b.frameHashes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("device scrolling", () => {
  it("scrolls a phone page so the target sits near the top", async () => {
    const items = Array.from({ length: 14 }, (_, i) => ({ id: `row-${i}`, type: "shape", shape: "rect", style: { fill: "#cccccc" }, layout: { height: 120 } }));
    const p = compile({
      version: "0.4", video: { format: "9:16" },
      scenes: [{ id: "s", duration: 3, elements: [
        { id: "phone", type: "phone", gap: 10, layout: { anchor: "center", width: 500 }, children: items },
      ], timeline: [{ behavior: "scroll", target: "phone", to: "row-6", at: 0.5, duration: 1 }] }],
    } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const y = async (t: number) => (await s.layout(t)).elements.find((e) => e.ref === "row-6")!.current.y;
      const phoneTop = (await s.layout(0)).elements.find((e) => e.ref === "phone")!.box.y;
      const before = await y(0);
      const after = await y(2);
      expect(after).toBeLessThan(before - 300);
      // 24 logical px + the 54px status bar below the screen top, scaled to canvas.
      const scale = (500 * 0.92) / 390;
      expect(after - (phoneTop + 500 * 0.04)).toBeCloseTo((24 + 54) * scale, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("progress steps", () => {
  it("pins elements to a step's dot", async () => {
    const p = compile({
      version: "0.4", video: { format: "1:1" },
      scenes: [{ id: "s", duration: 2, elements: [
        { id: "track", type: "progress", steps: ["One", "Two", "Three", "Four"], value: 1, layout: { x: 100, y: 500, width: 800 } },
        { id: "tag", type: "badge", label: "Here", layout: { pin: { to: "track#Three", point: "center" } } },
      ] }],
    } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const r = await s.layout(1);
      const tag = r.elements.find((e) => e.ref === "tag")!.box;
      // Four equal columns across 800px from x=100: "Three" is centred at 100 + 800 × 5/8 = 600.
      expect(tag.x + tag.width / 2).toBeCloseTo(600, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("charts", () => {
  it("draws bars proportional to their values and pins to a bar", async () => {
    const p = compile({
      version: "0.4", video: { format: "1:1" },
      scenes: [{ id: "s", duration: 2, elements: [
        { id: "c", type: "chart", kind: "bar", data: [["A", 10], ["B", 20], ["C", 40]], showValues: false, layout: { x: 100, y: 200, width: 600, height: 500 } },
        { id: "tag", type: "badge", label: "Top", layout: { pin: { to: "c#C", point: "top" } } },
      ] }],
    } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const heights = await s.page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".chart-bar")].map((b) => b.getBoundingClientRect().height));
      expect(heights[1]! / heights[0]!).toBeCloseTo(2, 1);
      expect(heights[2]! / heights[0]!).toBeCloseTo(4, 1);
      const r = await s.layout(1);
      const tag = r.elements.find((e) => e.ref === "tag")!.box;
      const top = await s.page.evaluate(() => { const st = document.getElementById("stage")!.getBoundingClientRect(); const b = document.querySelectorAll<HTMLElement>(".chart-bar")[2]!.getBoundingClientRect(); return b.top - st.top; });
      expect(tag.y + tag.height / 2).toBeCloseTo(top, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});
