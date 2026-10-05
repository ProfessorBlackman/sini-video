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

describe("interactions", () => {
  const plan = compile(video([{ id: "s", duration: 5, elements: [
    { id: "field", type: "text", content: "Search…" },
    { id: "btn", type: "button", label: "Reserve", states: { done: { label: "Reserved ✓" } } },
  ], timeline: [
    { behavior: "interaction", cursor: "touch", at: 1, steps: [
      { type: "field", text: "Akua" },
      { click: "btn", set: { btn: "done" } },
    ] },
  ] }]));

  it("turns a step's set into a state change at the end of the press", () => {
    // type: move 0.5 + press 0.18 + 4 chars at 12 cps; then click: move 0.5 + press 0.18
    const roll = plan.tracks.find((t) => t.kind === "content" && t.ref === "btn")!;
    expect(roll.t0).toBeCloseTo(1 + 0.68 + 4 / 12 + 0.68, 3);
  });
  it("types text into the field", () => {
    const typed = plan.tracks.find((t) => t.kind === "typed")!;
    expect(typed).toMatchObject({ ref: "field", text: "Akua" });
    expect(elementFrame(plan, "field", typed.t0 + 0.2).typed?.text).toBe("Ak");
  });
  it("moves a cursor between targets and presses", () => {
    const f = (t: number) => frameAt(plan, t).cursors[0]!;
    expect(frameAt(plan, 0.5).cursors).toHaveLength(0);
    expect(f(1.25)).toMatchObject({ from: "bottom-right", to: "field" });
    expect(f(1.6).press).toBeGreaterThan(0);
    expect(f(2.3)).toMatchObject({ from: "field", to: "btn" });
  });
  it("dips the clicked element while pressed", () => {
    const tap = plan.tracks.find((t) => t.kind === "tween" && t.prop === "press" && t.ref === "btn")!;
    expect(elementFrame(plan, "btn", (tap.t0 + tap.t1) / 2).props.press).toBeLessThan(1);
  });
});

describe("device screens and scrolling", () => {
  const plan = compile(video([{ id: "s", duration: 6, elements: [
    { id: "phone", type: "phone", screen: "home", screens: {
      home: [{ id: "go", type: "button", label: "Menu" }],
      menu: { background: "#eeeeee", children: [{ id: "item", type: "text", content: "Jollof" }] },
      cart: [{ id: "c", type: "text", content: "Cart" }],
    } },
  ], timeline: [
    { behavior: "interaction", at: 1, steps: [{ click: "go", navigate: { phone: "menu" } }] },
    { id: "down", behavior: "scroll", target: "phone", to: "item", at: 2.5 },
    { behavior: "navigate", target: "phone", to: "cart", transition: "fade", at: 4 },
  ] }]));
  const screens = plan.tracks.filter((t) => t.kind === "screen");

  it("builds one page per screen", () => {
    expect(plan.scenes[0]!.elements[0]!.pages!.map((p) => p.name)).toEqual(["home", "menu", "cart"]);
  });
  it("turns step and behavior navigation into screen changes, in order", () => {
    expect(screens.map((t) => [t.from, t.to, t.transition])).toEqual([["home", "menu", "push"], ["menu", "cart", "fade"]]);
    expect(screens[0]!.t0).toBeCloseTo(1.68); // end of the press
  });
  it("compiles scrolls with the target element", () => {
    expect(plan.tracks.find((t) => t.kind === "scroll")).toMatchObject({ ref: "phone", to: "item", t0: 2.5 });
  });
  it("hides elements on screens that aren't showing", () => {
    const at = (t: number) => Object.fromEntries(describeAt(plan, t).elements.map((e) => [e.ref, e.visible]));
    expect(at(0.5)).toMatchObject({ go: true, item: false, c: false });
    expect(at(1.9)).toMatchObject({ go: true, item: true }); // mid-push: both
    expect(at(3)).toMatchObject({ go: false, item: true, c: false });
    expect(at(5)).toMatchObject({ item: false, c: true });
  });
});

