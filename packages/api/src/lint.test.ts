import { describe, expect, it } from "vitest";
import { compile } from "@sini/core";
import { validate } from "@sini/schema";
import { avoidCopyRules, glyphRules, layoutRules, timelineRules } from "./lint.js";

const make = (scenes: unknown[], video: Record<string, unknown> = {}) =>
  compile({ version: "0.4", video: { format: "9:16", ...video }, theme: { motion: "editorial" }, scenes } as never);

describe("timeline rules", () => {
  it("flags text that isn't on screen long enough to read", () => {
    const plan = make([{ id: "s", duration: 1.2, elements: [{ id: "h", type: "text", content: "Five words to read here" }] }]);
    const codes = timelineRules(plan).map((i) => i.code);
    expect(codes).toContain("reading-time");
  });
  it("is quiet for auto scenes", () => {
    const plan = make([{ id: "s", duration: "auto", elements: [{ id: "h", type: "text", content: "Five words to read here" }] }]);
    expect(timelineRules(plan)).toEqual([]);
  });
  it("flags elements that enter after their scene ends", () => {
    const plan = make([{ id: "s", duration: 2, elements: [{ id: "late", type: "shape", shape: "rect", enter: { preset: "fadeIn", at: 3 } }] }]);
    expect(timelineRules(plan).map((i) => i.code)).toContain("never-visible");
  });
  it("flags long scenes with nothing moving", () => {
    const plan = make([{ id: "s", duration: 8, elements: [{ id: "h", type: "text", content: "Hi", enter: "none" }] }]);
    expect(timelineRules(plan).map((i) => i.code)).toContain("low-motion");
  });
});

describe("glyph rules", () => {
  it("flags emoji, which no bundled font draws", () => {
    const plan = make([{ id: "s", duration: "auto", elements: [{ id: "h", type: "text", content: "Delicious 🍩" }] }]);
    expect(glyphRules(plan).map((i) => i.code)).toEqual(["missing-glyph"]);
  });
  it("accepts symbols covered by the Inter Tight fallback", () => {
    const plan = make([{ id: "s", duration: "auto", elements: [{ id: "h", type: "text", content: "GH₵ 4,500 ✓ → ▶" }] }], {});
    expect(glyphRules(plan)).toEqual([]);
  });
});

describe("layout rules", () => {
  const plan = make([{ id: "s", duration: "auto", background: "#000000", elements: [
    { id: "a", type: "text", content: "Low", style: { color: "#222222" } },
    { id: "b", type: "text", content: "Edge" },
    { id: "c", type: "text", content: "Overlap" },
  ] }], { safeZone: "reels" });
  const box = (ref: string, x: number, y: number, w = 300, h = 100) => ({ ref, type: "text", scene: "s", box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h }, visible: true, inDevice: false });
  const report = { time: 0, width: 1080, height: 1920, elements: [box("a", 300, 600), box("b", 20, 1800), box("c", 320, 620)] };
  const codes = (ref: string) => layoutRules(plan, report).filter((i) => i.path === ref).map((i) => i.code);

  it("flags low contrast", () => expect(codes("a")).toContain("low-contrast"));
  it("flags edges and safe zones", () => {
    expect(codes("b")).toContain("edge-margin");
    expect(codes("b")).toContain("safe-zone");
  });
  it("flags overlapping text", () => expect(codes("a")).toContain("overlap"));
});

