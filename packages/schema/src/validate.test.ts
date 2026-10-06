import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validate } from "./index.js";

const referencePath = fileURLToPath(new URL("../../../docs/DSL_REFERENCE.md", import.meta.url));
const reference = readFileSync(referencePath, "utf8");

/** Full documents in the reference: JSON blocks that start with "version" and have scenes. */
const examples = [...reference.matchAll(/```json\n([\s\S]*?)```/g)]
  .map((m) => m[1]!)
  .filter((b) => b.trimStart().startsWith('{\n  "version"') && !b.includes('"scenes": [ ]'))
  .map((b) => JSON.parse(b));

const errors = (spec: unknown) => validate(spec).issues.filter((i) => i.level === "error");

describe("reference examples", () => {
  it("has the three full examples and the phone-flow recipe", () => {
    expect(examples).toHaveLength(4);
  });
  it.each(examples.map((e, i) => [i, e]))("example %i is valid", (_i, spec) => {
    expect(errors(spec)).toEqual([]);
  });
});

describe("common mistakes", () => {
  const base = () => structuredClone(examples[2]);
  const demo = (s: any) => s.scenes[0];
  const stats = (s: any) => s.scenes[1];

  const cases: [string, (s: any) => void, string][] = [
    ["misspelled preset", (s) => (stats(s).elements[0].enter = "wordreveal"), "unknown-preset"],
    ["unknown element type", (s) => (stats(s).elements[0].type = "heading"), "unknown-type"],
    ["colour not in palette", (s) => (demo(s).background = "creme"), "unknown-colour"],
    ["broken time reference", (s) => (stats(s).elements[2].enter.at = "s-paid/number.enter.end"), "unknown-ref"],
    ["duplicate id", (s) => (stats(s).elements[0].id = "demo"), "duplicate-id"],
    ["unknown key", (s) => (stats(s).elements[0].animation = "x"), "unknown-key"],
    ["undeclared hotspot", (s) => (demo(s).timeline[1].steps[0].click = "dashboard#import"), "unknown-hotspot"],
    ["unknown component", (s) => (stats(s).elements[1].children[0].use = "stat-card"), "unknown-component"],
    ["unknown component param", (s) => (stats(s).elements[1].children[0].with.colour = "sun"), "unknown-param"],
    ["grow on text", (s) => (stats(s).elements[0].enter = "grow"), "preset-target"],
    ["unknown chart bar", (s) => (stats(s).elements[2].highlight = "Q5"), "unknown-bar"],
    ["bad duration", (s) => (demo(s).duration = "long"), "bad-duration"],
    ["CSS animation in template", (s) => stats(s).elements.push({ id: "t", type: "template", html: "<b>x</b>", css: "b{transition:all 1s}" }), "unsafe-template"],
    ["old navigate form", (s) => demo(s).timeline.push({ target: "dashboard", navigate: "x", at: 1 }), "timeline-kind"],
    ["device path reference", (s) => (demo(s).timeline[3].target = "dashboard/export-toast"), "unknown-ref"],
    ["undeclared state", (s) => (demo(s).timeline[3].state = "failed"), "unknown-state"],
    ["wrong version", (s) => (s.version = "0.3"), "bad-version"],
    ["camelCase id", (s) => (stats(s).elements[0].id = "statsTitle"), "bad-id"],
    ["invented anchor", (s) => (stats(s).elements[0].layout.anchor = "bottom-center"), "unknown-anchor"],
  ];

  it.each(cases)("%s", (_name, mutate, code) => {
    const s = base();
    mutate(s);
    expect(errors(s).map((e) => e.code)).toContain(code);
  });

  it("suggests the right preset", () => {
    const s = base();
    stats(s).elements[0].enter = "wordreveal";
    expect(errors(s)[0]?.suggestion).toBe("Did you mean 'wordReveal'?");
  });

  it("suggests an anchor for an invented one", () => {
    const s = base();
    stats(s).elements[0].layout.anchor = "bottom-center";
    expect(errors(s)[0]?.suggestion).toMatch(/Did you mean 'bottom/);
  });

  it("explains plain IDs for device children", () => {
    const s = base();
    demo(s).timeline[3].target = "dashboard/export-toast";
    expect(errors(s).find((e) => e.code === "unknown-ref")?.suggestion).toMatch(/plain ID: 'export-toast'/);
  });

  it("rejects non-objects", () => {
    expect(validate(42).ok).toBe(false);
    expect(validate({ version: "0.4", video: {}, scenes: [] }).ok).toBe(false);
  });
});

describe("messages from the MCP test", () => {
  const spec = (timeline: unknown[], fill = "#ffffff") => ({
    version: "0.4", video: { format: "1:1" },
    scenes: [{ id: "s", duration: 2, elements: [{ id: "box", type: "shape", shape: "rect", style: { fill, stroke: "#ff0000" } }], timeline }],
  });
  it("accepts none and transparent as colours", () => {
    expect(errors(spec([], "none"))).toEqual([]);
    expect(errors(spec([], "transparent"))).toEqual([]);
  });
  it("says how to fix a quoted number and keys put inside animate", () => {
    const e = errors(spec([{ target: "box", animate: { scale: 1.2 }, at: "0" }, { animate: { id: "box", opacity: 0.5, duration: 1 } }]));
    expect(e.find((i) => i.code === "bad-time")?.suggestion).toBe("Write numbers without quotes: 0.");
    expect(e.find((i) => i.code === "bad-target")?.message).toBe("Missing target.");
    expect(e.filter((i) => i.code === "misplaced-key").map((i) => i.path)).toEqual(["scenes[0].timeline[1].animate.id", "scenes[0].timeline[1].animate.duration"]);
  });
});

describe("colours from the re-test round", () => {
  it("accepts hex colours with an opacity suffix", () => {
    const spec = { version: "0.4", video: { format: "1:1" }, scenes: [{ id: "s", duration: 1, background: "#2A1208/0.6", elements: [] }] };
    expect(errors(spec)).toEqual([]);
  });
});

describe("lint.accept", () => {
  const spec = (lint: unknown) => ({ version: "0.4", video: { format: "1:1" }, lint, scenes: [{ id: "s", duration: 1, elements: [] }] });
  it("needs a code and a reason for each accepted warning", () => {
    expect(errors(spec({ accept: [{ code: "tiny-text", element: "x", reason: "Printed label" }] }))).toEqual([]);
    expect(errors(spec({ accept: [{ code: "tiny-text" }] })).map((i) => i.path)).toEqual(["lint.accept[0].reason"]);
  });
});
