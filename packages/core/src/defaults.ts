/** Default values from DSL_REFERENCE.md, in one place so they can be tuned against real renders. */
import type { Personality, Role } from "@sini/schema";
import type { EaseSpec } from "./ease.js";

export const PERSONALITY: Record<Personality, { ease: EaseSpec; duration: number; stagger: number; textEnter: string }> = {
  editorial: { ease: "expo.out", duration: 0.75, stagger: 0.08, textEnter: "wordReveal" },
  snappy: { ease: "back.out", duration: 0.45, stagger: 0.04, textEnter: "popIn" },
  calm: { ease: "cubic.inOut", duration: 1.1, stagger: 0.12, textEnter: "fadeUp" },
  playful: { ease: "spring", duration: 0.6, stagger: 0.06, textEnter: "bounceIn" },
};

export interface RoleSpec {
  slot: "display" | "body" | "mono";
  size: number;
  deviceSize: number;
  lineHeight: number;
  weight: number;
  letterSpacing: number;
  uppercase: boolean;
}

export const ROLE_TABLE: Record<Role, RoleSpec> = {
  display: { slot: "display", size: 150, deviceSize: 44, lineHeight: 0.92, weight: 400, letterSpacing: 0, uppercase: false },
  title: { slot: "display", size: 104, deviceSize: 32, lineHeight: 0.95, weight: 400, letterSpacing: 0, uppercase: false },
  subtitle: { slot: "display", size: 64, deviceSize: 24, lineHeight: 1.05, weight: 400, letterSpacing: 0, uppercase: false },
  body: { slot: "body", size: 40, deviceSize: 17, lineHeight: 1.3, weight: 400, letterSpacing: 0, uppercase: false },
  caption: { slot: "body", size: 26, deviceSize: 13, lineHeight: 1.4, weight: 400, letterSpacing: 0, uppercase: false },
  label: { slot: "body", size: 22, deviceSize: 11, lineHeight: 1.2, weight: 600, letterSpacing: 0.08, uppercase: true },
  mono: { slot: "mono", size: 28, deviceSize: 14, lineHeight: 1.4, weight: 400, letterSpacing: 0, uppercase: false },
};

export const DEFAULT_FONTS = { display: "Inter Tight", body: "Inter Tight", mono: "JetBrains Mono" };

export const BUTTON = { size: 34, deviceSize: 16, weight: 600, heightEm: 2.4, padEm: 1.2, radiusOfHeight: 0.3 };

/** Text reading time: 0.5s + 0.3s per word. */
export const READING = { base: 0.5, perWord: 0.3 };
export const AUTO = { hold: 0.4, min: 1.5, holdMin: 0.2, holdMaxExtra: 3 };
export const DEFAULT_TRANSITION_DURATION = 0.55;
export const STATE_DURATION = 0.35;
export const FIRST_ENTER_AT = 0.3;
export const CHAIN_OVERLAP = 0.2;
export const TOP_LEVEL_TEXT_MARGIN = 72;

/** Interaction pace (DSL §9.4). */
export const PACE = {
  slow: { move: 0.7, press: 0.2, cps: 8 },
  normal: { move: 0.5, press: 0.18, cps: 12 },
  fast: { move: 0.35, press: 0.15, cps: 18 },
} as const;
export const NAVIGATE_DURATION = 0.45;
export const SCROLL_DURATION = 0.9;

/** Safe-zone margins on a 1080×1920 canvas: [top, right, bottom, left]. */
export const SAFE_ZONES = {
  reels: [220, 140, 420, 60],
  tiktok: [160, 160, 480, 60],
  shorts: [180, 140, 400, 60],
  none: [0, 0, 0, 0],
} as const;
