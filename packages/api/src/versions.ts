/**
 * Project folders, versions and patches.
 *
 *   my-video/
 *   ├── video.json        current spec
 *   ├── versions/         v0001.json, v0002.json, … (immutable) + log.json
 *   ├── assets/
 *   └── out/              renders, frames, contact sheets
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Issue, Spec } from "@sini/schema";
import { load, SiniError, specFile, validateFull } from "./project.js";

type J = any;

export interface VersionInfo {
  version: number;
  time: string;
  message: string;
}

const STARTER: Spec = {
  version: "0.4",
  video: { format: "9:16", fps: 30 },
  theme: {
    palette: { ink: "#141414", paper: "#F5F2EC", accent: "#E4572E" },
    fonts: { display: "Instrument Serif", body: "Inter Tight" },
    motion: "editorial",
    transition: { type: "crossfade", duration: 0.5 },
  },
  scenes: [
    {
      id: "intro",
      duration: "auto",
      background: "ink",
      elements: [
        { id: "headline", type: "text", role: "display", content: "Hello,\n*world.*", style: { color: "paper" }, layout: { anchor: "center" } } as never,
      ],
    },
  ],
};

function versionsDir(dir: string): string {
  return join(dir, "versions");
}

function readLog(dir: string): VersionInfo[] {
  const f = join(versionsDir(dir), "log.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as VersionInfo[]) : [];
}

export function listVersions(target = "."): VersionInfo[] {
  const dir = projectDir(target);
  return readLog(dir);
}

export function projectDir(target = "."): string {
  return resolve(specFile(target), "..");
}

/** Write the spec to video.json and record it as a new version. */
export function saveVersion(dir: string, spec: Spec, message: string): VersionInfo {
  const vd = versionsDir(dir);
  mkdirSync(vd, { recursive: true });
  const log = readLog(dir);
  const existing = readdirSync(vd).filter((f) => /^v\d{4}\.json$/.test(f)).length;
  const version = Math.max(existing, log.at(-1)?.version ?? 0) + 1;
  const json = `${JSON.stringify(spec, null, 2)}\n`;
  writeFileSync(join(vd, `v${String(version).padStart(4, "0")}.json`), json);
  writeFileSync(join(dir, "video.json"), json);
  const info = { version, time: new Date().toISOString(), message };
  log.push(info);
  writeFileSync(join(vd, "log.json"), `${JSON.stringify(log, null, 2)}\n`);
  return info;
}

/** Create a project folder. Uses `spec` if given, otherwise a small starter video. */
export function initProject(dir: string, opts: { spec?: Spec; force?: boolean } = {}): { dir: string; version: VersionInfo; issues: Issue[] } {
  const abs = resolve(dir);
  if (existsSync(join(abs, "video.json")) && !opts.force) throw new SiniError(`${abs} already has a video.json. Use update/patch, or --force to overwrite.`);
  const spec = opts.spec ?? STARTER;
  const v = validateFull(spec, abs);
  if (!v.ok) throw new SiniError("The spec has errors; nothing was written.", v.issues);
  mkdirSync(join(abs, "assets"), { recursive: true });
  writeFileSync(join(abs, ".gitignore"), "out/\n");
  return { dir: abs, version: saveVersion(abs, spec, opts.spec ? "create" : "create (starter)"), issues: v.issues };
}

/** Record the current video.json as a version (after editing it directly). */
export function snapshot(target = ".", message = "snapshot"): VersionInfo {
  const { dir, spec } = load(target);
  const v = validateFull(spec, dir);
  if (!v.ok) throw new SiniError("The spec has errors; fix them before saving a version.", v.issues);
  return saveVersion(dir, spec, message);
}

/** Replace the whole spec (validated), as a new version. */
export function replaceSpec(target: string, spec: Spec, message = "update"): { version: VersionInfo; issues: Issue[] } {
  const dir = projectDir(target);
  const v = validateFull(spec, dir);
  if (!v.ok) throw new SiniError("The spec has errors; nothing was saved.", v.issues);
  return { version: saveVersion(dir, spec, message), issues: v.issues };
}