describe("layout rules added after the tool-assisted test", () => {
  const plan = make([{ id: "s", duration: "auto", background: "#000000", elements: [
    { id: "t", type: "text", content: "Covered words", style: { color: "#ffffff" } },
    { id: "blob", type: "shape", shape: "circle", style: { fill: "#ff0000" } },
    { id: "small", type: "text", content: "Tiny words", style: { color: "#ffffff" } },
    { id: "card", type: "shape", shape: "rect", style: { fill: "#ffffff" } },
    { id: "on-card", type: "text", content: "Dark on white", style: { color: "#111111" } },
  ] }]);
  const box = (ref: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) =>
    ({ ref, type: "text", scene: "s", box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h }, visible: true, inDevice: false, ...extra });
  const report = { time: 0, width: 1080, height: 1920, elements: [
    box("t", 200, 400, 400, 100, { screenFontSize: 40 }),
    box("blob", 300, 380, 150, 150),
    box("small", 200, 800, 200, 20, { screenFontSize: 13 }),
    box("card", 100, 1100, 800, 300),
    box("on-card", 200, 1200, 400, 60, { screenFontSize: 40 }),
  ] };
  const codes = (ref: string) => layoutRules(plan, report).filter((i) => i.path === ref).map((i) => i.code);

  it("flags text covered by a later shape", () => expect(codes("t")).toContain("covered"));
  it("flags text drawn too small", () => expect(codes("small")).toContain("tiny-text"));
  it("measures contrast against a filled shape behind the text", () => expect(codes("on-card")).not.toContain("low-contrast"));
});

describe("layout rules added after the MCP test", () => {
  const plan = make([{ id: "s", duration: "auto", background: "#000000", elements: [
    { id: "col", type: "stack", layout: { anchor: "center", width: 600, height: 300 }, children: [
      { id: "fits", type: "text", content: "Fits", style: { color: "#ffffff" } },
      { id: "spills", type: "text", content: "Spills", style: { color: "#ffffff" } },
    ] },
    { id: "edge", type: "text", content: "Near the top", style: { color: "#ffffff" } },
  ] }]);
  const box = (ref: string, type: string, x: number, y: number, w: number, h: number) =>
    ({ ref, type, scene: "s", box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h }, visible: true, inDevice: false, screenFontSize: 40 });
  const report = { time: 0, width: 1080, height: 1920, elements: [
    box("col", "stack", 240, 810, 600, 300),
    box("fits", "text", 240, 810, 600, 100),
    box("spills", "text", 240, 1050, 600, 120),
    box("edge", "text", 300, 20, 400, 60),
  ] };
  const issues = layoutRules(plan, report);

  it("flags content sticking out of a stack, and says where", () => {
    const o = issues.filter((i) => i.code === "content-overflow");
    expect(o.map((i) => i.path)).toEqual(["spills"]);
    expect(o[0]!.message).toContain("60px past the bottom of 'col'");
  });
  it("names the edge in edge-margin warnings", () => {
    expect(issues.find((i) => i.path === "edge" && i.code === "edge-margin")?.message).toContain("top (20px)");
  });
});

describe("lint timing and camera awareness", () => {
  const plan = make([{ id: "s", duration: 10, background: "#000000", elements: [
    { id: "cap-a", type: "stack", style: { fill: "#222222" }, layout: { anchor: "bottom", inset: [80, 0] }, exit: { preset: "fadeOut", at: 3 },
      children: [{ id: "a-txt", type: "text", content: "First caption", style: { color: "#ffffff" } }] },
    { id: "cap-b", type: "stack", style: { fill: "#222222" }, layout: { anchor: "bottom", inset: [80, 0] }, enter: { preset: "fadeIn", at: 4 },
      children: [{ id: "b-txt", type: "text", content: "Second caption", style: { color: "#ffffff" } }] },
    { id: "stage", type: "group", layout: { x: 0, y: 0, width: 1080, height: 1920 }, children: [
      { id: "fine", type: "text", content: "Readable when zoomed", style: { color: "#ffffff" }, layout: { x: 100, y: 100 } },
    ] },
  ], timeline: [{ behavior: "camera", target: "stage", keys: [{ at: 0, focus: "center", zoom: 1 }, { at: 1, focus: "fine", zoom: 2.5 }] }] }]);
  const box = (ref: string, type: string, x: number, y: number, w: number, h: number, fs?: number) =>
    ({ ref, type, scene: "s", box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h }, visible: true, inDevice: false, ...(fs ? { screenFontSize: fs } : {}) });
  const report = { time: 0, width: 1080, height: 1920, elements: [
    box("cap-a", "stack", 300, 1700, 480, 100), box("a-txt", "text", 320, 1720, 440, 60, 40),
    box("cap-b", "stack", 300, 1700, 480, 100), box("b-txt", "text", 320, 1720, 440, 60, 40),
    box("stage", "group", 0, 0, 1080, 1920), box("fine", "text", 100, 100, 300, 20, 14),
  ] };
  const issues = layoutRules(plan, report);
  it("uses the parents' enter and exit times for overlap and covered checks", () => {
    expect(issues.filter((i) => ["overlap", "covered"].includes(i.code))).toEqual([]);
  });
  it("judges text size at the camera's zoom", () => {
    expect(issues.filter((i) => i.code === "tiny-text")).toEqual([]);
  });
});

