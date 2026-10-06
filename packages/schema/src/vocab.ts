/** The closed vocabulary of DSL v0.4. Anything not listed here is rejected by the validator. */

export const DSL_VERSION = "0.4";

export const FORMATS = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "16:9": [1920, 1080],
} as const satisfies Record<string, readonly [number, number]>;

export const FPS = [24, 25, 30, 60] as const;

export const BUNDLED_FONTS = [
  "Inter Tight",
  "Instrument Serif",
  "Bricolage Grotesque",
  "Fraunces",
  "DM Serif Display",
  "Space Grotesk",
  "Manrope",
  "JetBrains Mono",
] as const;

export const ROLES = ["display", "title", "subtitle", "body", "caption", "label", "mono"] as const;
export type Role = (typeof ROLES)[number];

export const PERSONALITIES = ["editorial", "snappy", "calm", "playful"] as const;
export type Personality = (typeof PERSONALITIES)[number];

export const ANCHORS = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
] as const;
export type Anchor = (typeof ANCHORS)[number];

export const SIDES = ["left", "right", "up", "down"] as const;
export type Side = (typeof SIDES)[number];

export const SAFE_ZONES = ["reels", "tiktok", "shorts", "none"] as const;

export const ELEMENT_TYPES = [
  "text", "image", "shape", "path", "svg", "button", "badge", "icon", "toast", "progress", "chart",
  "browser", "phone", "group", "stack", "grid", "template",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const COMMON_KEYS = ["id", "type", "layout", "style", "enter", "exit", "states", "z"] as const;
const DEVICE_KEYS = ["content", "children", "screens", "screen", "overlay", "background", "padding", "gap", "chrome"];

export const TYPE_KEYS: Record<ElementType, readonly string[]> = {
  text: ["content", "role", "fit", "maxLines"],
  image: ["asset", "fit", "focus"],
  shape: ["shape"],
  path: ["d", "points", "smooth", "closed", "viewBox"],
  svg: ["asset"],
  button: ["label", "variant"],
  badge: ["label", "shape"],
  icon: ["name"],
  toast: ["icon", "title", "body"],
  progress: ["steps", "value"],
  chart: ["kind", "data", "highlight", "showValues", "format", "max"],
  browser: [...DEVICE_KEYS, "url"],
  phone: [...DEVICE_KEYS, "statusBar"],
  group: ["children"],
  stack: ["children", "direction", "gap", "align", "justify"],
  grid: ["children", "columns", "gap", "rowGap"],
  template: ["html", "css", "params", "vars"],
};

export const REQUIRED_KEYS: Partial<Record<ElementType, readonly string[]>> = {
  text: ["content"],
  image: ["asset"],
  shape: ["shape"],
  svg: ["asset"],
  button: ["label"],
  badge: ["label"],
  icon: ["name"],
  toast: ["title"],
  progress: ["steps"],
  chart: ["kind", "data"],
  template: ["html"],
};

export const INSTANCE_KEYS = ["id", "use", "with", "layout", "style", "enter", "exit", "states", "z"] as const;

export const SHAPES = ["rect", "circle", "ellipse", "line", "pill"] as const;
export const BADGE_SHAPES = ["pill", "circle", "rect"] as const;
export const BUTTON_VARIANTS = ["solid", "outline", "ghost"] as const;
export const CHART_KINDS = ["bar", "hbar", "line"] as const;
export const CHROMES = ["light", "dark", "none"] as const;
export const STACK_ALIGN = ["start", "center", "end", "stretch", "baseline"] as const;
export const STACK_JUSTIFY = ["start", "center", "end", "space-between"] as const;

export const STYLE_KEYS = [
  "opacity", "rotation", "scale", "scaleX", "scaleY", "origin", "radius", "fill", "stroke",
  "strokeWidth", "dash", "shadow", "blur", "blend", "padding",
  // text and label overrides
  "color", "align", "size", "weight", "lineHeight", "letterSpacing", "uppercase", "italic",
] as const;

export const LAYOUT_KEYS = [
  "anchor", "inset", "offset", "below", "above", "leftOf", "rightOf", "gap", "align",
  "pin", "x", "y", "width", "height", "maxWidth", "aspect", "grow",
] as const;

export const ENTER_PRESETS = [
  "fadeIn", "fadeUp", "slideIn", "scaleIn", "popIn", "bounceIn", "blurIn", "wordReveal",
  "lineReveal", "charReveal", "typewriter", "countUp", "trackIn", "drawOutline", "wipeIn", "grow",
] as const;
export const EXIT_PRESETS = ["fadeOut", "slideOut", "scaleOut", "blurOut", "wordsUp", "wipeOut"] as const;
export const AMBIENT_PRESETS = ["kenBurns", "float", "pulse", "swing", "drift"] as const;
export const PRESETS = [...ENTER_PRESETS, ...EXIT_PRESETS, ...AMBIENT_PRESETS] as const;
export type PresetName = (typeof PRESETS)[number];

export const PRESET_COMMON = ["preset", "at", "duration", "ease", "stagger"] as const;
export const PRESET_PARAMS: Partial<Record<PresetName, readonly string[]>> = {
  fadeUp: ["distance"],
  slideIn: ["from", "distance"],
  scaleIn: ["from"],
  blurIn: ["amount"],
  charReveal: ["blur"],
  typewriter: ["cps", "caret"],
  countUp: ["from"],
  trackIn: ["from"],
  wipeIn: ["from"],
  slideOut: ["to"],
  scaleOut: ["to"],
  blurOut: ["amount"],
  wipeOut: ["to"],
  kenBurns: ["zoom", "pan"],
  float: ["amplitude", "period"],
  pulse: ["scale", "every", "ring"],
  swing: ["angle", "damping"],
  drift: ["x", "y", "scale"],
};
/** Presets restricted to particular element types. */
export const PRESET_TARGETS: Partial<Record<PresetName, readonly ElementType[]>> = {
  wordReveal: ["text"],
  lineReveal: ["text"],
  charReveal: ["text"],
  typewriter: ["text", "browser"],
  countUp: ["text", "badge"],
  trackIn: ["text"],
  wordsUp: ["text"],
  grow: ["chart"],
};
/** Presets whose `from`/`to` parameter names a side. */
export const SIDE_PRESETS = ["slideIn", "wipeIn", "slideOut", "wipeOut"] as const;

export const ANIM_PROPS = [
  "x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur", "width", "height",
  "radius", "color", "fill", "stroke", "letterSpacing", "fontWeight", "value",
] as const;

export const BEHAVIORS: Record<string, readonly string[]> = {
  scroll: ["target", "to", "at", "duration", "ease"],
  interaction: ["at", "cursor", "from", "steps", "pace"],
  camera: ["target", "ease", "keys"],
  focusCycle: ["targets", "at", "interval", "dim", "scale"],
  navigate: ["target", "to", "transition", "at"],
  follow: ["target", "path", "at", "duration", "ease", "rotate"],
};

export const TRANSITIONS: Record<string, readonly string[]> = {
  cut: [],
  crossfade: [],
  wipe: ["from", "angle", "bar", "barWidth"],
  slide: ["from", "push"],
  circle: ["origin"],
  zoom: ["direction"],
  matchCut: ["from", "to"],
};

export const EASE_FAMILIES = ["sine", "cubic", "quart", "expo", "back"] as const;