export function restoreVersion(target: string, version: number): VersionInfo {
  const dir = projectDir(target);
  const f = join(versionsDir(dir), `v${String(version).padStart(4, "0")}.json`);
  if (!existsSync(f)) throw new SiniError(`Version ${version} doesn't exist. Versions: ${readLog(dir).map((v) => v.version).join(", ") || "none"}.`);
  return saveVersion(dir, JSON.parse(readFileSync(f, "utf8")) as Spec, `restore v${version}`);
}

export function readVersion(target: string, version: number): Spec {
  const f = join(versionsDir(projectDir(target)), `v${String(version).padStart(4, "0")}.json`);
  if (!existsSync(f)) throw new SiniError(`Version ${version} doesn't exist.`);
  return JSON.parse(readFileSync(f, "utf8")) as Spec;
}

// ---------------------------------------------------------------- patches

export type PatchOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "remove"; id?: string; path?: string }
  | { op: "add"; scene?: string; element: J; after?: string; before?: string; parent?: string }
  | { op: "move"; id: string; scene?: string; after?: string; before?: string; parent?: string }
  | { op: "addScene"; scene: J; after?: string; before?: string }
  | { op: "addTimeline"; scene: string; item: J };

interface Found {
  obj: J;
  /** The array that holds it, and its index (for remove / insert). */
  list?: J[];
  index?: number;
}

/** Find the object with a given id anywhere: scenes, elements (incl. children, pages, overlays), timeline items, steps. */
function findById(spec: J, id: string): Found | undefined {
  const visitList = (list: J[] | undefined): Found | undefined => {
    if (!Array.isArray(list)) return undefined;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o && typeof o === "object") {
        if (o.id === id) return { obj: o, list, index: i };
        const inner = visitElement(o);
        if (inner) return inner;
      }
    }
    return undefined;
  };
  const visitElement = (e: J): Found | undefined => {
    const lists: J[][] = [e.children, e.overlay, e.elements, e.timeline, e.steps];
    for (const page of Object.values<J>(e.screens ?? {})) lists.push(Array.isArray(page) ? page : page?.children);
    for (const l of lists) {
      const f = visitList(l);
      if (f) return f;
    }
    return undefined;
  };
  return visitList(spec.scenes);
}

const ROOT_KEYS = new Set(["version", "video", "theme", "assets", "components", "scenes", "notes", "lint"]);

function setPath(spec: J, path: string, value: unknown) {
  // Accept both "timeline.3.at" and "timeline[3].at".
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let obj: J;
  let rest: string[];
  if (ROOT_KEYS.has(parts[0]!)) {
    obj = spec;
    rest = parts;
  } else {
    // Component paths ("ama/name") aren't patchable directly: patch the instance's `with` or the component.
    const found = findById(spec, parts[0]!);
    if (!found) throw new SiniError(`No scene, element or timeline item with id '${parts[0]}'.`);
    obj = found.obj;
    rest = parts.slice(1);
  }
  if (rest.length === 0) throw new SiniError(`Path '${path}' needs a property after the id, e.g. '${path}.style.size'.`);
  for (let i = 0; i < rest.length - 1; i++) {
    const k = rest[i]!;
    const key = Array.isArray(obj) ? Number(k) : k;
    if (obj[key] === undefined || obj[key] === null || typeof obj[key] !== "object") obj[key] = /^\d+$/.test(rest[i + 1]!) ? [] : {};
    obj = obj[key];
  }
  const last = rest.at(-1)!;
  const key = Array.isArray(obj) ? Number(last) : last;
  if (value === null) {
    if (Array.isArray(obj)) obj.splice(key as number, 1);
    else delete obj[key];
  } else obj[key] = value;
}

function sceneById(spec: J, id: string): J {
  const s = (spec.scenes ?? []).find((x: J) => x.id === id);
  if (!s) throw new SiniError(`No scene '${id}'.`);
  return s;
}

/** Insert next to `after`/`before`, inside `parent`, or at the end of `scene` (needed only for that last case). */
function insert(spec: J, scene: J | null, el: J, where: { after?: string; before?: string; parent?: string }) {
  if (!scene && !where.parent && !where.after && !where.before) throw new SiniError('Say where: "scene", "parent", "after" or "before".');
  let list: J[] = scene?.elements;
  if (where.parent) {
    const p = findById(spec, where.parent);
    if (!p) throw new SiniError(`No element '${where.parent}' to add into.`);
    p.obj.children ??= [];
    list = p.obj.children;
  }
  const anchor = where.after ?? where.before;
  if (anchor) {
    const f = findById(spec, anchor);
    if (!f?.list) throw new SiniError(`No element '${anchor}' to insert next to.`);
    f.list.splice(f.index! + (where.after ? 1 : 0), 0, el);
    return;
  }
  list.push(el);
}