describe("accepted warnings", () => {
  it("drop warnings matched by code and element (or an element inside it)", async () => {
    const { applyAccepted } = await import("./lint.js");
    const w = (code: string, path: string) => ({ level: "warning" as const, code, path, message: "" });
    const r = applyAccepted([w("tiny-text", "bottle-label"), w("tiny-text", "bottle/label"), w("tiny-text", "caption"), w("overlap", "bottle-label")], [{ code: "tiny-text", element: "bottle-label" }, { code: "tiny-text", element: "bottle" }]);
    expect(r.accepted).toBe(2);
    expect(r.open.map((i) => `${i.code}:${i.path}`)).toEqual(["tiny-text:caption", "overlap:bottle-label"]);
  });
});

describe("text over pictures", () => {
  const plan = make([{ id: "s", duration: "auto", background: "#000000", elements: [
    { id: "shot", type: "image", asset: "x" },
    { id: "over", type: "text", content: "Over the picture", style: { color: "#ffffff" } },
    { id: "card", type: "stack", style: { fill: "#111111" }, children: [{ id: "on-card", type: "text", content: "On a card", style: { color: "#ffffff" } }] },
  ] }]);
  const box = (ref: string, type: string, x: number, y: number, w: number, h: number) =>
    ({ ref, type, scene: "s", box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h }, visible: true, inDevice: false, screenFontSize: 40 });
  const report = { time: 0, width: 1080, height: 1920, elements: [
    box("shot", "image", 100, 400, 880, 600), box("over", "text", 200, 500, 500, 80),
    box("card", "stack", 200, 700, 500, 120), box("on-card", "text", 220, 720, 460, 80),
  ] };
  const codes = (ref: string) => layoutRules(plan, report).filter((i) => i.path === ref).map((i) => i.code);
  it("flags text over an image, but not text on a filled card", () => {
    expect(codes("over")).toContain("text-over-image");
    expect(codes("on-card")).not.toContain("text-over-image");
  });
});

describe("lint over time", () => {
  it("flags text that grows too wide or leaves the frame mid-animation, but not during enters", async () => {
    const { motionRules } = await import("./lint.js");
    const plan = make([{ id: "s", duration: 2, background: "#000000", elements: [
      { id: "wide", type: "text", content: "Wide", enter: "none" },
      { id: "away", type: "text", content: "Away", enter: "none" },
      { id: "slider", type: "text", content: "Slides in", enter: { preset: "slideIn", from: "left", at: 0, duration: 1 } },
    ] }], { format: "9:16" });
    const at = (t: number) => ({ time: t, width: 1080, height: 1920, elements: [
      { ref: "wide", type: "text", scene: "s", visible: true, inDevice: false, box: { x: 100, y: 100, width: 800, height: 100 }, current: { x: 100, y: 100, width: 800, height: 100 }, ink: { x: t > 1 ? -50 : 100, y: 100, width: t > 1 ? 1200 : 800, height: 100 } },
      { ref: "away", type: "text", scene: "s", visible: true, inDevice: false, box: { x: 100, y: 400, width: 300, height: 80 }, current: { x: t > 1 ? 950 : 100, y: 400, width: 300, height: 80 } },
      { ref: "slider", type: "text", scene: "s", visible: true, inDevice: false, box: { x: 100, y: 700, width: 300, height: 80 }, current: { x: t < 1 ? -200 : 100, y: 700, width: 300, height: 80 } },
    ] });
    const issues = await motionRules(plan, { layout: async (t: number) => at(t) });
    expect(issues.map((i) => `${i.path}:${i.code}`).sort()).toEqual(["away:leaves-frame", "wide:too-wide-in-motion"]);
  });
});