describe("toast and progress", () => {
  const plan = compile(video([{ id: "s", duration: 5, elements: [
    { id: "toast", type: "toast", icon: "loader", title: "Exporting…", states: { done: { icon: "check", title: "Exported", body: "INV-1.pdf" } } },
    { id: "track", type: "progress", steps: ["A", "B", "C"], value: 0 },
  ], timeline: [
    { target: "toast", state: "done", at: 1 },
    { target: "track", at: 2, duration: 1, ease: "linear", animate: { value: 2 } },
  ] }]));

  it("rolls the toast's title and body and swaps its icon", () => {
    const f = elementFrame(plan, "toast", 1.2);
    expect(f.contents?.title).toMatchObject({ from: "Exporting…", to: "Exported" });
    expect(f.contents?.body).toMatchObject({ from: "", to: "INV-1.pdf" });
    expect(f.steps?.icon).toBe("check");
    expect(elementFrame(plan, "toast", 0.5).steps?.icon).toBeUndefined();
  });
  it("counts toast text for reading time", () => {
    expect(plan.reading.find((r) => r.ref === "toast")?.words).toBe(1);
  });
  it("animates progress value from its declared start", () => {
    expect(elementFrame(plan, "track", 1).props.value).toBe(0);
    expect(elementFrame(plan, "track", 2.5).props.value).toBeCloseTo(1);
    expect(elementFrame(plan, "track", 4).props.value).toBeCloseTo(2);
  });
});

describe("charts", () => {
  it("formats numbers with templates", async () => {
    const { formatNumber } = await import("./index.js");
    expect(formatNumber(4500, "GH₵ 0,0")).toBe("GH₵ 4,500");
    expect(formatNumber(46, "0%")).toBe("46%");
    expect(formatNumber(3.14159, "0.0")).toBe("3.1");
    expect(formatNumber(12480, undefined)).toBe("12,480");
    expect(formatNumber(950, undefined)).toBe("950");
  });

  const plan = compile(video([{ id: "s", duration: 5, elements: [
    { id: "c", type: "chart", kind: "bar", data: [["A", 10], ["B", 20], ["C", 40]], enter: { preset: "grow", at: 1, duration: 0.5, stagger: 0.2, ease: "linear" } },
    { id: "after", type: "shape", shape: "rect", enter: { preset: "fadeIn", at: "c.enter.end" } },
  ], timeline: [{ target: "c#B", preset: "pulse", at: 2 }] }]));

  it("grows each bar in turn; enter.end waits for the last bar", () => {
    const parts = elementFrame(plan, "c", 1.35).parts.filter((p) => p.kind === "bar");
    expect(parts.map((p) => Math.round(p.props.grow! * 10) / 10)).toEqual([0.7, 0.3, 0]);
    expect(plan.tracks.find((t) => t.ref === "after")!.t0).toBeCloseTo(1 + 0.5 + 0.2 * 2);
  });
  it("animates a single bar with a preset", () => {
    expect(plan.tracks.some((t) => t.ref === "c#B" && t.kind === "pulse")).toBe(true);
    expect(frameAt(plan, 2.2).elements["c#B"]?.props.scale).toBeGreaterThan(1);
  });
});

