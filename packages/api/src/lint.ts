/**
 * Lint: design problems in a valid spec. Combines the compiled timeline (reading
 * time, visibility, motion), real layout boxes from the renderer (edges, safe zones,
 * overlaps, overflow), colours (contrast) and the font files (missing glyphs).
 */
import { existsSync } from "node:fs";
import * as fontkit from "fontkit";
import { contrast, over, parseCss, READING, SAFE_ZONES, TOP_LEVEL_TEXT_MARGIN, type CompiledPlan, type PlanElement, type RGBA } from "@sini/core";
import { fontFile, RenderSession, type LayoutReport } from "@sini/render";
import { ENTER_PRESETS, EXIT_PRESETS, type Issue } from "@sini/schema";
import { plan as loadPlan } from "./project.js";
import { resolveTextHotspots } from "./ocr.js";

export interface LintResult {
  ok: boolean;
  issues: Issue[];
  duration: number;
  /** Warnings matched by the spec's `lint.accept` (left out of `issues`). */
  accepted: number;
  /** The accepted warnings with the author's reasons, to show the human. */
  acceptedNotes: string[];
}

/** Drop warnings the spec accepts: same code, and the same element (or one inside it) when one is named. */
export function applyAccepted(issues: Issue[], accept: { code: string; element?: string }[] = []): { open: Issue[]; accepted: number } {
  const hit = (i: Issue) => i.level === "warning" && accept.some((a) => a.code === i.code && (!a.element || i.path === a.element || i.path.startsWith(`${a.element}/`)));
  const open = issues.filter((i) => !hit(i));
  return { open, accepted: issues.length - open.length };
}

type Box = { x: number; y: number; width: number; height: number };

const warn = (path: string, code: string, message: string, suggestion?: string): Issue => ({
  level: "warning", path, code, message, ...(suggestion ? { suggestion } : {}),
});
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function lint(target: string, opts: { layout?: boolean } = {}): Promise<LintResult> {
  await resolveTextHotspots(target);
  const { plan, validation, loaded } = loadPlan(target);
  const issues: Issue[] = [...validation.issues.filter((i) => i.level === "warning"), ...plan.report];
  issues.push(...timelineRules(plan));
  issues.push(...deviceRules(plan));
  issues.push(...glyphRules(plan));
  if (opts.layout !== false) {
    const session = await RenderSession.open(plan);
    try {
      const report = await session.layout(0);
      issues.push(...layoutRules(plan, report));
      issues.push(...(await motionRules(plan, session)));
    } finally {
      await session.close();
    }
  }
  const accept = loaded.spec.lint?.accept ?? [];
  const { open, accepted } = applyAccepted(issues, accept);
  const acceptedNotes = accept
    .filter((a) => issues.some((i) => i.code === a.code && (!a.element || i.path === a.element || i.path.startsWith(`${a.element}/`))))
    .map((a) => `${a.code}${a.element ? ` on '${a.element}'` : ""}: ${a.reason}`);
  return { ok: !open.some((i) => i.level === "error"), issues: open, duration: plan.duration, accepted, acceptedNotes };
}

function walk(plan: CompiledPlan): { el: PlanElement; parents: PlanElement[] }[] {
  const out: { el: PlanElement; parents: PlanElement[] }[] = [];
  const rec = (els: PlanElement[], parents: PlanElement[]) => {
    for (const el of els) {
      out.push({ el, parents });
      rec(el.children, [...parents, el]);
      for (const p of el.pages ?? []) rec(p.children, [...parents, el]);
      rec(el.overlay ?? [], [...parents, el]);
    }
  };
  for (const s of plan.scenes) rec(s.elements, []);
  return out;
}

// ---------------------------------------------------------------- timeline rules

