/** describe_at: what is on screen and what is moving at a given time. */
import { frameAt, isVisible, planElements } from "./evaluate.js";
import type { Plan } from "./plan.js";

export interface Description {
  time: number;
  scenes: { id: string; local: number; transition?: string }[];
  elements: { ref: string; type: string; scene: string; visible: boolean; opacity?: number; text?: string; animating: string[] }[];
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
    const op = frame.elements[ref]?.props.opacity;
    elements.push({
      ref,
      type: el.type,
      scene: el.sceneId,
      visible,
      ...(typeof op === "number" && op < 1 ? { opacity: round(op) } : {}),
      ...(el.text ? { text: shorten(el.text.plain.replace(/\n/g, " / ")) } : {}),
      animating,
    });
  }
  return { time: t, scenes, elements };
}

const round = (x: number) => Math.round(x * 100) / 100;
const shorten = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
