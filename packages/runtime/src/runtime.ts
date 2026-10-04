/**
 * Sini browser runtime.
 *
 * Builds a DOM from a compiled plan (window.__SINI_PLAN__), lays it out once (CSS plus a
 * measuring pass for relative placement, pins and fit-to-width), then renders any frame on
 * demand with `sini.render(t)`. Rendering is a pure function of t: every call sets every
 * animated style, so frames can be rendered in any order, in parallel.
 */
import { clamp01, formatLike, frameAt, type ElementFrame, type Frame, type PlanElement, type PlanScene, type Plan, type Run } from "@sini/core";

declare global {
  interface Window {
    __SINI_PLAN__: Plan;
    sini: {
      ready: Promise<void>;
      render(t: number): void;
      layout(t: number): LayoutReport;
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
  visible: boolean;
  inDevice: boolean;
  text?: string;
  fontSize?: number;
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
  body?: HTMLElement;
  ring?: HTMLElement;
  /** Device screen element (scaled logical-pixel space). */
  screen?: HTMLElement;
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

function picture(src: { kind: "file"; src: string } | { kind: "placeholder"; color: string; seed: number }, fit: string, focus: number[] = [50, 50]): HTMLElement {
  if (src.kind === "file") {
    const img = h("img", "pic", { width: "100%", height: "100%", objectFit: fit, objectPosition: `${focus[0]}% ${focus[1]}%`, display: "block" });
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
    background: `radial-gradient(ellipse at ${fx}% ${fy}%, ${shade(c, 38)}, ${c} 55%, ${shade(c, -34)})`,
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
        if (breaks === 0) host.appendChild(document.createTextNode(" "));
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

function fontCss(e: HTMLElement, el: PlanElement) {
  const f = el.font!;
  Object.assign(e.style, {
    fontFamily: `"${f.family}"`,
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
  if (s.radius !== undefined) e.style.borderRadius = px(s.radius);
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
    if (!(el.layout as Record<string, unknown>).width && ["text", "stack", "grid", "button", "badge"].includes(el.type)) outer.style.width = "max-content";
  }
  else outer.style.position = "relative";
  outer.style.zIndex = String(el.z || 0);
  sizeOuter(outer, el);
  const fillsBox = outer.style.width && outer.style.width !== "max-content" || outer.style.height || outer.style.aspectRatio;
  anim.style.transformOrigin = ORIGIN[el.style.origin] ?? "50% 50%";
  const node: Node = { el, outer, anim, words: [], chars: [], sceneId };
  nodes.set(el.ref, node);
  if (fillsBox) Object.assign(anim.style, { width: "100%", height: "100%" });

  switch (el.type) {
    case "text": {
      const t = h("div", "txt");
      fontCss(t, el);
      t.style.whiteSpace = "normal";
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
      inner.appendChild(picture(el.props.image as never, String(el.props.fit), el.props.focus as number[]));
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
    case "shape": {
      const shape = String(el.props.shape);
      const sw = el.style.strokeWidth ?? (el.style.stroke ? 2 : 0);
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      Object.assign(svg.style, { display: "block", overflow: "visible" });
      const geo = document.createElementNS(SVGNS, shape === "line" ? "line" : shape === "circle" || shape === "ellipse" ? "ellipse" : "rect") as SVGGeometryElement;
      geo.setAttribute("pathLength", "1");
      // Geometry with calc() must be set as CSS properties (SVG 2); Chrome rejects it in attributes.
      if (shape === "line") {
        for (const [a, v] of [["x1", "0"], ["x2", "100%"], ["y1", "50%"], ["y2", "50%"]]) geo.setAttribute(a!, v!);
      } else if (shape === "circle" || shape === "ellipse") {
        for (const [a, v] of [["cx", "50%"], ["cy", "50%"], ["rx", `calc(50% - ${sw / 2}px)`], ["ry", `calc(50% - ${sw / 2}px)`]]) geo.style.setProperty(a!, v!);
      } else {
        for (const [a, v] of [["x", px(sw / 2)], ["y", px(sw / 2)], ["width", `calc(100% - ${sw}px)`], ["height", `calc(100% - ${sw}px)`]]) geo.style.setProperty(a!, v!);
      }
      geo.setAttribute("fill", el.style.fill ?? "none");
      if (el.style.stroke) {
        geo.setAttribute("stroke", el.style.stroke);
        geo.setAttribute("stroke-width", String(sw));
        geo.setAttribute("stroke-linecap", "round");
      }
      svg.appendChild(geo);
      anim.appendChild(svg);
      Object.assign(anim.style, { width: "100%", height: "100%" });
      node.box = svg;
      node.outline = geo;
      node.box = geo;
      if (!outer.style.width) outer.style.width = px(shape === "line" ? 360 * k : 120 * k);
      if (!outer.style.height) outer.style.height = shape === "line" ? px(Math.max(sw, 2)) : outer.style.width;
      if (shape === "pill") geo.style.setProperty("rx", "9999px");
      else if (el.style.radius !== undefined && shape === "rect") geo.style.setProperty("rx", px(el.style.radius));
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
      if (fillsBox) Object.assign(c.style, { width: "100%", height: "100%" });
      anim.appendChild(c);
      node.box = c;
      for (const child of el.children) c.appendChild(build(child, el.type !== "group", sceneId));
      break;
    }
    case "browser":
    case "phone":
      buildDevice(node, el, sceneId);
      break;
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
      const bar = h("div", "toolbar", { height: px(toolbar), display: "flex", alignItems: "center", gap: px(10 * s), padding: `0 ${px(18 * s)}`, background: dark ? "rgba(255,255,255,0.06)" : "#ECE8E2", borderBottom: `${px(Math.max(1, 1.5 * s))} solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}` });
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
  const content = el.props.content as never;
  if (content) {
    const p = picture(content, "cover");
    Object.assign(p.style, { height: "auto", minHeight: "100%" });
    screen.appendChild(p);
    node.img = screen;
    return;
  }
  const page = el.pages?.[0];
  if (!page) return;
  const top = el.type === "phone" && el.props.statusBar !== false ? 54 : 0;
  const pg = h("div", "page", { display: "flex", flexDirection: "column", gap: px(page.gap), padding: page.padding.map((v, i) => px(v + (i === 0 ? top : 0))).join(" "), background: page.background, minHeight: "100%", boxSizing: "border-box" });
  for (const child of page.children) pg.appendChild(build(child, true, sceneId));
  screen.appendChild(pg);
}

// ---------------------------------------------------------------- scenes

function buildScene(s: PlanScene): HTMLElement {
  const sec = h("section", "scene", { position: "absolute", inset: "0", overflow: "hidden", visibility: "hidden" });
  sec.dataset.scene = s.id;
  const bg = h("div", "bg", { position: "absolute", inset: "0", overflow: "hidden" });
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
function localBox(target: HTMLElement, parent: HTMLElement) {
  const r = target.getBoundingClientRect();
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
      const target = ref ? nodes.get(ref)?.outer : undefined;
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
}

function resolveRef(name: string, from: string): string | undefined {
  if (nodes.has(name)) return name;
  // Inside a component, local ids are prefixed with the instance path.
  const prefix = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return nodes.has(prefix + name) ? prefix + name : undefined;
}

/** Auto-sized groups take the bounding box of their children. */
function sizeGroups() {
  for (const n of nodes.values()) {
    if (n.el.type !== "group" || n.outer.style.width) continue;
    let w = 0;
    let hh = 0;
    for (const c of n.el.children) {
      const o = nodes.get(c.ref)?.outer;
      if (!o) continue;
      const b = localBox(o, n.box as HTMLElement);
      w = Math.max(w, b.x + b.w);
      hh = Math.max(hh, b.y + b.h);
    }
    n.outer.style.width = px(w);
    n.outer.style.height = px(hh);
    (n.box as HTMLElement).style.width = "100%";
    (n.box as HTMLElement).style.height = "100%";
  }
}

const shrinkRatio = new Map<string, number>();
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
  const sc = num(p.scale, s.scale);
  anim.style.transform = `translate(${px(x)}, ${px(y)}) rotate(${rot}deg) scale(${sc * num(p.scaleX, s.scaleX)}, ${sc * num(p.scaleY, s.scaleY)})`;
  anim.style.opacity = String(clamp01(num(p.opacity, s.opacity)));
  const blur = num(p.blur, s.blur);
  anim.style.filter = blur > 0.01 ? `blur(${px(blur)})` : "";
  const cl = [num(p.clipTop, 0), num(p.clipRight, 0), num(p.clipBottom, 0), num(p.clipLeft, 0)];
  anim.style.clipPath = cl.some((c) => c > 0) ? `inset(${cl.map((c) => `${clamp01(c) * 100}%`).join(" ")})` : "";
  if (n.text) {
    if (p.letterSpacing !== undefined) n.text.style.letterSpacing = `${p.letterSpacing}em`;
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
      n.outline.style.strokeDasharray = "1";
      n.outline.style.strokeDashoffset = String(1 - clamp01(d));
    }
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
  // State content rolls.
  if (n.text && f.content) {
    const { from, to, p: q } = f.content;
    n.text.dataset.rolled = "1";
    if (q >= 1) n.text.textContent = to;
    else {
      n.text.innerHTML = "";
      const wrap = h("span", "", { display: "inline-grid", overflow: "hidden", verticalAlign: "top" });
      const a = h("span", "", { gridArea: "1 / 1", transform: `translateY(${-q * 100}%)`, whiteSpace: "nowrap" });
      const b = h("span", "", { gridArea: "1 / 1", transform: `translateY(${(1 - q) * 100}%)`, whiteSpace: "nowrap" });
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
      n.ring = h("div", "ring", { position: "absolute", inset: "0", pointerEvents: "none", borderRadius: (n.box as HTMLElement | undefined)?.style.borderRadius || "999px", border: `${px(2 * k)} solid ${el.style.fill ?? el.font?.color ?? "#fff"}` });
      n.anim.appendChild(n.ring);
    }
    n.ring.style.display = "block";
    n.ring.style.opacity = String((1 - f.ring.p) * 0.6);
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
        sec.style.transform = `scale(${s0 + (1 - s0) * p})`;
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
        sec.style.transform = `scale(${1 + (tr.direction === "out" ? -0.15 : 0.35) * out.p})`;
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

function render(t: number) {
  const fr = frameAt(plan, t);
  applyScenes(fr);
  for (const n of nodes.values()) applyElement(n, fr.elements[n.el.ref]);
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
      box: box(outerRect),
      current: box(n.anim.getBoundingClientRect()),
      visible,
      inDevice: n.el.inDevice,
      ...(n.el.text ? { text: n.el.text.plain } : {}),
      ...(n.el.font ? { fontSize: round((shrinkRatio.get(n.el.ref) ?? 1) * n.el.font.size) } : {}),
      ...(overflowing.has(n.el.ref) ? { overflow: true } : {}),
      ...(shrinkRatio.has(n.el.ref) ? { shrink: round(shrinkRatio.get(n.el.ref)!) } : {}),
    });
  }
  return { time: t, width: W, height: H, elements };
}

const round = (x: number) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- boot

async function boot() {
  const css = h("style");
  css.textContent = [
    // Rendering is driven only by render(t): no CSS-driven motion, ever.
    "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent}",
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
  await Promise.all([...document.images].map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))));
  for (const s of sceneEls.values()) s.style.visibility = "hidden";
  layoutAll();
  render(0);
}

window.sini = {
  ready: boot(),
  render,
  layout,
  setScale(f: number) {
    scale = f;
    stage.style.transform = f === 1 ? "" : `scale(${f})`;
  },
};
