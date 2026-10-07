/** The projects in a folder (each a subfolder with a video.json), and deleting one. */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { SiniError } from "./project.js";
import { listVersions } from "./versions.js";

export interface ProjectInfo { name: string; versions: number; changed: string; outputs: string[] }

/** Projects up to two folders deep under root, most recently changed first. */
export function listProjects(root: string): ProjectInfo[] {
  const out: ProjectInfo[] = [];
  const visit = (dir: string, rel: string, depth: number) => {
    if (existsSync(join(dir, "video.json"))) {
      const vs = listVersions(dir);
      const outDir = join(dir, "out");
      const outputs = existsSync(outDir) ? readdirSync(outDir).filter((f) => /\.mp4$/.test(f) || f === "sheet.png").map((f) => `out/${f}`) : [];
      out.push({ name: rel || ".", versions: vs.length, changed: (vs.at(-1)?.time ?? statSync(join(dir, "video.json")).mtime.toISOString()), outputs });
      return;
    }
    if (depth >= 2) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") visit(join(dir, e.name), rel ? `${rel}/${e.name}` : e.name, depth + 1);
    }
  };
  visit(resolve(root), "", 0);
  return out.sort((a, b) => b.changed.localeCompare(a.changed));
}

/** Delete a project folder (spec, versions, assets, renders). Only a project inside root, never root itself. */
export function deleteProject(root: string, name: string): void {
  const base = resolve(root);
  const dir = resolve(base, name);
  if (dir === base || !dir.startsWith(base + sep)) throw new SiniError(`'${name}' isn't a project folder inside ${base}.`);
  if (!existsSync(join(dir, "video.json"))) throw new SiniError(`'${name}' isn't a project (it has no video.json).`);
  rmSync(dir, { recursive: true, force: true });
}
