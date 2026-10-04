/**
 * Compile a validated Sini spec into a Plan: defaults resolved, components expanded,
 * every time expression resolved to absolute seconds, and every preset turned into tracks.
 */
import { expandComponent, devicePages, type Personality, type Spec } from "@sini/schema";
import { parseCss, resolveColour, resolvePaint, luminance } from "./colour.js";
import {
  AUTO, BUTTON, CHAIN_OVERLAP, DEFAULT_FONTS, DEFAULT_TRANSITION_DURATION, FIRST_ENTER_AT, NAVIGATE_DURATION,
  PACE, PERSONALITY, READING, ROLE_TABLE, SCROLL_DURATION, STATE_DURATION, TOP_LEVEL_TEXT_MARGIN,
} from "./defaults.js";
import type { EaseSpec } from "./ease.js";
import { parseMarkup } from "./markup.js";
import type {
  Font, ImageSource, PartSelector, Plan, PlanElement, PlanIssue, PlanScene, PlanState, PlanStyle, PlanTransition, Track, TweenTrack,
} from "./plan.js";

type J = any;

export interface CompileOptions {
  /** Absolute path of the project folder; asset paths are resolved against it. */
  projectDir?: string;
  /** Whether an asset file exists. Default: assume it does. */
  exists?: (absolutePath: string) => boolean;
  /** Join a project-relative path onto projectDir. Default: POSIX join. */
  resolvePath?: (projectDir: string, rel: string) => string;
}

export interface ReadingWindow {
  ref: string;
  sceneId: string;
  words: number;
  /** Absolute times the text is fully visible and readable. */
  start: number;
  end: number;
}

export interface CompiledPlan extends Plan {
  reading: ReadingWindow[];
}

const UNSUPPORTED_TYPES = new Set(["icon", "toast", "progress", "chart", "template", "svg"]);
const UNSUPPORTED_BEHAVIORS = new Set(["scroll", "interaction", "camera", "focusCycle", "navigate"]);
const ENTER = new Set(["fadeIn", "fadeUp", "slideIn", "scaleIn", "popIn", "bounceIn", "blurIn", "wordReveal", "lineReveal", "charReveal", "typewriter", "countUp", "trackIn", "drawOutline", "wipeIn", "grow"]);
const EXIT = new Set(["fadeOut", "slideOut", "scaleOut", "blurOut", "wordsUp", "wipeOut"]);
const AMBIENT = new Set(["kenBurns", "float", "pulse", "swing", "drift"]);
const WORD_SPLIT = new Set(["wordReveal", "lineReveal", "wordsUp", "bounceIn"]);
const CHAR_SPLIT = new Set(["charReveal", "typewriter"]);

class NeedsSceneEnd extends Error {}
class TimeCycle extends Error {}

const ceil10 = (x: number) => Math.ceil(x * 10 - 1e-9) / 10;
const posixJoin = (a: string, b: string) => (b.startsWith("/") ? b : `${a.replace(/\/$/, "")}/${b}`);

interface Window {
  start: number;
  end: number;
}

/** A preset application, before timing is resolved. */
interface PresetUse {
  name: string;
  params: Record<string, J>;
  ref: string;
  /** Item id when it came from a timeline item. */
  itemId?: string;
  at?: J;
  kind: "enter" | "exit" | "ambient";
  /** Position in a list target (for stagger between targets). */
  targetIndex: number;
  /** Chain index for default timing (enters only). */
  chain?: number;
  label: string;
}

export function compile(spec: Spec, options: CompileOptions = {}): CompiledPlan {
  return new Compiler(spec as J, options).run();
}

class Compiler {
  report: PlanIssue[] = [];
  W: number;
  H: number;
  k: number;
  palette: Record<string, string>;
  personality: { ease: EaseSpec; duration: number; stagger: number; textEnter: string };
  fonts: { display: string; body: string; mono: string };
  roleOverrides: Record<string, J>;
  assets: Record<string, J>;
  components: Record<string, J>;
  tracks: Track[] = [];
  reading: ReadingWindow[] = [];
  seedCounter = 0;

