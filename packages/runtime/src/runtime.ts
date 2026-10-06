/**
 * Sini browser runtime.
 *
 * Builds a DOM from a compiled plan (window.__SINI_PLAN__), lays it out once (CSS plus a
 * measuring pass for relative placement, pins and fit-to-width), then renders any frame on
 * demand with `sini.render(t)`. Rendering is a pure function of t: every call sets every
 * animated style, so frames can be rendered in any order, in parallel.
 */
import { clamp01, easeFn, elementFrame, formatLike, formatNumber, frameAt, type CursorFrame, type ElementFrame, type Font, type Frame, type PlanElement, type PlanScene, type Plan, type Run } from "@sini/core";

declare global {
  interface Window {
    __SINI_PLAN__: Plan;
    __SINI_ICONS__?: Record<string, string>;
    __SINI_SVGS__?: Record<string, string>;
    sini: {
      ready: Promise<void>;
      render(t: number): void;
      layout(t: number): LayoutReport;
      /** Several layouts in one call (no frames are produced between them). */
      layouts(ts: number[]): LayoutReport[];
      /** Where hotspots or image regions are on screen at each time (see regions()). */
      regions(ts: number[], queries: RegionQuery[]): RegionHit[][];
      setScale(f: number): void;
    };
  }
}

export interface LayoutBox {
  ref: string;
  type: string;
  scene: string;
  /** Laid-out box, canvas px, before animation. */
  box: { x: number; y: number; width: number; height: number };
  /** Box at time t, including animation transforms. */
  current: { x: number; y: number; width: number; height: number };
  /** Text only: where the words are drawn at time t (letter spacing and wrapping included), which can differ from the box. */
  ink?: { x: number; y: number; width: number; height: number };
  visible: boolean;
  inDevice: boolean;
  text?: string;
  fontSize?: number;
  /** Font size as drawn on the canvas (in-device sizes are scaled). */
  screenFontSize?: number;
  /** Text wider than its box (a long word) or more lines than maxLines. */
  overflow?: boolean;
  /** Font size after fit: "shrink", as a fraction of the requested size. */
  shrink?: number;
}
export interface LayoutReport {
  time: number;
  width: number;
  height: number;
  elements: LayoutBox[];
}

const plan = window.__SINI_PLAN__;
const W = plan.width;
const H = plan.height;
const k = Math.min(W, H) / 1080;

interface Node {
  el: PlanElement;
  outer: HTMLElement;
  anim: HTMLElement;
  /** Element painted with fill/stroke/radius (shape, button, container, image frame). */
  box?: HTMLElement | SVGElement;
  text?: HTMLElement;
  words: HTMLElement[];
  chars: HTMLElement[];
  num?: HTMLElement;
  textHTML?: string;
  img?: HTMLElement;
  url?: HTMLElement;
  urlText?: string;
  caret?: HTMLElement;
  outline?: SVGGeometryElement;
  /** Every stroke of an icon (drawOutline draws them together). */
  outlines?: SVGGeometryElement[];
  /** SVG shapes that only had a fill: drawOutline traces them, then fades the fill in. */
  filledOnly?: Set<SVGGeometryElement>;
  /** Template host (its CSS variables are animated). */
  host?: HTMLElement;
  body?: HTMLElement;
  ring?: HTMLElement;
  /** focusCycle spotlight on a screenshot region. */
  spot?: HTMLElement;
  /** drawOutline progress last applied (connectors re-dash after their geometry changes). */
  drawn?: number;
  particles?: { dots: HTMLElement[]; seeds: number[][] };
  /** Device screen element (scaled logical-pixel space). */
  screen?: HTMLElement;
  /** Device pages by screen name. */
  pages?: Map<string, { page: HTMLElement; background: string }>;
  statusBar?: HTMLElement;
  toast?: { icon: HTMLElement; iconName: string | null; title: HTMLElement; body: HTMLElement; text: HTMLElement };
  progress?: { dots: HTMLElement[]; labels: HTMLElement[]; fill: HTMLElement; track: HTMLElement };
  chart?: { bars: HTMLElement[]; values: HTMLElement[]; line?: SVGPathElement };
  sceneId: string;
}

const nodes = new Map<string, Node>();
const sceneEls = new Map<string, HTMLElement>();
const bgLayers = new Map<string, HTMLElement>();
let stage!: HTMLElement;
let wipebar!: HTMLElement;
let grain!: HTMLElement;
let endfade!: HTMLElement;
let scale = 1;

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, style?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  return e;
};
const SVGNS = "http://www.w3.org/2000/svg";
const px = (v: number) => `${Math.round(v * 1000) / 1000}px`;
const size = (v: unknown): string | undefined => (typeof v === "number" ? px(v) : typeof v === "string" ? (v === "auto" ? "auto" : v) : undefined);

const SHADOWS = {
  none: "none",
  soft: `0 ${px(20 * k)} ${px(50 * k)} rgba(0,0,0,.18), 0 ${px(4 * k)} ${px(12 * k)} rgba(0,0,0,.08)`,
  deep: `0 ${px(50 * k)} ${px(100 * k)} rgba(0,0,0,.30), 0 ${px(10 * k)} ${px(30 * k)} rgba(0,0,0,.20)`,
};

const ORIGIN: Record<string, string> = {
  "top-left": "0% 0%", top: "50% 0%", "top-right": "100% 0%",
  left: "0% 50%", center: "50% 50%", right: "100% 50%",
  "bottom-left": "0% 100%", bottom: "50% 100%", "bottom-right": "100% 100%",
};
const ANCHOR_FRAC: Record<string, [number, number]> = {
  "top-left": [0, 0], top: [0.5, 0], "top-right": [1, 0],
  left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5],
  "bottom-left": [0, 1], bottom: [0.5, 1], "bottom-right": [1, 1],
};

// ---------------------------------------------------------------- placeholders and grain

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseURL = "";
function noise(): string {
  if (noiseURL) return noiseURL;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  const rand = mulberry32(plan.seed * 7919 + 17);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 256);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseURL = c.toDataURL("image/png");
  return noiseURL;
}

function shade(css: string, amt: number): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  if (!m) return css;
  const f = (v: string) => Math.max(0, Math.min(255, Number(v) + amt));
  return `rgb(${f(m[1]!)}, ${f(m[2]!)}, ${f(m[3]!)})`;
}

/** Split on commas that aren't inside parentheses (colours like rgba(1, 2, 3, 0.5) contain commas). */
function topLevelParts(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let gradientId = 0;
/** SVG can't paint with CSS gradients: turn `linear-gradient(…)` / `radial-gradient(…)` into a <defs> gradient. */
function svgPaint(svg: SVGSVGElement, css: string): string {
  const m = /^(linear|radial)-gradient\((.*)\)$/s.exec(css.trim());
  if (!m) return css;
  const parts = topLevelParts(m[2]!);
  const kind = m[1]!;
  let angle = 180;
  if (kind === "linear" && /deg$/.test(parts[0] ?? "")) angle = parseFloat(parts.shift()!);
  if (kind === "radial" && /^(circle|ellipse)|^at /.test(parts[0] ?? "")) parts.shift();
  const id = `sini-grad-${++gradientId}`;
  const g = document.createElementNS(SVGNS, kind === "linear" ? "linearGradient" : "radialGradient");
  g.setAttribute("id", id);
  if (kind === "linear") {
    // CSS angles: 0deg points up, clockwise.
    const a = (angle * Math.PI) / 180;
    const [dx, dy] = [Math.sin(a) / 2, -Math.cos(a) / 2];
    for (const [k, v] of [["x1", 0.5 - dx], ["y1", 0.5 - dy], ["x2", 0.5 + dx], ["y2", 0.5 + dy]] as const) g.setAttribute(k, String(v));
  } else {
    // CSS "ellipse at center" reaches the farthest corner.
    for (const [k, v] of [["cx", "0.5"], ["cy", "0.5"], ["r", "0.7071"]]) g.setAttribute(k!, v!);
  }
  parts.forEach((c, i) => {
    const stop = document.createElementNS(SVGNS, "stop");
    stop.setAttribute("offset", String(parts.length > 1 ? i / (parts.length - 1) : 0));
    stop.setAttribute("stop-color", c);
    g.appendChild(stop);
  });
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVGNS, "defs");
    svg.prepend(defs);
  }
  defs.appendChild(g);
  return `url(#${id})`;
}

/** Light centre to dark edge along a cosine curve: three linear stops left a visible crease at the middle one. */
function placeholderGradient(c: string, fx: number, fy: number): string {
  const stops: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const q = i / 8;
    const amt = 38 - 72 * (0.5 - 0.5 * Math.cos(Math.PI * q));
    stops.push(`${shade(c, Math.round(amt))} ${Math.round(q * 100)}%`);
  }
  return `radial-gradient(ellipse at ${fx}% ${fy}%, ${stops.join(", ")})`;
}

function picture(src: { kind: "file"; src: string } | { kind: "placeholder"; color: string; seed: number }, fit: string, focus: number[] = [50, 50], crop?: number[]): HTMLElement {
  if (src.kind === "file") {
    const img = h("img", "pic", { width: "100%", height: "100%", objectFit: fit, objectPosition: `${focus[0]}% ${focus[1]}%`, display: "block" });
    // Only this region of the image exists for fit and focus (image pixels).
    if (crop) img.style.setProperty("object-view-box", `xywh(${crop[0]}px ${crop[1]}px ${crop[2]}px ${crop[3]}px)`);
    img.src = `file://${encodeURI(src.src)}`;
    img.decoding = "sync";
    return img;
  }
  const c = src.color;
  const rand = mulberry32(src.seed * 101 + plan.seed);
  const fx = 30 + rand() * 40;
  const fy = 25 + rand() * 30;
  const d = h("div", "pic placeholder", {
    width: "100%",
    height: "100%",
    background: placeholderGradient(c, fx, fy),
    position: "relative",
  });
  const n = h("div", "", { position: "absolute", inset: "0", backgroundImage: `url(${noise()})`, opacity: "0.10", mixBlendMode: "overlay" });
  d.appendChild(n);
  return d;
}

// ---------------------------------------------------------------- text

interface Seg { text: string; run: Run; num?: boolean }

function runSpan(seg: Seg, parent: HTMLElement): HTMLElement {
  const s = h("span");
  if (seg.run.italic) s.style.fontStyle = "italic";
  if (seg.run.bold) s.style.fontWeight = "700";
  if (seg.run.color) s.style.color = seg.run.color;
  s.textContent = seg.text;
  parent.appendChild(s);
  return s;
}

/** Split runs at the number's boundaries so countUp can replace just the number. */
function segments(runs: Run[], number?: { start: number; end: number }): Seg[] {
  const out: Seg[] = [];
  let pos = 0;
  for (const run of runs) {
    let text = run.text;
    let start = pos;
    while (text) {
      if (number && start < number.end && start + text.length > number.start) {
        const a = Math.max(0, number.start - start);
        const b = Math.min(text.length, number.end - start);
        if (a > 0) out.push({ text: text.slice(0, a), run });
        out.push({ text: text.slice(a, b), run, num: true });
        text = text.slice(b);
        start += b;
        continue;
      }
      out.push({ text, run });
      break;
    }
    pos += run.text.length;
  }
  return out;
}

function buildText(node: Node, host: HTMLElement) {
  const t = node.el.text!;
  host.textContent = "";
  node.words = [];
  node.chars = [];
  const segs = segments(t.runs, t.number);
  if (t.split === "none") {
    for (const seg of segs) {
      const parts = seg.text.split("\n");
      parts.forEach((p, i) => {
        if (i > 0) host.appendChild(h("br"));
        if (p) {
          const s = runSpan({ ...seg, text: p }, host);
          if (seg.num) node.num = s;
        }
      });
    }
    return;
  }
  // Word (and optionally character) spans, masked for reveals.
  let line = 0;
  let word: HTMLElement | null = null;
  let inner: HTMLElement | null = null;
  const closeWord = () => {
    word = null;
    inner = null;
  };
  for (const seg of segs) {
    for (const tok of seg.text.split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) {
        closeWord();
        const breaks = tok.split("\n").length - 1;
        for (let b = 0; b < breaks; b++) {
          host.appendChild(h("br"));
          line++;
        }
        // The spaces themselves (after the last line break), so indentation survives.
        const spaces = tok.slice(tok.lastIndexOf("\n") + 1);
        if (spaces) host.appendChild(document.createTextNode(spaces));
        continue;
      }
      if (!word) {
        word = h("span", t.split === "chars" ? "w open" : "w");
        word.dataset.line = String(line);
        inner = h("span", "wi");
        word.appendChild(inner);
        host.appendChild(word);
        node.words.push(word);
      }
      if (t.split === "chars") {
        for (const ch of [...tok]) {
          const c = runSpan({ ...seg, text: ch }, inner!);
          c.className = "c";
          node.chars.push(c);
        }
      } else {
        const s = runSpan({ ...seg, text: tok }, inner!);
        if (seg.num) node.num = s;
      }
    }
  }
}

/** CSS letter-spacing also follows the last glyph; balance it so centred and right-aligned text stays put. */
function balanceTracking(e: HTMLElement, em: number, align: string) {
  e.style.paddingLeft = align === "center" && em > 0 ? `${em}em` : "";
  e.style.marginRight = align === "right" && em > 0 ? `${-em}em` : "";
}

function applyFont(e: HTMLElement, f: Font) {
  Object.assign(e.style, {
    fontFamily: `"${f.family}", "Inter Tight"`,
    fontSize: px(f.size),
    fontWeight: String(f.weight),
    lineHeight: String(f.lineHeight),
    letterSpacing: `${f.letterSpacing}em`,
    textTransform: f.uppercase ? "uppercase" : "none",
    fontStyle: f.italic ? "italic" : "normal",
    color: f.color,
  });
}

function iconSvg(name: string, strokeWidth = 2): SVGSVGElement {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(strokeWidth));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = window.__SINI_ICONS__?.[name] ?? "";
  Object.assign(svg.style, { display: "block", width: "100%", height: "100%", overflow: "visible" });
  return svg;
}

function fontCss(e: HTMLElement, el: PlanElement) {
  const f = el.font!;
  balanceTracking(e, f.letterSpacing, f.align);
  Object.assign(e.style, {
    // Inter Tight covers symbols the display fonts lack (✓ ▶ → ₵ …).
    fontFamily: `"${f.family}", "Inter Tight"`,
    fontSize: px(f.size),
    fontWeight: String(f.weight),
    lineHeight: String(f.lineHeight),
    letterSpacing: `${f.letterSpacing}em`,
    textTransform: f.uppercase ? "uppercase" : "none",
    fontStyle: f.italic ? "italic" : "normal",
    textAlign: f.align,
    color: f.color,
  });
}

// ---------------------------------------------------------------- elements

function paintBox(e: HTMLElement, el: PlanElement) {
  const s = el.style;
  if (s.fill) e.style.background = s.fill;
  if (s.stroke) e.style.border = `${px(s.strokeWidth ?? 2)} solid ${s.stroke}`;
  if (s.radius !== undefined) e.style.borderRadius = radiusCss(s.radius);
  if (s.shadow !== "none") e.style.boxShadow = SHADOWS[s.shadow];
  if (s.padding) e.style.padding = s.padding.map(px).join(" ");
  if (s.blend !== "normal") e.style.mixBlendMode = s.blend;
}

function sizeOuter(outer: HTMLElement, el: PlanElement) {
  const l = el.layout as Record<string, unknown>;
  const w = size(l.width);
  const hh = size(l.height);
  if (w) outer.style.width = w;
  if (hh) outer.style.height = hh;
  const mw = size(l.maxWidth);
  if (mw) outer.style.maxWidth = mw;
  if (typeof l.aspect === "string") outer.style.aspectRatio = l.aspect.replace(":", " / ");
  if (typeof l.grow === "number") outer.style.flexGrow = String(l.grow);
}

