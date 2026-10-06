/** describe_at: what is on screen and what is moving at a given time. */
import { frameAt, isVisible, planElements } from "./evaluate.js";
import type { ElementFrame } from "./evaluate.js";
import type { Plan, PlanElement } from "./plan.js";

export interface Description {
  time: number;
  scenes: { id: string; local: number; transition?: string }[];
  elements: { ref: string; type: string; scene: string; visible: boolean; opacity?: number; highlighted?: boolean; text?: string; animating: string[] }[];
}

export function describeAt(plan: Plan, t: number): Description {
  const frame = frameAt(plan, t);
  const scenes = frame.scenes
    .filter((s) => s.visible)
    .map((s) => ({
      id: s.id,
      local: round(s.local),
      ...(s.incoming ? { transition: `${s.incoming.transition.type} in (${Math.round(s.incoming.p * 100)}%)` } : {}),
      ...(s.outgoing ? { transition: `leaving via ${s.outgoing.transition.type} (${Math.round(s.outgoing.p * 100)}%)` } : {}),
    }));
  const active = new Set(scenes.map((s) => s.id));
  const elements: Description["elements"] = [];
  for (const [ref, el] of planElements(plan)) {
    if (!active.has(el.sceneId)) continue;
    const visible = isVisible(plan, frame, ref);
    const animating = [...new Set(plan.tracks.filter((tr) => tr.ref === ref && t >= tr.t0 && t < tr.t1).map((tr) => tr.label))];
    const props = frame.elements[ref]?.props ?? {};
    const op = typeof props.opacity === "number" || typeof props.dim === "number" ? (typeof props.opacity === "number" ? props.opacity : 1) * (typeof props.dim === "number" ? props.dim : 1) : undefined;
    const highlighted = typeof props.focusScale === "number" && props.focusScale > 1.001;
    elements.push({
      ref,
      type: el.type,
      scene: el.sceneId,
      visible,
      ...(typeof op === "number" && op < 1 ? { opacity: round(op) } : {}),
      ...(currentText(el, frame.elements[ref]) !== undefined ? { text: shorten(currentText(el, frame.elements[ref])!.replace(/\n/g, " / ")) } : {}),
      ...(highlighted ? { highlighted: true } : {}),
      animating,
    });
  }
  return { time: t, scenes, elements };
}

/** The words on screen now: typed text, state changes (mid-roll as "old → new"), toast title and body. */
function currentText(el: PlanElement, f: ElementFrame | undefined): string | undefined {
  const roll = (r: { from: string; to: string; p: number } | undefined, base: string) =>
    !r ? base : r.p >= 1 ? r.to : r.p <= 0 ? r.from : `${r.from} → ${r.to}`;
  if (f?.typed) return f.typed.text;
  if (el.type === "toast") {
    const title = roll(f?.contents?.title, String(el.props.title ?? ""));
    const body = roll(f?.contents?.body, String(el.props.body ?? ""));
    return [title, body].filter(Boolean).join(" / ") || undefined;
  }
  const base = el.text?.plain ?? (typeof el.props.label === "string" ? el.props.label : undefined);
  if (base === undefined) return undefined;
  return roll(f?.content ?? f?.contents?.content ?? f?.contents?.label, base);
}

const round = (x: number) => Math.round(x * 100) / 100;
const shorten = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
