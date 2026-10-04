import { describeAt, type Description } from "@sini/core";
import { plan } from "./project.js";

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
