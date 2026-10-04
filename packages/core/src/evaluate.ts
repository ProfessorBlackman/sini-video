/**
 * The frame evaluator: a pure function from (plan, t) to the visual state of every scene
 * and element. No DOM. The browser runtime applies its output; describe_at and lint read it.
 */
import { mix, parseCss, toCss } from "./colour.js";
import { easeFn } from "./ease.js";
import type { Plan, PlanElement, PlanTransition, Track, TweenTrack } from "./plan.js";

export interface PartFrame {
  kind: "word" | "char" | "line" | "bar";
  index: number;
  props: Record<string, number>;
}

export interface ElementFrame {
  ref: string;
  visible: boolean;
  /** Animated values, only for properties that have tracks or non-default base values. */
  props: Record<string, number | string>;
  parts: PartFrame[];
  type?: { field: "text" | "url"; count: number; caret: boolean };
  count?: number;
  content?: { field: "content" | "label"; from: string; to: string; p: number };
  /** Every rolling text field (toasts roll title and body together). */
  contents?: Partial<Record<"content" | "label" | "title" | "body", { from: string; to: string; p: number }>>;
  /** Discrete values switched by state changes (variant, toast icon). */
  steps?: Record<string, string>;
  ring?: { p: number };
  variant?: string;
  typed?: { text: string; caret: boolean };
  /** Devices: the screen showing, or a transition between two screens. */
  screen?: { from: string; to: string; p: number; transition: "push" | "fade" | "none" };
}

export interface CursorFrame {
  ref: string;
  sceneId: string;
  cursor: "arrow" | "pointer" | "touch";
  opacity: number;
  /** Moving from `from` to `to` (targets or a canvas anchor), with eased progress. */
  from: string;
  to: string;
  p: number;
  /** 0 → 1 → 0 during a press. */
  press: number;
  /** Seconds since the last press ended (for a touch ripple), or null. */
  sincePress: number | null;
}

export interface SceneFrame {
  id: string;
  index: number;
  visible: boolean;
  local: number;
  incoming?: { transition: PlanTransition; p: number };
  outgoing?: { transition: PlanTransition; p: number };
}

export interface Frame {
  t: number;
  frame: number;
  scenes: SceneFrame[];
  elements: Record<string, ElementFrame>;
  cursors: CursorFrame[];
  endFade: number;
}

interface Index {
  byRef: Map<string, Track[]>;
  elements: Map<string, PlanElement>;
  parent: Map<string, string>;
  /** Elements on a device page: which device and which screen. */
  page: Map<string, { device: string; screen: string }>;
}

const indexes = new WeakMap<Plan, Index>();

