/** SVG assets: read from disk, sanitised, and inlined into the page so drawOutline can reach every stroke. */
import { existsSync, readFileSync } from "node:fs";
import type { Plan, PlanElement } from "@sini/core";

/** Remove anything that could run code or reach outside the file. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|foreignObject|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*\/>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Links: only in-document references (#id) and embedded data images survive.
    .replace(/\s+(xlink:href|href)\s*=\s*("(?!#|data:image\/)[^"]*"|'(?!#|data:image\/)[^']*')/gi, "")
    .replace(/url\(\s*(['"]?)(?!#|data:)[^)]*\1\s*\)/gi, "none")
    .replace(/@import[^;]*;/gi, "")
    .trim();
}

/** Every SVG file a plan's svg elements show, sanitised, keyed by absolute path. */
export function planSvgs(plan: Plan): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (els: PlanElement[]) => {
    for (const e of els) {
      const img = e.props.image as { kind: string; src?: string } | undefined;
      if (e.type === "svg" && img?.kind === "file" && img.src && !(img.src in out) && existsSync(img.src)) {
        out[img.src] = sanitizeSvg(readFileSync(img.src, "utf8"));
      }
      walk(e.children);
      for (const p of e.pages ?? []) walk(p.children);
      walk(e.overlay ?? []);
    }
  };
  for (const s of plan.scenes) walk(s.elements);
  return out;
}
