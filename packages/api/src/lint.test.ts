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
