import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);
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

/** A minimal RGB PNG: a light disc on a dark field, big enough that Chromium scales it. */
function discPng(w: number, h: number): Buffer {
  const { deflateSync, crc32 } = require("node:zlib") as typeof import("node:zlib");
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = (x - w / 2) ** 2 + (y - h / 3) ** 2 < (w * 0.35) ** 2;
      raw.set(inside ? [235, 200, 150] : [120, 40, 48 + (y % 7)], y * (w * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

describe("frame history", () => {
  // Regression: text animating over a scaled photo left partially re-rastered areas that
  // differed from a fresh page, so a frame depended on which frames a worker drew before it.
  it("draws a frame the same whatever was rendered before it", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "sini-hist-"));
    writeFileSync(join(dir, "photo.png"), discPng(1080, 1920));
    const p = compile(
      {
        version: "0.4",
        video: { format: "16:9" },
        theme: { motion: "editorial" },
        assets: { photo: "photo.png" },
        scenes: [{ id: "s", duration: 3, background: { asset: "photo", fit: "cover" }, elements: [
          { id: "t", type: "text", role: "title", content: "Opens into the scene.", style: { color: "#F2EFE8" }, layout: { anchor: "bottom-left", inset: [120, 120] } },
        ] }],
      } as never,
      { projectDir: dir },
    );
    const fresh = await RenderSession.open(p, { browser });
    const walked = await RenderSession.open(p, { browser });
    try {
      for (let f = 0; f < 60; f++) await walked.frame(f / 30, "jpeg", 95);
      const a = await walked.frame(2);
      const b = await fresh.frame(2);
      expect(Buffer.compare(a, b)).toBe(0);
    } finally {
      await fresh.close();
      await walked.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
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

describe("camera and matchCut", () => {
  const p = compile({
    version: "0.4", video: { format: "1:1" },
    scenes: [
      { id: "a", duration: 3, elements: [
        { id: "stage", type: "group", layout: { x: 0, y: 0, width: 1080, height: 1080 }, children: [
          { id: "dot", type: "shape", shape: "circle", style: { fill: "#ff0000" }, layout: { x: 100, y: 200, width: 40, height: 40 } },
        ] },
        { id: "card", type: "shape", shape: "rect", style: { fill: "#00ff00" }, layout: { x: 300, y: 400, width: 200, height: 300 } },
      ], timeline: [{ behavior: "camera", target: "stage", keys: [{ at: 0, focus: "center", zoom: 1 }, { at: 1, focus: "dot", zoom: 2 }] }] },
      { id: "b", duration: 2, background: "#0000ff", transition: { type: "matchCut", from: "card", to: "background", duration: 1, ease: "linear" }, elements: [] },
    ],
  } as never);

  it("centres the focus element at the requested zoom", async () => {
    const s = await RenderSession.open(p, { browser });
    try {
      const dot = (await s.layout(2)).elements.find((e) => e.ref === "dot")!.current;
      expect(dot.width).toBeCloseTo(80, 0);
      expect(dot.x + dot.width / 2).toBeCloseTo(540, 0);
      expect(dot.y + dot.height / 2).toBeCloseTo(540, 0);
    } finally {
      await s.close();
    }
  }, 60_000);

  it("starts the match cut on the outgoing element", async () => {
    const s = await RenderSession.open(p, { browser });
    try {
      await s.render(3.0);
      const clip = await s.page.evaluate(() => (document.querySelector('[data-scene="b"]') as HTMLElement).style.clipPath);
      // inset(top right bottom left …): starts at the card's box.
      const [top, right, bottom, left] = /inset\(([\d.]+)px ([\d.]+)px ([\d.]+)px ([\d.]+)px/.exec(clip)!.slice(1).map(Number) as [number, number, number, number];
      expect(top).toBeCloseTo(400, 0);
      expect(left).toBeCloseTo(300, 0);
      expect(1080 - right - left).toBeCloseTo(200, 0);
      expect(1080 - bottom - top).toBeCloseTo(300, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("fixes from the MCP test", () => {
  it("pins to a screenshot hotspot inside a device overlay", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "sini-pin-"));
    writeFileSync(join(dir, "shot.png"), discPng(1280, 800));
    const p = compile({
      version: "0.4", video: { format: "16:9" },
      assets: { shot: { type: "image", src: "shot.png", hotspots: { card: [100, 100, 200, 100] } } },
      scenes: [{ id: "s", duration: 2, elements: [
        { id: "app", type: "browser", content: "shot", layout: { anchor: "center", width: 1280 }, enter: "none",
          overlay: [{ id: "hl", type: "shape", shape: "rect", layout: { pin: { to: "app#card", point: "center" }, width: 200, height: 100 }, enter: "none" }] },
      ] }],
    } as never, { projectDir: dir });
    const s = await RenderSession.open(p, { browser });
    try {
      const r = await s.layout(1);
      const app = r.elements.find((e) => e.ref === "app")!.box;
      const hl = r.elements.find((e) => e.ref === "hl")!.current;
      // The screenshot fills the browser's width under a 44px toolbar; the hotspot centre is (200, 150) in image px.
      expect(Math.abs(hl.x + hl.width / 2 - (app.x + 200))).toBeLessThan(3);
      expect(Math.abs(hl.y + hl.height / 2 - (app.y + 44 + 150))).toBeLessThan(3);
    } finally {
      await s.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("moves pinned elements with their animated target, keeps explicit group sizes, and measures drawn buttons", async () => {
    const p = compile({
      version: "0.4", video: { format: "1:1" },
      scenes: [{ id: "s", duration: 3, elements: [
        { id: "card", type: "shape", shape: "rect", style: { fill: "#334455" }, layout: { anchor: "center", width: 400, height: 200 }, enter: { preset: "fadeUp", at: 0, duration: 2, distance: 300, ease: "linear" } },
        { id: "dot", type: "shape", shape: "circle", style: { fill: "#ff0000" }, layout: { pin: { to: "card", point: "top" }, width: 40, height: 40 }, enter: "none" },
        { id: "col", type: "stack", layout: { anchor: "top-left", inset: [40, 40], width: 600 }, children: [
          { id: "g", type: "group", layout: { height: 100 }, children: [{ id: "tall", type: "shape", shape: "rect", layout: { x: 0, y: 0, width: 50, height: 400 } }] },
          { id: "btn", type: "button", label: "Go" },
        ] },
      ] }],
    } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      for (const t of [0.5, 1.5, 2.5]) {
        const r = await s.layout(t);
        const card = r.elements.find((e) => e.ref === "card")!.current;
        const dot = r.elements.find((e) => e.ref === "dot")!.current;
        expect(dot.y + dot.height / 2).toBeCloseTo(card.y, 0);
      }
      const r = await s.layout(2.5);
      expect(r.elements.find((e) => e.ref === "g")!.box.height).toBeCloseTo(100, 0);
      expect(r.elements.find((e) => e.ref === "btn")!.box.width).toBeLessThan(300);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("fixes from the re-test round", () => {
  it("paints shapes with gradient fills (SVG can't use CSS gradients)", async () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [{ id: "s", duration: 1, elements: [
      { id: "g", type: "shape", shape: "rect", style: { fill: { linear: ["#ff0000", "#0000ff"], angle: 90 } }, layout: { anchor: "center", width: 400, height: 200 } },
    ] }] } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      await s.render(0.5);
      const r = await s.page.evaluate(() => {
        const geo = document.querySelector("svg rect")!;
        const ref = geo.getAttribute("fill")!;
        const grad = document.querySelector(ref.slice(4, -1))!;
        return { ref, tag: grad.tagName, stops: [...grad.querySelectorAll("stop")].map((x) => x.getAttribute("stop-color")) };
      });
      expect(r.ref).toMatch(/^url\(#sini-grad-\d+\)$/);
      expect(r.tag).toBe("linearGradient");
      expect(r.stops).toHaveLength(2);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("paths", () => {
  it("scale to a given width, keep stroke widths in px, dash, and carry a follower to the end", async () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [{ id: "s", duration: 3, elements: [
      { id: "wave", type: "path", points: [[0, 40], [100, 0], [200, 40]], smooth: true, style: { stroke: "#ffffff", strokeWidth: 10, dash: [12, 8] }, layout: { x: 100, y: 100, width: 400 } },
      { id: "route", type: "path", d: "M0 0 L300 300", style: { stroke: "#ffffff" }, layout: { x: 200, y: 400 } },
      { id: "dot", type: "shape", shape: "circle", style: { fill: "#ff0000" }, layout: { anchor: "top-left", width: 40, height: 40 } },
    ], timeline: [{ behavior: "follow", target: "dot", path: "route", at: 0.5, duration: 1 }] }] } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const r = await s.layout(2);
      const wave = r.elements.find((e) => e.ref === "wave")!.box;
      expect(wave.width).toBeCloseTo(400, 0);
      expect(wave.height).toBeCloseTo(80, 0);
      const attrs = await s.page.evaluate(() => {
        const g = document.querySelectorAll("path")[0]!;
        return { sw: Number(g.getAttribute("stroke-width")), dash: g.style.strokeDasharray };
      });
      expect(attrs.sw).toBeCloseTo(5, 1); // drawn at 2× scale, so 10px needs 5 path units
      expect(attrs.dash).not.toBe("");
      const dot = r.elements.find((e) => e.ref === "dot")!.current;
      expect(dot.x + dot.width / 2).toBeCloseTo(500, 0);
      expect(dot.y + dot.height / 2).toBeCloseTo(700, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("text ink", () => {
  it("reports where the letters are drawn, inside the line box", async () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [{ id: "s", duration: 1, elements: [
      { id: "big", type: "text", role: "display", content: "340", enter: "none", layout: { anchor: "center" } },
    ] }] } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const e = (await s.layout(0.5)).elements.find((x) => x.ref === "big")!;
      expect(e.ink).toBeDefined();
      expect(e.ink!.y).toBeGreaterThan(e.box.y);
      expect(e.ink!.y + e.ink!.height).toBeLessThan(e.box.y + e.box.height);
      // Digits are about 0.7 of the font size tall.
      expect(e.ink!.height / e.fontSize!).toBeGreaterThan(0.6);
      expect(e.ink!.height / e.fontSize!).toBeLessThan(0.85);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("zoom transition", () => {
  it("scales the scenes' content, never their backgrounds (a scaled background shows its edges)", async () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [
      { id: "a", duration: 1, background: "#000000", elements: [] },
      { id: "b", duration: 1, background: "#ffffff", transition: { type: "zoom", duration: 0.6 }, elements: [{ id: "t", type: "text", content: "Hi", enter: "none" }] },
    ] } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      await s.render(1.3);
      const r = await s.page.evaluate(() => [...document.querySelectorAll<HTMLElement>("section.scene")].map((sec) => ({ sec: sec.style.transform, layer: (sec.querySelector(":scope > .layer") as HTMLElement).style.transform })));
      expect(r.every((x) => x.sec === "")).toBe(true);
      expect(r.some((x) => x.layer.startsWith("scale("))).toBe(true);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("connectors", () => {
  it("run between the edges of their ends, follow them, and hide while an end is hidden", async () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [{ id: "s", duration: 3, elements: [
      { id: "a", type: "shape", shape: "rect", layout: { x: 100, y: 500, width: 100, height: 80 }, enter: "none" },
      { id: "b", type: "shape", shape: "rect", layout: { x: 800, y: 500, width: 100, height: 80 }, enter: { preset: "fadeUp", at: 1, duration: 1, distance: 200, ease: "linear" } },
      { id: "ab", type: "connector", from: "a", to: "b" },
    ] }] } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const line = async (t: number) => {
        await s.render(t);
        return s.page.evaluate(() => {
          const g = document.querySelectorAll("path")[0]!;
          return { d: g.getAttribute("d")!, opacity: Number((g.ownerSVGElement as SVGSVGElement).style.opacity) };
        });
      };
      expect((await line(0.5)).opacity).toBe(0);
      const done = await line(2.5);
      expect(done.opacity).toBe(1);
      const [x0, y0, x1, y1] = done.d.match(/-?[\d.]+/g)!.map(Number) as [number, number, number, number];
      expect(x0).toBeCloseTo(208, 0); // a's right edge + 8px gap
      expect(x1).toBeCloseTo(792, 0); // b's left edge − 8px gap
      expect(y0).toBeCloseTo(540, 0);
      expect(y1).toBeCloseTo(540, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});

describe("svg and template", () => {
  it("sanitises SVG files", async () => {
    const { sanitizeSvg } = await import("./index.js");
    const out = sanitizeSvg(`<?xml version="1.0"?><svg onload="x()"><script>alert(1)</script><a href="https://x.y"><rect onclick="y()" fill="url(https://x.y/p)"/></a><use href="#a"/></svg>`);
    expect(out).not.toMatch(/script|onload|onclick|https:/);
    expect(out).toContain('href="#a"');
  });

  it("escapes template params and animates CSS variables", async () => {
    const p = compile({
      version: "0.4", video: { format: "1:1" },
      scenes: [{ id: "s", duration: 2, elements: [
        { id: "tpl", type: "template", html: "<b class='x'>{{name}}</b>", css: ".x{display:block;width:calc(100px + var(--grow) * 100px)}", params: { name: "<i>hi</i>" }, vars: { "--grow": 0 }, layout: { x: 0, y: 0 } },
      ], timeline: [{ target: "tpl", at: 0.5, duration: 1, ease: "linear", animate: { "--grow": [0, 1] } }] }],
    } as never);
    const s = await RenderSession.open(p, { browser });
    try {
      const read = async (t: number) => { await s.render(t); return s.page.evaluate(() => { const root = document.querySelector(".template")!.shadowRoot!; const b = root.querySelector(".x") as HTMLElement; return { text: b.textContent, html: b.innerHTML, width: b.getBoundingClientRect().width }; }); };
      const before = await read(0.2);
      expect(before.text).toBe("<i>hi</i>");
      expect(before.html).not.toContain("<i>");
      expect(before.width).toBeCloseTo(100, 0);
      expect((await read(1.0)).width).toBeCloseTo(150, 0);
    } finally {
      await s.close();
    }
  }, 60_000);
});
