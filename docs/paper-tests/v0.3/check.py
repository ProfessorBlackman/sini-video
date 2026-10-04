#!/usr/bin/env python3
"""Paper-test checker for Sini DSL v0.3.

Checks a spec against the rules in docs/DSL_REFERENCE.md: allowed vocabulary,
unique IDs, references, time expressions, assets, hotspots, components and colours.
It is not the real validator; it exists to grade LLM-authored specs objectively.
(The v0.2 checker is kept in v0.2/check.py.)

Usage: python3 check.py file.json [file.json ...]
"""
import json, re, sys, copy

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
HEX = re.compile(r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$")
PARAM = re.compile(r"\{\{\s*([\w-]+)\s*\}\}")

FORMATS = {"9:16", "1:1", "4:5", "16:9"}
FONTS = {"Inter Tight", "Instrument Serif", "Bricolage Grotesque", "Fraunces",
         "DM Serif Display", "Space Grotesk", "Manrope", "JetBrains Mono"}
ROLES = {"display", "title", "subtitle", "body", "caption", "label", "mono"}
PERSONALITIES = {"editorial", "snappy", "calm", "playful"}
ANCHORS = {"top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"}
SIDES = {"left", "right", "up", "down"}

TYPES = {"text", "image", "shape", "svg", "button", "progress", "chart", "browser", "phone",
         "group", "stack", "grid", "template"}
COMMON_KEYS = {"id", "type", "layout", "style", "enter", "exit", "states", "z"}
DEVICE_KEYS = {"content", "children", "screens", "screen", "background", "padding", "gap", "chrome"}
TYPE_KEYS = {
    "text": {"content", "role", "fit", "maxLines"},
    "image": {"asset", "fit", "focus"},
    "shape": {"shape"},
    "svg": {"asset"},
    "button": {"label", "variant"},
    "progress": {"steps", "value"},
    "chart": {"kind", "data", "highlight", "showValues", "format", "max"},
    "browser": DEVICE_KEYS | {"url"},
    "phone": DEVICE_KEYS | {"statusBar"},
    "group": {"children"},
    "stack": {"children", "direction", "gap", "align", "justify"},
    "grid": {"children", "columns", "gap", "rowGap"},
    "template": {"html", "css", "params", "vars"},
}
REQUIRED = {"text": ["content"], "image": ["asset"], "shape": ["shape"], "svg": ["asset"],
            "button": ["label"], "progress": ["steps"], "chart": ["kind", "data"], "template": ["html"]}
INSTANCE_KEYS = {"id", "use", "with", "layout", "style", "enter", "exit", "states", "z"}
SHAPES = {"rect", "circle", "ellipse", "line", "pill"}
STYLE_KEYS = {"opacity", "rotation", "scale", "scaleX", "scaleY", "origin", "radius", "fill", "stroke",
              "strokeWidth", "shadow", "blur", "blend", "padding",
              # text / button label overrides
              "color", "align", "size", "weight", "lineHeight", "letterSpacing", "uppercase", "italic"}
LAYOUT_KEYS = {"anchor", "inset", "offset", "below", "above", "leftOf", "rightOf", "gap", "align",
               "pin", "x", "y", "width", "height", "maxWidth", "aspect"}

ENTER = {"fadeIn", "fadeUp", "slideIn", "scaleIn", "popIn", "bounceIn", "blurIn", "wordReveal",
         "lineReveal", "charReveal", "typewriter", "countUp", "trackIn", "drawOutline", "wipeIn", "grow"}
EXIT = {"fadeOut", "slideOut", "scaleOut", "blurOut", "wordsUp", "wipeOut"}
AMBIENT = {"kenBurns", "float", "pulse", "swing", "drift"}
PRESETS = ENTER | EXIT | AMBIENT
PRESET_COMMON = {"preset", "at", "duration", "ease", "stagger"}
PRESET_PARAMS = {"fadeUp": {"distance"}, "slideIn": {"from", "distance"}, "scaleIn": {"from"},
                 "blurIn": {"amount"}, "charReveal": {"blur"}, "typewriter": {"cps", "caret"},
                 "countUp": {"from"}, "trackIn": {"from"}, "wipeIn": {"from"},
                 "slideOut": {"to"}, "scaleOut": {"to"}, "blurOut": {"amount"}, "wipeOut": {"to"},
                 "kenBurns": {"zoom", "pan"}, "float": {"amplitude", "period"},
                 "pulse": {"scale", "every", "ring"}, "swing": {"angle", "damping"},
                 "drift": {"x", "y", "scale"}}
TEXT_ONLY = {"wordReveal", "lineReveal", "charReveal", "typewriter", "countUp", "trackIn", "wordsUp"}
ANIM_PROPS = {"x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur", "width", "height",
              "radius", "color", "fill", "stroke", "letterSpacing", "fontWeight", "value"}
BEHAVIORS = {
    "scroll": {"target", "to", "at", "duration", "ease"},
    "interaction": {"at", "cursor", "from", "steps", "pace"},
    "camera": {"target", "ease", "keys"},
    "focusCycle": {"targets", "at", "interval", "dim", "scale"},
}
TRANSITIONS = {"cut": set(), "crossfade": set(), "wipe": {"from", "angle", "bar", "barWidth"},
               "slide": {"from", "push"}, "circle": {"origin"}, "zoom": {"direction"},
               "matchCut": {"from", "to"}}
REF = r"[a-z0-9-]+(?:/[a-z0-9-]+)*"
TIME_RE = re.compile(rf"^(scene\.(start|end)|prev\.(enter|exit)\.(start|end)|cue:[\w-]+|"
                     rf"{REF}\.(enter|exit)\.(start|end)|{REF}\.(start|end))([+-]\d+(\.\d+)?)?$")


class Checker:
    def __init__(self, spec):
        self.s = spec
        self.issues = []
        self.ids = {}             # globally unique ids -> path
        self.palette = set()
        self.assets = {}          # id -> asset object
        self.components = {}
        self.scene_elems = {}     # scene id -> {ref path: element}
        self.timeline_ids = {}    # scene id -> set of referenceable ids (timeline items, steps)
        self.font_families = set(FONTS)

    def err(self, path, msg, level="error"):
        self.issues.append((level, path, msg))

    def warn(self, path, msg):
        self.err(path, msg, "warn")

    def unknown_keys(self, obj, allowed, path):
        if not isinstance(obj, dict):
            self.err(path, "must be an object")
            return
        for k in obj:
            if k not in allowed:
                self.err(path, f"unknown key '{k}'")

    # ---------- colours / time / refs ----------
    def colour(self, v, path):
        if isinstance(v, dict):
            self.unknown_keys(v, {"linear", "radial", "angle"}, path)
            for c in (v.get("linear") or []) + (v.get("radial") or []):
                self.colour(c, path)
            return
        if not isinstance(v, str):
            self.err(path, f"colour must be string or gradient, got {v!r}")
            return
        if HEX.match(v) or PARAM.search(v):
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

    def time(self, v, scene, path, prefix=""):
        if v is None:
            return
        if isinstance(v, (int, float)):
            d = scene.get("duration")
            if v < 0:
                self.err(path, f"negative time {v}")
            elif isinstance(d, (int, float)) and v > d:
                self.warn(path, f"time {v} is after scene end ({d})")
            return
        if not isinstance(v, str) or not TIME_RE.match(v):
            self.err(path, f"bad time expression {v!r}")
            return
        sid = scene.get("id")
        if v.startswith("cue:"):
            name = re.match(r"^cue:([\w-]+?)([+-]\d+(\.\d+)?)?$", v).group(1)
            if name not in (scene.get("cues") or {}):
                self.err(path, f"cue '{name}' not declared in scene '{sid}'")
            return
        base = re.match(r"^(.*\.(?:start|end))([+-]\d+(\.\d+)?)?$", v).group(1)
        ref, _, rest = base.partition(".")
        if ref in ("scene", "prev"):
            return
        elems = self.scene_elems.get(sid, {})
        if prefix and prefix + ref in elems:
            ref = prefix + ref
        if ref in elems:
            part = rest.split(".")[0]
            if part in ("start", "end"):
                self.err(path, f"'{v}': elements use '{ref}.enter.start/end' or '{ref}.exit.start/end'")
            elif part == "enter" and not self.has_enter(elems[ref], sid, ref):
                self.err(path, f"'{v}': element '{ref}' has no enter")
            elif part == "exit" and not elems[ref].get("exit"):
                self.err(path, f"'{v}': element '{ref}' has no exit")
        elif ref in self.timeline_ids.get(sid, set()):
            if rest.split(".")[0] not in ("start", "end"):
                self.err(path, f"'{v}': timeline items and steps use '.start' / '.end'")
        else:
            self.err(path, f"'{v}' references '{ref}', which is not in scene '{sid}'")

    def has_enter(self, el, sid, ref):
        if el.get("enter") and el.get("enter") != "none":
            return True
        if el.get("type") == "text" and "/" not in ref and ref in self.top_level.get(sid, set()) and el.get("enter") != "none":
            return True  # default text enter
        for t in self.timelines.get(sid, []):
            if isinstance(t, dict) and t.get("preset") in ENTER:
                tg = t.get("target")
                if ref == tg or (isinstance(tg, list) and ref in tg):
                    return True
        return False

    def target_ref(self, x, sid, path, allow_hotspot=False, allow_background=False):
        """Element id, component path, hotspot 'el#name', or 'background'."""
        if allow_background and x == "background":
            return
        if not isinstance(x, str):
            self.err(path, f"target must be a string, got {x!r}")
            return
        elems = self.scene_elems.get(sid, {})
        if "#" in x:
            if not allow_hotspot:
                self.err(path, f"hotspot '{x}' not allowed here")
                return
            el, hs = x.split("#", 1)
            if el not in elems:
                self.err(path, f"hotspot element '{el}' not in scene")
                return
            e = elems[el]
            aid = e.get("asset") if e.get("type") in ("image", "svg") else e.get("content")
            a = self.assets.get(aid) if isinstance(aid, str) else None
            if not isinstance(a, dict) or hs not in (a.get("hotspots") or {}):
                self.err(path, f"hotspot '{hs}' not declared on the asset shown by '{el}'")
            return
        if x not in elems:
            self.err(path, f"'{x}' is not an element in this scene")

    # ---------- main ----------
    def run(self):
        s = self.s
        self.unknown_keys(s, {"version", "video", "theme", "assets", "components", "scenes", "notes"}, "$")
        if s.get("version") != "0.3":
            self.err("$.version", f"expected '0.3', got {s.get('version')!r}")
        if "notes" in s and not (isinstance(s["notes"], list) and all(isinstance(n, str) for n in s["notes"])):
            self.err("$.notes", "must be a list of strings")
        self.theme(s.get("theme") or {})
        v = s.get("video")
        if not isinstance(v, dict):
            self.err("$.video", "missing")
            v = {}
        self.unknown_keys(v, {"format", "width", "height", "fps", "background", "seed", "targetDuration",
                              "safeZone", "end"}, "$.video")
        if "format" in v and v["format"] not in FORMATS:
            self.err("$.video.format", f"unknown format {v['format']!r}")
        if "fps" in v and v["fps"] not in (24, 25, 30, 60):
            self.err("$.video.fps", f"fps {v['fps']} not allowed")
        if "background" in v:
            self.colour(v["background"], "$.video.background")
        if "safeZone" in v and v["safeZone"] not in ("reels", "tiktok", "shorts", "none"):
            self.err("$.video.safeZone", f"unknown safe zone {v['safeZone']!r}")
        end = v.get("end")
        if isinstance(end, dict):
            self.unknown_keys(end, {"type", "duration", "color"}, "$.video.end")
            if end.get("type") != "fade":
                self.err("$.video.end.type", "only 'fade' is allowed")
            if "color" in end:
                self.colour(end["color"], "$.video.end.color")
        elif end is not None and end not in ("hold", "cut"):
            self.err("$.video.end", f"unknown end {end!r}")
        self.assets_(s.get("assets") or {})
        self.components_(s.get("components") or {})
        scenes = s.get("scenes")
        if not isinstance(scenes, list) or not scenes:
            self.err("$.scenes", "missing or empty")
            return
        self.top_level, self.timelines = {}, {}
        for i, sc in enumerate(scenes):
            sid = sc.get("id")
            self.reg(sid, f"$.scenes[{i}]")
            elems = {}
            self.collect(sc.get("elements") or [], elems, f"$.scenes[{i}].elements", prefix="")
            self.scene_elems[sid] = elems
            self.top_level[sid] = {e.get("id") for e in sc.get("elements") or [] if isinstance(e, dict)}
            self.timelines[sid] = sc.get("timeline") or []
            tids = set()
            for j, t in enumerate(sc.get("timeline") or []):
                if not isinstance(t, dict):
                    continue
                if "id" in t:
                    self.reg(t["id"], f"$.scenes[{i}].timeline[{j}]")
                    tids.add(t["id"])
                for k, stp in enumerate(t.get("steps") or []):
                    if isinstance(stp, dict) and "id" in stp:
                        self.reg(stp["id"], f"$.scenes[{i}].timeline[{j}].steps[{k}]")
                        tids.add(stp["id"])
            self.timeline_ids[sid] = tids
        for i, sc in enumerate(scenes):
            self.scene(sc, i, scenes)
        self.total = sum(sc.get("duration") for sc in scenes if isinstance(sc.get("duration"), (int, float)))
        self.auto = sum(1 for sc in scenes if sc.get("duration") == "auto")

    def reg(self, id_, path, global_=True):
        if not id_:
            self.err(path, "missing id")
            return
        if not isinstance(id_, str) or not KEBAB.match(id_):
            self.err(path, f"id {id_!r} is not kebab-case")
        if global_:
            if id_ in self.ids:
                self.err(path, f"duplicate id '{id_}' (also at {self.ids[id_]})")
            self.ids[id_] = path

    def expand(self, inst):
        """Return the component root with params substituted, or None."""
        comp = self.components.get(inst.get("use"))
        if not comp:
            return None
        params = dict(comp.get("params") or {})
        params.update(inst.get("with") or {})

        def sub(x):
            if isinstance(x, str):
                return PARAM.sub(lambda m: str(params.get(m.group(1), m.group(0))), x)
            if isinstance(x, list):
                return [sub(i) for i in x]
            if isinstance(x, dict):
                return {k: sub(v) for k, v in x.items()}
            return x
        return sub(copy.deepcopy(comp.get("root")))

    def collect(self, elems, out, path, prefix):
        for j, e in enumerate(elems):
            p = f"{path}[{j}]"
            if not isinstance(e, dict):
                self.err(p, "element must be an object")
                continue
            local = e.get("id")
            self.reg(local, p, global_=(prefix == ""))
            ref = prefix + local if isinstance(local, str) else local
            out[ref] = e
            if "use" in e:
                root = self.expand(e)
                if root is not None:
                    e["_expanded"] = root
                    out[ref + "/" + str(root.get("id"))] = root
                    self.collect(root.get("children") or [], out, p + "(component)", prefix=ref + "/")
                    for scr, kids in (root.get("screens") or {}).items():
                        self.collect(kids or [], out, p + "(component)", prefix=ref + "/")
                continue
            self.collect(e.get("children") or [], out, p + ".children", prefix)
            for scr, kids in (e.get("screens") or {}).items():
                if isinstance(kids, list):
                    self.collect(kids, out, f"{p}.screens.{scr}", prefix)

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
            self.assets[k] = v
            p = f"$.assets.{k}"
            if isinstance(v, str):
                if v.startswith("http"):
                    self.err(p, "remote URLs are not allowed")
                continue
            if not isinstance(v, dict):
                self.err(p, "asset must be a string or object")
                continue
            self.unknown_keys(v, {"type", "src", "family", "hint", "color", "fallback", "hotspots"}, p)
            if v.get("type") not in {"image", "svg", "font", "placeholder"}:
                self.err(p, f"unknown asset type {v.get('type')!r}")
            if v.get("type") == "font" and v.get("family"):
                self.font_families.add(v["family"])
            if "color" in v:
                self.colour(v["color"], p + ".color")
            for hn, hv in (v.get("hotspots") or {}).items():
                ok = (isinstance(hv, list) and len(hv) == 4 and all(isinstance(n, (int, float)) for n in hv)) or \
                     (isinstance(hv, dict) and set(hv) == {"text"})
                if not ok:
                    self.err(f"{p}.hotspots.{hn}", "hotspot must be [x, y, w, h] or { \"text\": ... }")
        for slot, fam in (getattr(self, "_theme_fonts", {}) or {}).items():
            if fam not in self.font_families:
                self.err(f"$.theme.fonts.{slot}", f"font '{fam}' is not bundled and not declared as a font asset")

    def components_(self, comps):
        for name, c in comps.items():
            p = f"$.components.{name}"
            if not KEBAB.match(name):
                self.err(p, "component name is not kebab-case")
            self.unknown_keys(c, {"params", "root"}, p)
            if not isinstance(c.get("root"), dict):
                self.err(p + ".root", "missing root element")
                continue
            used = set(PARAM.findall(json.dumps(c["root"])))
            for u in used - set(c.get("params") or {}):
                self.err(p, f"'{{{{{u}}}}}' used but not declared in params")
            local = {}
            self.collect([c["root"]], local, p + ".root", prefix="__local__/")
            self.components[name] = c

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
        if "from" in tr and ty in ("wipe", "slide") and tr["from"] not in SIDES:
            self.err(path + ".from", f"must be one of {sorted(SIDES)}")
        if "bar" in tr and tr["bar"] is not None:
            self.colour(tr["bar"], path + ".bar")
        if scene is None:
            return
        prev_elems = self.scene_elems.get(prev_scene.get("id") if prev_scene else None, {})
        cur_elems = self.scene_elems.get(scene.get("id"), {})
        if ty == "matchCut":
            if tr.get("from") not in prev_elems:
                self.err(path, f"matchCut.from '{tr.get('from')}' is not an element of the previous scene")
            to = tr.get("to")
            if to != "background" and to not in cur_elems:
                self.err(path, f"matchCut.to '{to}' is not an element of this scene or 'background'")
        if ty == "circle" and "origin" in tr:
            o = tr["origin"]
            if o not in ANCHORS and o not in prev_elems and o not in cur_elems:
                self.err(path + ".origin", f"'{o}' is not an anchor or an element of either scene")

    def scene(self, sc, i, scenes):
        p = f"$.scenes[{i}]"
        self.unknown_keys(sc, {"id", "duration", "background", "transition", "cues", "elements", "timeline"}, p)
        d = sc.get("duration")
        if d != "auto" and (not isinstance(d, (int, float)) or d <= 0):
            self.err(p + ".duration", "must be a positive number or 'auto'")
        bg = sc.get("background")
        if isinstance(bg, dict) and "asset" in bg:
            self.unknown_keys(bg, {"asset", "fit", "overlay", "blur"}, p + ".background")
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
            self.element(e, sc, f"{p}.elements[{j}]", prefix="")
        for j, t in enumerate(sc.get("timeline") or []):
            self.tl_item(t, sc, f"{p}.timeline[{j}]")

    def element(self, e, sc, p, prefix, in_component=False):
        if not isinstance(e, dict):
            return
        sid = sc.get("id") if sc else None
        if "use" in e:
            self.unknown_keys({k: v for k, v in e.items() if k != "_expanded"}, INSTANCE_KEYS, p)
            comp = self.components.get(e["use"])
            if not comp:
                self.err(p + ".use", f"component '{e['use']}' not defined")
                return
            for k in (e.get("with") or {}):
                if k not in (comp.get("params") or {}):
                    self.err(f"{p}.with.{k}", f"'{k}' is not a param of '{e['use']}'")
            self.common(e, sc, p, None, prefix)
            root = e.get("_expanded")
            if root:
                self.element(root, sc, p + "(component root)", prefix=prefix + e["id"] + "/", in_component=True)
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
        if ty == "chart":
            if e.get("kind") not in ("bar", "hbar", "line"):
                self.err(p + ".kind", f"unknown chart kind {e.get('kind')!r}")
            data = e.get("data")
            if not (isinstance(data, list) and all(isinstance(r, list) and len(r) == 2 and isinstance(r[1], (int, float)) for r in data)):
                self.err(p + ".data", "must be [[label, number], ...]")
            elif "highlight" in e and e["highlight"] not in [r[0] for r in data]:
                self.err(p + ".highlight", f"'{e['highlight']}' is not a data label")
        if ty in ("browser", "phone"):
            if isinstance(e.get("content"), str) and e["content"] not in self.assets:
                self.err(p + ".content", f"asset '{e['content']}' not declared")
            modes = [k for k in ("content", "children", "screens") if k in e]
            if len(modes) > 1:
                self.err(p, f"use only one of content/children/screens, has {modes}")
            if "screens" in e and e.get("screen") not in (e.get("screens") or {}):
                self.err(p + ".screen", "must name one of its screens")
            if "background" in e:
                self.colour(e["background"], p + ".background")
            if e.get("chrome") is not None and e["chrome"] not in ("light", "dark", "none"):
                self.err(p + ".chrome", f"unknown chrome {e['chrome']!r}")
        if ty == "stack" and e.get("align") not in (None, "start", "center", "end", "stretch", "baseline"):
            self.err(p + ".align", f"unknown align {e.get('align')!r}")
        if ty == "template" and re.search(r"<script|on\w+=|https?://|transition\s*:|animation\s*:|@keyframes",
                                          e.get("html", "") + e.get("css", "")):
            self.err(p, "template contains script, handlers, URLs or CSS transitions/animations")
        self.common(e, sc, p, ty, prefix)
        for j, c in enumerate(e.get("children") or []):
            self.element(c, sc, f"{p}.children[{j}]", prefix, in_component)
        for scr, kids in (e.get("screens") or {}).items():
            for j, c in enumerate(kids or []):
                self.element(c, sc, f"{p}.screens.{scr}[{j}]", prefix, in_component)

    def common(self, e, sc, p, ty, prefix):
        sid = sc.get("id") if sc else None
        st = e.get("style") or {}
        self.unknown_keys(st, STYLE_KEYS, p + ".style")
        for ck in ("color", "fill", "stroke"):
            if ck in st:
                self.colour(st[ck], f"{p}.style.{ck}")
        if "origin" in st and st["origin"] not in ANCHORS:
            self.err(p + ".style.origin", f"unknown origin {st['origin']!r}")
        lay = e.get("layout") or {}
        self.unknown_keys(lay, LAYOUT_KEYS, p + ".layout")
        if "anchor" in lay and lay["anchor"] not in ANCHORS:
            self.err(p + ".layout.anchor", f"unknown anchor {lay['anchor']!r}")
        methods = [m for m, on in (("anchor", "anchor" in lay or "inset" in lay),
                                   ("relative", any(k in lay for k in ("below", "above", "leftOf", "rightOf"))),
                                   ("pin", "pin" in lay), ("absolute", "x" in lay or "y" in lay)) if on]
        if len(methods) > 1:
            self.err(p + ".layout", f"mixes placement methods {methods}")
        if sc is not None:
            for k in ("below", "above", "leftOf", "rightOf"):
                if k in lay:
                    self.target_ref(prefix + lay[k] if prefix else lay[k], sid, f"{p}.layout.{k}")
            if "pin" in lay:
                pin = lay["pin"]
                self.unknown_keys(pin, {"to", "point"}, p + ".layout.pin")
                if isinstance(pin, dict):
                    to = pin.get("to")
                    self.target_ref(prefix + to if prefix and isinstance(to, str) and "#" not in to else to,
                                    sid, p + ".layout.pin.to", allow_hotspot=True)
                    if pin.get("point") not in ANCHORS:
                        self.err(p + ".layout.pin.point", f"unknown point {pin.get('point')!r}")
        for kind in ("enter", "exit"):
            if kind in e:
                if kind == "enter" and e[kind] == "none":
                    continue
                self.preset(e[kind], sc, f"{p}.{kind}", ty, ENTER if kind == "enter" else EXIT, kind, prefix)
        for sn, sv in (e.get("states") or {}).items():
            if not isinstance(sv, dict):
                self.err(f"{p}.states.{sn}", "state must be an object")
                continue
            self.unknown_keys(sv, {"style", "content", "label", "variant", "value"}, f"{p}.states.{sn}")
            self.unknown_keys(sv.get("style") or {}, STYLE_KEYS, f"{p}.states.{sn}.style")

    def preset(self, v, sc, p, etype, allowed, kind, prefix=""):
        if isinstance(v, str):
            name, obj = v, {}
        elif isinstance(v, dict):
            name, obj = v.get("preset"), v
        else:
            self.err(p, "must be a preset name or object")
            return
        if name not in allowed:
            hint = f" (exists, but not as {kind})" if name in PRESETS else ""
            self.err(p, f"unknown {kind} preset {name!r}{hint}")
            return
        self.unknown_keys(obj, PRESET_COMMON | PRESET_PARAMS.get(name, set()), p)
        self.preset_types(name, [etype], p)
        self.directions(name, obj, p)
        if sc is not None:
            self.time(obj.get("at"), sc, p + ".at", prefix)

    def preset_types(self, name, types, p):
        if name in TEXT_ONLY and any(t and t != "text" for t in types):
            self.err(p, f"'{name}' is text-only")
        if name == "grow" and any(t and t != "chart" for t in types):
            self.err(p, "'grow' is chart-only")

    def directions(self, name, obj, p):
        for k in ("from", "to"):
            if k in obj and name in ("slideIn", "wipeIn", "slideOut", "wipeOut") and obj[k] not in SIDES:
                self.err(f"{p}.{k}", f"must be one of {sorted(SIDES)}")

    def tl_item(self, t, sc, p):
        if not isinstance(t, dict):
            self.err(p, "timeline item must be an object")
            return
        sid = sc.get("id")
        elems = self.scene_elems.get(sid, {})

        def check_target(tg, allow_hotspot=False):
            tgs = tg if isinstance(tg, list) else [tg]
            for x in tgs:
                self.target_ref(x, sid, p + ".target", allow_hotspot=allow_hotspot, allow_background=True)
            return [self.etype(elems.get(x, {})) for x in tgs]

        kinds = [k for k in ("preset", "animate", "behavior", "state", "navigate") if k in t]
        if len(kinds) != 1:
            self.err(p, f"timeline item must have exactly one of preset/animate/behavior/state/navigate, has {kinds}")
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
            self.preset_types(name, types, p)
            self.directions(name, t, p)
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
            if t["state"] != "default" and t["state"] not in self.states_of(tg):
                self.err(p + ".state", f"state '{t['state']}' not declared on '{t.get('target')}'")
        elif k == "navigate":
            self.unknown_keys(t, {"id", "target", "navigate", "transition", "at"}, p)
            self.navigate(t.get("target"), t["navigate"], elems, p)
            if t.get("transition") not in (None, "push", "fade", "none"):
                self.err(p + ".transition", f"unknown screen transition {t.get('transition')!r}")
        else:
            b = t["behavior"]
            if b not in BEHAVIORS:
                self.err(p, f"unknown behavior {b!r}")
                return
            self.unknown_keys(t, BEHAVIORS[b] | {"behavior", "id"}, p)
            if b == "scroll":
                check_target(t.get("target"))
                to = t.get("to")
                if isinstance(to, str) and to not in ("top", "bottom"):
                    inner = {}
                    tgt = elems.get(t.get("target"), {})
                    self.collect_silent(tgt, inner)
                    if to not in inner:
                        self.err(p + ".to", f"'{to}' is not inside '{t.get('target')}'")
            if b == "camera":
                check_target(t.get("target"))
                if self.etype(elems.get(t.get("target")) or {}) != "group":
                    self.err(p + ".target", "camera target must be a group")
                for j, key in enumerate(t.get("keys") or []):
                    self.unknown_keys(key, {"at", "focus", "zoom"}, f"{p}.keys[{j}]")
                    self.time(key.get("at"), sc, f"{p}.keys[{j}].at")
                    f = key.get("focus")
                    if f and f not in ANCHORS:
                        self.target_ref(f, sid, f"{p}.keys[{j}].focus", allow_hotspot=True)
            if b == "focusCycle":
                for x in t.get("targets") or []:
                    self.target_ref(x, sid, p + ".targets", allow_hotspot=True)
            if b == "interaction":
                if t.get("cursor") and t["cursor"] not in ("arrow", "pointer", "touch"):
                    self.err(p + ".cursor", f"unknown cursor {t['cursor']!r}")
                if t.get("pace") not in (None, "slow", "normal", "fast"):
                    self.err(p + ".pace", f"unknown pace {t['pace']!r}")
                if t.get("from") is not None and t["from"] not in ANCHORS:
                    self.err(p + ".from", f"'{t['from']}' is not an anchor")
                for j, st in enumerate(t.get("steps") or []):
                    sp = f"{p}.steps[{j}]"
                    ks = [x for x in ("click", "wait", "type") if x in st]
                    if len(ks) != 1:
                        self.err(sp, f"step needs exactly one of click/wait/type, has {ks}")
                        continue
                    self.unknown_keys(st, {"id", "click", "set", "navigate", "wait", "type", "text"}, sp)
                    if "click" in st:
                        self.target_ref(st["click"], sid, sp + ".click", allow_hotspot=True)
                    if "type" in st:
                        self.target_ref(st["type"], sid, sp + ".type")
                        if "text" not in st:
                            self.err(sp, "type step needs 'text'")
                    if "wait" in st and ("set" in st or "navigate" in st):
                        self.err(sp, "set/navigate only allowed on click or type steps")
                    for el, state in (st.get("set") or {}).items():
                        if el not in elems:
                            self.err(sp + ".set", f"'{el}' not in scene")
                        elif state != "default" and state not in self.states_of(elems[el]):
                            self.err(sp + ".set", f"state '{state}' not declared on '{el}'")
                    for dev, scr in (st.get("navigate") or {}).items():
                        self.navigate(dev, scr, elems, sp + ".navigate")

    def navigate(self, dev, scr, elems, p):
        d = elems.get(dev)
        if not d:
            self.err(p, f"device '{dev}' not in scene")
        elif scr not in (d.get("screens") or {}):
            self.err(p, f"'{dev}' has no screen '{scr}'")

    def states_of(self, e):
        """States on the element, plus (for component instances) states declared on the component root."""
        st = dict(e.get("states") or {})
        st.update((e.get("_expanded") or {}).get("states") or {})
        return st

    def etype(self, e):
        if "use" in e:
            return (e.get("_expanded") or {}).get("type")
        return e.get("type")

    def collect_silent(self, e, out):
        kids = list(e.get("children") or [])
        for scr in (e.get("screens") or {}).values():
            kids += scr or []
        for c in kids:
            if isinstance(c, dict):
                out[c.get("id")] = c
                self.collect_silent(c, out)


def check(path):
    try:
        spec = json.load(open(path))
    except Exception as e:
        return [("error", "$", f"invalid JSON: {e}")], None, 0
    c = Checker(spec)
    c.run()
    return c.issues, getattr(c, "total", None), getattr(c, "auto", 0)


if __name__ == "__main__":
    grand = 0
    for f in sys.argv[1:]:
        issues, total, auto = check(f)
        errs = sum(1 for i in issues if i[0] == "error")
        warns = len(issues) - errs
        grand += errs
        dur = f"{total}s fixed" + (f" + {auto} auto scenes" if auto else "")
        print(f"\n== {f}  ({dur})  errors={errs} warnings={warns}")
        for lvl, p, m in issues:
            print(f"  [{lvl}] {p}: {m}")
    sys.exit(1 if grand else 0)