describe("describe_at coverage", () => {
  it("marks elements mostly hidden by an opaque element drawn above them", async () => {
    const { coveredAt } = await import("./describe.js");
    const plan = make([{ id: "s", duration: 2, background: "#000000", elements: [
      { id: "caption", type: "text", content: "Pick", enter: "none" },
      { id: "card", type: "shape", shape: "rect", style: { fill: "#ffffff" } },
      { id: "above", type: "text", content: "On top", enter: "none" },
    ] }]);
    const b = (ref: string, type: string, x: number, y: number, w: number, h: number) =>
      ({ ref, type, scene: "s", visible: true, inDevice: false, box: { x, y, width: w, height: h }, current: { x, y, width: w, height: h } });
    const covered = coveredAt(plan, { time: 1, width: 1080, height: 1920, elements: [
      b("caption", "text", 100, 100, 300, 80), b("card", "shape", 50, 50, 600, 400), b("above", "text", 100, 300, 300, 80),
    ] });
    expect(covered.get("caption")).toBe("card");
    expect(covered.has("above")).toBe(false);
  });
});

describe("device flow rules", () => {
  it("flag a new phone in each scene of an app flow, but not a repeated screenshot", async () => {
    const { deviceRules } = await import("./lint.js");
    const phone = (id: string) => ({ id, type: "phone", children: [{ id: `${id}-t`, type: "text", content: "Hi" }] });
    const flow = make([{ id: "a", duration: 1, elements: [phone("p1")] }, { id: "b", duration: 1, elements: [phone("p2")] }]);
    expect(deviceRules(flow).map((i) => `${i.path}:${i.code}`)).toEqual(["p2:device-per-scene"]);
    const shot = (id: string) => ({ id, type: "browser", content: "dash" });
    const shots = compile({ version: "0.4", video: { format: "16:9" }, assets: { dash: "dash.png" }, scenes: [{ id: "a", duration: 1, elements: [shot("b1")] }, { id: "b", duration: 1, elements: [shot("b2")] }] } as never);
    expect(deviceRules(shots)).toEqual([]);
  });
  it("flag a mostly empty device screen", async () => {
    const { motionRules } = await import("./lint.js");
    const plan = make([{ id: "s", duration: 1, elements: [{ id: "ph", type: "phone", children: [{ id: "row", type: "text", content: "Only a title", enter: "none" }] }] }]);
    const report = { time: 0, width: 1080, height: 1920, elements: [
      { ref: "ph", type: "phone", scene: "s", visible: true, inDevice: false, box: { x: 200, y: 200, width: 680, height: 1400 }, current: { x: 200, y: 200, width: 680, height: 1400 } },
      { ref: "row", type: "text", scene: "s", visible: true, inDevice: true, box: { x: 250, y: 300, width: 500, height: 60 }, current: { x: 250, y: 300, width: 500, height: 60 } },
    ] };
    const issues = await motionRules(plan, { layout: async () => report });
    expect(issues.map((i) => i.code)).toContain("empty-screen");
  });
});

