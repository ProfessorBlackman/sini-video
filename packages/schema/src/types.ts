/**
 * TypeScript shapes of a Sini DSL v0.4 document.
 *
 * These describe a document that has passed `validate()`. They are deliberately
 * close to the JSON: the engine (`@sini/core`) resolves defaults, not this package.
 */
import type { Anchor, ElementType, Personality, PresetName, Role, Side } from "./vocab.js";

export type Colour = string | Gradient;
export interface Gradient {
  linear?: string[];
  radial?: string[];
  angle?: number;
}

/** Seconds, or a time expression such as `"h1.enter.end+0.2"`. */
export type TimeValue = number | string;

export interface Spec {
  version: string;
  video: VideoConfig;
  theme?: Theme;
  assets?: Record<string, AssetDecl>;
  components?: Record<string, ComponentDef>;
  scenes: Scene[];
  notes?: string[];
  /** Lint warnings judged wrong for this video, each with a reason. */
  lint?: { accept?: { code: string; element?: string; reason: string }[] };
}

export interface VideoConfig {
  format?: "9:16" | "1:1" | "4:5" | "16:9";
  width?: number;
  height?: number;
  fps?: number;
  background?: Colour;
  seed?: number;
  targetDuration?: number;
  safeZone?: "reels" | "tiktok" | "shorts" | "none";
  end?: "hold" | "cut" | { type: "fade"; duration?: number; color?: Colour };
}

export interface RoleOverride {
  size?: number;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface Theme {
  palette?: Record<string, string>;
  fonts?: { display?: string; body?: string; mono?: string };
  roles?: Partial<Record<Role, RoleOverride>>;
  motion?: Personality | { base: Personality; ease?: Ease; duration?: number; stagger?: number };
  transition?: TransitionSpec;
  texture?: { grain?: number; vignette?: number };
}

export type AssetDecl =
  | string
  | {
      type: "image" | "svg" | "font" | "placeholder";
      src?: string;
      family?: string;
      hint?: string;
      color?: Colour;
      fallback?: AssetDecl;
      hotspots?: Record<string, [number, number, number, number] | { text: string }>;
    };

export interface ComponentDef {
  params?: Record<string, unknown>;
  root: Element;
}

export interface SceneBackgroundImage {
  asset: string;
  fit?: "cover" | "contain";
  overlay?: Colour;
  blur?: number;
}

export interface Scene {
  id: string;
  duration: number | "auto";
  background?: Colour | SceneBackgroundImage;
  transition?: TransitionSpec;
  cues?: Record<string, TimeValue>;
  elements: Element[];
  timeline?: TimelineItem[];
}

export type TransitionSpec =
  | "theme"
  | "cut"
  | "crossfade"
  | "wipe"
  | "slide"
  | "circle"
  | "zoom"
  | {
      type: "cut" | "crossfade" | "wipe" | "slide" | "circle" | "zoom" | "matchCut";
      duration?: number;
      ease?: Ease;
      from?: string;
      angle?: number;
      bar?: Colour | null;
      barWidth?: number;
      push?: boolean;
      origin?: string;
      direction?: "in" | "out";
      to?: string;
    };

export type Ease = string | { spring: { bounce?: number } };

export interface Style {
  opacity?: number;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  origin?: Anchor;
  radius?: number;
  fill?: Colour;
  stroke?: Colour;
  strokeWidth?: number;
  shadow?: "none" | "soft" | "deep";
  blur?: number;
  blend?: "normal" | "multiply" | "screen" | "overlay";
  padding?: number | number[];
  color?: Colour;
  align?: "left" | "center" | "right";
  size?: number;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  italic?: boolean;
}

export type Size = number | string;

export interface Layout {
  anchor?: Anchor;
  inset?: number | [number, number];
  offset?: [number, number];
  below?: string;
  above?: string;
  leftOf?: string;
  rightOf?: string;
  gap?: number;
  align?: "start" | "center" | "end";
  pin?: { to: string; point: Anchor; inside?: number };
  x?: number;
  y?: number;
  width?: Size;
  height?: Size;
  maxWidth?: Size;
  aspect?: string;
  grow?: number;
}

export interface PresetObject {
  preset: PresetName;
  at?: TimeValue;
  duration?: number;
  ease?: Ease;
  stagger?: number;
  [param: string]: unknown;
}
export type PresetRef = PresetName | PresetObject;

export interface ElementBase {
  id: string;
  type: ElementType;
  layout?: Layout;
  style?: Style;
  enter?: PresetRef | "none";
  exit?: PresetRef;
  states?: Record<string, StateDef>;
  z?: number;
  // type-specific keys (see TYPE_KEYS); kept open here
  [key: string]: unknown;
}

export interface ComponentInstance {
  id: string;
  use: string;
  with?: Record<string, unknown>;
  layout?: Layout;
  style?: Style;
  enter?: PresetRef | "none";
  exit?: PresetRef;
  states?: Record<string, StateDef>;
  z?: number;
}

export type Element = ElementBase | ComponentInstance;

export interface StateDef {
  style?: Style;
  content?: string;
  label?: string;
  variant?: string;
  value?: number;
  icon?: string;
  title?: string;
  body?: string;
}

export type TimelineItem =
  | (PresetObject & { id?: string; target: string | string[] })
  | {
      id?: string;
      target: string | string[];
      at?: TimeValue;
      duration?: number;
      ease?: Ease;
      animate: Record<string, unknown>;
      stagger?: number;
      repeat?: number;
      yoyo?: boolean;
    }
  | { id?: string; target: string; state: string; at?: TimeValue; duration?: number }
  | ({ id?: string; behavior: string; at?: TimeValue } & Record<string, unknown>);

export type { Anchor, ElementType, Personality, PresetName, Role, Side };