describe("camera and matchCut", () => {
  const plan = compile(video([
    { id: "a", duration: 4, elements: [
      { id: "stage", type: "group", layout: { width: 1080, height: 1920 }, children: [{ id: "dot", type: "shape", shape: "circle", layout: { x: 100, y: 100, width: 50, height: 50 } }] },
      { id: "card", type: "shape", shape: "rect", layout: { x: 200, y: 900, width: 300, height: 400 } },
    ], timeline: [{ behavior: "camera", target: "stage", ease: "linear", keys: [{ at: 1, focus: "center", zoom: 1 }, { at: 2, focus: "dot", zoom: 3 }] }] },
    { id: "b", duration: 2, transition: { type: "matchCut", from: "card", to: "background", duration: 0.6 }, elements: [] },
  ]));

  it("interpolates camera keys and holds before the first and after the last", () => {
    const cam = (t: number) => elementFrame(plan, "stage", t).camera!;
    expect(cam(0.5)).toMatchObject({ from: { focus: "center", zoom: 1 }, p: 1 });
    expect(cam(1.5)).toMatchObject({ from: { focus: "center" }, to: { focus: "dot", zoom: 3 } });
    expect(cam(1.5).p).toBeCloseTo(0.5);
    expect(cam(3).to).toMatchObject({ focus: "dot", zoom: 3 });
  });
  it("keeps matchCut with its elements", () => {
    expect(plan.scenes[1]!.transition).toMatchObject({ type: "matchCut", matchFrom: "card", matchTo: "background", duration: 0.6 });
  });
});

describe("focusCycle", () => {
  const plan = compile(video([{ id: "s", duration: 6, elements: [
    { id: "a", type: "shape", shape: "rect", layout: { width: 10, height: 10 } },
    { id: "b", type: "shape", shape: "rect", layout: { width: 10, height: 10 } },
    { id: "c", type: "shape", shape: "rect", layout: { width: 10, height: 10 } },
    { id: "after", type: "shape", shape: "rect", enter: { preset: "fadeIn", at: "cycle.end" } },
  ], timeline: [{ id: "cycle", behavior: "focusCycle", targets: ["a", "b", "c"], at: 1, interval: 1, dim: 0.3, scale: 1.1 }] }]));
  const p = (ref: string, t: number) => elementFrame(plan, ref, t).props;

  it("highlights each target in turn and dims the rest", () => {
    expect(p("a", 1.5)).toMatchObject({ focusScale: 1.1, dim: 1 });
    expect(p("b", 1.5).dim).toBeCloseTo(0.3);
    expect(p("b", 2.5)).toMatchObject({ focusScale: 1.1, dim: 1 });
    expect(p("a", 2.5)).toMatchObject({ focusScale: 1 });
    expect(p("a", 2.5).dim).toBeCloseTo(0.3);
  });
  it("returns everything to normal after the last target; end = at + interval × count", () => {
    expect(p("a", 4.5)).toMatchObject({ dim: 1, focusScale: 1 });
    expect(p("c", 4.5)).toMatchObject({ dim: 1, focusScale: 1 });
    expect(plan.tracks.find((t) => t.ref === "after")!.t0).toBeCloseTo(4);
  });
  it("is reported by describe_at", () => {
    const d = describeAt(plan, 2.5).elements;
    expect(d.find((e) => e.ref === "b")?.highlighted).toBe(true);
    expect(d.find((e) => e.ref === "a")?.opacity).toBeCloseTo(0.3);
  });
});

describe("transition defaults", () => {
  it("uses eases that start moving at once", () => {
    const p = compile({ version: "0.4", video: { format: "1:1" }, scenes: [
      { id: "a", duration: 1, elements: [] },
      { id: "b", duration: 1, transition: "wipe", elements: [] },
      { id: "c", duration: 1, transition: { type: "slide" }, elements: [] },
    ] } as never);
    expect(p.scenes[1]!.transition!.ease).toBe("quart.out");
    expect(p.scenes[2]!.transition!.ease).toBe("cubic.inOut");
  });
});

describe("targetDuration warnings", () => {
  it("say which scenes the time goes to", () => {
    const p = compile({ version: "0.4", video: { format: "1:1", targetDuration: 3 }, scenes: [
      { id: "long", duration: 6, elements: [] },
      { id: "short", duration: "auto", elements: [{ id: "t", type: "text", content: "Hello there" }] },
    ] } as never);
    const w = p.report.find((r) => r.code === "target-unreachable")!;
    expect(w.message).toContain("long 6.0s (fixed)");
    expect(w.message).toMatch(/short [\d.]+s \(auto, at its limit\)/);
  });
});
