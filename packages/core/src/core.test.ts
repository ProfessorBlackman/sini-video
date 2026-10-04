import { describe, expect, it } from "vitest";
import { compile, describeAt, elementFrame, formatLike, frameAt, parseMarkup } from "./index.js";

const video = (scenes: unknown[], extra: Record<string, unknown> = {}) =>
  ({ version: "0.4", video: { format: "9:16" }, theme: { motion: "editorial" }, scenes, ...extra }) as never;

describe("markup", () => {
  it("parses italic, bold and colour spans", () => {
    const p = parseMarkup("The [ultimate]{gold} *sophistication*, **now**");
    expect(p.plain).toBe("The ultimate sophistication, now");
    expect(p.runs.find((r) => r.text === "ultimate")?.color).toBe("gold");
    expect(p.runs.find((r) => r.text === "sophistication")?.italic).toBe(true);
    expect(p.runs.find((r) => r.text === "now")?.bold).toBe(true);
    expect(p.words).toBe(4);
  });
  it("counts reading words, characters and lines", () => {
    const p = parseMarkup("GH₵ 4,500 — per month\nnow");
    expect(p.readingWords).toBe(5); // "—" doesn't count
    expect(p.lines).toBe(2);
  });
  it("finds and reformats the first number", () => {
    const p = parseMarkup("GH₵ 4,500/month");
    expect(p.number).toMatchObject({ value: 4500, separator: "," });
    expect(formatLike(1234.4, p.number!)).toBe("1,234");
    expect(formatLike(7.25, parseMarkup("4.9★").number!)).toBe("7.3");
  });
});

describe("timing", () => {
  it("chains default enters: first at 0.3, then prev end − 0.2", () => {
    const plan = compile(video([{ id: "s", duration: 4, elements: [
      { id: "a", type: "text", content: "One", enter: "fadeIn" },
      { id: "b", type: "text", content: "Two", enter: "fadeIn" },
    ] }]));
    const a = plan.tracks.find((t) => t.ref === "a")!;
    const b = plan.tracks.find((t) => t.ref === "b")!;
    expect(a.t0).toBeCloseTo(0.3);
    expect(a.t1).toBeCloseTo(1.05);
    expect(b.t0).toBeCloseTo(0.85);
  });

  it("gives top-level text the personality's default enter, unless enter is none", () => {
    const plan = compile(video([{ id: "s", duration: 3, elements: [
      { id: "a", type: "text", content: "Hello world" },
      { id: "b", type: "text", content: "Static", enter: "none" },
    ] }]));
    expect(plan.tracks.some((t) => t.ref === "a" && t.label.startsWith("wordReveal"))).toBe(true);
    expect(plan.tracks.some((t) => t.ref === "b")).toBe(false);
  });

  it("applies per-part duration plus stagger", () => {
    const plan = compile(video([{ id: "s", duration: 5, elements: [
      { id: "h", type: "text", content: "one two three", enter: { preset: "wordReveal", at: 1, duration: 0.5, stagger: 0.1 } },
      { id: "n", type: "text", content: "next", enter: { preset: "fadeIn", at: "h.enter.end" } },
    ] }]));
    const n = plan.tracks.find((t) => t.ref === "n")!;
    expect(n.t0).toBeCloseTo(1 + 0.5 + 0.1 * 2);
  });

  it("computes auto durations from reading time plus hold", () => {
    const plan = compile(video([{ id: "s", duration: "auto", elements: [
      { id: "h", type: "text", content: "four words right here", enter: { preset: "fadeIn", at: 0.3, duration: 0.5 } },
    ] }]));
    // enter ends 0.8, + 0.5 + 0.3×4 = 2.5, + 0.4 hold = 2.9
    expect(plan.duration).toBeCloseTo(2.9);
  });

  it("stretches auto scenes to hit targetDuration", () => {
    const scene = (id: string) => ({ id, duration: "auto", elements: [{ id: `${id}-t`, type: "text", content: "Hi", enter: { preset: "fadeIn", at: 0.3, duration: 0.5 } }] });
    const plan = compile({ ...video([scene("a"), scene("b")]), video: { format: "9:16", targetDuration: 6 } } as never);
    expect(plan.duration).toBeCloseTo(6);
    expect(plan.report.filter((r) => r.code === "target-unreachable")).toHaveLength(0);
  });

  it("reports when targetDuration can't be reached", () => {
    const plan = compile({ ...video([{ id: "a", duration: "auto", elements: [] }]), video: { targetDuration: 30 } } as never);
    expect(plan.report.some((r) => r.code === "target-unreachable")).toBe(true);
  });

  it("ends exits at the scene end and resolves scene.end expressions", () => {
    const plan = compile(video([{ id: "s", duration: "auto", elements: [
      { id: "h", type: "text", content: "Bye", enter: { preset: "fadeIn", at: 0.3, duration: 0.5 }, exit: { preset: "fadeOut", duration: 0.4 } },
    ] }]));
    const exit = plan.tracks.find((t) => t.label === "fadeOut (exit)")!;
    expect(exit.t1).toBeCloseTo(plan.duration);
  });

  it("resolves cues and timeline item ids", () => {
    const plan = compile(video([{ id: "s", duration: 5, cues: { go: 1.5 }, elements: [
      { id: "a", type: "shape", shape: "rect", layout: { width: 10, height: 10 } },
      { id: "b", type: "shape", shape: "rect", layout: { width: 10, height: 10 } },
    ], timeline: [
      { id: "move", target: "a", at: "cue:go", duration: 1, animate: { x: [0, 100] } },
      { target: "b", at: "move.end+0.25", duration: 1, animate: { x: [0, 100] } },
    ] }]));
    expect(plan.tracks.find((t) => t.ref === "b")!.t0).toBeCloseTo(2.75);
  });

  it("offsets scenes and keeps the outgoing scene visible under the next transition", () => {
    const plan = compile(video([
      { id: "a", duration: 2, elements: [] },
      { id: "b", duration: 2, transition: { type: "crossfade", duration: 0.5 }, elements: [] },
    ]));
    expect(plan.scenes[1]!.start).toBe(2);
    expect(plan.scenes[0]!.visibleUntil).toBeCloseTo(2.5);
  });

  it("times interaction steps by pace", () => {
    const plan = compile(video([{ id: "s", duration: 5, elements: [
      { id: "btn", type: "button", label: "Go" },
      { id: "after", type: "shape", shape: "rect", layout: { width: 1, height: 1 } },
    ], timeline: [
      { behavior: "interaction", at: 1, steps: [{ id: "tap", click: "btn" }] },
      { target: "after", at: "tap.end", duration: 1, animate: { x: 10 } },
    ] }]));
    expect(plan.tracks.find((t) => t.ref === "after")!.t0).toBeCloseTo(1.68);
  });
});

