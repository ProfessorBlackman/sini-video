/**
 * Validator for Sini DSL v0.4.
 *
 * Checks vocabulary, unique IDs, references, time expressions, assets, hotspots,
 * components and colours, and returns structured issues an AI can act on.
 * Ported from docs/paper-tests/check.py, which graded the paper tests.
 */
import { didYouMean } from "./suggest.js";
import {
  ANCHORS, ANIM_PROPS, BADGE_SHAPES, BEHAVIORS, BUNDLED_FONTS, BUTTON_VARIANTS, CHART_KINDS, CHROMES,
  COMMON_KEYS, DSL_VERSION, ELEMENT_TYPES, ENTER_PRESETS, EXIT_PRESETS, FORMATS, FPS, INSTANCE_KEYS,
  LAYOUT_KEYS, PERSONALITIES, PRESETS, PRESET_COMMON, PRESET_PARAMS, PRESET_TARGETS, REQUIRED_KEYS,
  ROLES, SAFE_ZONES, SHAPES, SIDES, SIDE_PRESETS, STACK_ALIGN, STACK_JUSTIFY, STYLE_KEYS, TRANSITIONS,
  TYPE_KEYS, type ElementType,
} from "./vocab.js";

export interface Issue {
  level: "error" | "warning";
  /** JSONPath-like location, e.g. `scenes[1].elements[0].enter`. */
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  /** Counts for a one-line summary. */
  stats: { scenes: number; elements: number; timelineItems: number; assets: number; components: number };
}

// JSON input is untyped until validated.
type J = any;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const PARAM = /\{\{\s*([\w-]+)\s*\}\}/g;
const REF = "[a-z0-9-]+(?:/[a-z0-9-]+)*";
const TIME_RE = new RegExp(
  `^(scene\\.(start|end)|prev\\.(enter|exit)\\.(start|end)|cue:[\\w-]+|` +
    `${REF}\\.(enter|exit)\\.(start|end)|${REF}\\.(start|end))([+-]\\d+(\\.\\d+)?)?$`,
);
const SCREEN_TRANSITIONS = [undefined, "push", "fade", "none"];

const isObj = (v: unknown): v is Record<string, J> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = <T>(list: readonly T[], v: unknown): boolean => (list as readonly unknown[]).includes(v);

/** Element lists inside a device: overlay plus every screen (array or `{ children }`). */
export function devicePages(e: J): J[][] {
  const pages: J[][] = [Array.isArray(e?.overlay) ? e.overlay : []];
  for (const page of Object.values<J>(isObj(e?.screens) ? e.screens : {})) {
    const kids = isObj(page) ? page.children : page;
    pages.push(Array.isArray(kids) ? kids : []);
  }
  return pages;
}

/** Substitute `{{param}}` placeholders in a component root. Returns a deep copy. */
export function expandComponent(def: J, args: Record<string, unknown> | undefined): J {
  const params: Record<string, unknown> = { ...(isObj(def?.params) ? def.params : {}), ...(args ?? {}) };
  const sub = (x: J): J => {
    if (typeof x === "string") {
      const whole = /^\{\{\s*([\w-]+)\s*\}\}$/.exec(x);
      if (whole && whole[1]! in params && typeof params[whole[1]!] !== "string") return params[whole[1]!];
      return x.replace(PARAM, (m, name: string) => (name in params ? String(params[name]) : m));
    }
    if (Array.isArray(x)) return x.map(sub);
    if (isObj(x)) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, sub(v)]));
    return x;
  };
  return sub(structuredClone(def?.root));
}

class Validator {
  issues: Issue[] = [];
  ids = new Map<string, string>();
  palette = new Set<string>();
  assets = new Map<string, J>();
  components = new Map<string, J>();
  fontFamilies = new Set<string>(BUNDLED_FONTS);
  themeFonts: Record<string, J> = {};
  /** scene id → (reference path → element) */
  sceneElems = new Map<string, Map<string, J>>();
  /** scene id → ids of timeline items and interaction steps */
  timelineIds = new Map<string, Set<string>>();
  topLevel = new Map<string, Set<string>>();
  timelines = new Map<string, J[]>();
  /** instance element → expanded component root */
  expanded = new WeakMap<object, J>();
  elementCount = 0;

  constructor(private spec: J) {}

  err(path: string, code: string, message: string, suggestion?: string) {
    this.issues.push({ level: "error", path, code, message, ...(suggestion ? { suggestion } : {}) });
  }
  warn(path: string, code: string, message: string, suggestion?: string) {
    this.issues.push({ level: "warning", path, code, message, ...(suggestion ? { suggestion } : {}) });
  }

  unknownKeys(obj: J, allowed: readonly string[], path: string) {
    if (!isObj(obj)) {
      this.err(path, "not-an-object", "Must be an object.");
      return;
    }
    for (const k of Object.keys(obj)) {
      if (!allowed.includes(k)) this.err(path, "unknown-key", `Unknown key '${k}'.`, didYouMean(k, allowed));
    }
  }

  oneOf(value: unknown, allowed: readonly unknown[], path: string, what: string) {
    if (!allowed.includes(value)) {
      this.err(path, `unknown-${what}`, `Unknown ${what} ${JSON.stringify(value)}.`,
        didYouMean(value, allowed.filter((a): a is string => typeof a === "string")));
    }
  }

