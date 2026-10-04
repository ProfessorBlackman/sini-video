/** Lucide icons (ISC licence), read on demand from the lucide-static package. */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plan, PlanElement } from "@sini/core";

const require = createRequire(import.meta.url);
const ICON_DIR = join(dirname(require.resolve("lucide-static/package.json")), "icons");

let names: Set<string> | undefined;
/** Every icon name, including Lucide's aliases for renamed icons (e.g. check-circle → circle-check). */
export function iconNames(): Set<string> {
  names ??= new Set(readdirSync(ICON_DIR).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)));
  return names;
}

const cache = new Map<string, string>();
/** The inner SVG markup (paths, circles, …) of an icon drawn on a 24×24 grid. */
export function iconMarkup(name: string): string | undefined {
  if (!iconNames().has(name)) return undefined;
  if (!cache.has(name)) {
    const svg = readFileSync(join(ICON_DIR, `${name}.svg`), "utf8");
    const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1]?.trim() ?? "";
    cache.set(name, inner);
  }
  return cache.get(name);
}

/** Icons a plan needs: icon elements plus the hand used by pointer cursors. */
export function planIcons(plan: Plan): Record<string, string> {
  const wanted = new Set<string>();
  const walk = (els: PlanElement[]) => {
    for (const e of els) {
      if (e.type === "icon" && typeof e.props.name === "string") wanted.add(e.props.name);
      if (e.type === "toast") {
        if (typeof e.props.icon === "string") wanted.add(e.props.icon);
        for (const st of Object.values(e.states)) if (st.icon) wanted.add(st.icon);
      }
      walk(e.children);
      for (const p of e.pages ?? []) walk(p.children);
      walk(e.overlay ?? []);
    }
  };
  for (const s of plan.scenes) walk(s.elements);
  if (plan.tracks.some((t) => t.kind === "cursor" && t.cursor === "pointer")) wanted.add("pointer");
  const out: Record<string, string> = {};
  for (const n of wanted) {
    const m = iconMarkup(n);
    if (m !== undefined) out[n] = m;
  }
  return out;
}
