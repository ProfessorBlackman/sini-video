#!/usr/bin/env python3
"""Paper-test checker for Sini DSL v0.2.

Checks a spec against the rules in docs/DSL_REFERENCE.md: allowed vocabulary,
unique IDs, references, time expressions, assets and colours. It is not the real
validator; it exists to grade LLM-authored specs objectively.

Usage: python3 check.py file.json [file.json ...]
"""
import json, re, sys

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
HEX = re.compile(r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$")

FORMATS = {"9:16", "1:1", "4:5", "16:9"}
FONTS = {"Inter Tight", "Instrument Serif", "Bricolage Grotesque", "Fraunces",
         "DM Serif Display", "Space Grotesk", "Manrope", "JetBrains Mono"}
ROLES = {"display", "title", "subtitle", "body", "caption", "label", "mono"}
PERSONALITIES = {"editorial", "snappy", "calm", "playful"}
EASE_FAMILIES = {"sine", "cubic", "quart", "expo", "back"}

TYPES = {"text", "image", "shape", "svg", "button", "progress", "browser", "phone",
         "group", "stack", "grid", "template"}
COMMON_KEYS = {"id", "type", "layout", "style", "enter", "exit", "states", "z"}
TYPE_KEYS = {
    "text": {"content", "role", "fit", "maxLines"},
    "image": {"asset", "fit", "focus"},
    "shape": {"shape"},
    "svg": {"asset"},
    "button": {"label", "variant"},
    "progress": {"steps", "value"},
    "browser": {"url", "content", "children", "chrome"},
    "phone": {"content", "children", "chrome"},
    "group": {"children"},
    "stack": {"children", "direction", "gap", "align", "justify"},
    "grid": {"children", "columns", "gap", "rowGap"},
    "template": {"html", "css", "params", "vars"},
}
REQUIRED = {"text": ["content"], "image": ["asset"], "shape": ["shape"], "svg": ["asset"],
            "button": ["label"], "progress": ["steps"], "template": ["html"]}
SHAPES = {"rect", "circle", "ellipse", "line", "pill"}
STYLE_KEYS = {"opacity", "rotation", "scale", "radius", "fill", "stroke", "strokeWidth",
              "shadow", "blur", "blend",
              # text overrides
              "color", "align", "size", "weight", "lineHeight", "letterSpacing", "uppercase", "italic"}
LAYOUT_KEYS = {"anchor", "inset", "offset", "below", "above", "leftOf", "rightOf", "gap",
               "align", "x", "y", "width", "height", "maxWidth", "aspect"}
ANCHORS = {"top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"}

ENTER = {"fadeIn", "fadeUp", "slideIn", "scaleIn", "popIn", "bounceIn", "blurIn", "wordReveal",
         "lineReveal", "charReveal", "typewriter", "countUp", "drawOutline", "wipeIn", "trackIn"}
EXIT = {"fadeOut", "slideOut", "scaleOut", "blurOut", "wordsUp", "wipeOut"}
AMBIENT = {"kenBurns", "float", "pulse", "swing", "drift"}
PRESETS = ENTER | EXIT | AMBIENT
PRESET_COMMON = {"preset", "at", "duration", "ease", "stagger"}
PRESET_PARAMS = {"fadeUp": {"distance"}, "slideIn": {"from", "distance"}, "scaleIn": {"from"},
                 "blurIn": {"amount"}, "charReveal": {"blur"}, "typewriter": {"cps", "caret"},
                 "countUp": {"from"}, "wipeIn": {"from"}, "trackIn": {"from"}, "slideOut": {"to"},
                 "wipeOut": {"to"}, "kenBurns": {"zoom", "pan"}, "float": {"amplitude", "period"},
                 "pulse": {"scale", "every"}, "swing": {"angle", "damping"}, "drift": {"y"}}
TEXT_ONLY = {"wordReveal", "lineReveal", "charReveal", "typewriter", "countUp", "trackIn", "wordsUp"}
ANIM_PROPS = {"x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur", "width", "height",
              "radius", "color", "fill", "stroke", "letterSpacing", "fontWeight", "value"}
BEHAVIORS = {
    "scroll": {"target", "to", "at", "duration", "ease"},
    "interaction": {"at", "cursor", "from", "steps", "pace"},
    "camera": {"target", "ease", "keys"},
    "focusCycle": {"targets", "at", "interval", "dim", "scale"},
}
TRANSITIONS = {"cut": set(), "crossfade": set(), "wipe": {"angle", "bar", "barWidth"},
               "slide": {"direction", "push"}, "circle": {"origin"}, "zoom": {"direction"},
               "matchCut": {"from", "to"}}
TIME_RE = re.compile(r"^(scene\.(start|end)|prev\.(enter|exit)\.(start|end)|cue:[\w-]+|"
                     r"[a-z0-9-]+\.(enter|exit)\.(start|end)|[a-z0-9-]+\.(start|end))([+-]\d+(\.\d+)?)?$")


class Checker:
    def __init__(self, spec):
        self.s = spec
        self.issues = []
        self.ids = {}            # id -> path
        self.palette = set()
        self.assets = set()
        self.scene_elems = {}    # scene id -> {elem id: elem}
        self.timeline_ids = {}   # scene id -> set
        self.font_families = set(FONTS)

    def err(self, path, msg, level="error"):
        self.issues.append((level, path, msg))

    def warn(self, path, msg):
        self.err(path, msg, "warn")

    def unknown_keys(self, obj, allowed, path):
        for k in obj:
            if k not in allowed:
                self.err(path, f"unknown key '{k}'")

    # ---------- colours / time ----------
    def colour(self, v, path):
        if isinstance(v, dict):
            for k in v:
                if k not in {"linear", "radial", "angle"}:
                    self.err(path, f"unknown gradient key '{k}'")
            for c in v.get("linear", []) + v.get("radial", []):
                self.colour(c, path)
            return
        if not isinstance(v, str):
            self.err(path, f"colour must be string or gradient, got {v!r}")
            return
        if HEX.match(v):
            return
        tok = v.split("/")[0]
        if tok not in self.palette:
            self.err(path, f"colour '{v}' is not hex or a palette token")
        if "/" in v:
            try:
                a = float(v.split("/")[1])
                if not 0 <= a <= 1:
                    raise ValueError
            except ValueError:
                self.err(path, f"bad opacity in '{v}' (expected 0–1)")

    def time(self, v, scene, path):
        if v is None:
            return
        if isinstance(v, (int, float)):
            if v < 0:
                self.err(path, f"negative time {v}")
            elif v > scene.get("duration", 1e9):
                self.warn(path, f"time {v} is after scene end ({scene.get('duration')})")
            return
        if not isinstance(v, str) or not TIME_RE.match(v):
            self.err(path, f"bad time expression {v!r}")
            return
        sid = scene.get("id")
        if v.startswith("cue:"):
            name = re.split(r"[+-]", v[4:])[0]
            if name not in (scene.get("cues") or {}):
                self.err(path, f"cue '{name}' not declared in scene '{sid}'")
            return
        ref = v.split(".")[0]
        if ref in ("scene", "prev"):
            return
        elems = self.scene_elems.get(sid, {})
        if ref in elems:
            part = v.split(".")[1]
            if part in ("start", "end"):
                self.err(path, f"'{v}': elements use '{ref}.enter.start/end' or '{ref}.exit.start/end'")
            elif not elems[ref].get(part):
                self.err(path, f"'{v}': element '{ref}' has no {part}")
        elif ref in self.timeline_ids.get(sid, set()):
            pass
        else:
            self.err(path, f"'{v}' references '{ref}', which is not in scene '{sid}'")

    # ---------- main ----------
    def run(self):
        s = self.s
        self.unknown_keys(s, {"version", "video", "theme", "assets", "scenes"}, "$")
        if s.get("version") != "0.2":
            self.err("$.version", f"expected '0.2', got {s.get('version')!r}")
        v = s.get("video")
        if not isinstance(v, dict):
            self.err("$.video", "missing")
            v = {}
        self.unknown_keys(v, {"format", "width", "height", "fps", "background", "seed"}, "$.video")
        if "format" in v and v["format"] not in FORMATS:
            self.err("$.video.format", f"unknown format {v['format']!r}")
        if "fps" in v and v["fps"] not in (24, 25, 30, 60):
            self.err("$.video.fps", f"fps {v['fps']} not allowed")
        self.theme(s.get("theme") or {})
        if "background" in v:
            self.colour(v["background"], "$.video.background")
        self.assets_(s.get("assets") or {})
        scenes = s.get("scenes")
        if not isinstance(scenes, list) or not scenes:
            self.err("$.scenes", "missing or empty")
            return
        # first pass: collect ids
        for i, sc in enumerate(scenes):
            self.reg(sc.get("id"), f"$.scenes[{i}]")
            elems = {}
            self.collect(sc.get("elements") or [], elems, f"$.scenes[{i}].elements")
            self.scene_elems[sc.get("id")] = elems
            self.timeline_ids[sc.get("id")] = {t["id"] for t in sc.get("timeline") or [] if isinstance(t, dict) and "id" in t}
            for tid in self.timeline_ids[sc.get("id")]:
                self.reg(tid, f"$.scenes[{i}].timeline")
        for i, sc in enumerate(scenes):
            self.scene(sc, i, scenes)
        total = sum(sc.get("duration", 0) for sc in scenes if isinstance(sc.get("duration"), (int, float)))
        self.total = total

    def reg(self, id_, path):
        if not id_:
            self.err(path, "missing id")
            return
        if not isinstance(id_, str) or not KEBAB.match(id_):
            self.err(path, f"id {id_!r} is not kebab-case")
        if id_ in self.ids:
            self.err(path, f"duplicate id '{id_}' (also at {self.ids[id_]})")
        self.ids[id_] = path

    def collect(self, elems, out, path):
        for j, e in enumerate(elems):
            p = f"{path}[{j}]"
            if not isinstance(e, dict):
                self.err(p, "element must be an object")
                continue
            self.reg(e.get("id"), p)
            out[e.get("id")] = e
            self.collect(e.get("children") or [], out, p + ".children")

    def theme(self, t):
        self.unknown_keys(t, {"palette", "fonts", "roles", "motion", "transition", "texture"}, "$.theme")
        pal = t.get("palette") or {}
        self.palette = set(pal)
        for k, c in pal.items():
            if not (isinstance(c, str) and HEX.match(c)):
                self.err(f"$.theme.palette.{k}", f"palette values must be hex, got {c!r}")
        fonts = t.get("fonts") or {}
        self.unknown_keys(fonts, {"display", "body", "mono"}, "$.theme.fonts")
        self._theme_fonts = fonts
        for r in (t.get("roles") or {}):
            if r not in ROLES:
                self.err(f"$.theme.roles.{r}", "unknown role")
        m = t.get("motion")
        if isinstance(m, str) and m not in PERSONALITIES:
            self.err("$.theme.motion", f"unknown personality {m!r}")
        if isinstance(m, dict):
            self.unknown_keys(m, {"base", "ease", "duration", "stagger"}, "$.theme.motion")
            if m.get("base") not in PERSONALITIES:
                self.err("$.theme.motion.base", f"unknown personality {m.get('base')!r}")
        if "transition" in t:
            self.transition(t["transition"], "$.theme.transition", None, None)
        self.unknown_keys(t.get("texture") or {}, {"grain", "vignette"}, "$.theme.texture")

    def assets_(self, a):
        for k, v in a.items():
            self.assets.add(k)
            p = f"$.assets.{k}"
            if isinstance(v, str):
                if v.startswith("http"):
                    self.err(p, "remote URLs are not allowed")
                continue
            if not isinstance(v, dict):
                self.err(p, "asset must be a string or object")
                continue
            self.unknown_keys(v, {"type", "src", "family", "hint", "color", "fallback"}, p)
            if v.get("type") not in {"image", "svg", "font", "placeholder"}:
                self.err(p, f"unknown asset type {v.get('type')!r}")
            if v.get("type") == "font" and v.get("family"):
                self.font_families.add(v["family"])
            if "color" in v:
                self.colour(v["color"], p + ".color")
        for slot, fam in (getattr(self, "_theme_fonts", {}) or {}).items():
            if fam not in self.font_families:
                self.err(f"$.theme.fonts.{slot}", f"font '{fam}' is not bundled and not declared as a font asset")

    def transition(self, tr, path, prev_scene, scene):
        if tr in ("theme", "cut"):
            return
        if isinstance(tr, str):
            if tr not in TRANSITIONS:
                self.err(path, f"unknown transition {tr!r}")
            return
        if not isinstance(tr, dict):
            self.err(path, "transition must be string or object")
            return
        ty = tr.get("type")
        if ty not in TRANSITIONS:
            self.err(path, f"unknown transition type {ty!r}")
            return
        self.unknown_keys(tr, {"type", "duration", "ease"} | TRANSITIONS[ty], path)
        if "bar" in tr and tr["bar"] is not None:
            self.colour(tr["bar"], path + ".bar")
        if ty == "matchCut" and scene is not None:
            if tr.get("from") not in self.scene_elems.get(prev_scene.get("id") if prev_scene else None, {}):
                self.err(path, f"matchCut.from '{tr.get('from')}' is not an element of the previous scene")
            to = tr.get("to")
            if to != "background" and to not in self.scene_elems.get(scene.get("id"), {}):
                self.err(path, f"matchCut.to '{to}' is not an element of this scene or 'background'")

    def scene(self, sc, i, scenes):
        p = f"$.scenes[{i}]"
        self.unknown_keys(sc, {"id", "duration", "background", "transition", "cues", "elements", "timeline"}, p)
        d = sc.get("duration")
        if not isinstance(d, (int, float)) or d <= 0:
            self.err(p + ".duration", "missing or not positive")
        bg = sc.get("background")
        if isinstance(bg, dict) and "asset" in bg:
            self.unknown_keys(bg, {"asset", "fit", "overlay"}, p + ".background")
            if bg["asset"] not in self.assets:
                self.err(p + ".background.asset", f"asset '{bg['asset']}' not declared")
            if "overlay" in bg:
                self.colour(bg["overlay"], p + ".background.overlay")
        elif bg is not None:
            self.colour(bg, p + ".background")
        if "transition" in sc:
            self.transition(sc["transition"], p + ".transition", scenes[i - 1] if i else None, sc)
        for c, t in (sc.get("cues") or {}).items():
            self.time(t, sc, f"{p}.cues.{c}")
        for j, e in enumerate(sc.get("elements") or []):
            self.element(e, sc, f"{p}.elements[{j}]", parent=None)
        for j, t in enumerate(sc.get("timeline") or []):
            self.tl_item(t, sc, f"{p}.timeline[{j}]")

    def element(self, e, sc, p, parent):
        if not isinstance(e, dict):
            return
        ty = e.get("type")
        if ty not in TYPES:
            self.err(p, f"unknown element type {ty!r}")
            return
        self.unknown_keys(e, COMMON_KEYS | TYPE_KEYS[ty], p)
        for r in REQUIRED.get(ty, []):
            if r not in e:
                self.err(p, f"{ty} requires '{r}'")
        if ty == "text" and "role" in e and e["role"] not in ROLES:
            self.err(p + ".role", f"unknown role {e['role']!r}")
        if ty == "shape" and e.get("shape") not in SHAPES:
            self.err(p + ".shape", f"unknown shape {e.get('shape')!r}")
        if ty in ("image", "svg") and e.get("asset") not in self.assets:
            self.err(p + ".asset", f"asset '{e.get('asset')}' not declared")
        if ty in ("browser", "phone") and isinstance(e.get("content"), str) and e["content"] not in self.assets:
            self.err(p + ".content", f"asset '{e['content']}' not declared")
        if ty == "template" and re.search(r"<script|on\w+=|https?://", e.get("html", "") + e.get("css", "")):
            self.err(p, "template contains script, handlers or URLs")
        # style
        st = e.get("style") or {}
        self.unknown_keys(st, STYLE_KEYS, p + ".style")
        for ck in ("color", "fill", "stroke"):
            if ck in st:
                self.colour(st[ck], f"{p}.style.{ck}")
        # layout
        lay = e.get("layout") or {}
        self.unknown_keys(lay, LAYOUT_KEYS, p + ".layout")
        if "anchor" in lay and lay["anchor"] not in ANCHORS:
            self.err(p + ".layout.anchor", f"unknown anchor {lay['anchor']!r}")
        methods = [m for m in ("anchor", "rel", "abs") if
                   (m == "anchor" and ("anchor" in lay or "inset" in lay)) or
                   (m == "rel" and any(k in lay for k in ("below", "above", "leftOf", "rightOf"))) or
                   (m == "abs" and ("x" in lay or "y" in lay))]
        if len(methods) > 1:
            self.err(p + ".layout", f"mixes placement methods {methods}")
        for k in ("below", "above", "leftOf", "rightOf"):
            if k in lay and lay[k] not in self.scene_elems.get(sc.get("id"), {}):
                self.err(f"{p}.layout.{k}", f"'{lay[k]}' is not an element in this scene")
        # enter/exit
        for kind in ("enter", "exit"):
            if kind in e:
                self.preset(e[kind], sc, f"{p}.{kind}", ty, ENTER if kind == "enter" else EXIT, kind)
        # states
        for sn, sv in (e.get("states") or {}).items():
            if not isinstance(sv, dict):
                self.err(f"{p}.states.{sn}", "state must be an object")
                continue
            self.unknown_keys(sv, {"style", "content", "label", "value"}, f"{p}.states.{sn}")
            self.unknown_keys(sv.get("style") or {}, STYLE_KEYS, f"{p}.states.{sn}.style")
        for j, c in enumerate(e.get("children") or []):
            self.element(c, sc, f"{p}.children[{j}]", parent=e)

    def preset(self, v, sc, p, etype, allowed, kind):
        if isinstance(v, str):
            name, obj = v, {}
        elif isinstance(v, dict):
            name, obj = v.get("preset"), v
        else:
            self.err(p, "must be a preset name or object")
            return
        if name not in allowed:
            hint = " (exists, but not as " + kind + ")" if name in PRESETS else ""
            self.err(p, f"unknown {kind} preset {name!r}{hint}")
            return
        self.unknown_keys(obj, PRESET_COMMON | PRESET_PARAMS.get(name, set()), p)
        if name in TEXT_ONLY and etype and etype != "text":
            self.err(p, f"'{name}' is text-only but used on {etype}")
        self.time(obj.get("at"), sc, p + ".at")

    def tl_item(self, t, sc, p):
        if not isinstance(t, dict):
            self.err(p, "timeline item must be an object")
            return
        elems = self.scene_elems.get(sc.get("id"), {})

        def check_target(tg):
            tgs = tg if isinstance(tg, list) else [tg]
            for x in tgs:
                if x != "background" and x not in elems:
                    self.err(p + ".target", f"target '{x}' is not an element in this scene")
            return [elems.get(x, {}).get("type") for x in tgs]

        kinds = [k for k in ("preset", "animate", "behavior", "state") if k in t]
        if len(kinds) != 1:
            self.err(p, f"timeline item must have exactly one of preset/animate/behavior/state, has {kinds}")
            return
        k = kinds[0]
        self.time(t.get("at"), sc, p + ".at")
        if k == "preset":
            types = check_target(t.get("target"))
            name = t["preset"]
            if name not in PRESETS:
                self.err(p, f"unknown preset {name!r}")
                return
            self.unknown_keys(t, PRESET_COMMON | {"target", "id"} | PRESET_PARAMS.get(name, set()), p)
            if name in TEXT_ONLY and any(x and x != "text" for x in types):
                self.err(p, f"'{name}' is text-only")
        elif k == "animate":
            check_target(t.get("target"))
            self.unknown_keys(t, {"id", "target", "at", "duration", "ease", "animate", "stagger", "repeat", "yoyo"}, p)
            for prop in t["animate"]:
                if prop not in ANIM_PROPS and not prop.startswith("--"):
                    self.err(f"{p}.animate.{prop}", "not an animatable property")
        elif k == "state":
            check_target(t.get("target"))
            self.unknown_keys(t, {"id", "target", "state", "at", "duration"}, p)
            tg = elems.get(t.get("target"), {})
            if t["state"] != "default" and t["state"] not in (tg.get("states") or {}):
                self.err(p + ".state", f"state '{t['state']}' not declared on '{t.get('target')}'")
        else:
            b = t["behavior"]
            if b not in BEHAVIORS:
                self.err(p, f"unknown behavior {b!r}")
                return
            self.unknown_keys(t, BEHAVIORS[b] | {"behavior", "id"}, p)
            if b in ("scroll", "camera"):
                check_target(t.get("target"))
            if b == "scroll":
                to = t.get("to")
                if isinstance(to, str) and to not in ("top", "bottom"):
                    tgt = elems.get(t.get("target"), {})
                    inner = {}
                    self.collect_silent(tgt.get("children") or [], inner)
                    if to not in inner:
                        self.err(p + ".to", f"'{to}' is not inside '{t.get('target')}'")
            if b == "camera":
                if (elems.get(t.get("target")) or {}).get("type") != "group":
                    self.err(p + ".target", "camera target must be a group")
                for j, key in enumerate(t.get("keys") or []):
                    self.unknown_keys(key, {"at", "focus", "zoom"}, f"{p}.keys[{j}]")
                    self.time(key.get("at"), sc, f"{p}.keys[{j}].at")
                    f = key.get("focus")
                    if f and f not in ANCHORS and f not in elems:
                        self.err(f"{p}.keys[{j}].focus", f"'{f}' is not an anchor or element")
            if b == "focusCycle":
                check_target(t.get("targets"))
            if b == "interaction":
                if t.get("cursor") and t["cursor"] not in ("arrow", "pointer", "touch"):
                    self.err(p + ".cursor", f"unknown cursor {t['cursor']!r}")
                for j, st in enumerate(t.get("steps") or []):
                    sp = f"{p}.steps[{j}]"
                    ks = [x for x in ("click", "wait", "type") if x in st]
                    if len(ks) != 1:
                        self.err(sp, f"step needs exactly one of click/wait/type, has {ks}")
                        continue
                    self.unknown_keys(st, {"click", "set", "wait", "type", "text"}, sp)
                    if "click" in st and st["click"] not in elems:
                        self.err(sp, f"click target '{st['click']}' not in scene")
                    if "type" in st and st["type"] not in elems:
                        self.err(sp, f"type target '{st['type']}' not in scene")
                    for el, state in (st.get("set") or {}).items():
                        if el not in elems:
                            self.err(sp + ".set", f"'{el}' not in scene")
                        elif state != "default" and state not in (elems[el].get("states") or {}):
                            self.err(sp + ".set", f"state '{state}' not declared on '{el}'")

    def collect_silent(self, elems, out):
        for e in elems:
            if isinstance(e, dict):
                out[e.get("id")] = e
                self.collect_silent(e.get("children") or [], out)


def check(path):
    try:
        spec = json.load(open(path))
    except Exception as e:
        return [("error", "$", f"invalid JSON: {e}")], None
    c = Checker(spec)
    c.run()
    return c.issues, getattr(c, "total", None)


if __name__ == "__main__":
    grand = 0
    for f in sys.argv[1:]:
        issues, total = check(f)
        errs = sum(1 for i in issues if i[0] == "error")
        warns = len(issues) - errs
        grand += errs
        print(f"\n== {f}  ({total}s)  errors={errs} warnings={warns}")
        for lvl, p, m in issues:
            print(f"  [{lvl}] {p}: {m}")
    sys.exit(1 if grand else 0)
