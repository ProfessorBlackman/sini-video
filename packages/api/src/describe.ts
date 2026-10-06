import { describeAt, type CompiledPlan, type Description, type PlanElement } from "@sini/core";
import type { LayoutReport } from "@sini/render";
import { plan } from "./project.js";
import { layoutAt } from "./render.js";

export function describe(target: string, time: number): Description {
  return describeAt(plan(target).plan, time);
}

export interface Inspection {
  duration: number;
  timing: { target?: number; natural: number; final: number };
  scenes: { id: string; start: number; end: number; duration: number; auto: boolean; transition?: string; elements: number }[];
}

/** Scene-by-scene timing: where the seconds go. */
export function inspect(target: string): Inspection {
  const { plan: p, loaded } = plan(target);
  const count = (els: { children: unknown[]; pages?: { children: unknown[] }[] }[]): number =>
    els.reduce((n, e) => n + 1 + count(e.children as never) + (e.pages ?? []).reduce((m, pg) => m + count(pg.children as never), 0), 0);
  return {
    duration: p.duration,
    timing: p.timing,
    scenes: p.scenes.map((s, i) => ({
      id: s.id,
      start: r2(s.start),
      end: r2(s.start + s.duration),
      duration: r2(s.duration),
      auto: loaded.spec.scenes[i]?.duration === "auto",
      ...(s.transition ? { transition: `${s.transition.type} ${s.transition.duration}s` } : {}),
      elements: count(s.elements as never),
    })),
  };
}
const r2 = (x: number) => Math.round(x * 100) / 100;

/** describe_at plus what the renderer sees: elements mostly hidden behind something drawn on top of them. */
export async function describeWithLayout(target: string, time: number): Promise<Description & { elements: (Description["elements"][number] & { coveredBy?: string })[] }> {
  const d = describe(target, time);
  const covered = coveredAt(plan(target).plan, await layoutAt(target, time));
  return { ...d, elements: d.elements.map((e) => (covered.has(e.ref) ? { ...e, coveredBy: covered.get(e.ref)! } : e)) };
}

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Visible elements at least half hidden by a visible, opaque element drawn above them (later, or higher z). */
export function coveredAt(p: CompiledPlan, layout: LayoutReport): Map<string, string> {
  const order = new Map<string, number>();
  const ancestors = new Map<string, Set<string>>();
  const els = new Map<string, PlanElement>();
  const walk = (list: PlanElement[], up: string[]) => {
    for (const e of list) {
      order.set(e.ref, order.size);
      ancestors.set(e.ref, new Set(up));
      els.set(e.ref, e);
      walk(e.children, [...up, e.ref]);
      for (const pg of e.pages ?? []) walk(pg.children, [...up, e.ref]);
      walk(e.overlay ?? [], [...up, e.ref]);
    }
  };
  for (const s of p.scenes) walk(s.elements, []);
  const solid = new Set(["image", "badge", "button", "browser", "phone", "toast"]);
  const opaque = (e: PlanElement) => solid.has(e.type) || (["shape", "path", "stack", "grid", "group"].includes(e.type) && !!e.style.fill && e.style.fill !== "rgba(0, 0, 0, 0)");
  const shown = layout.elements.filter((b) => b.visible);
  const out = new Map<string, string>();
  for (const a of shown) {
    const ea = els.get(a.ref);
    if (!ea) continue;
    const ab = a.ink ?? a.current;
    const area = ab.width * ab.height;
    if (!area) continue;
    for (const b of shown) {
      const eb = els.get(b.ref);
      if (!eb || eb === ea || eb.sceneId !== ea.sceneId || !opaque(eb)) continue;
      if (ancestors.get(a.ref)?.has(b.ref) || ancestors.get(b.ref)?.has(a.ref)) continue;
      const above = (eb.z ?? 0) > (ea.z ?? 0) || ((eb.z ?? 0) === (ea.z ?? 0) && order.get(b.ref)! > order.get(a.ref)!);
      if (above && overlap(ab, b.current) / area >= 0.5) {
        out.set(a.ref, b.ref);
        break;
      }
    }
  }
  return out;
}
