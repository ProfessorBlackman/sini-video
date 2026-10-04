import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyOps, initProject, listVersions, patchProject, restoreVersion, SiniError } from "./index.js";

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