  constructor(private spec: J, private opts: CompileOptions) {
    const v = spec.video ?? {};
    const sizes: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350], "16:9": [1920, 1080] };
    const [fw, fh] = sizes[v.format ?? "9:16"] ?? [1080, 1920];
    this.W = v.width ?? fw;
    this.H = v.height ?? fh;
    this.k = Math.min(this.W, this.H) / 1080;
    const theme = spec.theme ?? {};
    this.palette = theme.palette ?? {};
    const m = theme.motion;
    const base = PERSONALITY[((typeof m === "string" ? m : m?.base) ?? "editorial") as Personality] ?? PERSONALITY.editorial;
    this.personality = typeof m === "object" && m ? { ...base, ...(m.ease ? { ease: m.ease } : {}), ...(m.duration ? { duration: m.duration } : {}), ...(m.stagger !== undefined ? { stagger: m.stagger } : {}) } : base;
    this.fonts = { ...DEFAULT_FONTS, ...(theme.fonts ?? {}) };
    this.roleOverrides = theme.roles ?? {};
    this.assets = spec.assets ?? {};
    this.components = spec.components ?? {};
  }

  warn(path: string, code: string, message: string, suggestion?: string) {
    this.report.push({ level: "warning", path, code, message, ...(suggestion ? { suggestion } : {}) });
  }

  colour(v: J): string | undefined {
    return typeof v === "string" ? resolveColour(v, this.palette) : undefined;
  }
  paint(v: J): string | undefined {
    return resolvePaint(v, this.palette);
  }

  // ---------- assets ----------

  image(id: J, path: string): ImageSource {
    const decl = this.assets[id];
    const seed = ++this.seedCounter;
    const fromDecl = (d: J, depth = 0): ImageSource => {
      if (typeof d === "string") return this.file(d, path, () => ({ kind: "placeholder", color: "#8a8178", hint: id, seed }));
      if (d && typeof d === "object") {
        if (d.type === "placeholder") return { kind: "placeholder", color: this.colour(d.color ?? "#8a8178") ?? "#8a8178", hint: d.hint, seed };
        if (typeof d.src === "string") {
          return this.file(d.src, path, () => (d.fallback && depth < 3 ? fromDecl(d.fallback, depth + 1) : { kind: "placeholder", color: "#8a8178", hint: d.hint ?? id, seed }));
        }
      }
      return { kind: "placeholder", color: "#8a8178", hint: String(id), seed };
    };
    return fromDecl(decl);
  }

  file(rel: string, path: string, fallback: () => ImageSource): ImageSource {
    const dir = this.opts.projectDir ?? ".";
    const abs = (this.opts.resolvePath ?? posixJoin)(dir, rel);
    if (this.opts.exists && !this.opts.exists(abs)) {
      this.warn(path, "missing-asset", `Asset file '${rel}' not found; using a placeholder.`);
      return fallback();
    }
    return { kind: "file", src: abs };
  }

  // ---------- styles ----------

  style(s: J = {}): PlanStyle {
    const pad = s.padding;
    const padding: [number, number, number, number] | undefined =
      pad === undefined ? undefined
        : typeof pad === "number" ? [pad, pad, pad, pad]
          : pad.length === 2 ? [pad[0], pad[1], pad[0], pad[1]]
            : [pad[0] ?? 0, pad[1] ?? 0, pad[2] ?? 0, pad[3] ?? 0];
    const out: PlanStyle = {
      opacity: s.opacity ?? 1,
      rotation: s.rotation ?? 0,
      scale: s.scale ?? 1,
      scaleX: s.scaleX ?? 1,
      scaleY: s.scaleY ?? 1,
      origin: s.origin ?? "center",
      shadow: s.shadow ?? "none",
      blur: s.blur ?? 0,
      blend: s.blend ?? "normal",
    };
    if (s.radius !== undefined) out.radius = s.radius;
    const fill = this.paint(s.fill);
    if (fill) out.fill = fill;
    const stroke = this.colour(s.stroke);
    if (stroke) out.stroke = stroke;
    if (s.strokeWidth !== undefined) out.strokeWidth = s.strokeWidth;
    if (padding) out.padding = padding;
    return out;
  }

  font(roleName: string, s: J = {}, inDevice: boolean, defaultColour: string, kind: "text" | "button" | "badge" = "text"): Font {
    const role = ROLE_TABLE[roleName as keyof typeof ROLE_TABLE] ?? ROLE_TABLE.body;
    const ov = this.roleOverrides[roleName] ?? {};
    let size = inDevice ? role.deviceSize : (ov.size ?? role.size) * this.k;
    let weight = ov.weight ?? role.weight;
    let family = this.fonts[role.slot];
    if (kind === "button") {
      size = inDevice ? BUTTON.deviceSize : BUTTON.size * this.k;
      weight = BUTTON.weight;
      family = this.fonts.body;
    }
    return {
      family,
      size: s.size ?? size,
      weight: s.weight ?? weight,
      lineHeight: s.lineHeight ?? ov.lineHeight ?? role.lineHeight,
      letterSpacing: s.letterSpacing ?? ov.letterSpacing ?? role.letterSpacing,
      uppercase: s.uppercase ?? ov.uppercase ?? (kind === "button" ? false : role.uppercase),
      italic: s.italic ?? false,
      align: s.align ?? "left",
      color: this.colour(s.color) ?? defaultColour,
    };
  }

  // ---------- elements ----------

  /** Build the element tree for a scene. Fills `registry` (ref → element + its source). */
  element(e: J, ctx: { sceneId: string; prefix: string; inDevice: boolean; topLevel: boolean; textColour: string; path: string }, registry: Map<string, { el: PlanElement; src: J; topLevel: boolean }>): PlanElement | null {
    let src = e;
    let ref = ctx.prefix + e.id;
    let childPrefix = ctx.prefix;
    if ("use" in e) {
      const def = this.components[e.use];
      if (!def) return null;
      const root = expandComponent(def, e.with);
      // Instance keys apply to the root; style merges, states add.
      src = {
        ...root,
        id: e.id,
        layout: e.layout ?? root.layout,
        style: { ...(root.style ?? {}), ...(e.style ?? {}) },
        states: { ...(root.states ?? {}), ...(e.states ?? {}) },
        ...(e.enter !== undefined ? { enter: e.enter } : {}),
        ...(e.exit !== undefined ? { exit: e.exit } : {}),
        ...(e.z !== undefined ? { z: e.z } : {}),
      };
      childPrefix = `${ref}/`;
      registry.set(`${ref}/${root.id}`, { el: null as unknown as PlanElement, src, topLevel: false }); // alias, fixed below
    }
    const type = src.type as string;
    if (UNSUPPORTED_TYPES.has(type)) {
      this.warn(ctx.path, "unsupported-element", `'${type}' elements aren't rendered yet in this version of Sini; '${ref}' is skipped.`);
      return null;
    }
    const style = this.style(src.style);
    const el: PlanElement = {
      ref,
      type,
      sceneId: ctx.sceneId,
      inDevice: ctx.inDevice,
      layout: this.layout(src.layout ?? {}, type, ctx),
      style,
      props: {},
      states: {},
      children: [],
      appearAt: null,
      hideAt: null,
      z: src.z ?? 0,
    };
    registry.set(ref, { el, src, topLevel: ctx.topLevel });
    const alias = "use" in e ? registry.get(`${ref}/${(this.components[e.use].root ?? {}).id}`) : undefined;
    if (alias) alias.el = el;

    if (type === "text") {
      el.font = this.font(src.role ?? "body", src.style, ctx.inDevice, ctx.textColour);
      const parsed = parseMarkup(String(src.content ?? ""));
      el.text = {
        runs: parsed.runs.map((r) => (r.color ? { ...r, color: this.colour(r.color) ?? r.color } : r)),
        plain: parsed.plain,
        words: parsed.words,
        chars: parsed.chars,
        lines: parsed.lines,
        readingWords: parsed.readingWords,
        ...(parsed.number ? { number: parsed.number } : {}),
        split: "none",
        fit: src.fit ?? "none",
        ...(src.maxLines ? { maxLines: src.maxLines } : {}),
      };
    } else if (type === "button" || type === "badge") {
      el.font = type === "button"
        ? this.font("body", src.style, ctx.inDevice, ctx.textColour, "button")
        : this.font("label", src.style, ctx.inDevice, ctx.textColour, "badge");
      const parsed = parseMarkup(String(src.label ?? ""));
      el.text = { runs: parsed.runs, plain: parsed.plain, words: parsed.words, chars: parsed.chars, lines: parsed.lines, readingWords: parsed.readingWords, ...(parsed.number ? { number: parsed.number } : {}), split: "none", fit: "none" };
      el.props = type === "button" ? { variant: src.variant ?? "solid" } : { shape: src.shape ?? "pill" };
      if (type === "button") {
        const h = el.font.size * BUTTON.heightEm;
        if (style.radius === undefined) style.radius = h * BUTTON.radiusOfHeight;
        if (!style.padding) style.padding = [0, el.font.size * BUTTON.padEm, 0, el.font.size * BUTTON.padEm];
        el.props.height = h;
        if (el.props.variant === "solid" && !style.fill) style.fill = "#111111";
        if (el.props.variant === "solid" && !src.style?.color) el.font.color = luminanceOf(style.fill) > 0.5 ? "rgb(17, 17, 17)" : "rgb(255, 255, 255)";
        if (el.props.variant === "outline" && !style.stroke) style.stroke = el.font.color;
      } else if (!style.fill) style.fill = "#111111";
      if (type === "badge" && !src.style?.color) el.font.color = luminanceOf(style.fill) > 0.5 ? "rgb(17, 17, 17)" : "rgb(255, 255, 255)";
    } else if (type === "image") {
      el.props = { image: this.image(src.asset, `${ctx.path}.asset`), fit: src.fit ?? "cover", focus: src.focus ?? [50, 50] };
    } else if (type === "shape") {
      el.props = { shape: src.shape };
      if (src.shape !== "line" && !style.fill && !style.stroke) style.fill = ctx.textColour;
      if (src.shape === "line" && !style.stroke) style.stroke = ctx.textColour;
    } else if (type === "stack") {
      el.props = { direction: src.direction ?? "vertical", gap: src.gap ?? 0, align: src.align ?? "start", justify: src.justify ?? "start" };
    } else if (type === "grid") {
      el.props = { columns: src.columns ?? 2, gap: src.gap ?? 0, rowGap: src.rowGap ?? src.gap ?? 0 };
    } else if (type === "browser" || type === "phone") {
      el.props = {
        chrome: src.chrome ?? "light",
        ...(type === "browser" ? { url: src.url ?? "" } : { statusBar: src.statusBar ?? true }),
        ...(typeof src.content === "string" ? { content: this.image(src.content, `${ctx.path}.content`) } : {}),
      };
      if (src.screens) {
        this.warn(ctx.path, "unsupported-feature", "Device screens aren't rendered yet; only the first screen is shown.");
      }
      if (src.overlay) this.warn(ctx.path, "unsupported-feature", "Device overlays aren't rendered yet.");
    }

    const childCtx = { ...ctx, prefix: childPrefix, topLevel: false };
    const kids: J[] = Array.isArray(src.children) ? src.children : [];
    if (type === "browser" || type === "phone") {
      const devCtx = { ...childCtx, inDevice: true, textColour: "rgb(17, 17, 17)" };
      const firstScreen = src.screens ? src.screens[src.screen] ?? Object.values(src.screens)[0] : null;
      const pageSrc: J = firstScreen ? (Array.isArray(firstScreen) ? { children: firstScreen } : firstScreen) : { children: kids };
      const pad = this.style({ padding: pageSrc.padding ?? src.padding ?? 0 }).padding!;
      el.pages = [{
        name: src.screen ?? "main",
        background: this.paint(pageSrc.background ?? src.background ?? "#FFFFFF") ?? "#FFFFFF",
        padding: pad,
        gap: pageSrc.gap ?? src.gap ?? 0,
        children: (pageSrc.children ?? []).map((c: J, j: number) => this.element(c, { ...devCtx, path: `${ctx.path}.children[${j}]` }, registry)).filter(Boolean) as PlanElement[],
      }];
    } else {
      el.children = kids.map((c: J, j: number) => this.element(c, { ...childCtx, path: `${ctx.path}.children[${j}]` }, registry)).filter(Boolean) as PlanElement[];
    }

    for (const [name, st] of Object.entries<J>(src.states ?? {})) {
      const ps: PlanState = { style: {} };
      for (const [k, v] of Object.entries<J>(st.style ?? {})) {
        ps.style[k] = k === "fill" ? this.paint(v) : k === "stroke" || k === "color" ? this.colour(v) : v;
      }
      if (st.content !== undefined) ps.content = st.content;
      if (st.label !== undefined) ps.label = st.label;
      if (st.variant !== undefined) ps.variant = st.variant;
      if (st.value !== undefined) ps.value = st.value;
      el.states[name] = ps;
    }
    return el;
  }

  layout(l: J, type: string, ctx: { inDevice: boolean; topLevel: boolean }): Record<string, unknown> {
    const out: Record<string, unknown> = { ...l };
    if (typeof l.inset === "number") out.inset = [l.inset, l.inset];
    const method = l.pin ? "pin" : ["below", "above", "leftOf", "rightOf"].some((k) => k in l) ? "relative" : "x" in l || "y" in l ? "absolute" : "anchor";
    out.method = method;
    if (method === "anchor") {
      out.anchor = l.anchor ?? "top-left";
      out.inset ??= [0, 0];
    }
    if (method === "relative") out.gap ??= 32;
    if (["text", "stack", "grid", "button", "badge"].includes(type) && ctx.topLevel && out.maxWidth === undefined && out.width === undefined) {
      out.maxWidth = this.W - 2 * TOP_LEVEL_TEXT_MARGIN * this.k;
    }
    return out;
  }

  // ---------- run ----------

  run(): CompiledPlan {
    const s = this.spec;
    const v = s.video ?? {};
    const theme = s.theme ?? {};
    const fps = v.fps ?? 30;
    const sceneSrcs: J[] = s.scenes ?? [];

    // Build element trees.
    const built = sceneSrcs.map((sc, i) => {
      const registry = new Map<string, { el: PlanElement; src: J; topLevel: boolean }>();
      const bg = sc.background;
      const bgPaint = bg && typeof bg === "object" && "asset" in bg ? null : this.paint(bg ?? v.background ?? "#000000");
      const bgRgba = parseCss(bgPaint && !bgPaint.includes("gradient") ? bgPaint : firstColour(bgPaint) ?? "#000000");
      const textColour = bgRgba && luminance(bgRgba) < 0.4 ? "rgb(255, 255, 255)" : "rgb(17, 17, 17)";
      const elements = (sc.elements ?? [])
        .map((e: J, j: number) => this.element(e, { sceneId: sc.id, prefix: "", inDevice: false, topLevel: true, textColour, path: `scenes[${i}].elements[${j}]` }, registry))
        .filter(Boolean) as PlanElement[];
      return { sc, registry, elements };
    });

    // Timing: first pass computes natural auto durations, second pass resolves everything.
    const naturals = built.map((b, i) => this.sceneTiming(b.sc, i, b.registry, null).natural);
    const durations = sceneSrcs.map((sc, i) => (sc.duration === "auto" ? naturals[i]! : Number(sc.duration)));
    const natural = durations.reduce((a, b) => a + b, 0);
    if (v.targetDuration) this.applyTarget(v.targetDuration, sceneSrcs, durations);

    let start = 0;
    const scenes: PlanScene[] = [];
    built.forEach((b, i) => {
      const duration = durations[i]!;
      const sc = b.sc;
      const timing = this.sceneTiming(sc, i, b.registry, duration);
      const transition = i === 0 ? null : this.transition(sc.transition ?? "theme", theme.transition, `scenes[${i}].transition`);
      const bg = sc.background;
      const background: PlanScene["background"] = bg && typeof bg === "object" && "asset" in bg
        ? { kind: "image", image: this.image(bg.asset, `scenes[${i}].background.asset`), fit: bg.fit ?? "cover", ...(bg.overlay ? { overlay: this.paint(bg.overlay)! } : {}), blur: bg.blur ?? 0 }
        : { kind: "paint", css: this.paint(bg ?? v.background ?? "#000000") ?? "#000000" };
      scenes.push({ id: sc.id, index: i, start, duration, visibleUntil: start + duration, background, transition, elements: b.elements });
      this.emitTracks(sc, i, b.registry, timing, start, duration);
      this.emitReading(sc, b.registry, timing, start, duration, transition?.duration ?? 0);
      start += duration;
    });
    for (let i = 0; i < scenes.length - 1; i++) scenes[i]!.visibleUntil += scenes[i + 1]!.transition?.duration ?? 0;
    const total = start;

    const end = v.end;
    const endPlan: Plan["end"] = typeof end === "object" && end
      ? { type: "fade", duration: end.duration ?? 0.6, start: total - (end.duration ?? 0.6), color: this.colour(end.color ?? "#000000") ?? "#000000" }
      : { type: end === "cut" ? "cut" : "hold", duration: 0, start: total, color: "#000000" };

    // Reading windows can't extend under the end fade.
    if (endPlan.type === "fade") for (const r of this.reading) r.end = Math.min(r.end, endPlan.start);

    const fontAssets = Object.values<J>(this.assets)
      .filter((a) => a && typeof a === "object" && a.type === "font" && a.src && a.family)
      .map((a) => ({ family: a.family, src: (this.opts.resolvePath ?? posixJoin)(this.opts.projectDir ?? ".", a.src) }));

    return {
      width: this.W,
      height: this.H,
      fps,
      duration: total,
      background: this.paint(v.background ?? "#000000") ?? "#000000",
      seed: v.seed ?? 1,
      grain: theme.texture?.grain ?? 0,
      vignette: theme.texture?.vignette ?? 0,
      safeZone: v.safeZone ?? "none",
      end: endPlan,
      fonts: this.fonts,
      fontAssets,
      scenes,
      tracks: this.tracks.sort((a, b) => a.t0 - b.t0),
      report: this.report,
      timing: { ...(v.targetDuration ? { target: v.targetDuration } : {}), natural, final: total },
      reading: this.reading,
    };
  }

  applyTarget(target: number, scenes: J[], durations: number[]) {
    const autoIdx = scenes.map((s, i) => (s.duration === "auto" ? i : -1)).filter((i) => i >= 0);
    const total = durations.reduce((a, b) => a + b, 0);
    let remaining = target - total;
    if (autoIdx.length === 0) {
      if (Math.abs(remaining) > 0.05) this.warn("video.targetDuration", "target-unreachable", `targetDuration is ${target}s but all scenes have fixed durations totalling ${total.toFixed(2)}s.`, "Use \"duration\": \"auto\" on some scenes.");
      return;
    }
    const adj = new Map<number, number>(autoIdx.map((i) => [i, 0]));
    const lo = AUTO.holdMin - AUTO.hold;
    const hi = AUTO.holdMaxExtra;
    for (let iter = 0; iter < 5 && Math.abs(remaining) > 1e-6; iter++) {
      const free = autoIdx.filter((i) => (remaining > 0 ? adj.get(i)! < hi : adj.get(i)! > lo));
      if (free.length === 0) break;
      const share = remaining / free.length;
      for (const i of free) {
        const next = Math.max(lo, Math.min(hi, adj.get(i)! + share));
        remaining -= next - adj.get(i)!;
        adj.set(i, next);
      }
    }
    for (const [i, a] of adj) durations[i] = Math.round((durations[i]! + a) * 1000) / 1000;
    if (Math.abs(remaining) > 0.05) {
      this.warn("video.targetDuration", "target-unreachable",
        `targetDuration ${target}s can't be reached: the video is ${(target - remaining).toFixed(2)}s (${remaining > 0 ? "short" : "long"} by ${Math.abs(remaining).toFixed(2)}s).`,
        remaining > 0 ? "Add content, lengthen fixed scenes, or lower targetDuration." : "Cut copy, shorten animations, or raise targetDuration.");
    }
  }

  transition(t: J, themeT: J, path: string): PlanTransition | null {
    let spec = t === "theme" ? themeT ?? "cut" : t;
    if (typeof spec === "string") spec = { type: spec };
    const type = spec.type ?? "cut";
    if (type === "cut") return null;
    const fallbackDur = typeof themeT === "object" && themeT?.duration ? themeT.duration : DEFAULT_TRANSITION_DURATION;
    let resolved = type;
    if (type === "matchCut") {
      this.warn(path, "unsupported-feature", "matchCut isn't rendered yet; using a crossfade.");
      resolved = "crossfade";
    }
    const defaultEase: Record<string, string> = { wipe: "expo.inOut", slide: "expo.inOut", crossfade: "sine.inOut", circle: "cubic.inOut", zoom: "cubic.inOut" };
    return {
      type: resolved,
      duration: spec.duration ?? fallbackDur,
      ease: spec.ease ?? defaultEase[resolved] ?? "cubic.inOut",
      from: spec.from ?? (resolved === "slide" ? "right" : "left"),
      angle: spec.angle ?? 0,
      bar: spec.bar === undefined || spec.bar === null ? null : this.colour(spec.bar) ?? null,
      barWidth: (spec.barWidth ?? 46) * this.k,
      push: !!spec.push,
      origin: spec.origin ?? "center",
      direction: spec.direction ?? "in",
    };
  }

  // ---------- timing ----------

  presetUses(sc: J, registry: Map<string, { el: PlanElement; src: J; topLevel: boolean }>): PresetUse[] {
    const uses: PresetUse[] = [];
    let chain = 0;
    const seen = new Set<PlanElement>();
    for (const [ref, { el, src, topLevel }] of registry) {
      if (!el || seen.has(el) || el.ref !== ref) continue;
      seen.add(el);
      let enter = src.enter;
      if (enter === undefined && topLevel && el.type === "text") enter = this.personality.textEnter;
      if (enter && enter !== "none") {
        const o = typeof enter === "string" ? { preset: enter } : enter;
        uses.push({ name: o.preset, params: o, ref, at: o.at, kind: "enter", targetIndex: 0, chain: chain++, label: `${o.preset} (enter)` });
      }
      if (src.exit) {
        const o = typeof src.exit === "string" ? { preset: src.exit } : src.exit;
        uses.push({ name: o.preset, params: o, ref, at: o.at, kind: "exit", targetIndex: 0, label: `${o.preset} (exit)` });
      }
    }
    for (const [j, t] of (sc.timeline ?? []).entries()) {
      if (!t || typeof t !== "object" || !("preset" in t)) continue;
      const targets: string[] = Array.isArray(t.target) ? t.target : [t.target];
      const kind = ENTER.has(t.preset) ? "enter" : EXIT.has(t.preset) ? "exit" : "ambient";
      const c = kind === "enter" && t.at === undefined ? chain++ : undefined;
      targets.forEach((ref, idx) => {
        uses.push({ name: t.preset, params: t, ref, at: t.at, kind, targetIndex: idx, ...(c !== undefined ? { chain: c } : {}), ...(t.id ? { itemId: t.id } : {}), label: `${t.preset}${t.id ? ` (${t.id})` : ` (timeline[${j}])`}` });
      });
    }
    return uses;
  }

  partsFor(name: string, el: PlanElement | undefined): number {
    const t = el?.text;
    if (!t) return 1;
    if (name === "wordReveal" || name === "wordsUp" || (name === "bounceIn" && el?.type === "text")) return Math.max(1, t.words);
    if (name === "lineReveal") return Math.max(1, t.lines);
    if (name === "charReveal") return Math.max(1, t.chars);
    return 1;
  }

  presetDuration(u: PresetUse, el: PlanElement | undefined): number {
    if (u.name === "typewriter") {
      const n = el?.type === "browser" ? String(el.props.url ?? "").length : el?.text?.chars ?? 0;
      return n / (u.params.cps ?? 40);
    }
    if (u.params.duration !== undefined) return u.params.duration;
    if (u.kind === "exit") return Math.round(this.personality.duration * 0.6 * 1000) / 1000;
    return this.personality.duration;
  }

  sceneTiming(sc: J, index: number, registry: Map<string, { el: PlanElement; src: J; topLevel: boolean }>, duration: number | null) {
    const uses = this.presetUses(sc, registry);
    const stagger = (u: PresetUse) => u.params.stagger ?? this.personality.stagger;
    const memo = new Map<string, number>();
    const visiting = new Set<string>();
    const useWindow = new Map<PresetUse, Window>();
    const itemWindows = new Map<string, Window>();
    const byChain = uses.filter((u) => u.chain !== undefined).sort((a, b) => a.chain! - b.chain!);
    const chainUse = (c: number) => byChain.find((u) => u.chain === c && u.targetIndex === 0);
    const timeline: J[] = sc.timeline ?? [];

    const evalExpr = (v: J, forUse?: PresetUse): number => {
      if (v === undefined || v === null) return 0;
      if (typeof v === "number") return v;
      if (v.startsWith("cue:")) {
        const m = /^cue:([\w-]+?)([+-]\d+(?:\.\d+)?)?$/.exec(v)!;
        return evalExpr(sc.cues?.[m[1]!]) + Number(m[2] ?? 0);
      }
      const m = /^(.*\.(?:start|end))([+-]\d+(?:\.\d+)?)?$/.exec(v);
      if (!m) return 0;
      const off = Number(m[2] ?? 0);
      const parts = m[1]!.split(".");
      const which = parts.pop() as "start" | "end";
      const ref = parts.shift()!;
      const sub = parts[0]; // enter | exit | undefined
      if (ref === "scene") {
        if (which === "start") return off;
        if (duration === null) throw new NeedsSceneEnd();
        return duration + off;
      }
      if (ref === "prev") {
        const c = forUse?.chain;
        const prevUse = c !== undefined && c > 0 ? chainUse(c - 1) : undefined;
        if (!prevUse) return off;
        const w = windowOf(prevUse);
        return (which === "start" ? w.start : w.end) + off;
      }
      if (sub === "enter" || sub === "exit") {
        const target = registry.get(ref)?.el?.ref ?? ref;
        const matches = uses.filter((u) => u.ref === target && u.kind === sub);
        if (matches.length === 0) return off;
        const ws = matches.map(windowOf);
        return (which === "start" ? Math.min(...ws.map((w) => w.start)) : Math.max(...ws.map((w) => w.end))) + off;
      }
      const w = itemWindow(ref);
      return (which === "start" ? w.start : w.end) + off;
    };

    const guard = <T>(key: string, f: () => T): T => {
      if (visiting.has(key)) throw new TimeCycle(key);
      visiting.add(key);
      try {
        return f();
      } finally {
        visiting.delete(key);
      }
    };

    const windowOf = (u: PresetUse): Window => {
      const cached = useWindow.get(u);
      if (cached) return cached;
      return guard(`use:${u.ref}:${u.label}`, () => {
        const el = registry.get(u.ref)?.el;
        let start: number;
        if (u.at !== undefined) start = evalExpr(u.at, u);
        else if (u.kind === "enter" && u.chain !== undefined) {
          const prev = u.chain > 0 ? chainUse(u.chain - 1) : undefined;
          start = prev ? Math.max(0, windowOf(prev).end - CHAIN_OVERLAP) : FIRST_ENTER_AT;
        } else if (u.kind === "exit") {
          const d = this.presetDuration(u, el);
          if (duration === null) throw new NeedsSceneEnd();
          start = duration - d - stagger(u) * (this.partsFor(u.name, el) - 1);
        } else start = 0;
        start += u.targetIndex * stagger(u);
        const d = this.presetDuration(u, el);
        const parts = this.partsFor(u.name, el);
        let end = start + d + stagger(u) * (parts - 1);
        if (u.kind === "ambient") {
          if (u.params.duration !== undefined) end = start + u.params.duration;
          else if (duration === null) end = start; // ambients don't extend auto scenes
          else end = duration;
        }
        const w = { start, end };
        useWindow.set(u, w);
        return w;
      });
    };

    const itemWindow = (id: string): Window => {
      const cached = itemWindows.get(id);
      if (cached) return cached;
      return guard(`item:${id}`, () => {
        for (const t of timeline) {
          if (!t || typeof t !== "object") continue;
          if (t.id === id) {
            const w = this.timelineItemWindow(t, (x) => evalExpr(x), uses.filter((u) => u.itemId === id).map(windowOf), duration);
            itemWindows.set(id, w);
            return w;
          }
          if (t.behavior === "interaction") {
            const steps = this.interactionSteps(t, (x) => evalExpr(x));
            const s = steps.find((x) => x.id === id);
            if (s) {
              itemWindows.set(id, s);
              return s;
            }
          }
        }
        return { start: 0, end: 0 };
      });
    };

    // Resolve everything we can; collect the natural length for auto scenes.
    let latest = 0;
    const enterEnd = new Map<string, number>();
    const tryEval = <T>(f: () => T): T | undefined => {
      try {
        return f();
      } catch (e) {
        if (e instanceof NeedsSceneEnd) return undefined;
        if (e instanceof TimeCycle) {
          this.warn(`scenes[${index}]`, "time-cycle", `Time expressions refer to each other in a loop (${e.message}).`);
          return undefined;
        }
        throw e;
      }
    };
    for (const u of uses) {
      const w = tryEval(() => windowOf(u));
      if (!w) continue;
      if (u.kind === "enter") enterEnd.set(u.ref, Math.max(enterEnd.get(u.ref) ?? 0, w.end));
      if (u.kind !== "ambient" && u.kind !== "exit") latest = Math.max(latest, w.end);
    }
    timeline.forEach((t: J, j: number) => {
      if (!t || typeof t !== "object" || "preset" in t) return;
      if (t.behavior && UNSUPPORTED_BEHAVIORS.has(t.behavior) && duration !== null) {
        this.warn(`scenes[${index}].timeline[${j}]`, "unsupported-feature", `The '${t.behavior}' behavior isn't rendered yet; its timing is still used.`);
      }
      const w = tryEval(() => (t.id ? itemWindow(t.id) : this.timelineItemWindow(t, (x) => evalExpr(x), [], duration)));
      if (w) latest = Math.max(latest, w.end);
    });

    // Reading time for text-bearing elements.
    const transitionEnd = index === 0 ? 0 : this.transitionDuration(sc.transition);
    const readStarts = new Map<string, number>();
    for (const [ref, { el }] of registry) {
      if (!el || el.ref !== ref || !el.text || el.text.readingWords === 0) continue;
      const readStart = Math.max(enterEnd.get(ref) ?? 0, transitionEnd);
      readStarts.set(ref, readStart);
      latest = Math.max(latest, readStart + READING.base + READING.perWord * el.text.readingWords);
    }
    const natural = Math.max(AUTO.min, ceil10(latest + AUTO.hold));
    return { natural, uses, windowOf: (u: PresetUse) => tryEval(() => windowOf(u)), evalExpr: (x: J) => tryEval(() => evalExpr(x)) ?? 0, readStarts, timeline };
  }

  transitionDuration(t: J): number {
    const themeT = this.spec.theme?.transition;
    const spec = t === undefined || t === "theme" ? themeT : t;
    if (!spec || spec === "cut" || (typeof spec === "object" && spec.type === "cut")) return 0;
    if (typeof spec === "object" && spec.duration) return spec.duration;
    return typeof themeT === "object" && themeT?.duration ? themeT.duration : DEFAULT_TRANSITION_DURATION;
  }

  interactionSteps(t: J, evalExpr: (x: J) => number): (Window & { id?: string })[] {
    const pace = PACE[(t.pace ?? "normal") as keyof typeof PACE] ?? PACE.normal;
    let cursor = evalExpr(t.at);
    const out: (Window & { id?: string })[] = [];
    for (const st of t.steps ?? []) {
      const start = cursor;
      if ("wait" in st) cursor += Number(st.wait) || 0;
      else {
        cursor += pace.move + pace.press;
        if ("type" in st) cursor += String(st.text ?? "").length / pace.cps;
        if (st.navigate) cursor += NAVIGATE_DURATION;
      }
      out.push({ start, end: cursor, ...(st.id ? { id: st.id } : {}) });
    }
    return out;
  }

  timelineItemWindow(t: J, evalExpr: (x: J) => number, presetWindows: Window[], duration: number | null): Window {
    if ("preset" in t) {
      if (presetWindows.length === 0) return { start: 0, end: 0 };
      return { start: Math.min(...presetWindows.map((w) => w.start)), end: Math.max(...presetWindows.map((w) => w.end)) };
    }
    const start = evalExpr(t.at);
    if ("animate" in t) {
      const n = Array.isArray(t.target) ? t.target.length : 1;
      const d = t.duration ?? this.personality.duration;
      const cycles = t.repeat === -1 ? 1 : (t.repeat ?? 0) + 1;
      return { start, end: start + d * cycles + (t.stagger ?? 0) * (n - 1) };
    }
    if ("state" in t) return { start, end: start + (t.duration ?? STATE_DURATION) };
    switch (t.behavior) {
      case "scroll":
        return { start, end: start + (t.duration ?? SCROLL_DURATION) };
      case "navigate":
        return { start, end: start + NAVIGATE_DURATION };
      case "interaction": {
        const steps = this.interactionSteps(t, evalExpr);
        return { start, end: steps.length ? steps[steps.length - 1]!.end : start };
      }
      case "camera": {
        const keys = (t.keys ?? []).map((k: J) => evalExpr(k.at));
        return { start: keys.length ? Math.min(...keys) : 0, end: keys.length ? Math.max(...keys) : 0 };
      }
      case "focusCycle":
        return { start, end: start + (t.interval ?? 0.9) * (t.targets?.length ?? 0) };
    }
    return { start, end: start };
  }

  // ---------- tracks ----------

  emitTracks(sc: J, index: number, registry: Map<string, { el: PlanElement; src: J; topLevel: boolean }>, timing: ReturnType<Compiler["sceneTiming"]>, sceneStart: number, duration: number) {
    const abs = (x: number) => sceneStart + x;
    const sceneEnd = sceneStart + duration;
    // Decide text splitting from every preset that touches each element.
    for (const u of timing.uses) {
      const el = registry.get(u.ref)?.el;
      if (!el?.text || el.type !== "text") continue;
      if (CHAR_SPLIT.has(u.name)) el.text.split = "chars";
      else if (WORD_SPLIT.has(u.name) && el.text.split === "none") el.text.split = "words";
    }
    const background: PlanElement = {
      ref: `${sc.id}:background`, type: "background", sceneId: sc.id, inDevice: false, layout: {}, style: this.style({}),
      props: {}, states: {}, children: [], appearAt: null, hideAt: null, z: 0,
    };
    for (const u of timing.uses) {
      const el = u.ref === "background" ? background : registry.get(u.ref)?.el;
      if (!el) continue;
      const w = timing.windowOf(u);
      if (!w) continue;
      const t0 = abs(w.start);
      if (u.kind === "enter") el.appearAt = el.appearAt === null ? t0 : Math.min(el.appearAt, t0);
      if (u.kind === "exit") el.hideAt = abs(w.end);
      this.presetTracks(u, el, t0, abs(w.end), sceneEnd);
    }
    // Raw animations and state changes.
    const stateNow = new Map<string, string>();
    const timeline = [...timing.timeline.entries()].filter(([, t]) => t && typeof t === "object");
    const stateItems = timeline.filter(([, t]) => "state" in t).sort((a, b) => timing.evalExpr(a[1].at) - timing.evalExpr(b[1].at));
    for (const [j, t] of timeline) {
      if (!("animate" in t)) continue;
      const targets: string[] = Array.isArray(t.target) ? t.target : [t.target];
      const start = timing.evalExpr(t.at);
      const d = t.duration ?? this.personality.duration;
      targets.forEach((ref, idx) => {
        const el = ref === "background" ? null : registry.get(ref)?.el;
        const r = ref === "background" ? `${sc.id}:background` : el?.ref;
        if (!r) return;
        const t0 = abs(start + idx * (t.stagger ?? 0));
        const infinite = t.repeat === -1;
        const cycles = infinite ? Math.max(1, Math.ceil((sceneEnd - t0) / d)) : (t.repeat ?? 0) + 1;
        for (const [prop, raw] of Object.entries<J>(t.animate)) {
          const vals = Array.isArray(raw) ? raw : [null, raw];
          // An explicit `from` holds until the animation starts (like GSAP's fromTo).
          this.tracks.push(this.tween(r, prop, vals.map((x: J) => this.animValue(prop, x)), t0, t0 + d * cycles, t.ease ?? this.personality.ease, `animate ${prop}${t.id ? ` (${t.id})` : ` (timeline[${j}])`}`, { repeat: cycles - 1, yoyo: !!t.yoyo, fillBackward: vals[0] !== null }));
        }
      });
    }
    for (const [j, t] of stateItems) {
      const el = registry.get(t.target)?.el;
      if (!el) continue;
      const t0 = abs(timing.evalExpr(t.at));
      const t1 = t0 + (t.duration ?? STATE_DURATION);
      const prevName = stateNow.get(el.ref) ?? "default";
      const prev = prevName === "default" ? null : el.states[prevName];
      const next = t.state === "default" ? null : el.states[t.state];
      stateNow.set(el.ref, t.state);
      const label = `state → ${t.state}${t.id ? ` (${t.id})` : ` (timeline[${j}])`}`;
      const props = new Set([...Object.keys(prev?.style ?? {}), ...Object.keys(next?.style ?? {})]);
      for (const p of props) {
        const target = next?.style[p] ?? this.baseValue(el, p);
        if (target === undefined) continue;
        this.tracks.push(this.tween(el.ref, p === "color" ? "color" : p, [null, target as number | string], t0, t1, "cubic.inOut", label));
      }
      for (const field of ["content", "label"] as const) {
        const before = prev?.[field] ?? (field === "content" ? baseText(el, "content") : baseText(el, "label"));
        const after = next?.[field] ?? (field === "content" ? baseText(el, "content") : baseText(el, "label"));
        if (before !== undefined && after !== undefined && before !== after) {
          this.tracks.push({ kind: "content", ref: el.ref, field, from: before, to: after, t0, t1, ease: "cubic.inOut", label });
        }
      }
      if (next?.value !== undefined || prev?.value !== undefined) {
        this.tracks.push(this.tween(el.ref, "value", [null, next?.value ?? 0], t0, t1, "cubic.inOut", label));
      }
      const variant = next?.variant ?? (el.props.variant as string | undefined);
      if (variant && variant !== (prev?.variant ?? el.props.variant)) this.tracks.push({ kind: "step", ref: el.ref, prop: "variant", value: variant, t0, t1: t0, label });
    }
  }

  animValue(prop: string, v: J): number | string | null {
    if (v === null) return null;
    if (typeof v === "string" && (prop === "color" || prop === "fill" || prop === "stroke")) return this.paint(v) ?? v;
    return v;
  }

  baseValue(el: PlanElement, prop: string): number | string | undefined {
    if (prop === "color") return el.font?.color;
    const s = el.style as unknown as Record<string, unknown>;
    if (prop in s) return s[prop] as number | string;
    if (prop === "strokeWidth") return 0;
    if (prop === "radius") return 0;
    return undefined;
  }

  tween(ref: string, prop: string, values: (number | string | null)[], t0: number, t1: number, ease: EaseSpec, label: string, extra: Partial<TweenTrack> = {}): TweenTrack {
    return {
      kind: "tween", ref, prop, values, t0, t1, ease, label,
      additive: prop === "x" || prop === "y" || prop === "rotation",
      fillBackward: false, repeat: 0, yoyo: false, ...extra,
    };
  }

  presetTracks(u: PresetUse, el: PlanElement, t0: number, t1: number, sceneEnd: number) {
    const p = u.params;
    const ease: EaseSpec = p.ease ?? (u.kind === "exit" ? "cubic.in" : u.kind === "ambient" ? "linear" : this.personality.ease);
    const d = this.presetDuration(u, el);
    const s = p.stagger ?? this.personality.stagger;
    const ref = el.ref;
    const label = u.label;
    const enter = u.kind === "enter";
    const push = (prop: string, values: (number | string | null)[], a = t0, b = t0 + d, e: EaseSpec = ease, part?: PartSelector) => {
      this.tracks.push(this.tween(ref, prop, values, a, b, e, label, { fillBackward: enter, ...(part ? { part } : {}) }));
    };
    const parts = (kind: PartSelector["kind"], n: number, f: (part: PartSelector, a: number, b: number) => void) => {
      for (let i = 0; i < n; i++) f({ kind, index: i }, t0 + i * s, t0 + i * s + d);
    };
    const side = (dir: string, dist: number | undefined) => {
      const D = dist ?? (dir === "left" || dir === "right" ? this.W : this.H);
      return dir === "left" ? ["x", -D] as const : dir === "right" ? ["x", D] as const : dir === "up" ? ["y", -D] as const : ["y", D] as const;
    };
    const text = el.text;
    switch (u.name) {
      case "fadeIn":
        push("opacity", [0, 1]);
        break;
      case "fadeUp":
        push("opacity", [0, 1]);
        push("y", [p.distance ?? 40 * this.k, 0]);
        break;
      case "slideIn": {
        const [prop, v] = side(p.from ?? "down", p.distance);
        push(prop, [v, 0]);
        break;
      }
      case "scaleIn":
        push("scale", [p.from ?? 0.8, 1]);
        push("opacity", [0, 1]);
        break;
      case "popIn":
        push("scale", [0, 1], t0, t0 + d, p.ease ?? "back.out");
        push("opacity", [0, 1], t0, t0 + d * 0.4, "linear");
        break;
      case "bounceIn":
        if (el.type === "text" && text) {
          parts("word", text.words, (part, a, b) => {
            push("pdy", [-1.2, 0], a, b, p.ease ?? "bounce.out", part);
            push("opacity", [0, 1], a, a + (b - a) * 0.3, "linear", part);
          });
        } else {
          push("y", [-200 * this.k, 0], t0, t0 + d, p.ease ?? "bounce.out");
          push("opacity", [0, 1], t0, t0 + d * 0.3, "linear");
        }
        break;
      case "blurIn":
        push("blur", [p.amount ?? 18, 0]);
        push("opacity", [0, 1]);
        break;
      case "wordReveal":
        parts("word", text?.words ?? 1, (part, a, b) => {
          push("py", [105, 0], a, b, ease, part);
          push("prot", [4, 0], a, b, ease, part);
        });
        break;
      case "lineReveal":
        parts("line", text?.lines ?? 1, (part, a, b) => push("py", [105, 0], a, b, ease, part));
        break;
      case "charReveal":
        parts("char", text?.chars ?? 1, (part, a, b) => {
          push("opacity", [0, 1], a, b, ease, part);
          push("py", [40, 0], a, b, ease, part);
          if (p.blur !== false) push("blur", [18 * this.k, 0], a, b, ease, part);
        });
        break;
      case "typewriter": {
        const isUrl = el.type === "browser";
        const n = isUrl ? String(el.props.url ?? "").length : text?.chars ?? 0;
        this.tracks.push({ kind: "type", ref, field: isUrl ? "url" : "text", chars: n, caret: p.caret !== false, t0, t1: t0 + d, label });
        break;
      }
      case "countUp": {
        const n = text?.number;
        if (!n) {
          this.warn(ref, "no-number", `countUp on '${ref}': the text has no number.`);
          break;
        }
        this.tracks.push({ kind: "count", ref, from: p.from ?? 0, to: n.value, t0, t1: t0 + d, ease, label });
        break;
      }
      case "trackIn": {
        const base = el.font?.letterSpacing ?? 0;
        push("letterSpacing", [base + (p.from ?? 0.4), base]);
        push("opacity", [0, 1]);
        break;
      }
      case "drawOutline":
        push("draw", [0, 1], t0, t0 + d, p.ease ?? "cubic.inOut");
        break;
      case "wipeIn": {
        const from = p.from ?? "left";
        const prop = from === "left" ? "clipRight" : from === "right" ? "clipLeft" : from === "up" ? "clipBottom" : "clipTop";
        push(prop, [1, 0]);
        break;
      }
      case "grow":
        break;
      case "fadeOut":
        push("opacity", [null, 0]);
        break;
      case "slideOut": {
        const [prop, v] = side(p.to ?? "up", p.distance);
        push(prop, [0, v]);
        break;
      }
      case "scaleOut":
        push("scale", [null, p.to ?? 0.8]);
        push("opacity", [null, 0]);
        break;
      case "blurOut":
        push("blur", [0, p.amount ?? 18]);
        push("opacity", [null, 0]);
        break;
      case "wordsUp":
        parts("word", text?.words ?? 1, (part, a, b) => push("py", [0, -105], a, b, ease, part));
        break;
      case "wipeOut": {
        const to = p.to ?? "right";
        const prop = to === "right" ? "clipLeft" : to === "left" ? "clipRight" : to === "down" ? "clipTop" : "clipBottom";
        push(prop, [0, 1]);
        break;
      }
      case "kenBurns": {
        const end = p.duration !== undefined ? t0 + p.duration : sceneEnd;
        // Zooms the picture inside its frame (images, backgrounds); the frame stays put.
        push("innerScale", [1, p.zoom ?? 1.12], t0, end, p.ease ?? "linear");
        if (p.pan) {
          push("innerX", [0, p.pan[0] ?? 0], t0, end, p.ease ?? "linear");
          push("innerY", [0, p.pan[1] ?? 0], t0, end, p.ease ?? "linear");
        }
        break;
      }
      case "drift": {
        const end = p.duration !== undefined ? t0 + p.duration : sceneEnd;
        if (p.x) push("x", [0, p.x], t0, end, p.ease ?? "linear");
        push("y", [0, p.y ?? -30], t0, end, p.ease ?? "linear");
        if (p.scale && p.scale !== 1) push("scale", [null, p.scale], t0, end, p.ease ?? "linear");
        break;
      }
      case "float":
        this.tracks.push({ kind: "float", ref, amplitude: p.amplitude ?? 10, period: p.period ?? 5, t0, t1: p.duration !== undefined ? t0 + p.duration : sceneEnd, label });
        break;
      case "pulse":
        this.tracks.push({ kind: "pulse", ref, scale: p.scale ?? 1.06, every: p.every ?? 0.75, ring: !!p.ring, t0, t1: p.duration !== undefined ? t0 + p.duration : sceneEnd, label });
        break;
      case "swing":
        if (!el.style.origin || el.style.origin === "center") el.style.origin = "top";
        this.tracks.push({ kind: "swing", ref, angle: p.angle ?? 7, damping: p.damping ?? 2.6, t0, t1: p.duration !== undefined ? t0 + p.duration : sceneEnd, label });
        break;
    }
  }

  emitReading(sc: J, registry: Map<string, { el: PlanElement; src: J; topLevel: boolean }>, timing: ReturnType<Compiler["sceneTiming"]>, sceneStart: number, duration: number, _transition: number) {
    for (const [ref, start] of timing.readStarts) {
      const el = registry.get(ref)?.el;
      if (!el?.text) continue;
      const hide = el.hideAt ?? sceneStart + duration;
      const exitStart = timing.uses.filter((u) => u.ref === ref && u.kind === "exit").map((u) => timing.windowOf(u)?.start).filter((x): x is number => x !== undefined);
      const end = exitStart.length ? sceneStart + Math.min(...exitStart) : hide;
      this.reading.push({ ref, sceneId: sc.id, words: el.text.readingWords, start: sceneStart + start, end });
    }
  }
}

function firstColour(paint: string | null | undefined): string | undefined {
  if (!paint) return undefined;
  const m = /(rgba?\([^)]+\)|#[0-9a-f]{3,8})/i.exec(paint);
  return m?.[1];
}

function luminanceOf(css: string | undefined): number {
  const c = css ? parseCss(firstColour(css) ?? css) : null;
  return c ? luminance(c) : 0;
}

function baseText(el: PlanElement, field: "content" | "label"): string | undefined {
  if (!el.text) return undefined;
  if (field === "content" && el.type === "text") return el.text.plain;
  if (field === "label" && (el.type === "button" || el.type === "badge")) return el.text.plain;
  return undefined;
}