/** Apply patch operations to a copy of the spec. Throws SiniError on a bad operation. */
export function applyOps(spec: Spec, ops: PatchOp[]): Spec {
  const s: J = structuredClone(spec);
  ops.forEach((op, i) => {
    try {
      switch (op.op) {
        case "set":
          setPath(s, op.path, op.value);
          break;
        case "remove": {
          if (op.path) {
            setPath(s, op.path, null);
            break;
          }
          const f = findById(s, op.id!);
          if (!f?.list) throw new SiniError(`No scene, element or timeline item with id '${op.id}'.`);
          f.list.splice(f.index!, 1);
          break;
        }
        case "add":
          insert(s, op.scene ? sceneById(s, op.scene) : null, op.element, op);
          break;
        case "move": {
          const f = findById(s, op.id);
          if (!f?.list) throw new SiniError(`No element '${op.id}'.`);
          const [el] = f.list.splice(f.index!, 1);
          insert(s, op.scene ? sceneById(s, op.scene) : null, el, op);
          break;
        }
        case "addScene": {
          const anchor = op.after ?? op.before;
          const idx = anchor ? s.scenes.findIndex((x: J) => x.id === anchor) : s.scenes.length - 1;
          if (anchor && idx < 0) throw new SiniError(`No scene '${anchor}'.`);
          s.scenes.splice(op.before ? idx : idx + 1, 0, op.scene);
          break;
        }
        case "addTimeline": {
          const sc = sceneById(s, op.scene);
          sc.timeline ??= [];
          sc.timeline.push(op.item);
          break;
        }
        default:
          throw new SiniError(`Unknown op '${(op as J).op}'. Use set, remove, add, move, addScene or addTimeline.`);
      }
    } catch (e) {
      if (e instanceof SiniError) throw new SiniError(`Patch operation ${i} (${(op as J).op}): ${e.message}`, e.issues);
      throw e;
    }
  });
  return s;
}

/** Paths that reach an item with an id by position ("intro.elements[2].style"): positions shift, ids don't. */
function indexPathNotes(spec: Spec, ops: PatchOp[]): Issue[] {
  const notes: Issue[] = [];
  ops.forEach((op, i) => {
    const path = "path" in op && typeof op.path === "string" ? op.path : undefined;
    if (!path) return;
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    let obj: J = ROOT_KEYS.has(parts[0]!) ? spec : findById(spec, parts[0]!)?.obj;
    const rest = ROOT_KEYS.has(parts[0]!) ? parts : parts.slice(1);
    for (let k = 0; k < rest.length && obj && typeof obj === "object"; k++) {
      obj = Array.isArray(obj) ? obj[Number(rest[k])] : obj[rest[k]!];
      // Only when the id path would reach the same item (ids inside component definitions aren't addressable).
      if (/^\d+$/.test(rest[k]!) && obj && typeof obj === "object" && typeof obj.id === "string" && findById(spec, obj.id)?.obj === obj) {
        const tail = rest.slice(k + 1).join(".");
        notes.push({ level: "warning", path: `patch[${i}]`, code: "index-path", message: `'${path}' reaches '${obj.id}' by position; positions shift when items are added or removed.`, suggestion: `Use '${obj.id}${tail ? `.${tail}` : ""}' instead.` });
        break;
      }
    }
  });
  return notes;
}

/** Apply a patch to the project; validates and saves a new version. Nothing is saved if the result is invalid. */
export function patchProject(target: string, ops: PatchOp[], message?: string): { version: VersionInfo; issues: Issue[] } {
  const { dir, spec } = load(target);
  if (!Array.isArray(ops)) throw new SiniError("A patch is a list of operations.");
  const notes = indexPathNotes(spec, ops);
  const next = applyOps(spec, ops);
  const v = validateFull(next, dir);
  if (!v.ok) throw new SiniError("The patched spec has errors; nothing was saved.", v.issues);
  return { version: saveVersion(dir, next, message ?? `patch (${ops.map((o) => o.op).join(", ")})`), issues: [...notes, ...v.issues] };
}
