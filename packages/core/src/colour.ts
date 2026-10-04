/** Colour tokens, parsing, CSS output and interpolation. Pure: also runs in the browser runtime. */

export type RGBA = [number, number, number, number];

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function parseHex(hex: string): RGBA | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

export function parseCss(css: string): RGBA | null {
  if (css === "transparent") return [0, 0, 0, 0];
  const hex = parseHex(css);
  if (hex) return hex;
  const m = /^rgba?\(([^)]+)\)$/.exec(css);
  if (!m) return null;
  const p = m[1]!.split(",").map((x) => Number(x.trim()));
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
}

export function toCss([r, g, b, a]: RGBA): string {
  const al = Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000;
  return al === 1 ? `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})` : `rgba(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)}, ${al})`;
}

export function mix(a: RGBA, b: RGBA, p: number): RGBA {
  return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p, a[3] + (b[3] - a[3]) * p];
}

/** Resolve a DSL colour string (token, token/alpha, hex) to CSS. Unknown values pass through. */
export function resolveColour(value: string, palette: Record<string, string>): string {
  const [tok, alpha] = value.split("/");
  const base = palette[tok!] ?? tok!;
  const rgba = parseCss(base);
  if (!rgba) return value;
  if (alpha !== undefined) rgba[3] = rgba[3] * Number(alpha);
  return toCss(rgba);
}

export interface GradientSpec {
  linear?: string[];
  radial?: string[];
  angle?: number;
}

/** Resolve a colour or gradient to a CSS `background` value. */
export function resolvePaint(value: unknown, palette: Record<string, string>): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return resolveColour(value, palette);
  const g = value as GradientSpec;
  if (g.linear) return `linear-gradient(${g.angle ?? 180}deg, ${g.linear.map((c) => resolveColour(c, palette)).join(", ")})`;
  if (g.radial) return `radial-gradient(ellipse at center, ${g.radial.map((c) => resolveColour(c, palette)).join(", ")})`;
  return undefined;
}

/** WCAG relative luminance and contrast ratio. */
export function luminance([r, g, b]: RGBA): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent colour over an opaque one. */
export function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}
