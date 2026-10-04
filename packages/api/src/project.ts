import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { compile, type CompiledPlan } from "@sini/core";
import { validate, type Issue, type Spec, type ValidationResult } from "@sini/schema";

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
  if (!existsSync(file)) throw new SiniError(`No video spec at ${file}. Create one with 'sini init'.`);
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
  const result = validate(spec);
  result.issues.push(...assetPathIssues(spec, dir));
  result.ok = !result.issues.some((i) => i.level === "error");
  return { ...result, file };
}

export function compileSpec(spec: Spec, dir: string): CompiledPlan {
  return compile(spec, { projectDir: dir, exists: (p) => existsSync(p), resolvePath: (d, rel) => resolve(d, rel) });
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

/** Load, validate and compile. Throws SiniError with the issues if the spec is invalid. */
export function plan(target = "."): { loaded: Loaded; plan: CompiledPlan; validation: ValidationResult } {
  const loaded = load(target);
  const validation = validate(loaded.spec);
  validation.issues.push(...assetPathIssues(loaded.spec, loaded.dir));
  validation.ok = !validation.issues.some((i) => i.level === "error");
  if (!validation.ok) throw new SiniError("The video spec has errors; run validate for details.", validation.issues);
  return { loaded, plan: compileSpec(loaded.spec, loaded.dir), validation };
}