function build(el: PlanElement, flow: boolean, sceneId: string): HTMLElement {
  const outer = h("div", `el el-${el.type}`);
  outer.dataset.ref = el.ref;
  const anim = h("div", "anim");
  outer.appendChild(anim);
  if (!flow) {
    outer.style.position = "absolute";
    // Shrink-to-fit would only use the space right of `left`; size to content, capped by maxWidth.
    if (!(el.layout as Record<string, unknown>).width && ["text", "stack", "grid", "button", "badge", "template"].includes(el.type)) outer.style.width = "max-content";
  }
  else outer.style.position = "relative";
  outer.style.zIndex = String(el.z || 0);
  sizeOuter(outer, el);
  const fillsBox = outer.style.width && outer.style.width !== "max-content" || outer.style.height || outer.style.aspectRatio;
  anim.style.transformOrigin = ORIGIN[el.style.origin] ?? "50% 50%";
  const node: Node = { el, outer, anim, words: [], chars: [], sceneId };
  // In stacks, grids and device pages the outer box is sized by the container; fill it.
  if (flow) anim.style.width = "100%";
  const grows = typeof (el.layout as Record<string, unknown>).grow === "number";
  if (grows) anim.style.height = "100%";
  nodes.set(el.ref, node);
  if (el.style.clip || el.style.cutout?.length) masked.push(node);
  if (fillsBox) Object.assign(anim.style, { width: "100%", height: "100%" });

  switch (el.type) {
    case "text": {
      const t = h("div", "txt");
      fontCss(t, el);
      // pre-wrap keeps leading and repeated spaces (code, indentation) and still wraps.
      t.style.whiteSpace = "pre-wrap";
      anim.appendChild(t);
      node.text = t;
      buildText(node, t);
      node.textHTML = t.innerHTML;
      break;
    }
    case "button":
    case "badge": {
      const b = h("div", el.type === "button" ? "btn" : "badge");
      fontCss(b, el);
      Object.assign(b.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", boxSizing: "border-box" });
      if (el.type === "button") {
        b.style.height = px(el.props.height as number);
        if (el.props.variant === "ghost") el.style.fill = undefined as never;
      } else {
        const f = el.font!.size;
        b.style.padding = `${px(f * 0.55)} ${px(f * 1.1)}`;
        b.style.borderRadius = px(999);
        if (el.props.shape === "circle") Object.assign(b.style, { aspectRatio: "1 / 1", borderRadius: "50%", padding: px(f * 0.9) });
        if (el.props.shape === "rect") b.style.borderRadius = px(f * 0.3);
      }
      paintBox(b, el);
      if (el.type === "button" && el.props.variant === "outline") b.style.background = "transparent";
      const label = h("span");
      b.appendChild(label);
      anim.appendChild(b);
      node.box = b;
      node.text = label;
      buildText(node, label);
      node.textHTML = label.innerHTML;
      break;
    }
    case "image": {
      const f = h("div", "frame", { width: "100%", height: "100%", overflow: "hidden", position: "relative" });
      paintBox(f, el);
      const inner = h("div", "inner", { width: "100%", height: "100%" });
      inner.appendChild(picture(el.props.image as never, String(el.props.fit), el.props.focus as number[], el.props.crop as number[] | undefined));
      f.appendChild(inner);
      anim.appendChild(f);
      Object.assign(anim.style, { width: "100%", height: "100%" });
      node.box = f;
      node.img = inner;
      if (!outer.style.width) outer.style.width = flow ? "100%" : px(400 * k);
      if (!outer.style.height && !outer.style.aspectRatio) outer.style.height = flow ? "auto" : px(400 * k);
      if (flow && !outer.style.height && !outer.style.aspectRatio) outer.style.aspectRatio = "4 / 3";
      break;
    }
    case "connector": {
      // Covers its parent (the scene, or a group); the line is drawn between its ends every frame.
      if (!outer.style.width) outer.style.width = "100%";
      if (!outer.style.height) outer.style.height = "100%";
      Object.assign(anim.style, { width: "100%", height: "100%" });
      outer.style.pointerEvents = "none";
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      Object.assign(svg.style, { display: "block", overflow: "visible" });
      const geo = document.createElementNS(SVGNS, "path");
      geo.setAttribute("pathLength", "1");
      geo.setAttribute("fill", "none");
      geo.setAttribute("stroke", el.style.stroke ?? "#ffffff");
      geo.setAttribute("stroke-width", String(el.style.strokeWidth ?? 3 * k));
      geo.setAttribute("stroke-linecap", "round");
      const arrow = String(el.props.arrow);
      let markerId = "";
      if (arrow !== "none") {
        const id = `sini-arrow-${++gradientId}`;
        const defs = document.createElementNS(SVGNS, "defs");
        const m = document.createElementNS(SVGNS, "marker");
        for (const [a, v] of [["id", id], ["viewBox", "0 0 10 10"], ["refX", "8"], ["refY", "5"], ["markerWidth", "4"], ["markerHeight", "4"], ["orient", "auto-start-reverse"]]) m.setAttribute(a!, v!);
        const tip = document.createElementNS(SVGNS, "path");
        tip.setAttribute("d", "M0 0L10 5L0 10z");
        tip.setAttribute("fill", el.style.stroke ?? "#ffffff");
        m.appendChild(tip);
        defs.appendChild(m);
        svg.appendChild(defs);
        markerId = id;
      }
      svg.appendChild(geo);
      anim.appendChild(svg);
      node.box = geo;
      node.outline = geo;
      connectors.push({ node, geo, svg, arrow, marker: markerId });
      break;
    }
    case "particles": {
      if (!outer.style.width) outer.style.width = "100%";
      if (!outer.style.height) outer.style.height = "100%";
      Object.assign(anim.style, { width: "100%", height: "100%", position: "relative", overflow: "hidden" });
      outer.style.pointerEvents = "none";
      const count = Number(el.props.count);
      const [s0, s1] = el.props.size as [number, number];
      const rand = mulberry32(Number(el.props.seed) * 7907 + plan.seed * 31 + count);
      const dots: HTMLElement[] = [];
      const seeds: number[][] = [];
      for (let i = 0; i < count; i++) {
        // x, y, size, phase, phase 2, speed factor
        const sd = [rand(), rand(), s0 + (s1 - s0) * rand(), rand() * Math.PI * 2, rand() * Math.PI * 2, 0.6 + rand() * 0.8];
        const d = h("div", "particle", { position: "absolute", left: "0", top: "0", width: px(sd[2]!), height: px(sd[2]!), borderRadius: "50%", background: el.style.fill ?? "#fff", boxShadow: `0 0 ${px(sd[2]! * 1.5)} ${el.style.fill ?? "#fff"}` });
        anim.appendChild(d);
        dots.push(d);
        seeds.push(sd);
      }
      node.particles = { dots, seeds };
      break;
    }
    case "path": {
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      Object.assign(svg.style, { display: "block", overflow: "visible" });
      const geo = document.createElementNS(SVGNS, "path");
      geo.setAttribute("d", String(el.props.d));
      geo.setAttribute("pathLength", "1");
      geo.setAttribute("fill", svgPaint(svg, el.style.fill ?? "none"));
      if (el.style.stroke) {
        geo.setAttribute("stroke", svgPaint(svg, el.style.stroke));
        geo.setAttribute("stroke-linecap", "round");
        geo.setAttribute("stroke-linejoin", "round");
      }
      svg.appendChild(geo);
      anim.appendChild(svg);
      Object.assign(anim.style, { width: "100%", height: "100%" });
      node.box = geo;
      node.outline = geo;
      const vb = el.props.viewBox as number[] | undefined;
      if (vb) svg.setAttribute("viewBox", vb.join(" "));
      paths.push({ node, svg, geo, auto: !vb });
      break;
    }
    case "shape": {
      const shape = String(el.props.shape);
      const sw = el.style.strokeWidth ?? (el.style.stroke ? 2 : 0);
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      Object.assign(svg.style, { display: "block", overflow: "visible" });
      // A rect with different corner radii is drawn as a path once its size is known (finishStrokes).
      const corners = shape === "rect" && Array.isArray(el.style.radius) ? (el.style.radius as number[]) : undefined;
      const geo = document.createElementNS(SVGNS, corners ? "path" : shape === "line" ? "line" : shape === "circle" || shape === "ellipse" ? "ellipse" : "rect") as SVGGeometryElement;
      if (corners) cornerRects.push({ node, geo: geo as SVGPathElement, svg, corners, sw });
      geo.setAttribute("pathLength", "1");
      // Geometry with calc() must be set as CSS properties (SVG 2); Chrome rejects it in attributes.
      if (shape === "line") {
        for (const [a, v] of [["x1", "0"], ["x2", "100%"], ["y1", "50%"], ["y2", "50%"]]) geo.setAttribute(a!, v!);
      } else if (shape === "circle" || shape === "ellipse") {
        for (const [a, v] of [["cx", "50%"], ["cy", "50%"], ["rx", `calc(50% - ${sw / 2}px)`], ["ry", `calc(50% - ${sw / 2}px)`]]) geo.style.setProperty(a!, v!);
      } else if (!corners) {
        for (const [a, v] of [["x", px(sw / 2)], ["y", px(sw / 2)], ["width", `calc(100% - ${sw}px)`], ["height", `calc(100% - ${sw}px)`]]) geo.style.setProperty(a!, v!);
      }
      geo.setAttribute("fill", svgPaint(svg, el.style.fill ?? "none"));
      if (el.style.stroke) {
        geo.setAttribute("stroke", svgPaint(svg, el.style.stroke));
        geo.setAttribute("stroke-width", String(sw));
        geo.setAttribute("stroke-linecap", "round");
      }
      svg.appendChild(geo);
      anim.appendChild(svg);
      Object.assign(anim.style, { width: "100%", height: "100%" });
      node.box = svg;
      node.outline = geo;
      node.box = geo;
      if (!outer.style.width) outer.style.width = flow ? "100%" : px(shape === "line" ? 360 * k : 120 * k);
      if (!outer.style.height) outer.style.height = shape === "line" ? px(Math.max(sw, 2)) : flow ? px(120 * k) : outer.style.width;
      if (shape === "pill") pills.push({ outer, geo, sw });
      else if (typeof el.style.radius === "number" && shape === "rect") geo.style.setProperty("rx", px(el.style.radius));
      break;
    }
    case "group":
    case "stack":
    case "grid": {
      const c = h("div", `container ${el.type}`, { position: "relative", boxSizing: "border-box" });
      paintBox(c, el);
      if (el.type === "stack") {
        const p = el.props;
        const align = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", baseline: "baseline" }[String(p.align)] ?? "flex-start";
        const justify = { start: "flex-start", center: "center", end: "flex-end", "space-between": "space-between" }[String(p.justify)] ?? "flex-start";
        Object.assign(c.style, { display: "flex", flexDirection: p.direction === "horizontal" ? "row" : "column", gap: px(Number(p.gap)), alignItems: align, justifyContent: justify });
      } else if (el.type === "grid") {
        if (flow && !outer.style.width) outer.style.width = "100%";
        const p = el.props;
        Object.assign(c.style, { display: "grid", gridTemplateColumns: `repeat(${p.columns}, minmax(0, 1fr))`, columnGap: px(Number(p.gap)), rowGap: px(Number(p.rowGap)), justifyItems: "stretch" });
      }
      if (fillsBox || flow) c.style.width = "100%";
      if (fillsBox || grows) c.style.height = "100%";
      anim.appendChild(c);
      node.box = c;
      for (const child of el.children) c.appendChild(build(child, el.type !== "group", sceneId));
      break;
    }
    case "browser":
    case "phone":
      buildDevice(node, el, sceneId);
      break;
    case "toast": {
      const f = el.font!;
      const bf = el.props.bodyFont as Font;
      const box = h("div", "toast", { display: "inline-flex", alignItems: "center", gap: px(f.size * 0.65), padding: `${px(f.size * 0.75)} ${px(f.size * 1.0)}`, boxSizing: "border-box", whiteSpace: "nowrap" });
      paintBox(box, el);
      const icon = h("span", "toast-icon", { width: px(f.size * 1.3), height: px(f.size * 1.3), flex: "none", color: el.style.stroke ?? f.color, display: "none" });
      const text = h("div", "toast-text", { display: "flex", flexDirection: "column", gap: px(bf.size * 0.15), overflow: "hidden" });
      const title = h("div", "toast-title");
      applyFont(title, f);
      const body = h("div", "toast-body", { opacity: "0.72" });
      applyFont(body, bf);
      text.append(title, body);
      box.append(icon, text);
      anim.appendChild(box);
      node.box = box;
      node.toast = { icon, iconName: null, title, body, text };
      setToastIcon(node, (el.props.icon as string | null) ?? null);
      title.textContent = String(el.props.title ?? "");
      body.textContent = String(el.props.body ?? "");
      body.style.display = el.props.body ? "block" : "none";
      break;
    }
    case "chart":
      buildChart(node, flow);
      break;
    case "svg":
      buildSvg(node, flow);
      break;
    case "template":
      buildTemplate(node);
      break;
    case "progress": {
      const f = el.font!;
      const steps = (el.props.steps as string[]) ?? [];
      const n = Math.max(1, steps.length);
      const d = Math.max(f.size * 0.85, 10);
      const lt = Math.max(f.size * 0.14, 2);
      const fill = el.style.fill ?? f.color;
      const base = el.style.stroke ?? fadeColour(fill, 0.25);
      const grid = h("div", "progress", { display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, position: "relative", rowGap: px(f.size * 0.55) });
      const inset = `${100 / n / 2}%`;
      const track = h("div", "progress-track", { position: "absolute", top: px(d / 2 - lt / 2), left: inset, right: inset, height: px(lt), background: base, borderRadius: px(lt) });
      const bar = h("div", "progress-fill", { position: "absolute", top: "0", left: "0", height: "100%", width: "0%", background: fill, borderRadius: px(lt) });
      track.appendChild(bar);
      grid.appendChild(track);
      const dots: HTMLElement[] = [];
      const labels: HTMLElement[] = [];
      steps.forEach((label, i) => {
        const dot = h("div", "progress-dot", { gridRow: "1", gridColumn: String(i + 1), justifySelf: "center", width: px(d), height: px(d), borderRadius: "50%", boxSizing: "border-box", border: `${px(Math.max(2, lt))} solid ${base}`, background: "transparent", position: "relative", zIndex: "1" });
        const lab = h("div", "progress-label", { gridRow: "2", gridColumn: String(i + 1), textAlign: "center", padding: `0 ${px(f.size * 0.2)}` });
        applyFont(lab, f);
        lab.textContent = label;
        grid.append(dot, lab);
        dots.push(dot);
        labels.push(lab);
      });
      anim.appendChild(grid);
      if (!outer.style.width || outer.style.width === "max-content") outer.style.width = flow ? "100%" : px(Math.min(W - 144 * k, 160 * k * n));
      node.box = grid;
      node.progress = { dots, labels, fill: bar, track };
      break;
    }
    case "icon": {
      const f = el.font!;
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", String(el.style.strokeWidth ?? 2));
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.innerHTML = window.__SINI_ICONS__?.[String(el.props.name)] ?? "";
      Object.assign(svg.style, { display: "block", width: "100%", height: "100%", color: f.color, overflow: "visible" });
      if (!outer.style.width || outer.style.width === "max-content") outer.style.width = px(f.size);
      if (!outer.style.height) outer.style.height = outer.style.width;
      Object.assign(anim.style, { width: "100%", height: "100%" });
      anim.appendChild(svg);
      node.box = svg;
      node.outlines = [...svg.querySelectorAll<SVGGeometryElement>("path, circle, rect, line, polyline, polygon, ellipse")];
      for (const g of node.outlines) g.setAttribute("pathLength", "1");
      break;
    }
  }
  return outer;
}

function buildDevice(node: Node, el: PlanElement, sceneId: string) {
  const { outer, anim } = node;
  const dark = el.props.chrome === "dark";
  const none = el.props.chrome === "none";
  const page = el.pages?.[0];
  if (el.type === "browser") {
    const width = typeof (el.layout as Record<string, unknown>).width === "number" ? ((el.layout as Record<string, unknown>).width as number) : 1100 * k;
    outer.style.width = px(width);
    const s = width / 1280;
    const toolbar = none ? 0 : 44 * s;
    const layoutH = (el.layout as Record<string, unknown>).height;
    const totalH = typeof layoutH === "number" ? layoutH : toolbar + 800 * s;
    outer.style.height = px(totalH);
    Object.assign(anim.style, { width: "100%", height: "100%" });
    const radius = 14 * s * 1.6;
    const body = h("div", "device-body", { position: "absolute", inset: "0", borderRadius: px(radius), overflow: "hidden", background: page?.background ?? "#fff", boxShadow: el.style.shadow !== "none" ? SHADOWS[el.style.shadow] : "none" });
    if (!none) {
      const bar = h("div", "toolbar", { height: px(toolbar), display: "flex", alignItems: "center", gap: px(10 * s), padding: `0 ${px(18 * s)}`, background: dark ? "#1F2128" : "#ECE8E2", borderBottom: `${px(Math.max(1, 1.5 * s))} solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}` });
      for (let i = 0; i < 3; i++) bar.appendChild(h("i", "", { width: px(12 * s), height: px(12 * s), borderRadius: "50%", background: dark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.18)", flex: "none" }));
      const url = h("div", "url", { marginLeft: px(14 * s), flex: "1", height: px(26 * s), borderRadius: px(13 * s), background: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", padding: `0 ${px(14 * s)}`, fontFamily: `"${plan.fonts.body}"`, fontSize: px(15 * s), color: dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)", whiteSpace: "nowrap", overflow: "hidden" });
      const urlText = h("span");
      urlText.textContent = String(el.props.url ?? "");
      url.appendChild(urlText);
      bar.appendChild(url);
      body.appendChild(bar);
      node.url = urlText;
      node.urlText = String(el.props.url ?? "");
    }
    const vp = h("div", "viewport", { position: "relative", height: px(totalH - toolbar), overflow: "hidden" });
    const screen = h("div", "screen", { width: "1280px", height: px((totalH - toolbar) / s), transform: `scale(${s})`, transformOrigin: "0 0", position: "absolute", left: "0", top: "0" });
    vp.appendChild(screen);
    body.appendChild(vp);
    anim.appendChild(body);
    node.body = body;
    node.screen = screen;
    fillScreen(node, el, screen, sceneId);
    const svg = document.createElementNS(SVGNS, "svg");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" });
    const rect = document.createElementNS(SVGNS, "rect");
    for (const [a, v] of [["x", "0.75px"], ["y", "0.75px"], ["width", "calc(100% - 1.5px)"], ["height", "calc(100% - 1.5px)"], ["rx", px(radius)]]) rect.style.setProperty(a!, v!);
    for (const [a, v] of [["fill", "none"], ["pathLength", "1"], ["stroke", dark ? "rgba(238,230,218,0.55)" : "rgba(0,0,0,0.14)"], ["stroke-width", String(Math.max(1.5, 2 * k))]]) rect.setAttribute(a!, v!);
    svg.appendChild(rect);
    anim.appendChild(svg);
    node.outline = rect;
  } else {
    const width = typeof (el.layout as Record<string, unknown>).width === "number" ? ((el.layout as Record<string, unknown>).width as number) : 560 * k;
    outer.style.width = px(width);
    outer.style.height = px(width * 2.07);
    Object.assign(anim.style, { width: "100%", height: "100%" });
    const s = (width * 0.92) / 390;
    const frame = h("div", "device-body", { position: "absolute", inset: "0", borderRadius: px(width * 0.135), background: dark || el.props.chrome !== "light" ? "#0f0b0a" : "#E9E6E1", boxShadow: el.style.shadow !== "none" ? SHADOWS[el.style.shadow] : SHADOWS.soft, padding: px(width * 0.04), boxSizing: "border-box" });
    const vp = h("div", "viewport", { position: "relative", width: "100%", height: "100%", borderRadius: px(width * 0.1), overflow: "hidden", background: page?.background ?? "#fff" });
    const screen = h("div", "screen", { width: "390px", height: px((width * 2.07 - width * 0.08) / s), transform: `scale(${s})`, transformOrigin: "0 0", position: "absolute", left: "0", top: "0" });
    vp.appendChild(screen);
    vp.appendChild(h("div", "notch", { position: "absolute", left: "50%", top: px(11 * s), width: px(110 * s), height: px(32 * s), marginLeft: px(-55 * s), borderRadius: px(16 * s), background: "#0f0b0a", zIndex: "5" }));
    frame.appendChild(vp);
    anim.appendChild(frame);
    node.body = frame;
    node.screen = screen;
    fillScreen(node, el, screen, sceneId);
  }
}

function fillScreen(node: Node, el: PlanElement, screen: HTMLElement, sceneId: string) {
  node.pages = new Map();
  const top = el.type === "phone" && el.props.statusBar !== false ? 54 : 0;
  const content = el.props.content as never;
  const pageBox = (bg: string) => h("div", "page", { position: "absolute", left: "0", top: "0", width: "100%", minHeight: "100%", boxSizing: "border-box", background: bg });
  if (content) {
    // A screenshot is one page, shown at the screen's width; tall ones can scroll.
    const pg = pageBox("#FFFFFF");
    const pic = picture(content, "cover");
    Object.assign(pic.style, { height: "auto" });
    pg.appendChild(pic);
    screen.appendChild(pg);
    node.pages.set("main", { page: pg, background: "#FFFFFF" });
    node.img = pg;
  } else {
    for (const page of el.pages ?? []) {
      const pg = pageBox(page.background);
      Object.assign(pg.style, { display: "flex", flexDirection: "column", gap: px(page.gap), padding: page.padding.map((v, i) => px(v + (i === 0 ? top : 0))).join(" ") });
      pg.dataset.screen = page.name;
      for (const child of page.children) pg.appendChild(build(child, true, sceneId));
      screen.appendChild(pg);
      node.pages.set(page.name, { page: pg, background: page.background });
    }
  }
  if (el.overlay?.length) {
    const ov = h("div", "overlay", { position: "absolute", inset: "0", zIndex: "20" });
    for (const child of el.overlay) ov.appendChild(build(child, false, sceneId));
    screen.appendChild(ov);
  }
  if (top) {
    // A status bar that stays put while pages scroll underneath.
    const bar = h("div", "statusbar", { position: "absolute", left: "0", top: "0", width: "100%", height: px(top), zIndex: "10", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", boxSizing: "border-box", font: `600 15px "${plan.fonts.body}", "Inter Tight"`, color: "#111" });
    const time = h("span");
    time.textContent = "9:41";
    const battery = h("span", "", { width: "26px", height: "12px", border: "1.5px solid currentColor", borderRadius: "3px", position: "relative", opacity: "0.8" });
    battery.appendChild(h("i", "", { position: "absolute", left: "2px", top: "2px", bottom: "2px", width: "70%", background: "currentColor", borderRadius: "1px" }));
    bar.append(time, battery);
    screen.appendChild(bar);
    node.statusBar = bar;
  }
}

// ---------------------------------------------------------------- toast and progress

let currentT = 0;

function fadeColour(css: string, alpha: number): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : css;
}

function setToastIcon(n: Node, name: string | null) {
  const t = n.toast!;
  if (t.iconName === name) return;
  t.iconName = name;
  t.icon.textContent = "";
  t.icon.style.display = name ? "block" : "none";
  if (name) t.icon.appendChild(iconSvg(name, 2.2));
}

/** Round line caps draw a dot where a stroke starts, even at zero length: fade a stroke in until the drawn part
 *  is twice as long as the stroke is wide. */
const strokeGeom = new WeakMap<Element, { len: number; width: number }>();
function capFade(g: Element, drawn: number): number {
  let m = strokeGeom.get(g);
  if (!m) {
    const len = g instanceof SVGGeometryElement ? g.getTotalLength() * scaleOf(g) : 0;
    m = { len, width: (parseFloat(getComputedStyle(g).strokeWidth) || 1) * scaleOf(g) };
    strokeGeom.set(g, m);
  }
  return m.len > 0 ? clamp01((drawn * m.len) / (2 * m.width)) : clamp01(drawn / 0.08);
}
/** User units to screen px for an SVG element (both length and stroke width scale the same way). */
function scaleOf(g: Element): number {
  const svg = (g as SVGElement).ownerSVGElement;
  const vb = svg?.viewBox?.baseVal;
  return svg && vb && vb.width ? svg.getBoundingClientRect().width / vb.width || 1 : 1;
}

/** Rolling text is clipped to its line plus ROLL_PAD above and below (glyphs overhang tight line heights),
 *  and travels a line plus ROLL_GAP so it fully leaves that area. */
const ROLL_PAD = "0.2em";
const ROLL_GAP = "0.45em";

/** Roll `from` up and `to` in, easing the width between the two texts. */
function rollInto(e: HTMLElement, from: string, to: string, p: number) {
  if (p >= 1) {
    e.textContent = to;
    e.style.width = "";
    return;
  }
  e.textContent = "";
  const wrap = h("span", "", { display: "inline-grid", overflow: "hidden", verticalAlign: "top", padding: `${ROLL_PAD} 0`, margin: `-${ROLL_PAD} 0` });
  const a = h("span", "", { gridArea: "1 / 1", transform: `translateY(calc(${-p} * (100% + ${ROLL_GAP})))`, whiteSpace: "nowrap" });
  const b = h("span", "", { gridArea: "1 / 1", transform: `translateY(calc(${1 - p} * (100% + ${ROLL_GAP})))`, whiteSpace: "nowrap" });
  a.textContent = from;
  b.textContent = to;
  wrap.append(a, b);
  e.appendChild(wrap);
  const wa = a.offsetWidth;
  const wb = b.offsetWidth;
  wrap.style.width = px(wa + (wb - wa) * p);
}

function applyToast(n: Node, f: ElementFrame) {
  const t = n.toast!;
  const el = n.el;
  setToastIcon(n, f.steps?.icon !== undefined ? f.steps.icon || null : (el.props.icon as string | null) ?? null);
  // `loader` icons spin.
  const svg = t.icon.firstElementChild as SVGElement | null;
  if (svg) svg.style.transform = t.iconName?.startsWith("loader") ? `rotate(${(currentT * 360) % 360}deg)` : "";
  const c = f.contents ?? {};
  const title = String(el.props.title ?? "");
  const body = String(el.props.body ?? "");
  if (c.title) rollInto(t.title, c.title.from, c.title.to, c.title.p);
  else t.title.textContent = title;
  const bodyNow = c.body ? (c.body.p >= 1 ? c.body.to : c.body.from || c.body.to) : body;
  t.body.style.display = bodyNow ? "block" : "none";
  if (c.body && (c.body.from || c.body.to)) rollInto(t.body, c.body.from, c.body.to, c.body.p);
  else t.body.textContent = body;
}

function applyProgress(n: Node, value: number) {
  const pr = n.progress!;
  const el = n.el;
  const steps = pr.dots.length;
  const fill = el.style.fill ?? el.font!.color;
  const base = el.style.stroke ?? fadeColour(fill, 0.25);
  const v = Math.max(0, Math.min(steps - 1, value));
  pr.fill.style.width = steps > 1 ? `${(v / (steps - 1)) * 100}%` : "100%";
  const current = Math.floor(v + 1e-6);
  pr.dots.forEach((d, i) => {
    const done = v >= i - 1e-6;
    d.style.background = done ? fill : "transparent";
    d.style.borderColor = done ? fill : base;
    // A small pop as the line reaches each dot.
    const near = Math.abs(v - i);
    const own = currentFrame?.elements[`${el.ref}#${((el.props.steps as string[]) ?? [])[i]}`];
    const ownScale = own ? num(own.props.scale, 1) * num(own.props.focusScale, 1) : 1;
    d.style.transform = `scale(${(near < 0.25 ? 1 + (0.25 - near) * 0.8 : 1) * ownScale})`;
    const ownDim = own ? num(own.props.dim, 1) : 1;
    d.style.opacity = String(ownDim);
    pr.labels[i]!.style.opacity = String((done ? 1 : 0.5) * ownDim);
    pr.labels[i]!.style.fontWeight = i === current ? "700" : String(el.font!.weight);
  });
}

// ---------------------------------------------------------------- svg and template

function buildSvg(node: Node, flow: boolean) {
  const { el, outer, anim } = node;
  const src = el.props.image as { kind: string; src?: string; color?: string; seed?: number };
  const markup = src.kind === "file" && src.src ? window.__SINI_SVGS__?.[src.src] : undefined;
  if (!outer.style.width || outer.style.width === "max-content") outer.style.width = flow ? "100%" : px(320 * k);
  Object.assign(anim.style, { width: "100%", height: "100%" });
  if (!markup) {
    if (!outer.style.height && !outer.style.aspectRatio) outer.style.height = outer.style.width;
    anim.appendChild(picture(src.kind === "file" ? { kind: "placeholder", color: "#8a8178", seed: 1 } : (src as never), "cover"));
    return;
  }
  const holder = h("div", "svg", { width: "100%", height: "100%" });
  holder.innerHTML = markup;
  const svg = holder.querySelector("svg");
  if (!svg) return;
  if (el.props.color) holder.style.color = String(el.props.color);
  const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const vw = vb[2] || Number.parseFloat(svg.getAttribute("width") ?? "") || 100;
  const vh = vb[3] || Number.parseFloat(svg.getAttribute("height") ?? "") || 100;
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  Object.assign(svg.style, { width: "100%", height: "100%", display: "block", overflow: "visible" });
  if (!outer.style.height && !outer.style.aspectRatio) outer.style.aspectRatio = `${vw} / ${vh}`;
  anim.appendChild(holder);
  node.box = svg;
  const geos = [...svg.querySelectorAll<SVGGeometryElement>("path, circle, rect, line, polyline, polygon, ellipse")];
  node.outlines = geos;
  node.filledOnly = new Set();
  for (const g of geos) g.setAttribute("pathLength", "1");
  if (plan.tracks.some((t) => t.ref === el.ref && t.kind === "tween" && t.prop === "draw")) pendingSvgs.push({ node, size: Math.max(vw, vh) });
}

const pendingSvgs: { node: Node; size: number }[] = [];

/** Needs computed styles, so it runs once the stage is in the document. */
function prepareSvgDrawing() {
  for (const { node, size } of pendingSvgs) {
    for (const g of node.outlines ?? []) {
      const cs = getComputedStyle(g);
      if ((cs.stroke === "none" || !cs.stroke) && cs.fill && cs.fill !== "none") {
        g.style.stroke = cs.fill;
        g.style.strokeWidth = String(size / 110);
        node.filledOnly!.add(g);
      }
    }
  }
}

function buildTemplate(node: Node) {
  const { el, anim } = node;
  const host = h("div", "template");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>*,*::before,*::after{transition:none!important;animation:none!important;will-change:auto!important}:host{display:block}${String(el.props.css ?? "")}</style>${String(el.props.html ?? "")}`;
  // Defence in depth (the validator already rejects these): nothing in a template may run code or load from outside.
  for (const bad of root.querySelectorAll("script, iframe, object, embed, link, meta, base, form")) bad.remove();
  for (const e of root.querySelectorAll("*")) {
    for (const a of [...e.attributes]) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith("on") || ((a.name === "src" || a.name === "href" || a.name.endsWith(":href")) && /^(https?:|javascript:|\/\/)/.test(v))) e.removeAttribute(a.name);
    }
  }
  for (const [k, v] of Object.entries((el.props.vars as Record<string, unknown>) ?? {})) host.style.setProperty(k, String(v));
  anim.appendChild(host);
  node.host = host;
  node.box = host;
}

// ---------------------------------------------------------------- camera and match cuts

type CameraKey = { focus: string; zoom: number };

/** A focus target in the group's own (unzoomed) coordinates. Call with the camera transform reset. */
function focusPoint(n: Node, layer: HTMLElement, focus: string): [number, number] {
  const fr = ANCHOR_FRAC[focus];
  if (fr) return [fr[0] * layer.offsetWidth, fr[1] * layer.offsetHeight];
  const [x, y] = targetPoint(focus);
  const st = stage.getBoundingClientRect();
  const r = layer.getBoundingClientRect();
  return [x - (r.left - st.left) / scale, y - (r.top - st.top) / scale];
}

function applyCamera(n: Node, cam: { from: CameraKey; to: CameraKey; p: number }) {
  const layer = n.box as HTMLElement | undefined;
  if (!layer || !(layer instanceof HTMLElement)) return;
  layer.style.transformOrigin = "0 0";
  layer.style.transform = "";
  const a = focusPoint(n, layer, cam.from.focus);
  const b = cam.from.focus === cam.to.focus ? a : focusPoint(n, layer, cam.to.focus);
  const fx = a[0] + (b[0] - a[0]) * cam.p;
  const fy = a[1] + (b[1] - a[1]) * cam.p;
  // Geometric zoom interpolation feels even whether zooming in or out.
  const z0 = Math.max(0.05, cam.from.zoom);
  const z1 = Math.max(0.05, cam.to.zoom);
  const z = z0 * (z1 / z0) ** cam.p;
  const cx = layer.offsetWidth / 2;
  const cy = layer.offsetHeight / 2;
  layer.style.transform = `translate(${px(cx - z * fx)}, ${px(cy - z * fy)}) scale(${z})`;
}

const matchClones = new Map<string, HTMLElement>();

/** For image elements, a copy of the picture rides the growing rectangle, so the cut reads as continuous. */
function buildMatchClones() {
  for (const s of plan.scenes) {
    const tr = s.transition;
    if (tr?.type !== "matchCut" || !tr.matchFrom) continue;
    const from = nodes.get(tr.matchFrom);
    if (!from || from.el.type !== "image") continue;
    const clone = h("div", "match-clone", { position: "absolute", overflow: "hidden", zIndex: "790", display: "none", pointerEvents: "none" });
    clone.appendChild(picture(from.el.props.image as never, "cover", from.el.props.focus as number[], from.el.props.crop as number[] | undefined));
    sceneEls.get(s.id)!.appendChild(clone);
    matchClones.set(s.id, clone);
  }
}

/** matchCut: reveal the incoming scene inside a rectangle that grows from the outgoing element. */
function applyMatchCuts(fr: Frame) {
  for (const c of matchClones.values()) c.style.display = "none";
  for (const sf of fr.scenes) {
    const inc = sf.incoming;
    if (!sf.visible || !inc || inc.transition.type !== "matchCut") continue;
    const sec = sceneEls.get(sf.id)!;
    const tr = inc.transition;
    const fromNode = tr.matchFrom ? nodes.get(tr.matchFrom) : undefined;
    if (!fromNode) {
      sec.style.opacity = String(inc.p);
      continue;
    }
    const st = stage.getBoundingClientRect();
    const fr0 = visualRect(fromNode);
    const from = { x: (fr0.left - st.left) / scale, y: (fr0.top - st.top) / scale, w: fr0.width / scale, h: fr0.height / scale };
    // Circles, ellipses, pills and circular badges are as round as their shape, whatever style.radius says.
    const radiusOf = (nd: Node, w: number, h = w) => {
      const shape = String(nd.el.props.shape ?? "");
      if (["circle", "ellipse", "pill"].includes(shape)) return Math.min(w, h) / 2;
      return radiusNum(nd.el.style.radius) * (w / Math.max(1, nd.outer.offsetWidth || w));
    };
    const full = { x: 0, y: 0, w: W, h: H };
    const toNode = tr.matchTo && tr.matchTo !== "background" ? nodes.get(tr.matchTo) : undefined;
    const toBox = toNode ? staticBoxes.get(toNode.el.ref) : undefined;
    const lerp = (a: typeof from, b: typeof from, q: number) => ({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, w: a.w + (b.w - a.w) * q, h: a.h + (b.h - a.h) * q });
    const r0 = radiusOf(fromNode, from.w, from.h);
    let rect: typeof from;
    let radius: number;
    if (toNode && toBox) {
      // Into the target element first, then open out to the whole frame.
      const to = { x: toBox.x, y: toBox.y, w: toBox.width, h: toBox.height };
      const r1 = radiusOf(toNode, to.w, to.h);
      if (inc.p < 0.7) {
        const q = inc.p / 0.7;
        rect = lerp(from, to, q);
        radius = r0 + (r1 - r0) * q;
      } else {
        const q = (inc.p - 0.7) / 0.3;
        rect = lerp(to, full, q);
        radius = r1 * (1 - q);
      }
    } else {
      rect = lerp(from, full, inc.p);
      radius = r0 * (1 - inc.p);
    }
    sec.style.clipPath = inc.p >= 1 ? "" : `inset(${px(rect.y)} ${px(W - rect.x - rect.w)} ${px(H - rect.y - rect.h)} ${px(rect.x)} round ${px(Math.max(0, radius))})`;
    const clone = matchClones.get(sf.id);
    if (clone && inc.p < 1) {
      Object.assign(clone.style, {
        display: "block",
        left: px(rect.x),
        top: px(rect.y),
        width: px(rect.w),
        height: px(rect.h),
        borderRadius: px(Math.max(0, radius)),
        opacity: String(1 - clamp01((inc.p - 0.35) / 0.5)),
      });
    }
  }
}

// ---------------------------------------------------------------- charts

function buildChart(node: Node, flow: boolean) {
  const { el, outer, anim } = node;
  const f = el.font!;
  const data = (el.props.data as [string, number][]) ?? [];
  const max = Number(el.props.max) || 1;
  const kind = String(el.props.kind);
  const fill = el.style.fill ?? f.color;
  const hiColour = el.style.stroke ?? fill;
  const highlight = el.props.highlight as string | null;
  const show = el.props.showValues !== false;
  if (!outer.style.width || outer.style.width === "max-content") outer.style.width = flow ? "100%" : px(Math.min(W - 144 * k, 900 * k));
  if (!outer.style.height && !outer.style.aspectRatio) outer.style.height = px((kind === "hbar" ? Math.max(3, data.length) * 1.9 * f.size * 1.6 : 560 * k));
  Object.assign(anim.style, { width: "100%", height: "100%" });
  const valueFont: Font = { ...f, weight: Math.max(600, f.weight) };
  const bars: HTMLElement[] = [];
  const values: HTMLElement[] = [];
  const valueLabel = (label: string) => {
    const v = h("div", "chart-value", { whiteSpace: "nowrap", pointerEvents: "none" });
    applyFont(v, valueFont);
    if (label === highlight) v.style.fontWeight = "800";
    values.push(v);
    return v;
  };
  const baseline = `${px(Math.max(1, 1.5 * k))} solid ${fadeColour(f.color, 0.3)}`;
  if (kind === "hbar") {
    const grid = h("div", "chart hbar", { display: "grid", gridTemplateColumns: "auto 1fr", alignContent: "space-evenly", columnGap: px(f.size * 0.8), width: "100%", height: "100%" });
    for (const [label, value] of data) {
      const lab = h("div", "chart-label", { textAlign: "right", whiteSpace: "nowrap" });
      applyFont(lab, f);
      lab.textContent = label;
      const track = h("div", "", { position: "relative", height: px(f.size * 1.6), borderLeft: baseline, paddingRight: px(f.size * 4) });
      const bar = h("div", "chart-bar", { position: "relative", height: "100%", width: `${(value / max) * 100}%`, background: label === highlight ? hiColour : fill, borderRadius: `0 ${px(6 * k)} ${px(6 * k)} 0`, transformOrigin: "0% 50%" });
      if (show) {
        const v = valueLabel(label);
        Object.assign(v.style, { position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: px(f.size * 0.4) });
        bar.appendChild(v);
      }
      track.appendChild(bar);
      grid.append(lab, track);
      bars.push(bar);
    }
    anim.appendChild(grid);
    node.chart = { bars, values };
  } else {
    const n = Math.max(1, data.length);
    const wrap = h("div", "chart", { display: "grid", gridTemplateRows: "1fr auto", rowGap: px(f.size * 0.5), width: "100%", height: "100%" });
    const plot = h("div", "chart-plot", { position: "relative", display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, alignItems: "end", borderBottom: baseline, paddingTop: px(show ? f.size * 1.7 : 0) });
    const labels = h("div", "chart-labels", { display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });
    let line: SVGPathElement | undefined;
    if (kind === "line") {
      const svg = document.createElementNS(SVGNS, "svg");
      // The real viewBox and path are set after layout, in pixels (see layoutCharts).
      svg.setAttribute("viewBox", "0 0 100 100");
      Object.assign(svg.style, { position: "absolute", left: "0", right: "0", bottom: "0", width: "100%", height: `calc(100% - ${px(show ? f.size * 1.7 : 0)})`, overflow: "visible" });
      const pts = data.map(([, v], i) => `${((i + 0.5) / n) * 100},${100 - (v / max) * 100}`);
      line = document.createElementNS(SVGNS, "path");
      line.setAttribute("d", `M${pts.join(" L")}`);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", fill);
      line.setAttribute("stroke-width", String(Math.max(3, 4 * k)));
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute("pathLength", "1");
      svg.appendChild(line);
      plot.appendChild(svg);
    }
    for (const [label, value] of data) {
      const col = h("div", "", { position: "relative", height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end" });
      const pct = `${(value / max) * 100}%`;
      let bar: HTMLElement;
      if (kind === "line") {
        // An invisible column to the point's height; the dot sits on top.
        bar = h("div", "chart-bar", { position: "relative", width: "0", height: pct });
        const d = Math.max(10, f.size * 0.55);
        bar.appendChild(h("div", "chart-dot", { position: "absolute", left: px(-d / 2), top: px(-d / 2), width: px(d), height: px(d), borderRadius: "50%", background: label === highlight ? hiColour : fill, boxShadow: `0 0 0 ${px(3 * k)} ${fadeColour(fill, 0.25)}` }));
      } else {
        bar = h("div", "chart-bar", { position: "relative", width: "62%", height: pct, background: label === highlight ? hiColour : fill, borderRadius: `${px(8 * k)} ${px(8 * k)} 0 0`, transformOrigin: "50% 100%" });
      }
      if (show) {
        const v = valueLabel(label);
        Object.assign(v.style, { position: "absolute", left: "50%", bottom: "100%", transform: "translateX(-50%)", marginBottom: px(f.size * (kind === "line" ? 0.6 : 0.3)) });
        bar.appendChild(v);
      }
      col.appendChild(bar);
      plot.appendChild(col);
      bars.push(bar);
      const lab = h("div", "chart-label", { textAlign: "center", padding: `0 ${px(f.size * 0.2)}` });
      applyFont(lab, f);
      if (label === highlight) lab.style.fontWeight = "700";
      lab.textContent = label;
      labels.appendChild(lab);
    }
    wrap.append(plot, labels);
    anim.appendChild(wrap);
    node.chart = { bars, values, ...(line ? { line } : {}) };
  }
  node.box = anim;
}

function applyChart(n: Node, f: ElementFrame) {
  const c = n.chart!;
  const el = n.el;
  const data = (el.props.data as [string, number][]) ?? [];
  const max = Number(el.props.max) || 1;
  const kind = String(el.props.kind);
  const grows = new Map(f.parts.filter((p) => p.kind === "bar").map((p) => [p.index, num(p.props.grow, 1)]));
  let total = 0;
  data.forEach(([label, value], i) => {
    const g = clamp01(grows.get(i) ?? 1);
    total += g;
    const bar = c.bars[i]!;
    const size = `${(value / max) * 100 * (kind === "line" ? 1 : g)}%`;
    if (kind === "hbar") bar.style.width = size;
    else bar.style.height = size;
    if (kind === "line") (bar.firstElementChild as HTMLElement).style.transform = `scale(${g})`;
    const v = c.values[i];
    if (v) {
      v.textContent = formatNumber(value * g, (el.props.format as string | null) ?? undefined, Number(el.props.decimals ?? 0));
      v.style.opacity = g > 0.02 ? "1" : "0";
    }
    // A bar animated on its own (e.g. pulse on "meals#Q4").
    const pf = currentFrame?.elements[`${el.ref}#${label}`];
    if (pf) {
      const p = pf.props;
      bar.style.transform = `translate(${px(num(p.x, 0))}, ${px(num(p.y, 0))}) scale(${num(p.scale, 1) * num(p.focusScale, 1)})`;
      bar.style.opacity = String(pf.visible ? clamp01(num(p.opacity, 1) * num(p.dim, 1)) : 0);
    }
  });
  if (c.line) {
    c.line.style.strokeDasharray = "1";
    c.line.style.strokeDashoffset = String(1 - (data.length ? total / data.length : 1));
  }
}

let currentFrame: Frame | undefined;

/** Line charts: once sizes are known, draw the path in real pixels so its stroke and dash stay even. */
function layoutCharts() {
  for (const n of nodes.values()) {
    const line = n.chart?.line;
    if (!line) continue;
    const svg = line.ownerSVGElement!;
    const w = svg.clientWidth || 100;
    const hh = svg.clientHeight || 100;
    svg.setAttribute("viewBox", `0 0 ${w} ${hh}`);
    const data = (n.el.props.data as [string, number][]) ?? [];
    const max = Number(n.el.props.max) || 1;
    const pts = data.map(([, v], i) => `${((i + 0.5) / data.length) * w},${hh - (v / max) * hh}`);
    line.setAttribute("d", `M${pts.join(" L")}`);
  }
}

/** The drawn element for a named part: a chart bar (or line point) or a progress step's dot. */
function partElement(n: Node, name: string): HTMLElement | undefined {
  if (n.progress) return n.progress.dots[((n.el.props.steps as string[]) ?? []).indexOf(name)];
  if (n.chart) {
    const i = ((n.el.props.data as [string, number][]) ?? []).findIndex(([l]) => l === name);
    const bar = n.chart.bars[i];
    return n.el.props.kind === "line" ? (bar?.firstElementChild as HTMLElement | undefined) : bar;
  }
  return undefined;
}

// ---------------------------------------------------------------- device screens and scrolling

interface ResolvedScroll { page: string; t0: number; t1: number; ease: Parameters<typeof easeFn>[0]; to: number }
const scrolls = new Map<string, ResolvedScroll[]>();

/** Turn scroll targets ("bottom", an element, px) into offsets, using real layout. */
function resolveScrolls() {
  for (const tr of plan.tracks) {
    if (tr.kind !== "scroll") continue;
    const n = nodes.get(tr.ref);
    if (!n?.pages || !n.screen) continue;
    const name = elementFrame(plan, tr.ref, tr.t0).screen?.to ?? String(n.el.props.screen ?? "main");
    const page = (n.pages.get(name) ?? [...n.pages.values()][0])!.page;
    const top = n.statusBar ? n.statusBar.offsetHeight : 0;
    const max = Math.max(0, page.offsetHeight - n.screen.offsetHeight);
    let to = 0;
    if (typeof tr.to === "number") to = tr.to;
    else if (tr.to === "bottom") to = max;
    else if (tr.to !== "top") {
      const target = nodes.get(tr.to)?.outer;
      if (target) {
        const s = n.screen.getBoundingClientRect().width / (n.screen.offsetWidth || 1);
        const y = (target.getBoundingClientRect().top - page.getBoundingClientRect().top) / s;
        to = y - 24 - top;
      }
    }
    const list = scrolls.get(tr.ref) ?? [];
    list.push({ page: name, t0: tr.t0, t1: tr.t1, ease: tr.ease, to: Math.max(0, Math.min(max, to)) });
    scrolls.set(tr.ref, list.sort((a, b) => a.t0 - b.t0));
  }
}

function scrollOffset(ref: string, page: string, t: number): number {
  let cur = 0;
  for (const s of scrolls.get(ref) ?? []) {
    if (s.page !== page) continue;
    if (t >= s.t1) cur = s.to;
    else if (t >= s.t0) return cur + (s.to - cur) * easeFn(s.ease)(clamp01((t - s.t0) / (s.t1 - s.t0)));
    else break;
  }
  return cur;
}

function applyDevice(n: Node, f: ElementFrame, t: number) {
  if (!n.pages) return;
  const sc = f.screen ?? { from: "main", to: "main", p: 1, transition: "none" as const };
  const moving = sc.p < 1 && sc.from !== sc.to;
  for (const [name, { page, background }] of n.pages) {
    const isTo = name === sc.to || n.pages.size === 1;
    const isFrom = moving && name === sc.from;
    page.style.visibility = isTo || isFrom ? "inherit" : "hidden";
    let x = "0%";
    let opacity = 1;
    let filter = "";
    if (moving && sc.transition === "push") {
      if (isTo) x = `${(1 - sc.p) * 100}%`;
      if (isFrom) {
        x = `${-sc.p * 30}%`;
        filter = `brightness(${1 - 0.15 * sc.p})`;
      }
    } else if (moving && sc.transition === "fade" && isTo) opacity = sc.p;
    page.style.zIndex = isTo ? "2" : "1";
    page.style.opacity = String(opacity);
    page.style.filter = filter;
    page.style.transform = `translateX(${x}) translateY(${-scrollOffset(n.el.ref, name, t)}px)`;
    if (isTo && n.statusBar) n.statusBar.style.background = background;
  }
}

// ---------------------------------------------------------------- scenes

function buildScene(s: PlanScene): HTMLElement {
  const sec = h("section", "scene", { position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden" });
  sec.dataset.scene = s.id;
  // Below every element, even ones with a negative z (the layer isn't isolated, so blend modes reach the background).
  const bg = h("div", "bg", { position: "absolute", inset: "0", overflow: "hidden", zIndex: "-100000" });
  if (s.background.kind === "paint") bg.style.background = s.background.css;
  else {
    const layer = h("div", "bg-pic", { position: "absolute", inset: "0", transformOrigin: "50% 50%" });
    layer.appendChild(picture(s.background.image as never, s.background.fit));
    if (s.background.blur) layer.style.filter = `blur(${px(s.background.blur)})`;
    bg.appendChild(layer);
    bgLayers.set(s.id, layer);
    if (s.background.overlay) bg.appendChild(h("div", "", { position: "absolute", inset: "0", background: s.background.overlay }));
  }
  sec.appendChild(bg);
  const layer = h("div", "layer", { position: "absolute", inset: "0" });
  for (const el of s.elements) layer.appendChild(build(el, false, s.id));
  sec.appendChild(layer);
  return sec;
}

// ---------------------------------------------------------------- layout

/** Box of an element's outer wrapper in its parent's local (unscaled) coordinates. */
function localBox(target: HTMLElement | DOMRect, parent: HTMLElement) {
  const r = target instanceof DOMRect ? target : target.getBoundingClientRect();
  const p = parent.getBoundingClientRect();
  const sx = p.width / (parent.offsetWidth || 1) || 1;
  const sy = p.height / (parent.offsetHeight || 1) || 1;
  return { x: (r.left - p.left) / sx, y: (r.top - p.top) / sy, w: r.width / sx, h: r.height / sy };
}

function anchorPlace(n: Node) {
  const l = n.el.layout as Record<string, unknown>;
  const st = n.outer.style;
  const [fx, fy] = ANCHOR_FRAC[String(l.anchor ?? "top-left")] ?? [0, 0];
  const [iv, ih] = (l.inset as [number, number]) ?? [0, 0];
  const off = (l.offset as [number, number]) ?? [0, 0];
  let tx = off[0];
  let ty = off[1];
  if (fx === 0) st.left = px(ih);
  else if (fx === 1) st.right = px(ih);
  else {
    st.left = "50%";
    tx += 0;
  }
  if (fy === 0) st.top = px(iv);
  else if (fy === 1) st.bottom = px(iv);
  else st.top = "50%";
  const cx = fx === 0.5 ? "-50%" : "0px";
  const cy = fy === 0.5 ? "-50%" : "0px";
  st.transform = `translate(${cx}, ${cy}) translate(${px(tx)}, ${px(ty)})`;
}

// ---------------------------------------------------------------- paths, dashes, follow

const paths: { node: Node; svg: SVGSVGElement; geo: SVGPathElement; auto: boolean }[] = [];
/** Stroke length in canvas px (for dashes in px on pathLength=1 geometry). */
const strokeLen = new Map<Node, number>();

/** A path without a viewBox takes its own bounding box as its box (points are in px). Given only a width or
 *  only a height, the other follows the drawing's proportions. */
function sizePaths() {
  for (const { svg, geo, auto, node } of paths) {
    let w: number;
    let hgt: number;
    if (auto) {
      const bb = geo.getBBox();
      w = Math.max(bb.width, 1);
      hgt = Math.max(bb.height, 1);
      svg.setAttribute("viewBox", `${bb.x} ${bb.y} ${w} ${hgt}`);
    } else {
      const vb = svg.viewBox.baseVal;
      [w, hgt] = [vb.width, vb.height];
    }
    const st = node.outer.style;
    const pxOf = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
    const sw = pxOf(st.width);
    const sh = pxOf(st.height);
    if (!Number.isNaN(sw) && !st.height) st.height = px((sw * hgt) / w);
    else if (!Number.isNaN(sh) && !st.width) st.width = px((sh * w) / hgt);
    if (!st.width) st.width = px(w);
    if (!st.height) st.height = px(hgt);
  }
}

/** viewBox units → box px (preserveAspectRatio meet). */
function pathScale(svg: SVGSVGElement): { s: number; vb: DOMRect; ox: number; oy: number } {
  const vb = svg.viewBox.baseVal as unknown as DOMRect;
  const w = svg.clientWidth || 1;
  const hgt = svg.clientHeight || 1;
  const s = Math.min(w / (vb.width || 1), hgt / (vb.height || 1));
  return { s, vb, ox: (w - vb.width * s) / 2, oy: (hgt - vb.height * s) / 2 };
}

const cornerRects: { node: Node; geo: SVGPathElement; svg: SVGSVGElement; corners: number[]; sw: number }[] = [];

const radiusCss = (r: number | number[]) => (Array.isArray(r) ? r.map(px).join(" ") : px(r));
const radiusNum = (r: number | number[] | undefined) => (Array.isArray(r) ? Math.max(...r) : r ?? 0);

/** A rounded rectangle with its own radius per corner (top-left, top-right, bottom-right, bottom-left), inset by half the stroke. */
function cornerRectPath(w: number, hgt: number, [tl, tr, br, bl]: number[], sw: number): string {
  const x0 = sw / 2;
  const y0 = sw / 2;
  const x1 = w - sw / 2;
  const y1 = hgt - sw / 2;
  const lim = (r: number) => Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const [a, b, c, d] = [lim(tl!), lim(tr!), lim(br!), lim(bl!)];
  return `M${x0 + a} ${y0} H${x1 - b} A${b} ${b} 0 0 1 ${x1} ${y0 + b} V${y1 - c} A${c} ${c} 0 0 1 ${x1 - c} ${y1} H${x0 + d} A${d} ${d} 0 0 1 ${x0} ${y1 - d} V${y0 + a} A${a} ${a} 0 0 1 ${x0 + a} ${y0} Z`;
}

/** After layout: stroke widths stay in canvas px however a path is scaled, and dashes get their px length. */
function finishStrokes() {
  for (const r of cornerRects) r.geo.setAttribute("d", cornerRectPath(r.svg.clientWidth, r.svg.clientHeight, r.corners, r.sw));
  for (const { svg, geo, node } of paths) {
    const { s } = pathScale(svg);
    const sw = node.el.style.strokeWidth ?? 4 * k;
    if (node.el.style.stroke) geo.setAttribute("stroke-width", String(sw / s));
    strokeLen.set(node, geo.getTotalLength() * s);
  }
  for (const n of nodes.values()) {
    if (n.el.type === "shape" && n.outline) strokeLen.set(n, n.outline.getTotalLength());
    if (n.el.style.dash && n.outline) setDash(n, 1);
  }
}

/** Dashes on pathLength=1 geometry; while drawOutline runs, only the drawn part's dashes show. */
function setDash(n: Node, drawn: number) {
  const g = n.outline!;
  const len = strokeLen.get(n) || 1;
  const [a, gap] = (n.el.style.dash ?? [1, 0]).map((v) => v / len) as [number, number];
  if (drawn >= 1) {
    g.style.strokeDasharray = `${a} ${gap}`;
    g.style.strokeDashoffset = "0";
    return;
  }
  const parts: number[] = [];
  let covered = 0;
  while (covered < drawn && parts.length < 800) {
    const seg = Math.min(a, drawn - covered);
    parts.push(seg);
    covered += seg;
    if (covered >= drawn) break;
    parts.push(gap);
    covered += gap;
  }
  if (parts.length % 2 === 1) parts.push(1);
  else parts.push(0, 1);
  g.style.strokeDasharray = parts.join(" ");
  g.style.strokeDashoffset = "0";
}

/** A window onto one screenshot region: outlined, with the rest of the screenshot dimmed by its shadow. */
function applySpot(n: Node, s: ElementFrame["spot"]) {
  if (!s) {
    if (n.spot) n.spot.style.display = "none";
    return;
  }
  // Inside the device screen or the image frame, so it scrolls, zooms and clips with the screenshot.
  const host = (n.screen ?? n.box) as HTMLElement | undefined;
  const a = spotRect(n, s.from);
  const b = spotRect(n, s.to);
  if (!host || !a || !b) return;
  if (!n.spot) {
    n.spot = h("div", "spot", { position: "absolute", pointerEvents: "none", zIndex: "40", boxSizing: "border-box" });
    host.appendChild(n.spot);
  }
  const ra = localBox(a, host);
  const rb = localBox(b, host);
  const q = s.p;
  const r = { x: ra.x + (rb.x - ra.x) * q, y: ra.y + (rb.y - ra.y) * q, w: ra.w + (rb.w - ra.w) * q, h: ra.h + (rb.h - ra.h) * q };
  // Padding and line width in canvas px, whatever the host's scale.
  const unit = host.offsetWidth ? host.getBoundingClientRect().width / scale / host.offsetWidth : 1;
  const pad = (10 * k) / unit;
  const line = (3 * k) / unit;
  Object.assign(n.spot.style, {
    display: "block",
    left: px(r.x - pad),
    top: px(r.y - pad),
    width: px(r.w + 2 * pad),
    height: px(r.h + 2 * pad),
    borderRadius: px((12 * k) / unit),
    border: `${px(line)} solid ${s.ring}`,
    boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${(1 - s.dim) * 0.85})`,
    opacity: String(s.opacity),
  });
}

const connectors: { node: Node; geo: SVGPathElement; svg: SVGSVGElement; arrow: string; marker: string }[] = [];

/** How visible an element is right now: hidden if it or a container is hidden, else its opacity chain. */
function shownOpacity(n: Node): number {
  let o = 1;
  for (let e: HTMLElement | null = n.anim; e && e !== stage; e = e.parentElement) {
    if (e.style.visibility === "hidden") return 0;
    const v = parseFloat(e.style.opacity);
    if (!Number.isNaN(v)) o *= v;
  }
  return o;
}

/** The point where the segment from the centre of `r` towards (tx, ty) leaves `r`, pushed out by `gap`. */
function edgePoint(r: { x: number; y: number; w: number; h: number }, tx: number, ty: number, gap: number): [number, number] {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const sx = dx ? r.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? r.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s + (dx / len) * gap, cy + dy * s + (dy / len) * gap];
}

/** Connectors: a line between two elements (or screenshot regions) as they are drawn right now. */
function updateConnectors() {
  for (const { node, geo, svg, arrow, marker } of connectors) {
    const ends: Node[] = [];
    const end = (name: string): DOMRect | undefined => {
      const [base, hs] = String(name).split("#") as [string, string | undefined];
      const ref = resolveRef(base, node.el.ref);
      const target = ref ? nodes.get(ref) : undefined;
      if (!target) return undefined;
      ends.push(target);
      return (hs ? spotRect(target, hs) : undefined) ?? visualRect(target);
    };
    const ra = end(String(node.el.props.from));
    const rb = end(String(node.el.props.to));
    if (!ra || !rb) continue;
    // Only while both ends are on screen, fading with them.
    svg.style.opacity = String(Math.min(...ends.map(shownOpacity)));
    // Arrowheads appear once the line has been drawn to them.
    const done = (node.drawn ?? 1) >= 0.98;
    if (marker) {
      if (done && (arrow === "end" || arrow === "both")) geo.setAttribute("marker-end", `url(#${marker})`);
      else geo.removeAttribute("marker-end");
      if ((node.drawn ?? 1) > 0.02 && (arrow === "start" || arrow === "both")) geo.setAttribute("marker-start", `url(#${marker})`);
      else geo.removeAttribute("marker-start");
    }
    const a = localBox(ra, node.anim);
    const b = localBox(rb, node.anim);
    const gap = 8 * k;
    const [x0, y0] = edgePoint(a, b.x + b.w / 2, b.y + b.h / 2, gap);
    const [x1, y1] = edgePoint(b, a.x + a.w / 2, a.y + a.h / 2, gap);
    const bend = Number(node.el.props.curve) || 0;
    // Positive bows to the left of the from → to direction: upward for a left-to-right line.
    const mx = (x0 + x1) / 2 + ((y1 - y0) / 2) * bend;
    const my = (y0 + y1) / 2 - ((x1 - x0) / 2) * bend;
    geo.setAttribute("d", bend ? `M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}` : `M${x0} ${y0} L${x1} ${y1}`);
    strokeLen.set(node, geo.getTotalLength());
    if (node.el.style.dash) setDash(node, node.drawn ?? 1);
  }
}

/** Particles: positions are functions of time and a seed, so every frame is reproducible. */
function applyParticles(n: Node, t: number) {
  const { dots, seeds } = n.particles!;
  const W0 = n.anim.offsetWidth;
  const H0 = n.anim.offsetHeight;
  const motion = String(n.el.props.motion);
  const speed = Number(n.el.props.speed);
  const frac = (v: number) => v - Math.floor(v);
  dots.forEach((d, i) => {
    const [bx, by, size, ph, ph2, sp] = seeds[i]! as [number, number, number, number, number, number];
    const v = speed * sp;
    let x = bx;
    let y = by;
    let o = 0.55 + 0.45 * Math.sin(ph);
    if (motion === "drift") {
      x = bx + Math.sin(t * 0.35 * v + ph) * 0.03;
      y = by + Math.cos(t * 0.3 * v + ph2) * 0.03;
    } else if (motion === "rise" || motion === "fall") {
      y = frac(by + (motion === "rise" ? -1 : 1) * t * 0.09 * v);
      x = bx + Math.sin(t * 0.9 * v + ph) * 0.02;
      o *= Math.sin(Math.PI * y);
    } else if (motion === "twinkle") {
      o = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * 3 * v + ph));
    }
    d.style.transform = `translate(${px(x * W0 - size / 2)}, ${px(y * H0 - size / 2)})`;
    d.style.opacity = String(Math.max(0, o));
  });
}

// ---------------------------------------------------------------- clips and cutouts

type Pt = [number, number];

/** Points around an ellipse in box (x, y, w, h). */
function ellipsePts(x: number, y: number, w: number, h: number, n = 72): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([x + w / 2 + (Math.cos(a) * w) / 2, y + h / 2 + (Math.sin(a) * h) / 2]);
  }
  return out;
}

