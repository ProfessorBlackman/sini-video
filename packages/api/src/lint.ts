/**
 * Lint: design problems in a valid spec. Combines the compiled timeline (reading
 * time, visibility, motion), real layout boxes from the renderer (edges, safe zones,
 * overlaps, overflow), colours (contrast) and the font files (missing glyphs).
 */
import { existsSync } from "node:fs";
import * as fontkit from "fontkit";
import { contrast, over, parseCss, READING, SAFE_ZONES, TOP_LEVEL_TEXT_MARGIN, type CompiledPlan, type PlanElement, type RGBA } from "@sini/core";
import { fontFile, RenderSession, type LayoutReport } from "@sini/render";
import type { Issue } from "@sini/schema";
import { plan as loadPlan } from "./project.js";

export interface LintResult {
  ok: boolean;
  issues: Issue[];
  duration: number;
}

type Box = { x: number; y: number; width: number; height: number };

const warn = (path: string, code: string, message: string, suggestion?: string): Issue => ({
  level: "warning", path, code, message, ...(suggestion ? { suggestion } : {}),
});
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function lint(target: string, opts: { layout?: boolean } = {}): Promise<LintResult> {
  const { plan, validation } = loadPlan(target);
  const issues: Issue[] = [...validation.issues.filter((i) => i.level === "warning"), ...plan.report];
  issues.push(...timelineRules(plan));
  issues.push(...glyphRules(plan));
  if (opts.layout !== false) {
    const session = await RenderSession.open(plan);
    try {
      const report = await session.layout(0);
      issues.push(...layoutRules(plan, report));
    } finally {
      await session.close();
    }
  }
  return { ok: !issues.some((i) => i.level === "error"), issues, duration: plan.duration };
}

function walk(plan: CompiledPlan): { el: PlanElement; parents: PlanElement[] }[] {
  const out: { el: PlanElement; parents: PlanElement[] }[] = [];
  const rec = (els: PlanElement[], parents: PlanElement[]) => {
    for (const el of els) {
      out.push({ el, parents });
      rec(el.children, [...parents, el]);
      for (const p of el.pages ?? []) rec(p.children, [...parents, el]);
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

export function layoutRules(plan: CompiledPlan, report: LayoutReport): Issue[] {
  const issues: Issue[] = [];
  const boxes = new Map(report.elements.map((e) => [e.ref, e]));
  const W = plan.width;
  const H = plan.height;
  const k = Math.min(W, H) / 1080;
  const margin = TOP_LEVEL_TEXT_MARGIN * k * 0.99;
  const zone = SAFE_ZONES[plan.safeZone];
  const [zt, zr, zb, zl] = [zone[0] * (H / 1920), zone[1] * (W / 1080), zone[2] * (H / 1920), zone[3] * (W / 1080)];
  const textual = new Set(["text", "button", "badge"]);
  const entries = walk(plan);
  const sceneOf = new Map(plan.scenes.map((s) => [s.id, s]));

  for (const { el, parents } of entries) {
    const lb = boxes.get(el.ref);
    if (!lb || el.inDevice) continue;
    const b = lb.box;
    if (textual.has(el.type) || el.type === "browser" || el.type === "phone") {
      const off = b.x < -1 || b.y < -1 || b.x + b.width > W + 1 || b.y + b.height > H + 1;
      if (off) {
        issues.push(warn(el.ref, "off-canvas", `'${el.ref}' extends past the canvas (${r1(b.x)},${r1(b.y)} ${r1(b.width)}×${r1(b.height)} on ${W}×${H}).`, "Reduce its size or move it inside the frame."));
      } else if (textual.has(el.type) && (b.x < margin || b.y < margin || b.x + b.width > W - margin || b.y + b.height > H - margin)) {
        issues.push(warn(el.ref, "edge-margin", `'${el.ref}' is closer than ${Math.round(margin)}px to the edge of the frame.`, "Keep text and buttons at least 72px from the edges."));
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
      if (!bg && (el.type === "button" || el.type === "badge") && el.style.fill && el.props.variant !== "outline") bg = solid(el.style.fill);
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
    if (lb.screenFontSize < 20 * k - 0.05) {
      issues.push(warn(el.ref, "tiny-text", `'${el.ref}' is drawn at ${r1(lb.screenFontSize)}px on the canvas, too small to read on a phone.`,
        el.inDevice ? "Raise its style.size (in-device sizes are scaled with the device), or make the device larger." : "Use a larger role or style.size (at least 20px on a 1080px canvas)."));
    }
  }

  // Text covered by a later element (drawn on top) while both are on screen.
  const order = new Map(entries.map(({ el }, i) => [el.ref, i]));
  const opaque = new Set(["shape", "image", "badge", "button", "browser", "phone"]);
  for (const t of entries) {
    if (!textual.has(t.el.type) || t.el.inDevice || !boxes.has(t.el.ref)) continue;
    const tb = boxes.get(t.el.ref)!.box;
    const scene = sceneOf.get(t.el.sceneId)!;
    const tSpan = [t.el.appearAt ?? scene.start, t.el.hideAt ?? scene.visibleUntil] as const;
    for (const o of entries) {
      if (o.el === t.el || o.el.sceneId !== t.el.sceneId || o.el.inDevice || !boxes.has(o.el.ref)) continue;
      if (o.parents.includes(t.el) || t.parents.includes(o.el)) continue;
      const isOpaque = opaque.has(o.el.type) || (["stack", "grid", "group"].includes(o.el.type) && !!o.el.style.fill);
      if (!isOpaque) continue;
      const above = (o.el.z ?? 0) > (t.el.z ?? 0) || ((o.el.z ?? 0) === (t.el.z ?? 0) && order.get(o.el.ref)! > order.get(t.el.ref)!);
      if (!above) continue;
      const oSpan = [o.el.appearAt ?? scene.start, o.el.hideAt ?? scene.visibleUntil] as const;
      if (Math.min(tSpan[1], oSpan[1]) - Math.max(tSpan[0], oSpan[0]) <= 0.05) continue;
      const area = intersect(tb, boxes.get(o.el.ref)!.box);
      if (tb.width * tb.height > 0 && area / (tb.width * tb.height) > 0.15) {
        issues.push(warn(t.el.ref, "covered", `'${t.el.ref}' is partly covered by '${o.el.ref}', which is drawn on top of it.`, "Move one of them, or give the text a higher z."));
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
      const scene = sceneOf.get(a.el.sceneId)!;
      const span = (e: PlanElement) => [e.appearAt ?? scene.start, e.hideAt ?? scene.visibleUntil] as const;
      const [a0, a1] = span(a.el);
      const [b0, b1] = span(b.el);
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
