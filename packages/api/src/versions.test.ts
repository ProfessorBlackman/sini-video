import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyOps, initProject, listVersions, patchProject, restoreVersion, SiniError, validateSpec } from "./index.js";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "sini-proj-"));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("projects and versions", () => {
  it("creates a valid starter project with version 1", () => {
    const d = tmp();
    const r = initProject(d);
    expect(r.version.version).toBe(1);
    expect(JSON.parse(readFileSync(join(d, "video.json"), "utf8")).version).toBe("0.4");
    expect(() => initProject(d)).toThrow(SiniError);
  });

  it("patches by id, saves versions, and restores", () => {
    const d = tmp();
    initProject(d);
    patchProject(d, [{ op: "set", path: "headline.style.size", value: 180 }]);
    patchProject(d, [{ op: "add", scene: "intro", after: "headline", element: { id: "kicker", type: "text", content: "New" } }]);
    expect(listVersions(d).map((v) => v.version)).toEqual([1, 2, 3]);
    const spec = JSON.parse(readFileSync(join(d, "video.json"), "utf8"));
    expect(spec.scenes[0].elements[0].style.size).toBe(180);
    expect(spec.scenes[0].elements[1].id).toBe("kicker");
    restoreVersion(d, 1);
    const restored = JSON.parse(readFileSync(join(d, "video.json"), "utf8"));
    expect(restored.scenes[0].elements).toHaveLength(1);
    expect(listVersions(d).at(-1)?.message).toBe("restore v1");
  });

  it("refuses patches that make the spec invalid, and saves nothing", () => {
    const d = tmp();
    initProject(d);
    expect(() => patchProject(d, [{ op: "set", path: "headline.enter", value: "wordreveal" }])).toThrow(/errors/);
    expect(listVersions(d)).toHaveLength(1);
  });
});

describe("patch operations", () => {
  const spec = () => ({
    version: "0.4", video: {}, scenes: [
      { id: "a", duration: 2, elements: [{ id: "x", type: "text", content: "x" }, { id: "st", type: "stack", children: [{ id: "y", type: "text", content: "y" }] }] },
      { id: "b", duration: 2, elements: [] },
    ],
  }) as never;

  it("sets root and nested paths", () => {
    const s = applyOps(spec(), [{ op: "set", path: "video.format", value: "1:1" }, { op: "set", path: "y.style.color", value: "#fff" }]) as any;
    expect(s.video.format).toBe("1:1");
    expect(s.scenes[0].elements[1].children[0].style.color).toBe("#fff");
  });
  it("moves, removes and adds scenes and timeline items", () => {
    const s = applyOps(spec(), [
      { op: "move", id: "y", scene: "b" },
      { op: "remove", id: "x" },
      { op: "addScene", after: "a", scene: { id: "mid", duration: 1, elements: [] } },
      { op: "addTimeline", scene: "b", item: { target: "y", preset: "fadeIn" } },
    ]) as any;
    expect(s.scenes.map((x: any) => x.id)).toEqual(["a", "mid", "b"]);
    expect(s.scenes[2].elements[0].id).toBe("y");
    expect(s.scenes[0].elements.map((e: any) => e.id)).toEqual(["st"]);
    expect(s.scenes[2].timeline).toHaveLength(1);
  });
  it("explains unknown ids", () => {
    expect(() => applyOps(spec(), [{ op: "set", path: "nope.style.size", value: 1 }])).toThrow(/No scene, element or timeline item with id 'nope'/);
  });
});

describe("icon validation on every write", () => {
  it("rejects unknown icon names with a suggestion, and accepts Lucide aliases", () => {
    const d = tmp();
    initProject(d);
    expect(() => patchProject(d, [{ op: "add", scene: "intro", element: { id: "i", type: "icon", name: "chek" } }])).toThrow(SiniError);
    try {
      patchProject(d, [{ op: "add", scene: "intro", element: { id: "i", type: "icon", name: "chek" } }]);
    } catch (e) {
      expect((e as SiniError).issues[0]?.suggestion).toBe("Did you mean 'check'?");
    }
    patchProject(d, [{ op: "add", scene: "intro", element: { id: "i", type: "icon", name: "check-circle" } }]);
    expect(listVersions(d)).toHaveLength(2);
  });
});

describe("icons inside components", () => {
  const spec = (icon: string) => ({
    version: "0.4", video: { format: "1:1" },
    components: { row: { params: { icon: "car" }, root: { id: "r", type: "stack", children: [{ id: "i", type: "icon", name: "{{icon}}" }] } } },
    scenes: [{ id: "s", duration: 2, elements: [
      { id: "a", use: "row", with: { icon }, layout: { anchor: "center" } },
      { id: "b", use: "row", layout: { anchor: "top" } },
    ] }],
  });
  it("checks {{param}} icon names per instance, after substitution", () => {
    expect(validateSpec(spec("bike")).ok).toBe(true);
    const bad = validateSpec(spec("bikee"));
    expect(bad.ok).toBe(false);
    expect(bad.issues[0]).toMatchObject({ path: "scenes[0].elements[0].with", code: "unknown-icon", suggestion: "Did you mean 'bike'?" });
  });
});

describe("patch paths by position", () => {
  it("warn when an index reaches an item that has an id", () => {
    const d = tmp();
    initProject(d);
    const r = patchProject(d, [{ op: "set", path: "intro.elements[0].style.size", value: 120 }]);
    expect(r.issues[0]).toMatchObject({ code: "index-path", suggestion: "Use 'headline.style.size' instead." });
    expect(patchProject(d, [{ op: "set", path: "headline.style.size", value: 130 }]).issues.filter((i) => i.code === "index-path")).toEqual([]);
  });
  it("don't suggest ids inside component definitions, which patches can't address", () => {
    const d = tmp();
    initProject(d);
    patchProject(d, [{ op: "set", path: "components", value: { perk: { params: { text: "" }, root: { id: "row", type: "stack", children: [{ id: "t", type: "text", content: "{{text}}" }] } } } }]);
    const r = patchProject(d, [{ op: "set", path: "components.perk.root.children[0].style", value: { size: 80 } }]);
    expect(r.issues.filter((i) => i.code === "index-path")).toEqual([]);
  });
});

describe("patches from the 0.1.4 re-test", () => {
  it("add inside a parent without naming the scene, and set lint.accept", () => {
    const d = tmp();
    initProject(d);
    patchProject(d, [{ op: "add", scene: "intro", element: { id: "box", type: "stack", children: [] } }]);
    patchProject(d, [{ op: "add", parent: "box", element: { id: "inner", type: "text", content: "Hi" } }]);
    patchProject(d, [{ op: "set", path: "lint.accept", value: [{ code: "tiny-text", reason: "Decorative" }] }]);
    const spec = JSON.parse(readFileSync(join(d, "video.json"), "utf8"));
    expect(spec.scenes[0].elements.find((e: { id: string }) => e.id === "box").children[0].id).toBe("inner");
    expect(spec.lint.accept[0].code).toBe("tiny-text");
    expect(() => patchProject(d, [{ op: "add", element: { id: "lost", type: "text", content: "?" } }])).toThrow(/Say where/);
  });
});