  /** `path`: an SVG path string (`d`) or a list of points (optionally smoothed into curves). */
  pathDecl(e: J, p: string) {
    const hasD = "d" in e;
    const hasPoints = "points" in e;
    if (hasD === hasPoints) {
      this.err(p, "path-geometry", 'A path needs exactly one of "d" (SVG path data) or "points" ([[x, y], …]).');
      return;
    }
    if (hasD && !/\{\{/.test(String(e.d))) {
      if (typeof e.d !== "string" || !/^\s*[Mm]/.test(e.d) || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(e.d)) {
        this.err(`${p}.d`, "bad-path", 'Path data must be SVG path syntax starting with M, e.g. "M0 0 C40 -30 80 30 120 0".');
      }
    }
    if (hasPoints) {
      const ok = Array.isArray(e.points) && e.points.length >= 2 && e.points.every((pt: J) => Array.isArray(pt) && pt.length === 2 && pt.every((v: J) => typeof v === "number"));
      if (!ok) this.err(`${p}.points`, "bad-path", "Points must be at least two [x, y] pairs of numbers.");
    }
    if ("smooth" in e && typeof e.smooth !== "boolean") this.err(`${p}.smooth`, "bad-path", "Must be true or false.");
    if ("closed" in e && typeof e.closed !== "boolean") this.err(`${p}.closed`, "bad-path", "Must be true or false.");
    if ("viewBox" in e) {
      const vb = e.viewBox;
      const ok = Array.isArray(vb) && (vb.length === 2 || vb.length === 4) && vb.every((v: J) => typeof v === "number") && (vb.at(-1) ?? 0) > 0 && (vb.at(-2) ?? 0) > 0;
      if (!ok) this.err(`${p}.viewBox`, "bad-path", "Must be [width, height] or [x, y, width, height], with positive width and height.");
    }
  }

  /** `lint.accept`: warnings the author has judged wrong for this video, each with a reason. */
  lintDecl(l: J) {
    if (!isObj(l)) return this.err("lint", "bad-lint", 'Must be an object: { "accept": [ … ] }.');
    this.unknownKeys(l, ["accept"], "lint");
    if (!("accept" in l)) return;
    if (!Array.isArray(l.accept)) return this.err("lint.accept", "bad-lint", "Must be a list.");
    l.accept.forEach((a: J, i: number) => {
      const p = `lint.accept[${i}]`;
      if (!isObj(a)) return this.err(p, "bad-lint", 'Each entry is { "code", "element"?, "reason" }.');
      this.unknownKeys(a, ["code", "element", "reason"], p);
      if (typeof a.code !== "string" || !a.code) this.err(`${p}.code`, "bad-lint", "Name the lint code to accept, e.g. \"tiny-text\".");
      if (typeof a.reason !== "string" || !a.reason.trim()) this.err(`${p}.reason`, "bad-lint", "Say why this warning is wrong for this video.");
      if ("element" in a && typeof a.element !== "string") this.err(`${p}.element`, "bad-lint", "Must be an element id.");
    });
  }

  // ---------- colours / time / references ----------

  colour(v: J, path: string) {
    if (isObj(v)) {
      this.unknownKeys(v, ["linear", "radial", "angle"], path);
      for (const c of [...(v.linear ?? []), ...(v.radial ?? [])]) this.colour(c, path);
      return;
    }
    if (typeof v !== "string") {
      this.err(path, "bad-colour", `Colour must be a string or gradient, got ${JSON.stringify(v)}.`);
      return;
    }
    if (HEX.test(v) || /\{\{/.test(v) || v === "none" || v === "transparent") return;
    const [tok, alpha] = v.split("/");
    if (!this.palette.has(tok!) && !HEX.test(tok!)) {
      this.err(path, "unknown-colour", `Colour '${v}' is not hex or a palette token.`, didYouMean(tok, this.palette));
    }
    if (alpha !== undefined) {
      const a = Number(alpha);
      if (!(a >= 0 && a <= 1)) this.err(path, "bad-opacity", `Bad opacity in '${v}' (expected 0–1).`);
    }
  }

  time(v: J, scene: J, path: string, prefix = "") {
    if (v === undefined || v === null) return;
    if (typeof v === "number") {
      if (v < 0) this.err(path, "negative-time", `Negative time ${v}.`);
      else if (typeof scene.duration === "number" && v > scene.duration) {
        this.warn(path, "time-after-scene", `Time ${v} is after the scene ends (${scene.duration}s).`);
      }
      return;
    }
    if (typeof v !== "string" || !TIME_RE.test(v)) {
      const numeric = typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
      this.err(path, "bad-time", `Bad time expression ${JSON.stringify(v)}.`,
        numeric ? `Write numbers without quotes: ${Number(v)}.` : "Use a number or an expression like \"h1.enter.end+0.2\", \"scene.end-0.4\" or \"cue:name\".");
      return;
    }
    const sid = scene.id;
    if (v.startsWith("cue:")) {
      const name = /^cue:([\w-]+?)([+-]\d+(\.\d+)?)?$/.exec(v)![1]!;
      const cues = Object.keys(scene.cues ?? {});
      if (!cues.includes(name)) this.err(path, "unknown-cue", `Cue '${name}' isn't declared in scene '${sid}'.`, didYouMean(name, cues));
      return;
    }
    const base = /^(.*\.(?:start|end))([+-]\d+(\.\d+)?)?$/.exec(v)![1]!;
    const dot = base.indexOf(".");
    let ref = base.slice(0, dot);
    const rest = base.slice(dot + 1);
    if (ref === "scene" || ref === "prev") return;
    const elems = this.sceneElems.get(sid) ?? new Map();
    if (prefix && elems.has(prefix + ref)) ref = prefix + ref;
    const part = rest.split(".")[0];
    if (elems.has(ref)) {
      if (part === "start" || part === "end") {
        this.err(path, "bad-time-ref", `'${v}': elements use '${ref}.enter.start/end' or '${ref}.exit.start/end'.`);
      } else if (part === "enter" && !this.hasEnter(elems.get(ref), sid, ref)) {
        this.err(path, "no-enter", `'${v}': element '${ref}' has no enter.`);
      } else if (part === "exit" && !elems.get(ref).exit) {
        this.err(path, "no-exit", `'${v}': element '${ref}' has no exit.`);
      }
    } else if (this.timelineIds.get(sid)?.has(ref)) {
      if (part !== "start" && part !== "end") {
        this.err(path, "bad-time-ref", `'${v}': timeline items and steps use '.start' / '.end'.`);
      }
    } else {
      this.err(path, "unknown-ref", `'${v}' refers to '${ref}', which isn't in scene '${sid}'.`,
        didYouMean(ref, [...elems.keys(), ...(this.timelineIds.get(sid) ?? [])]));
    }
  }

  hasEnter(el: J, sid: string, ref: string): boolean {
    if (el.enter && el.enter !== "none") return true;
    if (el.type === "text" && !ref.includes("/") && this.topLevel.get(sid)?.has(ref) && el.enter !== "none") return true;
    for (const t of this.timelines.get(sid) ?? []) {
      if (isObj(t) && has(ENTER_PRESETS, t.preset)) {
        const tg = t.target;
        if (tg === ref || (Array.isArray(tg) && tg.includes(ref))) return true;
      }
    }
    return false;
  }

  /** Element id, component path, `element#hotspot` (or chart bar / progress step), or 'background'. */
  targetRef(x: J, sid: string, path: string, opts: { hotspot?: boolean; background?: boolean } = {}) {
    if (opts.background && x === "background") return;
    if (typeof x !== "string") {
      this.err(path, "bad-target", x === undefined ? "Missing target." : `Target must be a string, got ${JSON.stringify(x)}.`,
        x === undefined ? 'Add "target": "<element id>" next to the preset, animate or behavior.' : undefined);
      return;
    }
    const elems = this.sceneElems.get(sid) ?? new Map<string, J>();
    if (x.includes("#")) {
      if (!opts.hotspot) {
        this.err(path, "hotspot-not-allowed", `Hotspot '${x}' isn't allowed here.`);
        return;
      }
      const [el, hs] = x.split("#", 2) as [string, string];
      const e = elems.get(el);
      if (!e) {
        this.err(path, "unknown-ref", `Hotspot element '${el}' isn't in this scene.`, didYouMean(el, elems.keys()));
        return;
      }
      if (e.type === "chart") {
        const labels = (e.data ?? []).filter(Array.isArray).map((r: J[]) => r[0]);
        if (!labels.includes(hs)) this.err(path, "unknown-bar", `Chart '${el}' has no bar '${hs}'.`, didYouMean(hs, labels));
        return;
      }
      if (e.type === "progress") {
        if (!(e.steps ?? []).includes(hs)) this.err(path, "unknown-step", `Progress '${el}' has no step '${hs}'.`, didYouMean(hs, e.steps ?? []));
        return;
      }
      const aid = e.type === "image" || e.type === "svg" ? e.asset : e.content;
      const a = typeof aid === "string" ? this.assets.get(aid) : undefined;
      const spots = isObj(a) && isObj(a.hotspots) ? Object.keys(a.hotspots) : [];
      if (!spots.includes(hs)) {
        this.err(path, "unknown-hotspot", `Hotspot '${hs}' isn't declared on the asset shown by '${el}'.`, didYouMean(hs, spots));
      }
      return;
    }
    if (!elems.has(x)) {
      const hint = x.includes("/") && elems.has(x.split("/").pop()!)
        ? `Elements inside devices use their plain ID: '${x.split("/").pop()}'. Only component instances create '/' paths.`
        : didYouMean(x, elems.keys());
      this.err(path, "unknown-ref", `'${x}' isn't an element in this scene.`, hint);
    }
  }

  // ---------- main ----------

  run(): ValidationResult {
    const s = this.spec;
    const stats = { scenes: 0, elements: 0, timelineItems: 0, assets: 0, components: 0 };
    if (!isObj(s)) {
      this.err("$", "not-an-object", "A Sini video must be a JSON object.");
      return { ok: false, issues: this.issues, stats };
    }
    this.unknownKeys(s, ["version", "video", "theme", "assets", "components", "scenes", "notes", "lint"], "$");
    if (s.version !== DSL_VERSION) {
      this.err("version", "bad-version", `Expected "${DSL_VERSION}", got ${JSON.stringify(s.version)}.`, `Set "version": "${DSL_VERSION}".`);
    }
    if ("notes" in s && !(Array.isArray(s.notes) && s.notes.every((n: J) => typeof n === "string"))) {
      this.err("notes", "bad-notes", "Must be a list of strings.");
    }
    this.theme(isObj(s.theme) ? s.theme : {});
    this.video(s.video);
    this.assetsDecl(isObj(s.assets) ? s.assets : {});
    this.componentsDecl(isObj(s.components) ? s.components : {});

    const scenes = s.scenes;
    if (!Array.isArray(scenes) || scenes.length === 0) {
      this.err("scenes", "no-scenes", "A video needs at least one scene.");
      return { ok: false, issues: this.issues, stats };
    }
    if ("lint" in s) this.lintDecl(s.lint);
    scenes.forEach((sc: J, i: number) => {
      if (!isObj(sc)) return;
      const sid = sc.id;
      this.reg(sid, `scenes[${i}]`);
      const elems = new Map<string, J>();
      this.collect(sc.elements ?? [], elems, `scenes[${i}].elements`, "");
      this.sceneElems.set(sid, elems);
      this.topLevel.set(sid, new Set((sc.elements ?? []).filter(isObj).map((e: J) => e.id)));
      this.timelines.set(sid, sc.timeline ?? []);
      const tids = new Set<string>();
      (sc.timeline ?? []).forEach((t: J, j: number) => {
        if (!isObj(t)) return;
        if ("id" in t) {
          this.reg(t.id, `scenes[${i}].timeline[${j}]`);
          tids.add(t.id);
        }
        (Array.isArray(t.steps) ? t.steps : []).forEach((st: J, k: number) => {
          if (isObj(st) && "id" in st) {
            this.reg(st.id, `scenes[${i}].timeline[${j}].steps[${k}]`);
            tids.add(st.id);
          }
        });
      });
      this.timelineIds.set(sid, tids);
      stats.timelineItems += (sc.timeline ?? []).length;
    });
    scenes.forEach((sc: J, i: number) => {
      if (!isObj(sc)) {
        this.err(`scenes[${i}]`, "not-an-object", "Scene must be an object.");
        return;
      }
      this.scene(sc, i, scenes);
    });
    stats.scenes = scenes.length;
    stats.elements = this.elementCount;
    stats.assets = this.assets.size;
    stats.components = this.components.size;
    return { ok: !this.issues.some((x) => x.level === "error"), issues: this.issues, stats };
  }

  reg(id: J, path: string, global = true) {
    if (!id) {
      this.err(path, "missing-id", "Missing 'id'.");
      return;
    }
    if (typeof id !== "string" || !KEBAB.test(id)) {
      this.err(path, "bad-id", `ID ${JSON.stringify(id)} isn't kebab-case.`,
        typeof id === "string" ? `Try '${id.replace(/[^a-zA-Z0-9]+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace(/^-|-$/g, "")}'.` : undefined);
    }
    if (global) {
      if (this.ids.has(id)) this.err(path, "duplicate-id", `Duplicate ID '${id}' (also at ${this.ids.get(id)}).`);
      this.ids.set(id, path);
    }
  }

  collect(elems: J, out: Map<string, J>, path: string, prefix: string, count = true) {
    if (!Array.isArray(elems)) {
      this.err(path, "not-a-list", "Must be a list of elements.");
      return;
    }
    elems.forEach((e: J, j: number) => {
      const p = `${path}[${j}]`;
      if (!isObj(e)) {
        this.err(p, "not-an-object", "Element must be an object.");
        return;
      }
      if (count) this.elementCount++;
      this.reg(e.id, p, prefix === "");
      const ref = typeof e.id === "string" ? prefix + e.id : e.id;
      out.set(ref, e);
      if ("use" in e) {
        const def = this.components.get(e.use);
        if (def) {
          const root = expandComponent(def, isObj(e.with) ? e.with : undefined);
          this.expanded.set(e, root);
          out.set(`${ref}/${root?.id}`, root);
          this.collect(root?.children ?? [], out, `${p}(component)`, `${ref}/`, count);
          for (const kids of devicePages(root)) this.collect(kids, out, `${p}(component)`, `${ref}/`, count);
        }
        return;
      }
      if (e.children !== undefined) this.collect(e.children, out, `${p}.children`, prefix, count);
      for (const kids of devicePages(e)) this.collect(kids, out, `${p}.pages`, prefix, count);
    });
  }

  theme(t: J) {
    this.unknownKeys(t, ["palette", "fonts", "roles", "motion", "transition", "texture"], "theme");
    const pal = isObj(t.palette) ? t.palette : {};
    this.palette = new Set(Object.keys(pal));
    for (const [k, c] of Object.entries(pal)) {
      if (!(typeof c === "string" && HEX.test(c))) this.err(`theme.palette.${k}`, "bad-palette", `Palette values must be hex, got ${JSON.stringify(c)}.`);
    }
    this.themeFonts = isObj(t.fonts) ? t.fonts : {};
    this.unknownKeys(this.themeFonts, ["display", "body", "mono"], "theme.fonts");
    for (const r of Object.keys(isObj(t.roles) ? t.roles : {})) {
      if (!has(ROLES, r)) this.err(`theme.roles.${r}`, "unknown-role", `Unknown role '${r}'.`, didYouMean(r, ROLES));
      else this.unknownKeys(t.roles[r], ["size", "weight", "lineHeight", "letterSpacing", "uppercase"], `theme.roles.${r}`);
    }
    const m = t.motion;
    if (typeof m === "string") this.oneOf(m, PERSONALITIES, "theme.motion", "personality");
    else if (isObj(m)) {
      this.unknownKeys(m, ["base", "ease", "duration", "stagger"], "theme.motion");
      this.oneOf(m.base, PERSONALITIES, "theme.motion.base", "personality");
    } else if (m !== undefined) this.err("theme.motion", "bad-motion", "Must be a personality name or an object.");
    if ("transition" in t) this.transition(t.transition, "theme.transition", null, null);
    if ("texture" in t) this.unknownKeys(t.texture, ["grain", "vignette"], "theme.texture");
  }

  video(v: J) {
    if (!isObj(v)) {
      this.err("video", "missing-video", "Missing 'video'.", 'Add "video": { "format": "9:16" }.');
      return;
    }
    this.unknownKeys(v, ["format", "width", "height", "fps", "background", "seed", "targetDuration", "safeZone", "end"], "video");
    if ("format" in v) this.oneOf(v.format, Object.keys(FORMATS), "video.format", "format");
    if ("fps" in v) this.oneOf(v.fps, FPS, "video.fps", "fps");
    for (const k of ["width", "height", "targetDuration"]) {
      if (k in v && !(typeof v[k] === "number" && v[k] > 0)) this.err(`video.${k}`, "bad-number", "Must be a positive number.");
    }
    if ("background" in v) this.colour(v.background, "video.background");
    if ("safeZone" in v) this.oneOf(v.safeZone, SAFE_ZONES, "video.safeZone", "safe zone");
    const end = v.end;
    if (isObj(end)) {
      this.unknownKeys(end, ["type", "duration", "color"], "video.end");
      if (end.type !== "fade") this.err("video.end.type", "bad-end", "Only 'fade' is allowed.");
      if ("color" in end) this.colour(end.color, "video.end.color");
    } else if (end !== undefined && end !== "hold" && end !== "cut") {
      this.err("video.end", "bad-end", `Unknown end ${JSON.stringify(end)}.`, didYouMean(end, ["hold", "cut"]));
    }
  }

  assetsDecl(a: Record<string, J>) {
    for (const [k, v] of Object.entries(a)) {
      this.assets.set(k, v);
      const p = `assets.${k}`;
      if (typeof v === "string") {
        if (/^https?:/.test(v)) this.err(p, "remote-asset", "Remote URLs aren't allowed; download the file into the project.");
        continue;
      }
      if (!isObj(v)) {
        this.err(p, "bad-asset", "Asset must be a path or an object.");
        continue;
      }
      this.unknownKeys(v, ["type", "src", "family", "hint", "color", "fallback", "hotspots"], p);
      this.oneOf(v.type, ["image", "svg", "font", "placeholder"], `${p}.type`, "asset type");
      if (typeof v.src === "string" && /^https?:/.test(v.src)) this.err(`${p}.src`, "remote-asset", "Remote URLs aren't allowed.");
      if ((v.type === "image" || v.type === "svg" || v.type === "font") && typeof v.src !== "string") {
        this.err(p, "missing-src", `A ${v.type} asset needs 'src'.`);
      }
      if (v.type === "font" && v.family) this.fontFamilies.add(v.family);
      if ("color" in v) this.colour(v.color, `${p}.color`);
      for (const [hn, hv] of Object.entries(isObj(v.hotspots) ? v.hotspots : {})) {
        const ok = (Array.isArray(hv) && hv.length === 4 && hv.every((n: J) => typeof n === "number")) ||
          (isObj(hv) && Object.keys(hv).length === 1 && typeof hv.text === "string");
        if (!ok) this.err(`${p}.hotspots.${hn}`, "bad-hotspot", 'Hotspot must be [x, y, width, height] or { "text": "…" }.');
      }
    }
    for (const [slot, fam] of Object.entries(this.themeFonts)) {
      if (!this.fontFamilies.has(fam)) {
        this.err(`theme.fonts.${slot}`, "unknown-font", `Font '${fam}' isn't bundled and isn't declared as a font asset.`, didYouMean(fam, this.fontFamilies));
      }
    }
  }

  componentsDecl(comps: Record<string, J>) {
    for (const [name, c] of Object.entries(comps)) {
      const p = `components.${name}`;
      if (!KEBAB.test(name)) this.err(p, "bad-id", "Component names must be kebab-case.");
      this.unknownKeys(c, ["params", "root"], p);
      if (!isObj(c?.root)) {
        this.err(`${p}.root`, "missing-root", "A component needs a 'root' element.");
        continue;
      }
      const used = new Set([...JSON.stringify(c.root).matchAll(PARAM)].map((m) => m[1]!));
      const declared = Object.keys(isObj(c.params) ? c.params : {});
      for (const u of used) {
        if (!declared.includes(u)) this.err(p, "undeclared-param", `'{{${u}}}' is used but not declared in params.`);
      }
      this.collect([c.root], new Map(), `${p}.root`, "__local__/", false);
      this.components.set(name, c);
    }
  }

  transition(tr: J, path: string, prevScene: J | null, scene: J | null) {
    if (tr === "theme" || tr === "cut") return;
    if (typeof tr === "string") {
      this.oneOf(tr, Object.keys(TRANSITIONS), path, "transition");
      return;
    }
    if (!isObj(tr)) {
      this.err(path, "bad-transition", "Transition must be a name or an object.");
      return;
    }
    const ty = tr.type;
    if (!(ty in TRANSITIONS)) {
      this.oneOf(ty, Object.keys(TRANSITIONS), `${path}.type`, "transition");
      return;
    }
    this.unknownKeys(tr, ["type", "duration", "ease", ...TRANSITIONS[ty]!], path);
    if ("from" in tr && (ty === "wipe" || ty === "slide")) this.oneOf(tr.from, SIDES, `${path}.from`, "side");
    if (tr.bar !== undefined && tr.bar !== null) this.colour(tr.bar, `${path}.bar`);
    if (!scene) return;
    const prevElems = (prevScene && this.sceneElems.get(prevScene.id)) || new Map();
    const curElems = this.sceneElems.get(scene.id) ?? new Map();
    if (ty === "matchCut") {
      if (!prevElems.has(tr.from)) this.err(`${path}.from`, "unknown-ref", `matchCut.from '${tr.from}' isn't an element of the previous scene.`, didYouMean(tr.from, prevElems.keys()));
      if (tr.to !== "background" && !curElems.has(tr.to)) this.err(`${path}.to`, "unknown-ref", `matchCut.to '${tr.to}' isn't an element of this scene or 'background'.`);
    }
    if (ty === "circle" && "origin" in tr) {
      const o = tr.origin;
      if (!has(ANCHORS, o) && !prevElems.has(o) && !curElems.has(o)) {
        this.err(`${path}.origin`, "unknown-ref", `'${o}' isn't an anchor or an element of either scene.`, didYouMean(o, [...ANCHORS]));
      }
    }
  }

  scene(sc: J, i: number, scenes: J[]) {
    const p = `scenes[${i}]`;
    this.unknownKeys(sc, ["id", "duration", "background", "transition", "cues", "elements", "timeline"], p);
    const d = sc.duration;
    if (d !== "auto" && !(typeof d === "number" && d > 0)) {
      this.err(`${p}.duration`, "bad-duration", "Must be a positive number of seconds or \"auto\".");
    }
    const bg = sc.background;
    if (isObj(bg) && "asset" in bg) {
      this.unknownKeys(bg, ["asset", "fit", "overlay", "blur"], `${p}.background`);
      if (!this.assets.has(bg.asset)) this.err(`${p}.background.asset`, "unknown-asset", `Asset '${bg.asset}' isn't declared.`, didYouMean(bg.asset, this.assets.keys()));
      if ("overlay" in bg) this.colour(bg.overlay, `${p}.background.overlay`);
    } else if (bg !== undefined) this.colour(bg, `${p}.background`);
    if ("transition" in sc) this.transition(sc.transition, `${p}.transition`, i ? scenes[i - 1] : null, sc);
    for (const [c, t] of Object.entries(isObj(sc.cues) ? sc.cues : {})) this.time(t, sc, `${p}.cues.${c}`);
    if (!Array.isArray(sc.elements)) this.err(`${p}.elements`, "missing-elements", "A scene needs an 'elements' list (it may be empty).");
    (sc.elements ?? []).forEach((e: J, j: number) => this.element(e, sc, `${p}.elements[${j}]`, ""));
    (sc.timeline ?? []).forEach((t: J, j: number) => this.timelineItem(t, sc, `${p}.timeline[${j}]`));
  }

  element(e: J, sc: J, p: string, prefix: string) {
    if (!isObj(e)) return;
    if ("use" in e) {
      this.unknownKeys(e, INSTANCE_KEYS, p);
      const comp = this.components.get(e.use);
      if (!comp) {
        this.err(`${p}.use`, "unknown-component", `Component '${e.use}' isn't defined.`, didYouMean(e.use, this.components.keys()));
        return;
      }
      const params = Object.keys(isObj(comp.params) ? comp.params : {});
      for (const k of Object.keys(isObj(e.with) ? e.with : {})) {
        if (!params.includes(k)) this.err(`${p}.with.${k}`, "unknown-param", `'${k}' isn't a param of '${e.use}'.`, didYouMean(k, params));
      }
      this.common(e, sc, p, null, prefix);
      const root = this.expanded.get(e);
      if (root) this.element(root, sc, `${p}(component root)`, `${prefix}${e.id}/`);
      return;
    }
    const ty = e.type as ElementType;
    if (!has(ELEMENT_TYPES, ty)) {
      this.err(`${p}.type`, "unknown-type", `Unknown element type ${JSON.stringify(ty)}.`, didYouMean(ty, ELEMENT_TYPES));
      return;
    }
    this.unknownKeys(e, [...COMMON_KEYS, ...TYPE_KEYS[ty]], p);
    for (const r of REQUIRED_KEYS[ty] ?? []) {
      if (!(r in e)) this.err(p, "missing-key", `A ${ty} needs '${r}'.`);
    }
    if (ty === "text") {
      if ("role" in e) this.oneOf(e.role, ROLES, `${p}.role`, "role");
      if ("content" in e && typeof e.content !== "string") this.err(`${p}.content`, "bad-content", "Text content must be a string.");
      if ("fit" in e) this.oneOf(e.fit, ["none", "shrink"], `${p}.fit`, "fit");
    }
    if (ty === "shape") this.oneOf(e.shape, SHAPES, `${p}.shape`, "shape");
    if (ty === "path") this.pathDecl(e, p);
    if (ty === "badge" && "shape" in e) this.oneOf(e.shape, BADGE_SHAPES, `${p}.shape`, "badge shape");
    if (ty === "button" && "variant" in e && !/\{\{/.test(e.variant)) this.oneOf(e.variant, BUTTON_VARIANTS, `${p}.variant`, "variant");
    if ((ty === "image" || ty === "svg") && !this.assets.has(e.asset) && !/\{\{/.test(String(e.asset))) {
      this.err(`${p}.asset`, "unknown-asset", `Asset '${e.asset}' isn't declared.`, didYouMean(e.asset, this.assets.keys()));
    }
    if (ty === "image" && "fit" in e) this.oneOf(e.fit, ["cover", "contain"], `${p}.fit`, "fit");
    if (ty === "chart") {
      this.oneOf(e.kind, CHART_KINDS, `${p}.kind`, "chart kind");
      const data = e.data;
      const ok = Array.isArray(data) && data.every((r: J) => Array.isArray(r) && r.length === 2 && typeof r[1] === "number");
      if (!ok) this.err(`${p}.data`, "bad-chart-data", "Must be [[label, number], …].");
      else if ("highlight" in e && !data.map((r: J[]) => r[0]).includes(e.highlight)) {
        this.err(`${p}.highlight`, "unknown-bar", `'${e.highlight}' isn't a data label.`);
      }
    }
    if (ty === "browser" || ty === "phone") {
      if (typeof e.content === "string" && !this.assets.has(e.content)) {
        this.err(`${p}.content`, "unknown-asset", `Asset '${e.content}' isn't declared.`, didYouMean(e.content, this.assets.keys()));
      }
      const modes = ["content", "children", "screens"].filter((k) => k in e);
      if (modes.length > 1) this.err(p, "device-modes", `Use only one of content/children/screens (has ${modes.join(", ")}).`);
      if ("screens" in e && !(e.screen in (isObj(e.screens) ? e.screens : {}))) {
        this.err(`${p}.screen`, "unknown-screen", "Must name one of its screens.", didYouMean(e.screen, Object.keys(e.screens ?? {})));
      }
      if ("background" in e) this.colour(e.background, `${p}.background`);
      if (e.chrome !== undefined) this.oneOf(e.chrome, CHROMES, `${p}.chrome`, "chrome");
      for (const [scr, page] of Object.entries(isObj(e.screens) ? e.screens : {})) {
        if (isObj(page)) {
          this.unknownKeys(page, ["background", "padding", "gap", "children"], `${p}.screens.${scr}`);
          if ("background" in page) this.colour(page.background, `${p}.screens.${scr}.background`);
        }
      }
    }
    if (ty === "stack") {
      if ("direction" in e) this.oneOf(e.direction, ["vertical", "horizontal"], `${p}.direction`, "direction");
      if ("align" in e) this.oneOf(e.align, STACK_ALIGN, `${p}.align`, "align");
      if ("justify" in e) this.oneOf(e.justify, STACK_JUSTIFY, `${p}.justify`, "justify");
    }
    if (ty === "template" && /<script|on\w+=|https?:\/\/|transition\s*:|animation\s*:|@keyframes/.test(`${e.html ?? ""}${e.css ?? ""}`)) {
      this.err(p, "unsafe-template", "Templates can't contain scripts, event handlers, URLs or CSS transitions/animations.");
    }
    this.common(e, sc, p, ty, prefix);
    (Array.isArray(e.children) ? e.children : []).forEach((c: J, j: number) => this.element(c, sc, `${p}.children[${j}]`, prefix));
    (Array.isArray(e.overlay) ? e.overlay : []).forEach((c: J, j: number) => this.element(c, sc, `${p}.overlay[${j}]`, prefix));
    for (const [scr, page] of Object.entries(isObj(e.screens) ? e.screens : {})) {
      const kids = isObj(page) ? page.children : page;
      (Array.isArray(kids) ? kids : []).forEach((c: J, j: number) => this.element(c, sc, `${p}.screens.${scr}[${j}]`, prefix));
    }
  }

  common(e: J, sc: J, p: string, ty: ElementType | null, prefix: string) {
    const sid = sc?.id;
    const st = e.style ?? {};
    this.unknownKeys(st, STYLE_KEYS, `${p}.style`);
    if ("dash" in st) {
      const d = st.dash;
      const ok = d === false || (Array.isArray(d) && d.length >= 1 && d.length <= 2 && d.every((v: J) => typeof v === "number" && v >= 0) && d.some((v: J) => v > 0));
      if (!ok) this.err(`${p}.style.dash`, "bad-dash", "Must be [dash, gap] in px (e.g. [12, 8]), [dash] for equal gaps, or false.");
    }
    for (const ck of ["color", "fill", "stroke"]) if (ck in st) this.colour(st[ck], `${p}.style.${ck}`);
    if ("origin" in st) this.oneOf(st.origin, ANCHORS, `${p}.style.origin`, "origin");
    if ("shadow" in st) this.oneOf(st.shadow, ["none", "soft", "deep"], `${p}.style.shadow`, "shadow");
    if ("align" in st) this.oneOf(st.align, ["left", "center", "right"], `${p}.style.align`, "align");
    const lay = e.layout ?? {};
    this.unknownKeys(lay, LAYOUT_KEYS, `${p}.layout`);
    if ("anchor" in lay) this.oneOf(lay.anchor, ANCHORS, `${p}.layout.anchor`, "anchor");
    const methods = ([
      ["anchor", "anchor" in lay || "inset" in lay],
      ["relative", ["below", "above", "leftOf", "rightOf"].some((k) => k in lay)],
      ["pin", "pin" in lay],
      ["absolute", "x" in lay || "y" in lay],
    ] as const).filter(([, on]) => on).map(([m]) => m);
    if (methods.length > 1) this.err(`${p}.layout`, "mixed-layout", `Mixes placement methods (${methods.join(", ")}). Choose one.`);
    if (sc) {
      for (const k of ["below", "above", "leftOf", "rightOf"]) {
        if (k in lay) this.targetRef(prefix ? prefix + lay[k] : lay[k], sid, `${p}.layout.${k}`);
      }
      if ("pin" in lay) {
        const pin = lay.pin;
        this.unknownKeys(pin, ["to", "point", "inside"], `${p}.layout.pin`);
        if (isObj(pin)) {
          const to = pin.to;
          this.targetRef(prefix && typeof to === "string" && !to.includes("#") ? prefix + to : to, sid, `${p}.layout.pin.to`, { hotspot: true });
          this.oneOf(pin.point, ANCHORS, `${p}.layout.pin.point`, "point");
        }
      }
    }
    if ("enter" in e && e.enter !== "none") this.preset(e.enter, sc, `${p}.enter`, ty, ENTER_PRESETS, "enter", prefix);
    if ("exit" in e) this.preset(e.exit, sc, `${p}.exit`, ty, EXIT_PRESETS, "exit", prefix);
    for (const [sn, sv] of Object.entries(isObj(e.states) ? e.states : {})) {
      if (!isObj(sv)) {
        this.err(`${p}.states.${sn}`, "bad-state", "A state must be an object.");
        continue;
      }
      this.unknownKeys(sv, ["style", "content", "label", "variant", "value", "icon", "title", "body"], `${p}.states.${sn}`);
      this.unknownKeys(sv.style ?? {}, STYLE_KEYS, `${p}.states.${sn}.style`);
    }
  }

  preset(v: J, sc: J, p: string, etype: ElementType | null, allowed: readonly string[], kind: string, prefix = "") {
    let name: J;
    let obj: J = {};
    if (typeof v === "string") name = v;
    else if (isObj(v)) {
      name = v.preset;
      obj = v;
    } else {
      this.err(p, "bad-preset", "Must be a preset name or an object.");
      return;
    }
    if (!allowed.includes(name)) {
      const other = has(PRESETS, name) ? ` ('${name}' exists, but isn't an ${kind} preset.)` : "";
      this.err(p, "unknown-preset", `Unknown ${kind} preset ${JSON.stringify(name)}.${other}`, didYouMean(name, allowed));
      return;
    }
    this.unknownKeys(obj, [...PRESET_COMMON, ...(PRESET_PARAMS[name as keyof typeof PRESET_PARAMS] ?? [])], p);
    this.presetTypes(name, [etype], p);
    this.directions(name, obj, p);
    if (sc) this.time(obj.at, sc, `${p}.at`, prefix);
  }

  presetTypes(name: string, types: (ElementType | null | undefined)[], p: string) {
    const ok = PRESET_TARGETS[name as keyof typeof PRESET_TARGETS];
    if (!ok) return;
    for (const t of types) {
      if (t && !ok.includes(t)) this.err(p, "preset-target", `'${name}' works on ${ok.join("/")} elements, not ${t}.`);
    }
  }

  directions(name: string, obj: J, p: string) {
    for (const k of ["from", "to"]) {
      if (k in obj && has(SIDE_PRESETS, name)) this.oneOf(obj[k], SIDES, `${p}.${k}`, "side");
    }
  }

  etype(e: J): ElementType | undefined {
    if (!e) return undefined;
    if ("use" in e) return this.expanded.get(e)?.type;
    return e.type;
  }

  statesOf(e: J): Set<string> {
    return new Set([...Object.keys(e?.states ?? {}), ...Object.keys(this.expanded.get(e)?.states ?? {})]);
  }

  timelineItem(t: J, sc: J, p: string) {
    if (!isObj(t)) {
      this.err(p, "not-an-object", "Timeline item must be an object.");
      return;
    }
    const sid = sc.id;
    const elems = this.sceneElems.get(sid) ?? new Map<string, J>();
    const checkTarget = (tg: J, hotspot = false) => {
      const tgs = Array.isArray(tg) ? tg : [tg];
      for (const x of tgs) this.targetRef(x, sid, `${p}.target`, { hotspot, background: true });
      return tgs.map((x: J) => this.etype(elems.get(x)));
    };
    const kinds = ["preset", "animate", "behavior", "state"].filter((k) => k in t);
    if (kinds.length !== 1) {
      this.err(p, "timeline-kind", `A timeline item needs exactly one of preset/animate/behavior/state (has ${kinds.join(", ") || "none"}).`,
        "navigate" in t ? 'Screen changes are a behavior: { "behavior": "navigate", "target": …, "to": … }.' : undefined);
      return;
    }
    const k = kinds[0];
    this.time(t.at, sc, `${p}.at`);
    if (k === "preset") {
      const types = checkTarget(t.target, true);
      if (!has(PRESETS, t.preset)) {
        this.err(`${p}.preset`, "unknown-preset", `Unknown preset ${JSON.stringify(t.preset)}.`, didYouMean(t.preset, PRESETS));
        return;
      }
      this.unknownKeys(t, [...PRESET_COMMON, "target", "id", ...(PRESET_PARAMS[t.preset as keyof typeof PRESET_PARAMS] ?? [])], p);
      this.presetTypes(t.preset, types, p);
      this.directions(t.preset, t, p);
    } else if (k === "animate") {
      checkTarget(t.target);
      this.unknownKeys(t, ["id", "target", "at", "duration", "ease", "animate", "stagger", "repeat", "yoyo"], p);
      for (const prop of Object.keys(isObj(t.animate) ? t.animate : {})) {
        if (["id", "target"].includes(prop)) {
          this.err(`${p}.animate.${prop}`, "misplaced-key", `'${prop}' doesn't go inside animate.`, 'The element goes in "target", next to "animate": { "target": "box", "animate": { "opacity": 0.5 }, "duration": 1 }.');
        } else if (["at", "duration", "ease", "stagger", "repeat", "yoyo"].includes(prop)) {
          this.err(`${p}.animate.${prop}`, "misplaced-key", `'${prop}' doesn't go inside animate.`, `Put "${prop}" next to "animate", on the timeline item.`);
        } else if (!has(ANIM_PROPS, prop) && !prop.startsWith("--")) {
          this.err(`${p}.animate.${prop}`, "not-animatable", `'${prop}' isn't an animatable property.`, didYouMean(prop, ANIM_PROPS));
        }
      }
    } else if (k === "state") {
      checkTarget(t.target);
      this.unknownKeys(t, ["id", "target", "state", "at", "duration"], p);
      const tg = elems.get(t.target);
      if (tg && t.state !== "default" && !this.statesOf(tg).has(t.state)) {
        this.err(`${p}.state`, "unknown-state", `State '${t.state}' isn't declared on '${t.target}'.`, didYouMean(t.state, this.statesOf(tg)));
      }
    } else {
      const b = t.behavior;
      if (!(b in BEHAVIORS)) {
        this.err(`${p}.behavior`, "unknown-behavior", `Unknown behavior ${JSON.stringify(b)}.`, didYouMean(b, Object.keys(BEHAVIORS)));
        return;
      }
      this.unknownKeys(t, [...BEHAVIORS[b]!, "behavior", "id"], p);
      if (b === "scroll") {
        checkTarget(t.target);
        const to = t.to;
        if (typeof to === "string" && to !== "top" && to !== "bottom") {
          const inner = new Map<string, J>();
          this.collectSilent(elems.get(t.target) ?? {}, inner);
          if (!inner.has(to)) this.err(`${p}.to`, "unknown-ref", `'${to}' isn't inside '${t.target}'.`, didYouMean(to, inner.keys()));
        }
      }
      if (b === "camera") {
        checkTarget(t.target);
        if (this.etype(elems.get(t.target)) !== "group") this.err(`${p}.target`, "camera-target", "A camera target must be a group.");
        (Array.isArray(t.keys) ? t.keys : []).forEach((key: J, j: number) => {
          this.unknownKeys(key, ["at", "focus", "zoom"], `${p}.keys[${j}]`);
          this.time(key?.at, sc, `${p}.keys[${j}].at`);
          const f = key?.focus;
          if (f && !has(ANCHORS, f)) this.targetRef(f, sid, `${p}.keys[${j}].focus`, { hotspot: true });
        });
      }
      if (b === "navigate") {
        this.navigate(t.target, t.to, elems, p);
        this.oneOf(t.transition, SCREEN_TRANSITIONS, `${p}.transition`, "screen transition");
      }
      if (b === "follow") {
        checkTarget(t.target);
        if (this.etype(elems.get(t.path)) !== "path") {
          this.err(`${p}.path`, "follow-path", `'${t.path}' isn't a path element in this scene.`, didYouMean(String(t.path), [...elems.entries()].filter(([, v]) => this.etype(v) === "path").map(([k]) => k)));
        }
        if ("rotate" in t && typeof t.rotate !== "boolean") this.err(`${p}.rotate`, "bad-follow", "Must be true or false.");
        if ("duration" in t && !(typeof t.duration === "number" && t.duration > 0)) this.err(`${p}.duration`, "bad-follow", "Must be a positive number of seconds.");
      }
      if (b === "focusCycle") {
        for (const x of Array.isArray(t.targets) ? t.targets : []) this.targetRef(x, sid, `${p}.targets`, { hotspot: true });
      }
      if (b === "interaction") this.interaction(t, sc, elems, p);
    }
  }

  interaction(t: J, sc: J, elems: Map<string, J>, p: string) {
    const sid = sc.id;
    if (t.cursor !== undefined) this.oneOf(t.cursor, ["arrow", "pointer", "touch"], `${p}.cursor`, "cursor");
    if (t.pace !== undefined) this.oneOf(t.pace, ["slow", "normal", "fast"], `${p}.pace`, "pace");
    if (t.from !== undefined) this.oneOf(t.from, ANCHORS, `${p}.from`, "anchor");
    (Array.isArray(t.steps) ? t.steps : []).forEach((st: J, j: number) => {
      const sp = `${p}.steps[${j}]`;
      if (!isObj(st)) return;
      const ks = ["click", "wait", "type"].filter((x) => x in st);
      if (ks.length !== 1) {
        this.err(sp, "step-kind", `A step needs exactly one of click/wait/type (has ${ks.join(", ") || "none"}).`);
        return;
      }
      this.unknownKeys(st, ["id", "click", "set", "navigate", "transition", "wait", "type", "text"], sp);
      this.oneOf(st.transition, SCREEN_TRANSITIONS, `${sp}.transition`, "screen transition");
      if ("click" in st) this.targetRef(st.click, sid, `${sp}.click`, { hotspot: true });
      if ("type" in st) {
        this.targetRef(st.type, sid, `${sp}.type`);
        if (!("text" in st)) this.err(sp, "missing-key", "A type step needs 'text'.");
      }
      if ("wait" in st && ("set" in st || "navigate" in st)) this.err(sp, "wait-step", "set/navigate are only allowed on click or type steps.");
      for (const [el, state] of Object.entries(isObj(st.set) ? st.set : {})) {
        const target = elems.get(el);
        if (!target) this.targetRef(el, sid, `${sp}.set`);
        else if (state !== "default" && !this.statesOf(target).has(state as string)) {
          this.err(`${sp}.set`, "unknown-state", `State '${state}' isn't declared on '${el}'.`, didYouMean(state, this.statesOf(target)));
        }
      }
      for (const [dev, scr] of Object.entries(isObj(st.navigate) ? st.navigate : {})) this.navigate(dev, scr, elems, `${sp}.navigate`);
    });
  }

  navigate(dev: J, scr: J, elems: Map<string, J>, p: string) {
    const d = elems.get(dev);
    if (!d) this.err(p, "unknown-ref", `Device '${dev}' isn't in this scene.`, didYouMean(dev, elems.keys()));
    else if (!(scr in (d.screens ?? {}))) this.err(p, "unknown-screen", `'${dev}' has no screen '${scr}'.`, didYouMean(scr, Object.keys(d.screens ?? {})));
  }

  collectSilent(e: J, out: Map<string, J>) {
    const kids: J[] = [...(Array.isArray(e.children) ? e.children : [])];
    for (const page of devicePages(e)) kids.push(...page);
    for (const c of kids) {
      if (isObj(c)) {
        out.set(c.id, c);
        this.collectSilent(c, out);
      }
    }
  }
}

/** Validate a parsed Sini document. */
export function validate(spec: unknown): ValidationResult {
  return new Validator(spec).run();
}