describe("evaluator", () => {
  const plan = compile(video([{ id: "s", duration: 4, elements: [
    { id: "a", type: "text", content: "Hello there", enter: { preset: "fadeUp", at: 1, duration: 1, ease: "linear" } },
  ], timeline: [{ target: "a", at: 2, duration: 1, ease: "linear", animate: { y: [0, -100] } }] }]));

  it("hides elements before their first enter", () => {
    expect(elementFrame(plan, "a", 0.5).visible).toBe(false);
    expect(elementFrame(plan, "a", 1).visible).toBe(true);
  });
  it("interpolates and adds offsets", () => {
    const f = elementFrame(plan, "a", 1.5);
    expect(f.props.opacity).toBeCloseTo(0.5);
    expect(f.props.y).toBeCloseTo(20);
    expect(elementFrame(plan, "a", 2.5).props.y).toBeCloseTo(-50); // fadeUp done (0) + half of −100
  });
  it("is deterministic", () => {
    expect(JSON.stringify(frameAt(plan, 1.234))).toBe(JSON.stringify(frameAt(plan, 1.234)));
  });
  it("describes what is on screen", () => {
    const d = describeAt(plan, 1.5);
    expect(d.elements[0]).toMatchObject({ ref: "a", visible: true });
    expect(d.elements[0]!.animating[0]).toMatch(/fadeUp/);
  });
  it("animates word parts for wordReveal", () => {
    const p = compile(video([{ id: "s", duration: 3, elements: [{ id: "h", type: "text", content: "Two words" }] }]));
    const f = elementFrame(p, "h", 0.3);
    expect(f.parts.filter((x) => x.kind === "word")).toHaveLength(2);
    expect(p.scenes[0]!.elements[0]!.text!.split).toBe("words");
  });
});
