import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  const { file, spec } = load(target);
  return { ...validate(spec), file };
}

export function compileSpec(spec: Spec, dir: string): CompiledPlan {
  return compile(spec, { projectDir: dir, exists: (p) => existsSync(p), resolvePath: (d, rel) => resolve(d, rel) });
}

/** Load, validate and compile. Throws SiniError with the issues if the spec is invalid. */
export function plan(target = "."): { loaded: Loaded; plan: CompiledPlan; validation: ValidationResult } {
  const loaded = load(target);
  const validation = validate(loaded.spec);
  if (!validation.ok) throw new SiniError("The video spec has errors; run validate for details.", validation.issues);
  return { loaded, plan: compileSpec(loaded.spec, loaded.dir), validation };
}
