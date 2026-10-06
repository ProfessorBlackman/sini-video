import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { compile, type CompiledPlan } from "@sini/core";
import { didYouMean, expandComponent, validate, type Issue, type Spec, type ValidationResult } from "@sini/schema";
import { iconNames } from "@sini/render";
import { cachedFontFaces } from "./fonts.js";
import { cachedTextHotspots } from "./ocr.js";

export class SiniError extends Error {
  constructor(message: string, public issues: Issue[] = []) {
    super(message);
  }
}

export interface Loaded {
  /** Absolute path of the spec file. */
  file: string;
  /** Absolute path of the project folder (where asset paths are resolved). */
  dir: string;
  spec: Spec;
}

/** Resolve a project folder or spec file to its spec file. */
export function specFile(target = "."): string {
  const abs = resolve(target);
  return existsSync(abs) && statSync(abs).isDirectory() ? join(abs, "video.json") : abs;
}

export function load(target = "."): Loaded {
  const file = specFile(target);
  if (!existsSync(file)) throw new SiniError(`No video spec at ${file}. Create one first (create_video through MCP, or 'sini init').`);
  let spec: Spec;
  try {
    spec = JSON.parse(readFileSync(file, "utf8")) as Spec;
  } catch (e) {
    throw new SiniError(`${file} isn't valid JSON: ${(e as Error).message}`, [
      { level: "error", path: "$", code: "invalid-json", message: (e as Error).message },
    ]);
  }
  return { file, dir: dirname(file), spec };
}

export function check(target = "."): ValidationResult & { file: string } {
  const { file, dir, spec } = load(target);
  return { ...validateFull(spec, dir), file };
}

export function compileSpec(spec: Spec, dir: string): CompiledPlan {
  return compile(spec, { projectDir: dir, exists: (p) => existsSync(p), resolvePath: (d, rel) => resolve(d, rel), textHotspots: cachedTextHotspots(spec, dir), fontFaces: cachedFontFaces(spec, dir) });
}

/** Asset files must live inside the project folder (no ../ escapes, no absolute paths elsewhere). */
export function assetPathIssues(spec: Spec, dir: string): Issue[] {
  const issues: Issue[] = [];
  const root = resolve(dir);
  const check = (src: unknown, path: string) => {
    if (typeof src !== "string") return;
    const abs = resolve(root, src);
    if (abs !== root && !abs.startsWith(root + sep)) {
      issues.push({ level: "error", path, code: "asset-outside-project", message: `Asset '${src}' is outside the project folder.`, suggestion: "Copy the file into the project (e.g. assets/) and use a relative path." });
    }
  };
  for (const [id, a] of Object.entries((spec.assets ?? {}) as Record<string, any>)) {
    if (typeof a === "string") check(a, `assets.${id}`);
    else if (a && typeof a === "object") {
      check(a.src, `assets.${id}.src`);
      if (a.fallback && typeof a.fallback === "object") check(a.fallback.src, `assets.${id}.fallback.src`);
      else check(a.fallback, `assets.${id}.fallback`);
    }
  }
  return issues;
}

/** Schema validation plus the checks that need the filesystem or bundled data (asset paths, icon names). */
export function validateFull(spec: Spec, dir: string): ValidationResult {
  const result = validate(spec);
  result.issues.push(...assetPathIssues(spec, dir), ...iconIssues(spec));
  result.ok = !result.issues.some((i) => i.level === "error");
  return result;
}

/** Validate a spec that isn't in a project folder (no asset files to check): schema plus icon names. */
export function validateSpec(spec: unknown): ValidationResult {
  const result = validate(spec);
  if (result.ok) result.issues.push(...iconIssues(spec as Spec));
  result.ok = !result.issues.some((i) => i.level === "error");
  return result;
}

/** Icon names must exist in the bundled Lucide set. */
export function iconIssues(spec: Spec): Issue[] {
  const issues: Issue[] = [];
  const known = iconNames();
  const visit = (els: any[], path: string) => {
    (els ?? []).forEach((e: any, i: number) => {
      if (!e || typeof e !== "object") return;
      const p = `${path}[${i}]`;
      const check = (name: unknown, at: string) => {
        // `{{param}}` names are checked per instance, once the component is expanded.
        if (typeof name === "string" && !name.includes("{{") && !known.has(name)) {
          issues.push({ level: "error", path: at, code: "unknown-icon", message: `Unknown icon '${name}'.`, suggestion: didYouMean(name, known) ?? "Use a Lucide icon name (lucide.dev/icons)." });
        }
      };
      if (e.type === "icon") check(e.name, `${p}.name`);
      if (e.type === "toast") check(e.icon, `${p}.icon`);
      for (const [sn, st] of Object.entries<any>(e.states ?? {})) check(st?.icon, `${p}.states.${sn}.icon`);
      if (typeof e.use === "string" && spec.components?.[e.use]) {
        const expanded = expandComponent(spec.components[e.use], e.with);
        for (const is of iconIssues({ scenes: [{ elements: [expanded] }] } as unknown as Spec)) {
          issues.push({ ...is, path: `${p}.with`, message: `${is.message.replace(/\.$/, "")} (in component '${e.use}').` });
        }
      }
      visit(e.children, `${p}.children`);
      visit(e.overlay, `${p}.overlay`);
      for (const [n, pg] of Object.entries<any>(e.screens ?? {})) visit(Array.isArray(pg) ? pg : pg?.children, `${p}.screens.${n}`);
    });
  };
  (spec.scenes ?? []).forEach((s: any, i: number) => visit(s?.elements, `scenes[${i}].elements`));
  for (const [name, c] of Object.entries<any>(spec.components ?? {})) visit([c?.root], `components.${name}.root`);
  return issues;
}

/** Load, validate and compile. Throws SiniError with the issues if the spec is invalid. */
export function plan(target = "."): { loaded: Loaded; plan: CompiledPlan; validation: ValidationResult } {
  const loaded = load(target);
  const validation = validateFull(loaded.spec, loaded.dir);
  if (!validation.ok) throw new SiniError("The video spec has errors; run validate for details.", validation.issues);
  return { loaded, plan: compileSpec(loaded.spec, loaded.dir), validation };
}
