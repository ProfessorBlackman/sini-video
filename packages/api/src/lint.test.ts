import { describe, expect, it } from "vitest";
import { compile } from "@sini/core";
import { glyphRules, layoutRules, timelineRules } from "./lint.js";

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