/** Points around a rounded rectangle (one radius, or [tl, tr, br, bl]). */
function roundRectPts(x: number, y: number, w: number, h: number, radius: number | number[] = 0): Pt[] {
  const rs = (Array.isArray(radius) ? radius : [radius, radius, radius, radius]).map((r) => Math.max(0, Math.min(r, w / 2, h / 2)));
  const corners: [number, number, number, number][] = [
    [x + w - rs[1]!, y + rs[1]!, rs[1]!, -90], [x + w - rs[2]!, y + h - rs[2]!, rs[2]!, 0],
    [x + rs[3]!, y + h - rs[3]!, rs[3]!, 90], [x + rs[0]!, y + rs[0]!, rs[0]!, 180],
  ];
  const out: Pt[] = [];
  for (const [cx, cy, r, start] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = ((start + (i / 8) * 90) * Math.PI) / 180;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

/** A path element's outline as viewport points (sampled along its length). */
function pathClientPts(pn: { svg: SVGSVGElement; geo: SVGPathElement }, n = 160): Pt[] {
  const L = pn.geo.getTotalLength();
  const rect = pn.svg.getBoundingClientRect();
  const css = rect.width / (pn.svg.clientWidth || 1);
  const { s, vb, ox, oy } = pathScale(pn.svg);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = pn.geo.getPointAtLength((i / n) * L);
    out.push([rect.left + (ox + (p.x - vb.x) * s) * css, rect.top + (oy + (p.y - vb.y) * s) * css]);
  }
  return out;
}

/** Hidden (not yet entered, or its scene hidden): a cutter that isn't there yet cuts nothing. */
function isHidden(n: Node): boolean {
  for (let e: HTMLElement | null = n.anim; e && e !== stage; e = e.parentElement) if (e.style.visibility === "hidden") return true;
  return false;
}

const masked: Node[] = [];
/**
 * `style.clip` and `style.cutout` as one clip-path in the element's own coordinates: the outline (box,
 * circle, ellipse or a path stretched to the box) with the cutters' current shapes as holes (even-odd).
 * Synchronous geometry, so frames stay deterministic. Rebuilt every frame: cutters can move.
 */
function applyMasks() {
  for (const n of masked) {
    const host = n.anim;
    const W = host.offsetWidth;
    const H = host.offsetHeight;
    if (!W || !H) continue;
    const clip = n.el.style.clip;
    let base: Pt[];
    if (clip === "circle") {
      const d = Math.min(W, H);
      base = ellipsePts((W - d) / 2, (H - d) / 2, d, d);
    } else if (clip === "ellipse") base = ellipsePts(0, 0, W, H);
    else if (clip) {
      const ref = resolveRef(clip, n.el.ref);
      const pn = paths.find((x) => x.node.el.ref === ref);
      if (!pn) continue;
      // The path's own drawing area stretched to this element's box.
      const vb = pn.svg.viewBox.baseVal;
      const L = pn.geo.getTotalLength();
      base = [];
      for (let i = 0; i < 160; i++) {
        const p = pn.geo.getPointAtLength((i / 160) * L);
        base.push([((p.x - vb.x) / (vb.width || 1)) * W, ((p.y - vb.y) / (vb.height || 1)) * H]);
      }
    } else base = [[0, 0], [W, 0], [W, H], [0, H]];
    const rings: Pt[][] = [base];
    for (const id of n.el.style.cutout ?? []) {
      const ref = resolveRef(id, n.el.ref);
      const cn = ref ? nodes.get(ref) : undefined;
      if (!cn || isHidden(cn)) continue;
      const toLocal = (pts: Pt[]) => pts.map(([x, y]): Pt => { const b = localBox(new DOMRect(x, y, 0, 0), host); return [b.x, b.y]; });
      const pn = paths.find((x) => x.node === cn);
      if (pn) {
        rings.push(toLocal(pathClientPts(pn)));
        continue;
      }
      const r = visualRect(cn);
      const b = localBox(r, host);
      const shape = String(cn.el.props.shape ?? "rect");
      if (shape === "circle" || shape === "ellipse") rings.push(ellipsePts(b.x, b.y, b.w, b.h));
      else if (shape === "pill") rings.push(roundRectPts(b.x, b.y, b.w, b.h, Math.min(b.w, b.h) / 2));
      else rings.push(roundRectPts(b.x, b.y, b.w, b.h, (cn.el.style.radius ?? 0) as number | number[]));
    }
    const d = rings.map((ring) => `M${ring.map(([x, y]) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`).join(" L")} Z`).join(" ");
    host.style.clipPath = `path(evenodd, "${d}")`;
  }
}

const following = new Set<Node>();
/** `follow`: the element's centre rides along a path element, optionally turned to its direction. */
function applyFollow(fr: Frame) {
  for (const n of nodes.values()) {
    const f = fr.elements[n.el.ref]?.follow;
    if (!f) {
      if (following.delete(n)) {
        n.outer.style.translate = "";
        n.outer.style.rotate = "";
      }
      continue;
    }
    const pn = paths.find((x) => x.node.el.ref === f.path);
    if (!pn) continue;
    const { svg, geo } = pn;
    const L = geo.getTotalLength();
    const rect = svg.getBoundingClientRect();
    const css = rect.width / (svg.clientWidth || 1);
    const { s, vb, ox, oy } = pathScale(svg);
    const at = (q: number): [number, number] => {
      const pt = geo.getPointAtLength(clamp01(q) * L);
      return [rect.left + (ox + (pt.x - vb.x) * s) * css, rect.top + (oy + (pt.y - vb.y) * s) * css];
    };
    const parent = (n.outer.offsetParent as HTMLElement | null) ?? n.outer.parentElement!;
    n.outer.style.translate = "";
    n.outer.style.rotate = "";
    const me = localBox(n.outer, parent);
    const [tx, ty] = at(f.p);
    const t = localBox(new DOMRect(tx, ty, 0, 0), parent);
    n.outer.style.translate = `${px(t.x - (me.x + me.w / 2))} ${px(t.y - (me.y + me.h / 2))}`;
    if (f.rotate) {
      const [ax, ay] = at(f.p - 0.002);
      const [bx, by] = at(f.p + 0.002);
      n.outer.style.rotate = `${(Math.atan2(by - ay, bx - ax) * 180) / Math.PI}deg`;
    }
    following.add(n);
  }
}

/** Pinned elements ride along with their target's animation (the pin point is re-measured each frame). */
const pinFollows: { node: Node; rect: () => DOMRect; fx: number; fy: number; base: [number, number] }[] = [];

function followPins() {
  for (const f of pinFollows) {
    const parent = (f.node.outer.offsetParent as HTMLElement | null) ?? f.node.outer.parentElement!;
    const r = f.rect();
    if (r.width === 0 && r.height === 0) continue; // target not laid out (display: none)
    const b = localBox(r, parent);
    const dx = b.x + b.w * f.fx - f.base[0];
    const dy = b.y + b.h * f.fy - f.base[1];
    f.node.outer.style.translate = Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 ? "" : `${px(dx)} ${px(dy)}`;
  }
}

function layoutAll() {
  // Pass 1: anchors and absolute positions.
  const pending: Node[] = [];
  for (const n of nodes.values()) {
    if (n.outer.style.position !== "absolute") continue;
    const l = n.el.layout as Record<string, unknown>;
    if (l.method === "absolute") {
      n.outer.style.left = px(Number(l.x ?? 0));
      n.outer.style.top = px(Number(l.y ?? 0));
      const off = (l.offset as [number, number]) ?? [0, 0];
      if (off[0] || off[1]) n.outer.style.transform = `translate(${px(off[0])}, ${px(off[1])})`;
    } else if (l.method === "relative" || l.method === "pin") {
      n.outer.style.left = "0px";
      n.outer.style.top = "0px";
      pending.push(n);
    } else anchorPlace(n);
  }
  fitTexts();
  // Pass 2: relative placement and pins, in dependency order.
  const placed = new Set<string>();
  for (const n of nodes.values()) if (!pending.includes(n)) placed.add(n.el.ref);
  for (let guard = 0; guard < 50 && pending.length; guard++) {
    for (let i = 0; i < pending.length; i++) {
      const n = pending[i]!;
      const l = n.el.layout as Record<string, unknown>;
      const refName = String(l.pin ? (l.pin as { to: string }).to.split("#")[0] : (l.below ?? l.above ?? l.leftOf ?? l.rightOf));
      const ref = resolveRef(refName, n.el.ref);
      if (ref && !placed.has(ref)) continue;
      const pinStep = l.pin ? (l.pin as { to: string }).to.split("#")[1] : undefined;
      const pinNode = ref ? nodes.get(ref) : undefined;
      const stepDot = pinStep && pinNode ? partElement(pinNode, pinStep) : undefined;
      const spot = pinStep && pinNode && !stepDot ? () => spotRect(pinNode, pinStep) : undefined;
      const targetEl = stepDot ?? (ref ? nodes.get(ref)?.outer : undefined);
      const target = spot?.() ?? targetEl;
      const parent = n.outer.offsetParent as HTMLElement | null ?? n.outer.parentElement!;
      const me = localBox(n.outer, parent);
      const off = (l.offset as [number, number]) ?? [0, 0];
      let x = 0;
      let y = 0;
      if (target) {
        const b = localBox(target, parent);
        if (l.pin) {
          const pin = l.pin as { point: string; inside?: number };
          const [fx, fy] = ANCHOR_FRAC[pin.point] ?? [0.5, 0.5];
          const px0 = b.x + b.w * fx;
          const py0 = b.y + b.h * fy;
          // Follow what the target draws: its animated layer (enter/exit/ambient transforms live there).
          const moving = stepDot ?? pinNode?.anim ?? (target instanceof HTMLElement ? target : undefined);
          const rect = () => spot?.() ?? moving!.getBoundingClientRect();
          if (spot || moving) {
            const b0 = localBox(rect(), parent);
            pinFollows.push({ node: n, rect, fx, fy, base: [b0.x + b0.w * fx, b0.y + b0.h * fy] });
          }
          if (pin.inside === undefined) {
            x = px0 - me.w / 2;
            y = py0 - me.h / 2;
          } else {
            const ins = pin.inside;
            x = px0 - fx * me.w + (fx === 0 ? ins : fx === 1 ? -ins : 0);
            y = py0 - fy * me.h + (fy === 0 ? ins : fy === 1 ? -ins : 0);
          }
        } else {
          const gap = Number(l.gap ?? 32);
          const align = String(l.align ?? "start");
          const alongX = (start: number, len: number, mine: number) => (align === "center" ? start + len / 2 - mine / 2 : align === "end" ? start + len - mine : start);
          if (l.below !== undefined) {
            y = b.y + b.h + gap;
            x = alongX(b.x, b.w, me.w);
          } else if (l.above !== undefined) {
            y = b.y - gap - me.h;
            x = alongX(b.x, b.w, me.w);
          } else if (l.leftOf !== undefined) {
            x = b.x - gap - me.w;
            y = alongX(b.y, b.h, me.h);
          } else {
            x = b.x + b.w + gap;
            y = alongX(b.y, b.h, me.h);
          }
        }
      }
      n.outer.style.left = px(x + off[0]);
      n.outer.style.top = px(y + off[1]);
      n.outer.style.transform = "";
      placed.add(n.el.ref);
      pending.splice(i--, 1);
    }
  }
  sizeGroups();
  layoutCharts();
  for (const p of pills) {
    const r = Math.max(0, p.outer.offsetHeight / 2 - p.sw / 2);
    p.geo.style.setProperty("rx", px(r));
    p.geo.style.setProperty("ry", px(r));
  }
}

function resolveRef(name: string, from: string): string | undefined {
  if (nodes.has(name)) return name;
  // Inside a component, local ids are prefixed with the instance path.
  const prefix = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return nodes.has(prefix + name) ? prefix + name : undefined;
}

/** Auto-sized groups take the bounding box of their children. */
/** A group without an explicit size fits its children; an explicit width or height is kept. */
function sizeGroups() {
  for (const n of nodes.values()) {
    if (n.el.type !== "group") continue;
    const hasW = !!n.outer.style.width;
    const hasH = !!n.outer.style.height;
    if (hasW && hasH) continue;
    let w = 0;
    let hh = 0;
    for (const c of n.el.children) {
      const o = nodes.get(c.ref)?.outer;
      if (!o) continue;
      const b = localBox(o, n.box as HTMLElement);
      w = Math.max(w, b.x + b.w);
      hh = Math.max(hh, b.y + b.h);
    }
    if (!hasW) n.outer.style.width = px(w);
    if (!hasH) n.outer.style.height = px(hh);
    (n.box as HTMLElement).style.width = "100%";
    (n.box as HTMLElement).style.height = "100%";
  }
}

const shrinkRatio = new Map<string, number>();
const pills: { outer: HTMLElement; geo: SVGGeometryElement; sw: number }[] = [];
const staticBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
const overflowing = new Set<string>();

function textOverflows(n: Node): boolean {
  const t = n.text!;
  const f = n.el.font!;
  // Word masks overhang by a hair (negative margins), so allow a small tolerance.
  const tol = f.size * 0.12;
  if (t.scrollWidth > t.clientWidth + tol) return true;
  const max = n.el.text?.maxLines;
  if (max) return t.getBoundingClientRect().height / scale > f.size * f.lineHeight * max + 1;
  return false;
}

function fitTexts() {
  for (const n of nodes.values()) {
    if (n.el.type !== "text" || !n.text) continue;
    const f = n.el.font!;
    n.text.style.overflowWrap = "normal";
    if (n.el.text?.fit !== "shrink") {
      if (textOverflows(n)) overflowing.add(n.el.ref);
      continue;
    }
    if (!textOverflows(n)) continue;
    let lo = f.size * 0.3;
    let hi = f.size;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      n.text.style.fontSize = px(mid);
      if (textOverflows(n)) hi = mid;
      else lo = mid;
    }
    n.text.style.fontSize = px(lo);
    shrinkRatio.set(n.el.ref, lo / f.size);
    if (textOverflows(n)) overflowing.add(n.el.ref);
  }
}

// ---------------------------------------------------------------- frames

const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);

function applyElement(n: Node, f: ElementFrame | undefined) {
  const { anim, el } = n;
  if (!f) return;
  n.outer.style.visibility = f.visible ? "inherit" : "hidden";
  const p = f.props;
  const s = el.style;
  const x = num(p.x, 0);
  const y = num(p.y, 0);
  const rot = num(p.rotation, s.rotation);
  const focus = num(p.focusScale, 1);
  const sc = num(p.scale, s.scale) * num(p.press, 1) * focus;
  // A highlighted element (focusCycle) is drawn above its neighbours.
  n.outer.style.zIndex = focus > 1.001 ? "50" : String(el.z || 0);
  anim.style.transform = `translate(${px(x)}, ${px(y)}) rotate(${rot}deg) scale(${sc * num(p.scaleX, s.scaleX)}, ${sc * num(p.scaleY, s.scaleY)})`;
  anim.style.opacity = String(clamp01(num(p.opacity, s.opacity) * num(p.dim, 1)));
  const blur = num(p.blur, s.blur);
  anim.style.filter = blur > 0.01 ? `blur(${px(blur)})` : "";
  const cl = [num(p.clipTop, 0), num(p.clipRight, 0), num(p.clipBottom, 0), num(p.clipLeft, 0)];
  anim.style.clipPath = cl.some((c) => c > 0) ? `inset(${cl.map((c) => `${clamp01(c) * 100}%`).join(" ")})` : "";
  if (el.type === "icon" && p.color !== undefined && n.box instanceof SVGElement) (n.box as SVGElement).style.color = String(p.color);
  if (n.toast) applyToast(n, f);
  if (n.progress) applyProgress(n, num(p.value, Number(el.props.value ?? 0)));
  if (n.chart) applyChart(n, f);
  if (n.text) {
    if (p.letterSpacing !== undefined) {
      n.text.style.letterSpacing = `${p.letterSpacing}em`;
      balanceTracking(n.text, Number(p.letterSpacing), el.font?.align ?? "left");
    }
    if (p.color !== undefined) n.text.style.color = String(p.color);
    if (p.fontWeight !== undefined) n.text.style.fontWeight = String(Math.round(Number(p.fontWeight)));
  }
  if (n.box) {
    const box = n.box;
    if (box instanceof SVGElement) {
      if (p.fill !== undefined) box.setAttribute("fill", String(p.fill));
      if (p.stroke !== undefined) box.setAttribute("stroke", String(p.stroke));
    } else {
      if (p.fill !== undefined) box.style.background = String(p.fill);
      if (p.stroke !== undefined) box.style.borderColor = String(p.stroke);
      if (p.radius !== undefined) box.style.borderRadius = px(Number(p.radius));
    }
  }
  // Inner picture (kenBurns).
  if (n.img && (p.innerScale !== undefined || p.innerX !== undefined || p.innerY !== undefined)) {
    n.img.style.transform = `translate(${px(num(p.innerX, 0))}, ${px(num(p.innerY, 0))}) scale(${num(p.innerScale, 1)})`;
  }
  // Outline drawing (shapes, browser frame).
  if (n.outline) {
    const d = num(p.draw, 1);
    if (el.type === "browser") {
      const line = clamp01(d / 0.75);
      n.outline.style.strokeDasharray = "1";
      n.outline.style.strokeDashoffset = String(1 - line);
      n.outline.style.opacity = d >= 1 ? "1" : String(Math.min(1, line * 4));
      if (n.body) n.body.style.opacity = String(clamp01((d - 0.55) / 0.45));
    } else if (p.draw !== undefined) {
      n.drawn = clamp01(d);
      if (el.style.dash) setDash(n, clamp01(d));
      else {
        n.outline.style.strokeDasharray = "1";
        n.outline.style.strokeDashoffset = String(1 - clamp01(d));
      }
      n.outline.style.strokeOpacity = String(capFade(n.outline, clamp01(d)));
    }
  }
  if (n.outlines && p.draw !== undefined) {
    const d = clamp01(Number(p.draw));
    for (const g of n.outlines) {
      const drawn = n.filledOnly ? clamp01(d / 0.7) : d;
      g.style.strokeDasharray = "1";
      g.style.strokeDashoffset = String(1 - drawn);
      g.style.strokeOpacity = String(capFade(g, drawn));
      if (n.filledOnly?.has(g)) {
        // Trace with the fill colour, then let the fill take over.
        const f = clamp01((d - 0.6) / 0.4);
        g.style.fillOpacity = String(f);
        g.style.strokeOpacity = String((1 - f) * capFade(g, drawn));
      }
    }
  }
  if (n.host) {
    for (const [k, v] of Object.entries(p)) if (k.startsWith("--")) n.host.style.setProperty(k, String(v));
  }
  // Parts: words, lines, characters.
  if (f.parts.length) {
    for (const part of f.parts) {
      const targets = part.kind === "char" ? [n.chars[part.index]] : part.kind === "word" ? [n.words[part.index]] : n.words.filter((w) => w.dataset.line === String(part.index));
      for (const t of targets) {
        if (!t) continue;
        const inner = part.kind === "char" ? t : (t.firstElementChild as HTMLElement);
        const pp = part.props;
        inner.style.transform = `translateY(${num(pp.py, 0)}%) translateY(${num(pp.pdy, 0)}em) rotate(${num(pp.prot, 0)}deg)`;
        if (pp.opacity !== undefined) inner.style.opacity = String(clamp01(pp.opacity));
        if (pp.blur !== undefined) inner.style.filter = pp.blur > 0.01 ? `blur(${px(pp.blur)})` : "";
      }
    }
  }
  // Typewriter.
  if (f.type) {
    if (f.type.field === "url" && n.url) {
      n.url.textContent = (n.urlText ?? "").slice(0, f.type.count);
      setCaret(n, n.url, f.type.caret, true);
    } else {
      n.chars.forEach((c, i) => (c.style.visibility = i < f.type!.count ? "inherit" : "hidden"));
      const last = n.chars[Math.max(0, f.type.count - 1)];
      setCaret(n, f.type.count > 0 ? last! : n.chars[0]!, f.type.caret, false, f.type.count === 0);
    }
  }
  // countUp.
  if (f.count !== undefined && n.num && el.text?.number) n.num.textContent = formatLike(f.count, el.text.number);
  // Text typed by an interaction step.
  if (n.text && f.typed) {
    n.text.dataset.rolled = "1";
    n.text.textContent = f.typed.text;
    setCaret(n, n.text, f.typed.caret, true);
  } else if (n.text && f.content) {
    const { from, to, p: q } = f.content;
    n.text.dataset.rolled = "1";
    if (q >= 1) n.text.textContent = to;
    else {
      n.text.innerHTML = "";
      // Labels (buttons, badges) roll on one line; text keeps wrapping to its width, so a longer caption
      // is laid out as it will end up rather than running off on a single line mid-roll.
      const wraps = el.type === "text";
      const ws = wraps ? "pre-wrap" : "nowrap";
      const wrap = h("span", "", { display: wraps ? "grid" : "inline-grid", overflow: "hidden", verticalAlign: "top", padding: `${ROLL_PAD} 0`, margin: `-${ROLL_PAD} 0` });
      const a = h("span", "", { gridArea: "1 / 1", transform: `translateY(calc(${-q} * (100% + ${ROLL_GAP})))`, whiteSpace: ws });
      const b = h("span", "", { gridArea: "1 / 1", transform: `translateY(calc(${1 - q} * (100% + ${ROLL_GAP})))`, whiteSpace: ws });
      a.textContent = from;
      b.textContent = to;
      wrap.append(a, b);
      n.text.appendChild(wrap);
    }
  } else if (n.text?.dataset.rolled) {
    delete n.text.dataset.rolled;
    n.text.innerHTML = n.textHTML ?? "";
    // Re-bind split parts and the number span after restoring.
    const kids = [...n.text.querySelectorAll<HTMLElement>(".w")];
    n.words = kids;
    n.chars = [...n.text.querySelectorAll<HTMLElement>(".c")];
  }
  // Pulse ring.
  if (f.ring) {
    if (!n.ring) {
      n.ring = h("div", "ring", { position: "absolute", inset: "0", pointerEvents: "none", borderRadius: (n.box as HTMLElement | undefined)?.style.borderRadius || "999px", border: `${px(3 * k)} solid ${el.style.stroke ?? el.style.fill ?? el.font?.color ?? "#fff"}` });
      n.anim.appendChild(n.ring);
    }
    n.ring.style.display = "block";
    n.ring.style.opacity = String((1 - f.ring.p) * 0.85);
    n.ring.style.transform = `scale(${1 + f.ring.p * 0.18}, ${1 + f.ring.p * 0.5})`;
  } else if (n.ring) n.ring.style.display = "none";
}

function setCaret(n: Node, after: HTMLElement, on: boolean, inside: boolean, before = false) {
  if (!n.caret) {
    n.caret = h("i", "caret", { display: "inline-block", width: "0.08em", height: "1em", marginRight: "-0.08em", verticalAlign: "-0.12em", background: "currentColor" });
  }
  if (inside) after.appendChild(n.caret);
  else if (before) after.parentElement?.insertBefore(n.caret, after);
  else after.after(n.caret);
  n.caret.style.visibility = on ? "inherit" : "hidden";
}

function applyScenes(fr: Frame) {
  wipebar.style.display = "none";
  for (const sf of fr.scenes) {
    const sec = sceneEls.get(sf.id)!;
    sec.style.visibility = sf.visible ? "visible" : "hidden";
    sec.style.zIndex = String(sf.index + 1);
    sec.style.clipPath = "";
    sec.style.opacity = "1";
    sec.style.transform = "";
    // Zoom transitions scale the scene's content, never its background (a scaled background shows its edges).
    const content = sec.querySelector<HTMLElement>(":scope > .layer");
    if (content) content.style.transform = "";
    if (!sf.visible) continue;
    const inc = sf.incoming;
    if (inc) {
      const tr = inc.transition;
      const p = inc.p;
      if (tr.type === "crossfade") sec.style.opacity = String(p);
      else if (tr.type === "wipe") wipe(sec, tr, p);
      else if (tr.type === "slide") {
        const [dx, dy] = slideVec(tr.from);
        sec.style.transform = `translate(${px(dx * (1 - p) * W)}, ${px(dy * (1 - p) * H)})`;
      } else if (tr.type === "circle") {
        const [ox, oy] = originPoint(tr.origin);
        const r = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) * p;
        sec.style.clipPath = `circle(${px(r)} at ${px(ox)} ${px(oy)})`;
      } else if (tr.type === "zoom") {
        const s0 = tr.direction === "out" ? 1.25 : 0.8;
        if (content) content.style.transform = `scale(${s0 + (1 - s0) * p})`;
        sec.style.opacity = String(p);
      }
    }
    const out = sf.outgoing;
    if (out) {
      const tr = out.transition;
      if (tr.type === "slide" && tr.push) {
        const [dx, dy] = slideVec(tr.from);
        sec.style.transform = `translate(${px(-dx * out.p * W)}, ${px(-dy * out.p * H)})`;
      } else if (tr.type === "zoom") {
        if (content) content.style.transform = `scale(${1 + (tr.direction === "out" ? -0.15 : 0.35) * out.p})`;
      }
    }
  }
}

/** The direction the incoming scene moves from: 'right' means it slides in from the right. */
function slideVec(from: string): [number, number] {
  return from === "left" ? [-1, 0] : from === "up" ? [0, -1] : from === "down" ? [0, 1] : [1, 0];
}

function originPoint(origin: string): [number, number] {
  const fr = ANCHOR_FRAC[origin];
  if (fr) return [fr[0] * W, fr[1] * H];
  const n = nodes.get(origin);
  if (n) {
    const r = n.outer.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    return [((r.left + r.width / 2 - st.left) / scale), ((r.top + r.height / 2 - st.top) / scale)];
  }
  return [W / 2, H / 2];
}

function wipe(sec: HTMLElement, tr: { from: string; angle: number; bar: string | null; barWidth: number }, p: number) {
  const vertical = tr.from === "left" || tr.from === "right";
  const len = vertical ? H : W;
  const span = vertical ? W : H;
  const slant = len * Math.tan((tr.angle * Math.PI) / 180);
  const pos = -Math.abs(slant) - 60 + (span + Math.abs(slant) + 120) * p;
  let poly: string;
  if (tr.from === "left") poly = `polygon(0 0, ${px(pos + slant)} 0, ${px(pos)} ${px(H)}, 0 ${px(H)})`;
  else if (tr.from === "right") poly = `polygon(${px(W)} 0, ${px(W - pos - slant)} 0, ${px(W - pos)} ${px(H)}, ${px(W)} ${px(H)})`;
  else if (tr.from === "up") poly = `polygon(0 0, ${px(W)} 0, ${px(W)} ${px(pos)}, 0 ${px(pos + slant)})`;
  else poly = `polygon(0 ${px(H)}, ${px(W)} ${px(H)}, ${px(W)} ${px(H - pos)}, 0 ${px(H - pos - slant)})`;
  sec.style.clipPath = p >= 1 ? "" : poly;
  if (tr.bar && p > 0 && p < 1) {
    const angle = (Math.atan2(slant, len) * 180) / Math.PI;
    const bw = tr.barWidth;
    Object.assign(wipebar.style, { display: "block", background: tr.bar, zIndex: String(Number(sec.style.zIndex) + 1) });
    if (vertical) {
      const cx = tr.from === "left" ? pos + slant / 2 : W - pos - slant / 2;
      Object.assign(wipebar.style, { width: px(bw), height: px(H * 1.4), left: px(cx - bw / 2), top: px(-H * 0.2), transform: `rotate(${tr.from === "left" ? angle : -angle}deg)` });
    } else {
      const cy = tr.from === "up" ? pos + slant / 2 : H - pos - slant / 2;
      Object.assign(wipebar.style, { height: px(bw), width: px(W * 1.4), top: px(cy - bw / 2), left: px(-W * 0.2), transform: `rotate(${tr.from === "up" ? -angle : angle}deg)` });
    }
  }
}

// ---------------------------------------------------------------- cursors

const cursorEls = new Map<string, { el: HTMLElement; ripple?: HTMLElement; kind: string; tip: [number, number] }>();
const ARROW = "M4 2 L4 21 L9 16.4 L12.6 24.6 L15.8 23.2 L12.3 15.2 L19 15.2 Z";

function buildCursors() {
  for (const tr of plan.tracks) {
    if (tr.kind !== "cursor") continue;
    const sec = sceneEls.get(tr.sceneId);
    if (!sec) continue;
    const el = h("div", "cursor", { position: "absolute", left: "0", top: "0", zIndex: "800", pointerEvents: "none", display: "none", transformOrigin: "0 0" });
    let tip: [number, number] = [0, 0];
    let ripple: HTMLElement | undefined;
    if (tr.cursor === "touch") {
      const d = 78 * k;
      Object.assign(el.style, { width: px(d), height: px(d) });
      const dot = h("div", "", { position: "absolute", inset: "0", borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: `${px(3 * k)} solid rgba(20,20,20,0.35)`, boxShadow: `0 ${px(6 * k)} ${px(18 * k)} rgba(0,0,0,0.25)`, boxSizing: "border-box" });
      ripple = h("div", "", { position: "absolute", inset: "0", borderRadius: "50%", border: `${px(3 * k)} solid rgba(255,255,255,0.8)`, boxSizing: "border-box" });
      el.append(ripple, dot);
      tip = [d / 2, d / 2];
    } else {
      const size = (tr.cursor === "pointer" ? 54 : 46) * k;
      Object.assign(el.style, { width: px(size), height: px(size) });
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 26");
      Object.assign(svg.style, { width: "100%", height: "100%", overflow: "visible", filter: `drop-shadow(0 ${px(3 * k)} ${px(5 * k)} rgba(0,0,0,0.35))` });
      if (tr.cursor === "pointer" && window.__SINI_ICONS__?.pointer) {
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.innerHTML = window.__SINI_ICONS__.pointer;
        Object.assign(svg.style, { color: "#111" });
        svg.setAttribute("fill", "#fff");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "1.6");
        svg.setAttribute("stroke-linejoin", "round");
        tip = [(10 / 24) * size, (2 / 24) * size];
      } else {
        svg.innerHTML = `<path d="${ARROW}" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`;
        tip = [(4 / 24) * size, (2 / 26) * size];
      }
      el.appendChild(svg);
    }
    sec.appendChild(el);
    cursorEls.set(tr.ref, { el, ...(ripple ? { ripple } : {}), kind: tr.cursor, tip });
  }
}

/** Canvas point for a cursor target: an anchor, an element's centre, or an image hotspot. */
function targetPoint(target: string): [number, number] {
  const fr = ANCHOR_FRAC[target];
  if (fr) {
    const m = 0.12 * Math.min(W, H);
    return [fr[0] * W + (fr[0] === 0 ? m : fr[0] === 1 ? -m : 0), fr[1] * H + (fr[1] === 0 ? m : fr[1] === 1 ? -m : 0)];
  }
  const [ref, hs] = target.split("#") as [string, string | undefined];
  const n = nodes.get(ref);
  if (!n) return [W / 2, H / 2];
  const st = stage.getBoundingClientRect();
  const toCanvas = (x: number, y: number): [number, number] => [(x - st.left) / scale, (y - st.top) / scale];
  const part = hs ? partElement(n, hs) : undefined;
  if (part) {
    const r = part.getBoundingClientRect();
    return toCanvas(r.left + r.width / 2, r.top + r.height / 2);
  }
  const r = (hs ? spotRect(n, hs) : undefined) ?? visualRect(n);
  return toCanvas(r.left + r.width / 2, r.top + r.height / 2);
}

/** Where an image hotspot is drawn right now (viewport coordinates), for images and device screenshots. */
function spotRect(n: Node, hs: string): DOMRect | undefined {
  const spot = (n.el.props.hotspots as Record<string, number[]> | undefined)?.[hs];
  if (!spot) return undefined;
  const img = (n.screen ?? n.box ?? n.anim).querySelector?.("img") as HTMLImageElement | null;
  if (!img || !img.naturalWidth) return undefined;
  const r = img.getBoundingClientRect();
  return imageRect(n, img, spot);
}

/** Where a region of an image ([x, y, w, h] in its own pixels) is drawn right now (viewport coordinates). */
function imageRect(n: Node, img: HTMLImageElement, region: number[]): DOMRect {
  const r = img.getBoundingClientRect();
  const fit = String(n.el.props.fit ?? (n.screen ? "width" : "cover"));
  // A crop makes that region the whole image.
  const crop = n.screen ? undefined : (n.el.props.crop as number[] | undefined);
  const [cx, cy, nw, nh] = crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  let sc: number;
  let ox = 0;
  let oy = 0;
  if (fit === "width") sc = r.width / nw!;
  else {
    sc = fit === "contain" ? Math.min(r.width / nw!, r.height / nh!) : Math.max(r.width / nw!, r.height / nh!);
    const focus = (n.el.props.focus as number[] | undefined) ?? [50, 50];
    ox = ((r.width - nw! * sc) * focus[0]!) / 100;
    oy = ((r.height - nh! * sc) * focus[1]!) / 100;
  }
  return new DOMRect(r.left + ox + (region[0]! - cx!) * sc, r.top + oy + (region[1]! - cy!) * sc, region[2]! * sc, region[3]! * sc);
}

const SHAPED = new Set(["button", "badge", "icon", "toast"]);

/** The element that draws a button/badge/icon/toast: its layout box may be stretched wider than the shape. */
function drawnEl(n: Node): HTMLElement {
  return SHAPED.has(n.el.type) && n.box instanceof HTMLElement ? n.box : n.outer;
}

let inkCtx: CanvasRenderingContext2D | null = null;
/**
 * Where a text's glyphs are drawn: the run of words, tightened to the letters' cap tops and descenders
 * (font metrics measured on a canvas) and widened by italic or swash overhang. Approximate for several lines:
 * the whole text's extremes are applied to the first and last line.
 */
function inkRect(n: Node): DOMRect {
  const r = visualRect(n);
  const t = n.text!;
  const words = (t.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!words || !r.height) return r;
  inkCtx ??= document.createElement("canvas").getContext("2d");
  if (!inkCtx) return r;
  const cs = getComputedStyle(t);
  inkCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  inkCtx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  const m = inkCtx.measureText(words);
  const fa = m.fontBoundingBoxAscent;
  const fd = m.fontBoundingBoxDescent;
  // CSS px of the element → viewport px (stage scale, animation scale).
  const f = t.offsetHeight ? t.getBoundingClientRect().height / t.offsetHeight : 1;
  // Text runs span the font's ascent to descent (not the line height): trim to the glyphs.
  const top = r.top + (fa - m.actualBoundingBoxAscent) * f;
  const bottom = r.bottom - (fd - m.actualBoundingBoxDescent) * f;
  // Side bearings: positive actualBoundingBoxLeft = ink left of the pen (italics), negative = a gap. One line only;
  // with several lines the run's edges are kept.
  const oneLine = r.height <= (fa + fd) * f * 1.5;
  const left = oneLine ? r.left - m.actualBoundingBoxLeft * f : r.left;
  const right = oneLine ? r.right + (m.actualBoundingBoxRight - m.width) * f : r.right;
  return new DOMRect(left, top, right - left, Math.max(1, bottom - top));
}

/** What's actually drawn: the button/badge/icon shape or the text's own bounds, not a stretched layout box. */
function visualRect(n: Node): DOMRect {
  if (SHAPED.has(n.el.type) && n.box) return n.box.getBoundingClientRect();
  if (n.el.type === "text" && n.text) {
    const range = document.createRange();
    range.selectNodeContents(n.text);
    const r = range.getBoundingClientRect();
    if (r.width > 0) return r;
  }
  return n.anim.getBoundingClientRect();
}

function applyCursors(cursors: CursorFrame[]) {
  for (const c of cursorEls.values()) c.el.style.display = "none";
  for (const cf of cursors) {
    const c = cursorEls.get(cf.ref);
    if (!c) continue;
    const a = targetPoint(cf.from);
    const b = cf.from === cf.to ? a : targetPoint(cf.to);
    const x = a[0] + (b[0] - a[0]) * cf.p;
    const y = a[1] + (b[1] - a[1]) * cf.p;
    const pressScale = 1 - (c.kind === "touch" ? 0.18 : 0.12) * cf.press;
    Object.assign(c.el.style, {
      display: "block",
      opacity: String(cf.opacity),
      transform: `translate(${px(x - c.tip[0] * pressScale)}, ${px(y - c.tip[1] * pressScale)}) scale(${pressScale})`,
    });
    if (c.ripple) {
      const s = cf.sincePress;
      const on = s !== null && s < 0.5;
      c.ripple.style.opacity = on ? String((1 - s! / 0.5) * 0.7) : "0";
      c.ripple.style.transform = on ? `scale(${1 + s! * 2.2})` : "scale(1)";
    }
  }
}

function render(t: number) {
  currentT = t;
  const fr = frameAt(plan, t);
  currentFrame = fr;
  applyScenes(fr);
  for (const n of nodes.values()) applyElement(n, fr.elements[n.el.ref]);
  for (const n of nodes.values()) {
    const f = fr.elements[n.el.ref];
    if (f && n.pages) applyDevice(n, f, t);
  }
  for (const n of nodes.values()) {
    const cam = fr.elements[n.el.ref]?.camera;
    if (cam) applyCamera(n, cam);
  }
  applyFollow(fr);
  followPins();
  for (const n of nodes.values()) applySpot(n, fr.elements[n.el.ref]?.spot);
  updateConnectors();
  for (const n of nodes.values()) if (n.particles) applyParticles(n, t);
  applyMasks();
  applyMatchCuts(fr);
  applyCursors(fr.cursors);
  for (const [id, layer] of bgLayers) {
    const f = fr.elements[`${id}:background`];
    if (!f) continue;
    const p = f.props;
    layer.style.transform = `translate(${px(num(p.innerX, 0))}, ${px(num(p.innerY, 0))}) scale(${num(p.innerScale, 1)})`;
  }
  if (plan.grain > 0) {
    const fi = Math.floor(t * 24) + plan.seed * 31;
    grain.style.transform = `translate(${(fi * 137) % 256 - 256}px, ${(fi * 271) % 256 - 256}px)`;
  }
  endfade.style.opacity = String(fr.endFade);
  // Chromium re-rasters only what changed since the last frame, and an image redrawn in a
  // small invalidated area can land a pixel or two off from a full redraw. Taking the stage
  // out of the tree drops its cached paint, so every frame is drawn as if on a fresh page.
  stage.style.display = "none";
  void stage.offsetWidth;
  stage.style.display = "";
}

function layout(t: number): LayoutReport {
  render(t);
  const st = stage.getBoundingClientRect();
  const fr = frameAt(plan, t);
  const box = (r: DOMRect) => ({ x: round((r.left - st.left) / scale), y: round((r.top - st.top) / scale), width: round(r.width / scale), height: round(r.height / scale) });
  const elements: LayoutBox[] = [];
  for (const n of nodes.values()) {
    const sf = fr.scenes.find((s) => s.id === n.sceneId);
    let visible = !!sf?.visible;
    for (let e: HTMLElement | null = n.anim; visible && e && e !== stage; e = e.parentElement) {
      if (e.style.visibility === "hidden" || e.style.opacity === "0") visible = false;
    }
    const outerRect = n.outer.getBoundingClientRect();
    elements.push({
      ref: n.el.ref,
      type: n.el.type,
      scene: n.sceneId,
      box: staticBoxes.get(n.el.ref) ?? box(outerRect),
      current: box((SHAPED.has(n.el.type) && n.box instanceof HTMLElement ? n.box : n.anim).getBoundingClientRect()),
      ...(n.el.type === "text" && n.text ? { ink: box(inkRect(n)) } : {}),
      visible,
      inDevice: n.el.inDevice,
      ...(n.el.text ? { text: n.el.text.plain } : {}),
      ...(n.el.font ? { fontSize: round((shrinkRatio.get(n.el.ref) ?? 1) * n.el.font.size), screenFontSize: round((shrinkRatio.get(n.el.ref) ?? 1) * n.el.font.size * screenScale(n)) } : {}),
      ...(overflowing.has(n.el.ref) ? { overflow: true } : {}),
      ...(shrinkRatio.has(n.el.ref) ? { shrink: round(shrinkRatio.get(n.el.ref)!) } : {}),
    });
  }
  return { time: t, width: W, height: H, elements };
}

const round = (x: number) => Math.round(x * 10) / 10;

/** Canvas pixels per CSS pixel for an element (devices scale their logical pixels). */
function screenScale(n: Node): number {
  const t = n.text ?? n.outer;
  const w = t.offsetWidth;
  return w > 0 ? t.getBoundingClientRect().width / scale / w : 1;
}

// ---------------------------------------------------------------- boot

async function boot() {
  const css = h("style");
  css.textContent = [
    // Rendering is driven only by render(t): no CSS-driven motion, ever.
    // Rendering is driven only by render(t); no CSS motion, and no cached-raster layers
    // (will-change makes Chromium scale old bitmaps and re-raster later: timing-dependent pixels).
    "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent;will-change:auto!important}",
    ".w{display:inline-block;vertical-align:top;overflow:hidden;padding:0 .04em .12em;margin:0 -.04em -.12em}",
    ".w.open{overflow:visible}",
    ".wi{display:inline-block}",
    ".c{display:inline-block;white-space:pre}",
    ".txt{overflow-wrap:normal}",
  ].join("\n");
  document.head.appendChild(css);
  document.documentElement.style.background = "#000";
  document.body.style.margin = "0";
  stage = h("div", "", { position: "relative", width: px(W), height: px(H), overflow: "hidden", background: plan.background, transformOrigin: "0 0", WebkitFontSmoothing: "antialiased" } as Partial<CSSStyleDeclaration>);
  stage.id = "stage";
  for (const s of plan.scenes) {
    const sec = buildScene(s);
    sceneEls.set(s.id, sec);
    stage.appendChild(sec);
  }
  wipebar = h("div", "", { position: "absolute", display: "none", zIndex: "900" });
  stage.appendChild(wipebar);
  grain = h("div", "", { position: "absolute", inset: "-256px", pointerEvents: "none", zIndex: "950", mixBlendMode: "overlay", opacity: String(plan.grain) });
  if (plan.grain > 0) {
    grain.style.backgroundImage = `url(${noise()})`;
    // Grain drawn at 2× reads as film grain and keeps the H.264 bitrate sane.
    grain.style.backgroundSize = `${512 * k}px ${512 * k}px`;
  }
  stage.appendChild(grain);
  if (plan.vignette > 0) stage.appendChild(h("div", "", { position: "absolute", inset: "0", zIndex: "960", pointerEvents: "none", background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${plan.vignette}))` }));
  endfade = h("div", "", { position: "absolute", inset: "0", zIndex: "990", pointerEvents: "none", background: plan.end.color, opacity: "0" });
  stage.appendChild(endfade);
  document.body.appendChild(stage);
  prepareSvgDrawing();

  // Wait for every font face and image before measuring anything.
  const faces = new Set<string>();
  for (const n of nodes.values()) {
    const f = n.el.font;
    if (!f) continue;
    for (const style of ["normal", "italic"]) for (const w of [f.weight, 700]) faces.add(`${style} ${w} 40px "${f.family}"`);
  }
  faces.add(`normal 400 15px "${plan.fonts.body}"`);
  await Promise.all([...faces].map((f) => document.fonts.load(f).catch(() => [])));
  await document.fonts.ready;
  await decodeImages();
  for (const s of sceneEls.values()) s.style.visibility = "hidden";
  sizePaths();
  layoutAll();
  finishStrokes();
  for (const tr of plan.tracks) if (tr.kind === "camera") {
    const n = nodes.get(tr.ref);
    if (n) n.outer.style.overflow = "hidden";
  }
  resolveScrolls();
  buildCursors();
  buildMatchClones();
  await decodeImages();
  // Static boxes: measured once, before any animation transform is applied.
  const st = stage.getBoundingClientRect();
  for (const n of nodes.values()) {
    const r = drawnEl(n).getBoundingClientRect();
    staticBoxes.set(n.el.ref, { x: round(r.left - st.left), y: round(r.top - st.top), width: round(r.width), height: round(r.height) });
  }
  render(0);
}

