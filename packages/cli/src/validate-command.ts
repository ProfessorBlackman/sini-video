import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateFull } from "@sini/api";
import type { Issue } from "@sini/schema";

/** A path to a project folder (containing video.json) or directly to a spec file. */
export function specPath(target: string): string {
  return statSync(target).isDirectory() ? join(target, "video.json") : target;
}

export function formatIssue(i: Issue): string {
  const tag = i.level === "error" ? "✗" : "!";
  return `${tag} ${i.path}: ${i.message}${i.suggestion ? `  ${i.suggestion}` : ""}  [${i.code}]${i.fix ? " (auto-fix)" : ""}`;
}

export function runValidate(target: string, opts: { json?: boolean }): number {
  const file = specPath(target);
  let spec: unknown;
  try {
    spec = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    const issue: Issue = { level: "error", path: "$", code: "invalid-json", message: `${file}: ${(e as Error).message}` };
    console.log(opts.json ? JSON.stringify({ ok: false, issues: [issue] }, null, 2) : formatIssue(issue));
    return 1;
  }
  // The full check: schema, asset files and icon names, the same as every other command.
  const result = validateFull(spec as never, dirname(file));
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    const s = result.stats;
    console.log(`✓ Valid Sini video: ${s.scenes} scenes, ${s.elements} elements, ${s.timelineItems} timeline items, ${s.assets} assets`);
    for (const i of result.issues) console.log(formatIssue(i));
  } else {
    for (const i of result.issues) console.log(formatIssue(i));
    const n = result.issues.filter((i) => i.level === "error").length;
    console.log(`\n${n} error${n === 1 ? "" : "s"}.`);
  }
  return result.ok ? 0 : 1;
}