function index(plan: Plan): Index {
  let idx = indexes.get(plan);
  if (idx) return idx;
  const byRef = new Map<string, Track[]>();
  for (const tr of plan.tracks) {
    const list = byRef.get(tr.ref) ?? [];
    list.push(tr);
    byRef.set(tr.ref, list);
  }
  for (const list of byRef.values()) list.sort((a, b) => a.t0 - b.t0);
  const elements = new Map<string, PlanElement>();
  const parent = new Map<string, string>();
  const page = new Map<string, { device: string; screen: string }>();
  const walk = (els: PlanElement[], p?: string) => {
    for (const e of els) {
      elements.set(e.ref, e);
      if (p) parent.set(e.ref, p);
      walk(e.children, e.ref);
      for (const pg of e.pages ?? []) {
        for (const c of pg.children) page.set(c.ref, { device: e.ref, screen: pg.name });
        walk(pg.children, e.ref);
      }
      walk(e.overlay ?? [], e.ref);
    }
  };
  for (const s of plan.scenes) walk(s.elements);
  idx = { byRef, elements, parent, page };
  indexes.set(plan, idx);
  return idx;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function interp(a: number | string, b: number | string, p: number): number | string {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * p;
  const ca = parseCss(String(a));
  const cb = parseCss(String(b));
  if (ca && cb) return toCss(mix(ca, cb, p));
  return p < 1 ? a : b;
}

/** Progress of a tween at t, with repeat/yoyo and easing applied (may overshoot for back/spring). */
function tweenProgress(tr: TweenTrack, t: number): number {
  const total = tr.t1 - tr.t0;
  if (total <= 0) return 1;
  const cycle = total / (tr.repeat + 1);
  const local = Math.min(Math.max(t - tr.t0, 0), total);
  let c = Math.floor(local / cycle);
  let frac = (local - c * cycle) / cycle;
  if (c > tr.repeat) {
    c = tr.repeat;
    frac = 1;
  }
  if (tr.yoyo && c % 2 === 1) frac = 1 - frac;
  return easeFn(tr.ease)(frac);
}

function keyframeValue(values: (number | string)[], p: number): number | string {
  if (values.length === 1) return values[0]!;
  const segs = values.length - 1;
  const k = Math.max(0, Math.min(segs - 1, Math.floor(p * segs)));
  return interp(values[k]!, values[k + 1]!, p * segs - k);
}

/** Value of one property at t from its tracks (sorted by t0). */
function propValue(tracks: TweenTrack[], t: number, base: number | string | undefined): number | string | undefined {
  if (tracks.length === 0) return base;
  if (tracks[0]!.additive) {
    let sum = typeof base === "number" ? base : 0;
    for (const tr of tracks) {
      if (t < tr.t0) {
        if (tr.fillBackward && typeof tr.values[0] === "number") sum += tr.values[0];
        continue;
      }
      const vals = tr.values.map((v) => (v === null ? 0 : v));
      const v = keyframeValue(vals, tweenProgress(tr, t));
      if (typeof v === "number") sum += v;
    }
    return sum;
  }
  let last = -1;
  for (let i = 0; i < tracks.length; i++) if (tracks[i]!.t0 <= t) last = i;
  if (last < 0) {
    const first = tracks[0]!;
    return first.fillBackward && first.values[0] !== null ? first.values[0] : base;
  }
  const tr = tracks[last]!;
  const vals = tr.values.map((v) => (v === null ? propValue(tracks.slice(0, last), tr.t0, base) ?? 0 : v));
  return keyframeValue(vals, tweenProgress(tr, t));
}

const PART_PROPS = new Set(["py", "prot", "opacity", "blur", "pdy", "grow"]);

function baseOf(el: PlanElement | undefined, prop: string): number | string | undefined {
  if (!el) return undefined;
  if (prop === "color") return el.font?.color;
  if (prop === "letterSpacing") return el.font?.letterSpacing;
  if (prop === "fontWeight") return el.font?.weight;
  const s = el.style as unknown as Record<string, unknown>;
  const v = s[prop];
  if (typeof v === "number" || typeof v === "string") return v;
  if (prop === "x" || prop === "y" || prop === "rotation" || prop === "blur") return 0;
  if (prop === "draw" || prop === "innerScale" || prop === "press") return 1;
  if (prop === "value") return Number(el.props.value ?? 0);
  if (prop === "innerX" || prop === "innerY") return 0;
  return undefined;
}

export function elementFrame(plan: Plan, ref: string, t: number): ElementFrame {
  const { byRef, elements } = index(plan);
  const el = elements.get(ref);
  const tracks = byRef.get(ref) ?? [];
  const frame: ElementFrame = { ref, visible: true, props: {}, parts: [] };
  if (el) frame.visible = (el.appearAt === null || t >= el.appearAt) && (el.hideAt === null || t < el.hideAt);

  // Group tweens by (part, prop).
  const groups = new Map<string, TweenTrack[]>();
  for (const tr of tracks) {
    if (tr.kind !== "tween") continue;
    const key = tr.part ? `${tr.part.kind}:${tr.part.index}:${tr.prop}` : tr.prop;
    const list = groups.get(key) ?? [];
    list.push(tr);
    groups.set(key, list);
  }
  const partMap = new Map<string, PartFrame>();
  for (const [key, list] of groups) {
    const first = list[0]!;
    if (first.part) {
      const base = first.prop === "opacity" || first.prop === "grow" ? 1 : 0;
      const v = propValue(list, t, base);
      if (typeof v !== "number" || !PART_PROPS.has(first.prop)) continue;
      const pk = `${first.part.kind}:${first.part.index}`;
      const pf = partMap.get(pk) ?? { kind: first.part.kind, index: first.part.index, props: {} };
      pf.props[first.prop] = v;
      partMap.set(pk, pf);
    } else {
      const v = propValue(list, t, baseOf(el, key));
      if (v !== undefined) frame.props[key] = v;
    }
  }
  frame.parts = [...partMap.values()];

  for (const tr of tracks) {
    switch (tr.kind) {
      case "float":
        if (t >= tr.t0 && t <= tr.t1) frame.props.y = num(frame.props.y) + tr.amplitude * Math.sin((2 * Math.PI * (t - tr.t0)) / tr.period);
        break;
      case "swing":
        if (t >= tr.t0) {
          const dt = t - tr.t0;
          frame.props.rotation = num(frame.props.rotation) + tr.angle * Math.exp(-tr.damping * dt) * Math.sin(8 * dt);
        }
        break;
      case "pulse":
        if (t >= tr.t0 && t <= tr.t1) {
          const phase = ((t - tr.t0) % tr.every) / tr.every;
          if (tr.ring) frame.ring = { p: phase };
          else frame.props.scale = num(frame.props.scale, 1) * (1 + (tr.scale - 1) * Math.sin(phase * Math.PI));
        }
        break;
      case "type":
        if (t >= tr.t0 || frame.type === undefined) {
          const p = tr.t1 > tr.t0 ? clamp01((t - tr.t0) / (tr.t1 - tr.t0)) : t >= tr.t0 ? 1 : 0;
          const typing = t >= tr.t0 && t < tr.t1;
          const blinkOn = Math.floor(t * 2.5) % 2 === 0;
          frame.type = { field: tr.field, count: Math.floor(p * tr.chars + 1e-9), caret: tr.caret && t >= tr.t0 && (typing || blinkOn) };
        }
        break;
      case "count":
        if (t >= tr.t0 || frame.count === undefined) {
          const p = tr.t1 > tr.t0 ? easeFn(tr.ease)(clamp01((t - tr.t0) / (tr.t1 - tr.t0))) : 1;
          frame.count = tr.from + (tr.to - tr.from) * p;
        }
        break;
      case "content":
        if (t >= tr.t0) {
          const p = tr.t1 > tr.t0 ? easeFn(tr.ease)(clamp01((t - tr.t0) / (tr.t1 - tr.t0))) : 1;
          (frame.contents ??= {})[tr.field] = { from: tr.from, to: tr.to, p };
          if (tr.field === "content" || tr.field === "label") frame.content = { field: tr.field, from: tr.from, to: tr.to, p };
        }
        break;
      case "step":
        if (t >= tr.t0) {
          (frame.steps ??= {})[tr.prop] = tr.value;
          if (tr.prop === "variant") frame.variant = tr.value;
        }
        break;
      case "screen":
        if (t >= tr.t0) {
          const p = tr.t1 > tr.t0 ? clamp01((t - tr.t0) / (tr.t1 - tr.t0)) : 1;
          frame.screen = { from: tr.from, to: tr.to, p: p < 1 ? easeFn("cubic.inOut")(p) : 1, transition: tr.transition };
        }
        break;
      case "typed":
        if (t >= tr.t0) {
          const cps = tr.t1 > tr.t0 ? tr.text.length / (tr.t1 - tr.t0) : Infinity;
          const n = Math.min(tr.text.length, Math.floor((t - tr.t0) * cps + 1e-9));
          frame.typed = { text: tr.text.slice(0, n), caret: t < tr.t1 || Math.floor(t * 2.5) % 2 === 0 };
        }
        break;
    }
  }
  return frame;
}

const num = (v: number | string | undefined, d = 0) => (typeof v === "number" ? v : d);

export function frameAt(plan: Plan, t: number): Frame {
  const { elements } = index(plan);
  const scenes: SceneFrame[] = plan.scenes.map((s, i) => {
    const visible = t >= s.start && t < s.visibleUntil || (i === plan.scenes.length - 1 && t >= s.start);
    const f: SceneFrame = { id: s.id, index: i, visible, local: t - s.start };
    if (s.transition && t >= s.start && t < s.start + s.transition.duration) {
      f.incoming = { transition: s.transition, p: easeFn(s.transition.ease)(clamp01((t - s.start) / s.transition.duration)) };
    }
    const next = plan.scenes[i + 1];
    if (next?.transition && t >= next.start && t < next.start + next.transition.duration) {
      f.outgoing = { transition: next.transition, p: easeFn(next.transition.ease)(clamp01((t - next.start) / next.transition.duration)) };
    }
    return f;
  });
  const out: Record<string, ElementFrame> = {};
  for (const ref of elements.keys()) {
    out[ref] = elementFrame(plan, ref, t);
    const el = elements.get(ref)!;
    if (el.pages && !out[ref]!.screen) {
      const s = String(el.props.screen ?? el.pages[0]?.name ?? "main");
      out[ref]!.screen = { from: s, to: s, p: 1, transition: "none" };
    }
  }
  for (const s of plan.scenes) {
    const bg = `${s.id}:background`;
    if (index(plan).byRef.has(bg)) out[bg] = elementFrame(plan, bg, t);
  }
  // Parts animated on their own: chart bars and progress steps ("meals#Q4").
  for (const ref of index(plan).byRef.keys()) if (ref.includes("#")) out[ref] = elementFrame(plan, ref, t);
  const cursors: CursorFrame[] = [];
  for (const tr of plan.tracks) {
    if (tr.kind !== "cursor" || t < tr.t0 || t > tr.t1) continue;
    const first = tr.steps[0]!;
    const last = tr.steps[tr.steps.length - 1]!;
    const opacity = Math.min(clamp01((t - tr.t0) / 0.2), 1 - clamp01((t - last.end) / 0.3));
    let from = tr.from;
    let to = tr.from;
    let p = 1;
    let press = 0;
    let sincePress: number | null = null;
    let at = tr.from;
    for (const st of tr.steps) {
      if (st.target === null) continue; // wait: stay put
      if (t < st.start) break;
      if (t < st.arrive) {
        from = at;
        to = st.target;
        p = easeFn("cubic.inOut")(clamp01((t - st.start) / (st.arrive - st.start)));
        at = st.target;
        break;
      }
      at = st.target;
      from = to = st.target;
      p = 1;
      if (t < st.release) press = Math.sin(clamp01((t - st.arrive) / (st.release - st.arrive)) * Math.PI);
      else sincePress = t - st.release;
    }
    if (t < first.start) from = to = tr.from;
    cursors.push({ ref: tr.ref, sceneId: tr.sceneId, cursor: tr.cursor, opacity, from, to, p, press, sincePress });
  }
  const endFade = plan.end.type === "fade" && plan.end.duration > 0 ? clamp01((t - plan.end.start) / plan.end.duration) : 0;
  return { t, frame: Math.round(t * plan.fps), scenes, elements: out, cursors, endFade };
}

/** Is an element (and every ancestor) visible at t? */
export function isVisible(plan: Plan, frame: Frame, ref: string): boolean {
  const { parent, elements, page } = index(plan);
  const el = elements.get(ref);
  if (!el) return false;
  const scene = frame.scenes.find((s) => s.id === el.sceneId);
  if (!scene?.visible) return false;
  for (let r: string | undefined = ref; r; r = parent.get(r)) {
    if (!frame.elements[r]?.visible) return false;
    // On a device page that isn't showing (or transitioning)?
    const pg = page.get(r);
    if (pg) {
      const sc = frame.elements[pg.device]?.screen;
      if (sc && pg.screen !== sc.to && !(sc.p < 1 && pg.screen === sc.from)) return false;
    }
    const props = frame.elements[r]?.props ?? {};
    for (const key of ["opacity", "scale", "scaleX", "scaleY"]) {
      const v = props[key];
      if (typeof v === "number" && Math.abs(v) <= 0.001) return false;
    }
  }
  return true;
}

export function planElements(plan: Plan): Map<string, PlanElement> {
  return index(plan).elements;
}