/** Decode every image up front (`complete` only means loaded), so the first frame doesn't catch one mid-decode. */
function decodeImages(): Promise<unknown> {
  return Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
}

/** What part of a viewport rect is really on screen: inside the stage and every clipping container. */
function shownPart(from: Element, r: DOMRect): { rect: DOMRect; fraction: number; opacity: number } {
  let x0 = r.left;
  let y0 = r.top;
  let x1 = r.right;
  let y1 = r.bottom;
  let opacity = 1;
  const clipTo = (c: DOMRect) => {
    x0 = Math.max(x0, c.left);
    y0 = Math.max(y0, c.top);
    x1 = Math.min(x1, c.right);
    y1 = Math.min(y1, c.bottom);
  };
  for (let e: Element | null = from; e && e !== stage; e = e.parentElement) {
    const cs = getComputedStyle(e);
    opacity *= Number(cs.opacity);
    if (e !== from && cs.overflow !== "visible") clipTo(e.getBoundingClientRect());
  }
  if (getComputedStyle(from).visibility === "hidden") opacity = 0;
  clipTo(stage.getBoundingClientRect());
  const area = r.width * r.height;
  const shown = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return { rect: r, fraction: area > 0 ? shown / area : 0, opacity };
}

const pct = (x: number) => Math.round(x * 100) / 100;
export interface RegionQuery { target?: string; src?: string; rect?: number[] }
export interface RegionHit { query: number; ref: string; box: { x: number; y: number; width: number; height: number }; fraction: number; opacity: number }