describe("words to avoid", () => {
  it("find avoided words and phrases in text, labels and state changes, as whole words", () => {
    const plan = make([{ id: "s", duration: 4, elements: [
      { id: "h", type: "text", content: "Is your medicine *safe*?", states: { later: { content: "Verified   safe by us" } } },
      { id: "ok", type: "text", content: "Safety first, unsafe never" },
      { id: "b", type: "button", label: "Genuine check" },
    ], timeline: [{ target: "h", state: "later", at: 2 }] }]);
    const hits = avoidCopyRules(plan, ["safe", "verified safe", "genuine"]).map((i) => `${i.path}:${i.message.match(/says "([^"]+)"/)![1]}`);
    expect(hits).toEqual(expect.arrayContaining(["h:safe", "h:Verified   safe", "b:Genuine"]));
    expect(hits.some((h) => h.startsWith("ok:"))).toBe(false);
  });
  it("validate lint.avoid and image crop", () => {
    const base = (extra: Record<string, unknown>, el: Record<string, unknown> = {}) => validate({ version: "0.4", video: { format: "1:1" }, assets: { a: "a.png" }, ...extra,
      scenes: [{ id: "s", duration: 1, elements: [{ id: "i", type: "image", asset: "a", ...el }] }] } as never);
    expect(base({ lint: { avoid: ["safe", "verified safe"] } }).ok).toBe(true);
    expect(base({ lint: { avoid: "safe" } }).issues.map((i) => i.code)).toContain("bad-lint");
    expect(base({}, { crop: [0, 270, 390, 790] }).ok).toBe(true);
    expect(base({}, { crop: [0, 270, 0, 790] }).issues.map((i) => i.code)).toContain("bad-crop");
    // A ruled-out word has to be fixed, not accepted.
    const acc = base({ lint: { avoid: ["safe"], accept: [{ code: "avoided-word", reason: "not emphasised" }] } });
    expect(acc.issues).toEqual([expect.objectContaining({ level: "warning", path: "lint.accept[0].code" })]);
  });
});

describe("state text with markup", () => {
  it("rolls in styled runs and reports the plain text", () => {
    const plan = make([{ id: "s", duration: 3, elements: [
      { id: "cap", type: "text", content: "Scan the pack", states: { r: { content: "It is [registered]{#17915a} with the **FDA**." } } },
    ], timeline: [{ target: "cap", state: "r", at: 1 }] }]);
    const tr = plan.tracks.find((t) => t.kind === "content");
    expect(tr).toMatchObject({ from: "Scan the pack", to: "It is registered with the FDA." });
    expect((tr as { toRuns?: { text: string; color?: string; bold?: boolean }[] }).toRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "registered", color: "rgb(23, 145, 90)" }),
      expect.objectContaining({ text: "FDA", bold: true }),
    ]));
  });
});

describe("overlap while the camera zooms", () => {
  it("flags a zoomed element running into text outside the zoom, not things zoomed together", async () => {
    const { motionRules } = await import("./lint.js");
    const plan = make([{ id: "s", duration: 2, elements: [
      { id: "cap", type: "text", content: "On the register", enter: "none", layout: { x: 100, y: 100 } },
      { id: "stage", type: "group", layout: { x: 0, y: 400, width: 1080, height: 1400 }, children: [
        { id: "phone", type: "shape", shape: "rect", style: { fill: "#ffffff" }, layout: { x: 240, y: 0, width: 600, height: 1200 }, enter: "none" },
        { id: "label", type: "text", content: "Inside", enter: "none", layout: { x: 300, y: 50 } },
      ] },
    ], timeline: [{ target: "stage", behavior: "camera", keys: [{ at: 0, focus: "center", zoom: 1 }, { at: 1, focus: "phone", zoom: 1.6 }] }] }]);
    const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
    const report = (t: number) => {
      const zoomed = t > 1;
      return {
        time: t, width: 1080, height: 1920,
        elements: [
          { ref: "cap", type: "text", scene: "s", box: box(100, 100, 500, 80), current: box(100, 100, 500, 80), visible: true },
          { ref: "stage", type: "group", scene: "s", box: box(0, 400, 1080, 1400), current: box(0, 400, 1080, 1400), visible: true },
          { ref: "phone", type: "shape", scene: "s", box: box(240, 400, 600, 1200), current: zoomed ? box(60, 50, 960, 1900) : box(240, 400, 600, 1200), visible: true },
          { ref: "label", type: "text", scene: "s", box: box(300, 450, 200, 60), current: zoomed ? box(160, 130, 320, 96) : box(300, 450, 200, 60), visible: true },
        ],
      };
    };
    const session = { layout: async (t: number) => report(t) as never, layouts: async (ts: number[]) => ts.map(report) as never };
    const issues = (await motionRules(plan, session)).filter((i) => i.code === "overlap-in-motion");
    expect(issues.map((i) => i.path)).toEqual(["cap"]);
  });
});
