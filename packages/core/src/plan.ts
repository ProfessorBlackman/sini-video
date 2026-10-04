/**
 * The compiled plan: everything the renderer needs, with all defaults resolved and
 * all times absolute (seconds from the start of the video). JSON-serialisable, so it
 * can be handed to the in-browser runtime as-is.
 */
import type { EaseSpec } from "./ease.js";
import type { Run } from "./markup.js";

export interface Plan {
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  seed: number;
  grain: number;
  vignette: number;
  safeZone: "reels" | "tiktok" | "shorts" | "none";
  end: { type: "hold" | "cut" | "fade"; start: number; duration: number; color: string };
  fonts: { display: string; body: string; mono: string };
  fontAssets: { family: string; src: string }[];
  scenes: PlanScene[];
  tracks: Track[];
  /** Notes from compilation (e.g. targetDuration not reachable, unsupported features). */
  report: PlanIssue[];
  /** How targetDuration was applied. */
  timing: { target?: number; natural: number; final: number };
}

export interface PlanIssue {
  level: "error" | "warning";
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export type ImageSource =
  | { kind: "file"; src: string }
  | { kind: "placeholder"; color: string; hint?: string; seed: number };

export interface PlanTransition {
  type: "cut" | "crossfade" | "wipe" | "slide" | "circle" | "zoom" | "matchCut";
  duration: number;
  ease: EaseSpec;
  from: "left" | "right" | "up" | "down";
  angle: number;
  bar: string | null;
  barWidth: number;
  push: boolean;
  origin: string;
  direction: "in" | "out";
  /** matchCut: the outgoing element that opens into the incoming scene, and its target ("background" or an element). */
  matchFrom?: string;
  matchTo?: string;
}

export interface PlanScene {
  id: string;
  index: number;
  start: number;
  duration: number;
  /** When the scene stops being drawn: end + the next scene's transition. */
  visibleUntil: number;
  background:
    | { kind: "paint"; css: string }
    | { kind: "image"; image: ImageSource; fit: "cover" | "contain"; overlay?: string; blur: number };
  transition: PlanTransition | null;
  elements: PlanElement[];
}

export interface Font {
  family: string;
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
}

export interface PlanStyle {
  opacity: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  origin: string;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow: "none" | "soft" | "deep";
  blur: number;
  blend: string;
  padding?: [number, number, number, number];
}

export interface PlanText {
  runs: Run[];
  plain: string;
  words: number;
  chars: number;
  lines: number;
  readingWords: number;
  number?: { start: number; end: number; value: number; decimals: number; separator: string };
  /** How the runtime must split the text so parts can animate. */
  split: "none" | "words" | "chars";
  fit: "none" | "shrink";
  maxLines?: number;
}

export interface PlanElement {
  /** Unique reference: the id, or `instance/local` inside components. */
  ref: string;
  type: string;
  sceneId: string;
  /** True inside a device: sizes are in the device's logical pixels. */
  inDevice: boolean;
  layout: Record<string, unknown>;
  style: PlanStyle;
  font?: Font;
  text?: PlanText;
  /** Type-specific data (image source, button label, browser url, stack direction, …). */
  props: Record<string, unknown>;
  states: Record<string, PlanState>;
  children: PlanElement[];
  /** Device pages: `children` for a single page, or per-screen pages. */
  pages?: { name: string; background: string; padding: [number, number, number, number]; gap: number; children: PlanElement[] }[];
  overlay?: PlanElement[];
  /** Absolute time the element first appears (its earliest enter); null = from scene start. */
  appearAt: number | null;
  /** Absolute time it disappears (end of its exit); null = until the scene ends. */
  hideAt: number | null;
  z: number;
}

export interface PlanState {
  style: Partial<Record<string, unknown>>;
  content?: string;
  label?: string;
  variant?: string;
  value?: number;
  icon?: string;
  title?: string;
  body?: string;
}

/** Which part of a split text a track drives. */
export interface PartSelector {
  kind: "word" | "char" | "line" | "bar";
  index: number;
}

interface TrackBase {
  ref: string;
  t0: number;
  t1: number;
  /** For describe_at: what produced the track. */
  label: string;
}

export interface TweenTrack extends TrackBase {
  kind: "tween";
  prop: string;
  part?: PartSelector;
  /** Keyframe values, evenly spaced. `null` first value = "from the current value". */
  values: (number | string | null)[];
  ease: EaseSpec;
  additive: boolean;
  /** Apply the first value before t0 (enter presets). */
  fillBackward: boolean;
  repeat: number;
  yoyo: boolean;
}

export interface OscTrack extends TrackBase {
  kind: "float";
  amplitude: number;
  period: number;
}
export interface PulseTrack extends TrackBase {
  kind: "pulse";
  scale: number;
  every: number;
  ring: boolean;
}
export interface SwingTrack extends TrackBase {
  kind: "swing";
  angle: number;
  damping: number;
}
export interface TypeTrack extends TrackBase {
  kind: "type";
  field: "text" | "url";
  chars: number;
  caret: boolean;
}
export interface CountTrack extends TrackBase {
  kind: "count";
  from: number;
  to: number;
  ease: EaseSpec;
}
export interface ContentTrack extends TrackBase {
  kind: "content";
  field: "content" | "label" | "title" | "body";
  from: string;
  to: string;
  ease: EaseSpec;
}
export interface StepTrack extends TrackBase {
  kind: "step";
  prop: string;
  value: string;
}

/** A cursor or finger performing interaction steps. Targets are resolved to points by the renderer. */
export interface CursorTrack extends TrackBase {
  kind: "cursor";
  sceneId: string;
  cursor: "arrow" | "pointer" | "touch";
  /** Canvas anchor where the cursor first appears. */
  from: string;
  steps: { target: string | null; start: number; arrive: number; release: number; end: number }[];
}
/** A device switching screens (navigate behavior, or an interaction step's navigate). */
export interface ScreenTrack extends TrackBase {
  kind: "screen";
  from: string;
  to: string;
  transition: "push" | "fade" | "none";
}
/** Scrolling a device's current page. The renderer resolves `to` against real layout. */
export interface ScrollTrack extends TrackBase {
  kind: "scroll";
  /** Logical px, "top", "bottom", or an element ref inside the device. */
  to: number | string;
  ease: EaseSpec;
}
/** A camera moving and zooming a group. Focus targets are resolved to points by the renderer. */
export interface CameraTrack extends TrackBase {
  kind: "camera";
  keys: { t: number; focus: string; zoom: number }[];
  ease: EaseSpec;
}
/** Text typed into a text element by an interaction `type` step. */
export interface TypedTrack extends TrackBase {
  kind: "typed";
  text: string;
}

export type Track = TweenTrack | OscTrack | PulseTrack | SwingTrack | TypeTrack | CountTrack | ContentTrack | StepTrack | CursorTrack | TypedTrack | ScreenTrack | ScrollTrack | CameraTrack;