export function timelineRules(plan: CompiledPlan): Issue[] {
  const issues: Issue[] = [];
  for (const r of plan.reading) {
    const need = READING.base + READING.perWord * r.words;
    const have = r.end - r.start;
    if (have + 0.05 < need) {
      issues.push(warn(r.ref, "reading-time",
        `'${r.ref}' is readable for ${r1(Math.max(0, have))}s but needs about ${r1(need)}s (${r.words} word${r.words === 1 ? "" : "s"}).`,
        have <= 0 ? "It disappears before its entrance finishes; start it earlier or lengthen the scene." : `Lengthen the scene by ${r1(need - have)}s, start the text earlier, or use "duration": "auto".`));
    }
  }
  for (const s of plan.scenes) {
    const sceneEnd = s.start + s.duration;
    for (const { el } of walk({ ...plan, scenes: [s] } as CompiledPlan)) {
      if (el.appearAt !== null && el.appearAt >= sceneEnd - 0.01) {
        issues.push(warn(el.ref, "never-visible", `'${el.ref}' enters at ${r1(el.appearAt - s.start)}s, after scene '${s.id}' ends (${r1(s.duration)}s).`, "Move its enter earlier or lengthen the scene."));
      } else if (el.appearAt !== null && el.hideAt !== null && el.hideAt <= el.appearAt) {
        issues.push(warn(el.ref, "never-visible", `'${el.ref}' exits before it finishes entering.`));
      }
    }
    // Low motion: a long stretch with nothing animating.
    if (s.duration > 6) {
      const spans = plan.tracks
        .filter((t) => t.t1 > s.start && t.t0 < sceneEnd)
        .map((t) => [Math.max(s.start, t.t0), Math.min(sceneEnd, Math.max(t.t1, t.t0 + 0.1))] as const)
        .sort((a, b) => a[0] - b[0]);
      let cursor = s.start;
      let gap = 0;
      for (const [a, b] of spans) {
        gap = Math.max(gap, a - cursor);
        cursor = Math.max(cursor, b);
      }
      gap = Math.max(gap, sceneEnd - cursor);
      if (gap > 4) {
        issues.push(warn(`scene:${s.id}`, "low-motion", `Scene '${s.id}' has ${r1(gap)}s with nothing moving.`, "Shorten the scene, add an ambient preset (kenBurns, drift, float), or split it."));
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------- glyphs

const fontCache = new Map<string, { hasGlyphForCodePoint(cp: number): boolean } | null>();
function openFont(path: string | undefined) {
  if (!path || !existsSync(path)) return null;
  if (!fontCache.has(path)) {
    try {
      const f = fontkit.openSync(path) as unknown as { hasGlyphForCodePoint(cp: number): boolean };
      fontCache.set(path, f);
    } catch {
      fontCache.set(path, null);
    }
  }
  return fontCache.get(path)!;
}

export function glyphRules(plan: CompiledPlan): Issue[] {
  const issues: Issue[] = [];
  const fallback = openFont(fontFile("Inter Tight"));
  const assetFonts = new Map(plan.fontAssets.map((f) => [f.family, f.src]));
  for (const { el } of walk(plan)) {
    if (!el.font || !el.text) continue;
    const runs = el.text.runs;
    const missing = new Set<string>();
    for (const run of runs) {
      const style = run.italic || el.font.italic ? "italic" : "normal";
      const primary = openFont(assetFonts.get(el.font.family) ?? fontFile(el.font.family, style));
      for (const ch of run.text) {
        const cp = ch.codePointAt(0)!;
        if (/\s/.test(ch) || cp < 0x20) continue;
        if (primary?.hasGlyphForCodePoint(cp) || fallback?.hasGlyphForCodePoint(cp)) continue;
        missing.add(ch);
      }
    }
    if (missing.size) {
      issues.push(warn(el.ref, "missing-glyph", `'${el.ref}' uses characters no bundled font can draw: ${[...missing].join(" ")}.`,
        /\p{Extended_Pictographic}/u.test([...missing].join("")) ? "Emoji aren't supported; use an icon element or plain text." : "Use a font asset that covers them, or replace the characters."));
    }
  }
  return issues;
}

// ---------------------------------------------------------------- layout rules

function intersect(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function solid(paint: string | undefined): RGBA | null {
  if (!paint || paint.includes("gradient")) return null;
  return parseCss(paint);
}

/**
 * A new phone (or browser) in each of several scenes in a row: an app flow reads better as one device whose
 * screen changes (screens + navigate), with the device staying put.
 */
export function deviceRules(plan: CompiledPlan): Issue[] {
  const issues: Issue[] = [];
  // App screens built from elements (a screenshot repeated across scenes is a different matter).
  const deviceIn = (s: CompiledPlan["scenes"][number]) => s.elements.find((e) => (e.type === "phone" || e.type === "browser") && !e.props.content);
  plan.scenes.forEach((s, i) => {
    const prev = i > 0 ? deviceIn(plan.scenes[i - 1]!) : undefined;
    const cur = deviceIn(s);
    if (prev && cur && prev.type === cur.type) {
      issues.push(warn(cur.ref, "device-per-scene", `'${cur.ref}' is a new ${cur.type} in scene '${s.id}', right after '${prev.ref}' in '${plan.scenes[i - 1]!.id}'. Each cut swaps the device instead of the screen.`,
        `Use one ${cur.type} with "screens" and switch them with navigate or interaction steps (reference §15 Recipes), so the device stays put while its screen changes.`));
    }
  });
  return issues;
}

/** Enter and exit presets move things on and off screen on purpose. */
const ON_OFF_PRESETS = new Set([...ENTER_PRESETS, ...EXIT_PRESETS]);

/**
 * Lint over time: text sampled every 0.5s while it's visible. Flags text that grows wider than the frame
 * (e.g. trackIn letter spacing) or runs past its edge outside of an enter or exit. Text inside camera groups
 * (zooming past the edges is the point) and inside devices is skipped.
 */
export async function motionRules(plan: CompiledPlan, session: { layout(t: number): Promise<LayoutReport> }): Promise<Issue[]> {
  const W = plan.width;
  const H = plan.height;
  const entries = new Map(walk(plan).map((e) => [e.el.ref, e]));
  const cameraGroups = new Set(plan.tracks.filter((t) => t.kind === "camera").map((t) => t.ref));
  const onOff = (ref: string, t: number) => plan.tracks.some((tr) => tr.ref === ref && tr.t0 <= t && t <= tr.t1 + 0.05 && ON_OFF_PRESETS.has(tr.label.replace(/\s*\(.*\)$/, "") as never));
  // Scene transitions (slides, pushes, zooms) move whole scenes off the frame on purpose.
  const inTransition = (sceneId: string, t: number) => {
    const i = plan.scenes.findIndex((s) => s.id === sceneId);
    const sc = plan.scenes[i];
    const next = plan.scenes[i + 1];
    return (!!sc?.transition && t < sc.start + sc.transition.duration) || (!!next?.transition && t >= next.start);
  };
  const found = new Map<string, Issue>();
  const tol = 8 * (Math.min(W, H) / 1080);
  // Devices whose screens are built from elements (not a screenshot), and which device each element is in.
  // Page content only (not overlays), in devices showing elements rather than a screenshot.
  const pageContent = new Map<string, string>();
  const collect = (els: PlanElement[], device: string) => {
    for (const e of els) {
      pageContent.set(e.ref, device);
      collect(e.children, device);
    }
  };
  for (const e of entries.values()) {
    if ((e.el.type === "phone" || e.el.type === "browser") && !e.el.props.content) for (const pg of e.el.pages ?? []) collect(pg.children, e.el.ref);
  }
  const deviceOf = (ref: string) => pageContent.get(ref);
  const emptyFound = new Set<string>();
  for (let t = 0.25; t < plan.duration; t += 0.5) {
    const r = await session.layout(t);
    // Mostly empty device screens: content reaching less than 40% of the way down.
    const lowest = new Map<string, number>();
    for (const b of r.elements) {
      const d = b.visible ? deviceOf(b.ref) : undefined;
      if (d) lowest.set(d, Math.max(lowest.get(d) ?? -Infinity, b.current.y + b.current.height));
    }
    for (const [d, bottom] of lowest) {
      const dev = r.elements.find((x) => x.ref === d);
      if (!dev?.visible || emptyFound.has(d) || inTransition(entries.get(d)!.el.sceneId, t)) continue;
      const share = (bottom - dev.current.y) / Math.max(1, dev.current.height);
      if (share < 0.4) {
        emptyFound.add(d);
        found.set(`${d}#empty`, warn(d, "empty-screen", `'${d}' is mostly empty at ${r1(t)}s: its content stops ${Math.round(share * 100)}% of the way down the screen, so most of the phone shows nothing.`,
          "Fill it like a real app screen: a map or image placeholder (an image with a hint) at the top, bigger cards and text (style.size), more list rows, a bottom button bar; or make the device smaller and give the space to a caption."));
      }
    }
    for (const b of r.elements) {
      const e = entries.get(b.ref);
      if (!e || e.el.type !== "text" || b.inDevice || !b.visible || found.has(b.ref)) continue;
      if (e.parents.some((p) => cameraGroups.has(p.ref)) || inTransition(e.el.sceneId, t)) continue;
      const c = b.ink ?? b.current;
      if (c.width > W + tol) {
        found.set(b.ref, warn(b.ref, "too-wide-in-motion", `'${b.ref}' grows to ${Math.round(c.width)}px wide at ${r1(t)}s, wider than the ${W}px frame.`, "Shorten it, make it smaller, or reduce the animation's spread (e.g. trackIn's start spacing)."));
      } else if ((c.x < -tol || c.y < -tol || c.x + c.width > W + tol || c.y + c.height > H + tol) && !onOff(b.ref, t)) {
        found.set(b.ref, warn(b.ref, "leaves-frame", `'${b.ref}' runs past the edge of the frame at ${r1(t)}s (${Math.round(c.x)},${Math.round(c.y)} ${Math.round(c.width)}×${Math.round(c.height)}).`, "Keep its animation inside the frame, or make it an enter or exit."));
      }
    }
  }
  return [...found.values()];
}

export function layoutRules(plan: CompiledPlan, report: LayoutReport): Issue[] {
  const issues: Issue[] = [];
  const boxes = new Map(report.elements.map((e) => [e.ref, e]));
  const W = plan.width;
  const H = plan.height;
  const k = Math.min(W, H) / 1080;
  const margin = TOP_LEVEL_TEXT_MARGIN * k * 0.99;
  const zone = SAFE_ZONES[plan.safeZone];
  const [zt, zr, zb, zl] = [zone[0] * (H / 1920), zone[1] * (W / 1080), zone[2] * (H / 1920), zone[3] * (W / 1080)];
  const textual = new Set(["text", "button", "badge", "toast"]);
  const entries = walk(plan);
  const sceneOf = new Map(plan.scenes.map((s) => [s.id, s]));
  const parentsOf = new Map(entries.map(({ el, parents }) => [el.ref, parents]));
  /** When an element can be seen: its own appear/hide times, narrowed by every ancestor's. */
  const visibleSpan = (el: PlanElement): [number, number] => {
    const scene = sceneOf.get(el.sceneId)!;
    let [t0, t1] = [scene.start, scene.visibleUntil];
    for (const e of [...(parentsOf.get(el.ref) ?? []), el]) {
      t0 = Math.max(t0, e.appearAt ?? t0);
      t1 = Math.min(t1, e.hideAt ?? t1);
    }
    return [t0, t1];
  };
  /** The largest camera zoom an element is shown at while visible (1 outside camera groups). */
  const cameraZoom = (el: PlanElement): number => {
    const groups = new Set((parentsOf.get(el.ref) ?? []).map((p) => p.ref));
    const [t0, t1] = visibleSpan(el);
    let best = 1;
    for (const tr of plan.tracks) {
      if (tr.kind !== "camera" || !groups.has(tr.ref) || !tr.keys.length) continue;
      const at = (t: number) => {
        const k = tr.keys;
        if (t <= k[0]!.t) return k[0]!.zoom;
        for (let i = 1; i < k.length; i++) {
          if (t <= k[i]!.t) {
            const q = (t - k[i - 1]!.t) / Math.max(1e-6, k[i]!.t - k[i - 1]!.t);
            return k[i - 1]!.zoom * (k[i]!.zoom / k[i - 1]!.zoom) ** q;
          }
        }
        return k.at(-1)!.zoom;
      };
      // Between keys the zoom changes monotonically, so the maximum is at a key or an end of the span.
      const zooms = [at(t0), at(t1), ...tr.keys.filter((k) => k.t > t0 && k.t < t1).map((k) => k.zoom)];
      best = Math.max(best, ...zooms);
    }
    return best;
  };

  // Content sticking out of a stack or grid. Group children are placed freely and often overhang on purpose;
  // pinned/offset children too; device pages scroll.
  for (const { el, parents } of entries) {
    const parent = parents.at(-1);
    const l = el.layout as Record<string, unknown>;
    if (!parent || !["stack", "grid"].includes(parent.type) || l.method === "pin" || l.offset) continue;
    const cb = boxes.get(el.ref)?.box;
    const pb = boxes.get(parent.ref)?.box;
    if (!cb || !pb || cb.width === 0 || cb.height === 0) continue;
    const tol = 4 * k;
    const past = [
      ["bottom", cb.y + cb.height - (pb.y + pb.height)],
      ["right", cb.x + cb.width - (pb.x + pb.width)],
      ["top", pb.y - cb.y],
      ["left", pb.x - cb.x],
    ].filter(([, d]) => (d as number) > tol) as [string, number][];
    if (!past.length) continue;
    const [side, d] = past.sort((a, b) => b[1] - a[1])[0]!;
    issues.push(warn(el.ref, "content-overflow", `'${el.ref}' sticks out ${r1(d)}px past the ${side} of '${parent.ref}' (${r1(pb.width)}×${r1(pb.height)}).`, `Make '${parent.ref}' bigger, reduce its gap or padding, or make the content smaller.`));
  }

  for (const { el, parents } of entries) {
    const lb = boxes.get(el.ref);
    if (!lb || el.inDevice) continue;
    const b = lb.box;
    if (textual.has(el.type) || el.type === "browser" || el.type === "phone") {
      const outside = b.x < -1 || b.y < -1 || b.x + b.width > W + 1 || b.y + b.height > H + 1;
      // Devices often bleed off an edge on purpose; only flag them when most of the device is off-canvas.
      const onCanvas = intersect(b, { x: 0, y: 0, width: W, height: H }) / Math.max(1, b.width * b.height);
      const off = textual.has(el.type) ? outside : outside && onCanvas < 0.5;
      if (off) {
        issues.push(warn(el.ref, "off-canvas", `'${el.ref}' extends past the canvas (${r1(b.x)},${r1(b.y)} ${r1(b.width)}×${r1(b.height)} on ${W}×${H}).`, "Reduce its size or move it inside the frame."));
      } else if (textual.has(el.type) && (b.x < margin || b.y < margin || b.x + b.width > W - margin || b.y + b.height > H - margin)) {
        const sides = [
          b.y < margin ? `top (${r1(b.y)}px)` : "",
          b.x + b.width > W - margin ? `right (${r1(W - b.x - b.width)}px)` : "",
          b.y + b.height > H - margin ? `bottom (${r1(H - b.y - b.height)}px)` : "",
          b.x < margin ? `left (${r1(b.x)}px)` : "",
        ].filter(Boolean);
        issues.push(warn(el.ref, "edge-margin", `'${el.ref}' is closer than ${Math.round(margin)}px to the ${sides.join(" and ")} edge of the frame.`, "Keep text and buttons at least 72px from the edges."));
      }
      if (plan.safeZone !== "none" && textual.has(el.type) && !off) {
        const hit = [b.y < zt && "top", b.y + b.height > H - zb && "bottom", b.x < zl && "left", b.x + b.width > W - zr && "right"].filter(Boolean);
        if (hit.length) issues.push(warn(el.ref, "safe-zone", `'${el.ref}' sits under the ${plan.safeZone} interface (${hit.join(", ")} edge).`, `Keep text and buttons inside the safe area: ${zone[0]}px from the top and ${zone[2]}px from the bottom on 1080×1920.`));
      }
    }
    if (lb.overflow) issues.push(warn(el.ref, "text-overflow", `'${el.ref}' has a word too wide for its box${el.text?.maxLines ? " or more lines than maxLines" : ""}.`, 'Use "fit": "shrink", widen "maxWidth", or shorten the text.'));
    if (lb.shrink !== undefined && lb.shrink < 0.6) issues.push(warn(el.ref, "shrunk-text", `'${el.ref}' was shrunk to ${Math.round(lb.shrink * 100)}% of its size to fit.`, "Shorten the text or give it more width."));

    // Contrast against a solid background.
    if (el.font && el.text && el.text.readingWords > 0) {
      let bg: RGBA | null = null;
      for (const p of [...parents].reverse()) {
        const f = p.type === "browser" || p.type === "phone" ? p.pages?.[0]?.background : p.style.fill;
        if (f) {
          bg = solid(f);
          break;
        }
      }
      if (!bg && (el.type === "button" || el.type === "badge" || el.type === "toast") && el.style.fill && el.props.variant !== "outline") bg = solid(el.style.fill);
      // Text sitting on a filled shape or container drawn before it: measure against that fill.
      if (!bg && !el.inDevice) {
        const tb = lb.box;
        const cx = tb.x + tb.width / 2;
        const cy = tb.y + tb.height / 2;
        const myIndex = entries.findIndex((x) => x.el === el);
        for (let i = myIndex - 1; i >= 0; i--) {
          const o = entries[i]!;
          if (o.el.sceneId !== el.sceneId || o.el.inDevice || !o.el.style.fill) continue;
          if (!["shape", "stack", "grid", "group", "badge", "button"].includes(o.el.type)) continue;
          const ob = boxes.get(o.el.ref)?.box;
          if (ob && cx >= ob.x && cx <= ob.x + ob.width && cy >= ob.y && cy <= ob.y + ob.height) {
            bg = solid(o.el.style.fill);
            break;
          }
        }
      }
      const scene = sceneOf.get(el.sceneId);
      if (!bg && scene?.background.kind === "paint") bg = solid(scene.background.css);
      const fg = parseCss(el.font.color);
      if (bg && fg && bg[3] > 0.99) {
        const ratio = contrast(over(fg, bg), bg);
        const large = el.font.size >= (el.inDevice ? 24 : 48 * k) || (el.font.weight >= 700 && el.font.size >= (el.inDevice ? 19 : 36 * k));
        const min = large ? 3 : 4.5;
        if (ratio < min) {
          issues.push(warn(el.ref, "low-contrast", `'${el.ref}' has a contrast of ${ratio.toFixed(1)}:1 against its background (minimum ${min}:1).`, "Use a lighter or darker text colour from the palette."));
        }
      }
    }
  }

  // Text that is too small to read once drawn (in-device text is scaled down).
  for (const { el } of entries) {
    const lb = boxes.get(el.ref);
    if (!lb?.screenFontSize || !el.text || el.text.readingWords === 0) continue;
    const zoom = cameraZoom(el);
    const size = lb.screenFontSize * zoom;
    if (size < 20 * k - 0.05) {
      issues.push(warn(el.ref, "tiny-text", `'${el.ref}' is drawn at ${r1(size)}px on the canvas${zoom > 1 ? ` (at the camera's ${r1(zoom)}× zoom)` : ""}, too small to read on a phone.`,
        el.inDevice ? "Raise its style.size (in-device sizes are scaled with the device), or make the device larger." : "Use a larger role or style.size (at least 20px on a 1080px canvas)."));
    }
  }

  // Text covered by a later element (drawn on top) while both are on screen.
  const order = new Map(entries.map(({ el }, i) => [el.ref, i]));
  const opaque = new Set(["shape", "image", "badge", "button", "browser", "phone"]);
  for (const t of entries) {
    if (!textual.has(t.el.type) || t.el.inDevice || !boxes.has(t.el.ref)) continue;
    const tb = boxes.get(t.el.ref)!.box;
    const tSpan = visibleSpan(t.el);
    for (const o of entries) {
      if (o.el === t.el || o.el.sceneId !== t.el.sceneId || o.el.inDevice || !boxes.has(o.el.ref)) continue;
      if (o.parents.includes(t.el) || t.parents.includes(o.el)) continue;
      const isOpaque = opaque.has(o.el.type) || (["stack", "grid", "group"].includes(o.el.type) && !!o.el.style.fill);
      if (!isOpaque) continue;
      const above = (o.el.z ?? 0) > (t.el.z ?? 0) || ((o.el.z ?? 0) === (t.el.z ?? 0) && order.get(o.el.ref)! > order.get(t.el.ref)!);
      if (!above) continue;
      const oSpan = visibleSpan(o.el);
      if (Math.min(tSpan[1], oSpan[1]) - Math.max(tSpan[0], oSpan[0]) <= 0.05) continue;
      const area = intersect(tb, boxes.get(o.el.ref)!.box);
      if (tb.width * tb.height > 0 && area / (tb.width * tb.height) > 0.15) {
        issues.push(warn(t.el.ref, "covered", `'${t.el.ref}' is partly covered by '${o.el.ref}', which is drawn on top of it.`, "Move one of them, or give the text a higher z."));
        break;
      }
    }
  }

  // Text over a picture (image, screenshot, SVG, drawn path): its contrast can't be measured, and busy
  // pictures make text hard to read. Text on a filled card is fine (contrast is checked against the card).
  const pictures = new Set(["image", "browser", "phone", "svg", "path"]);
  for (const t of entries) {
    if (t.el.type !== "text" || t.el.inDevice || !boxes.has(t.el.ref)) continue;
    if (t.parents.some((p) => !!p.style.fill)) continue;
    const tb = boxes.get(t.el.ref)!.box;
    const tSpan = visibleSpan(t.el);
    for (const o of entries) {
      if (o.el.sceneId !== t.el.sceneId || !pictures.has(o.el.type) || o.el.inDevice || !boxes.has(o.el.ref)) continue;
      if (o.parents.includes(t.el) || t.parents.includes(o.el)) continue;
      const below = (o.el.z ?? 0) < (t.el.z ?? 0) || ((o.el.z ?? 0) === (t.el.z ?? 0) && order.get(o.el.ref)! < order.get(t.el.ref)!);
      if (!below) continue;
      const oSpan = visibleSpan(o.el);
      if (Math.min(tSpan[1], oSpan[1]) - Math.max(tSpan[0], oSpan[0]) <= 0.05) continue;
      const area = intersect(tb, boxes.get(o.el.ref)!.box);
      if (tb.width * tb.height > 0 && area / (tb.width * tb.height) > 0.2) {
        issues.push(warn(t.el.ref, "text-over-image", `'${t.el.ref}' sits over '${o.el.ref}' (${o.el.type}), so its contrast can't be checked and the picture may make it hard to read.`, "Move it off the picture, or put it on a card (a stack with style.fill)."));
        break;
      }
    }
  }

  // Overlapping text blocks that are on screen at the same time.
  const texts = entries.filter(({ el }) => textual.has(el.type) && !el.inDevice && boxes.has(el.ref));
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      if (a.el.sceneId !== b.el.sceneId) continue;
      if (a.parents.includes(b.el) || b.parents.includes(a.el)) continue;
      const [a0, a1] = visibleSpan(a.el);
      const [b0, b1] = visibleSpan(b.el);
      if (Math.min(a1, b1) - Math.max(a0, b0) <= 0.05) continue;
      const ba = boxes.get(a.el.ref)!.box;
      const bb = boxes.get(b.el.ref)!.box;
      const area = intersect(ba, bb);
      const smaller = Math.min(ba.width * ba.height, bb.width * bb.height);
      if (smaller > 0 && area / smaller > 0.08) {
        issues.push(warn(a.el.ref, "overlap", `'${a.el.ref}' and '${b.el.ref}' overlap while both are on screen.`, "Move one with layout (below/above, a stack) or separate them in time."));
      }
    }
  }
  return issues;
}