/**
 * Where regions are drawn at t, in canvas pixels, how much of each is inside the frame and its clipping
 * containers (a phone screen, a cropped image), and its opacity. A query is a hotspot target ("app#export"),
 * or a rect in an image file's own pixels ({ src, rect }), reported for every element showing that file.
 */
function regions(t: number, queries: RegionQuery[]): RegionHit[] {
  render(t);
  const st = stage.getBoundingClientRect();
  const box = (r: DOMRect) => ({ x: round((r.left - st.left) / scale), y: round((r.top - st.top) / scale), width: round(r.width / scale), height: round(r.height / scale) });
  const out: RegionHit[] = [];
  queries.forEach((q, i) => {
    if (q.target) {
      const [ref, hs] = q.target.split("#") as [string, string | undefined];
      const n = nodes.get(ref);
      const r = n && (hs ? spotRect(n, hs) : visualRect(n));
      if (!n || !r) return;
      const img = (n.screen ?? n.box ?? n.anim).querySelector?.("img") ?? n.anim;
      const s = shownPart(hs ? img : n.anim, r);
      out.push({ query: i, ref: q.target, box: box(r), fraction: pct(s.fraction), opacity: pct(s.opacity) });
    } else if (q.src && q.rect) {
      for (const img of document.images) {
        if (decodeURI(img.src) !== `file://${q.src}` || !img.naturalWidth) continue;
        const owner = img.closest<HTMLElement>(".el");
        const n = owner ? nodes.get(owner.dataset.ref ?? "") : undefined;
        if (!n) continue;
        // In a device the screenshot is a page shown at the screen's width; as an image element it has fit, focus and crop.
        const r = n.el.type === "image" ? imageRect(n, img, q.rect) : (() => {
          const b = img.getBoundingClientRect();
          const sc = b.width / img.naturalWidth;
          return new DOMRect(b.left + q.rect![0]! * sc, b.top + q.rect![1]! * sc, q.rect![2]! * sc, q.rect![3]! * sc);
        })();
        const s = shownPart(img, r);
        if (s.fraction > 0 && s.opacity > 0.01) out.push({ query: i, ref: n.el.ref, box: box(r), fraction: pct(s.fraction), opacity: pct(s.opacity) });
      }
    }
  });
  return out;
}

window.sini = {
  ready: boot(),
  render,
  layout,
  layouts: (ts: number[]) => ts.map(layout),
  regions: (ts: number[], queries: RegionQuery[]) => ts.map((t) => regions(t, queries)),
  setScale(f: number) {
    scale = f;
    stage.style.transform = f === 1 ? "" : `scale(${f})`;
  },
};
