/** Path geometry for `path` elements: point lists to SVG path data. */

type Pt = [number, number];

const f = (v: number) => String(Math.round(v * 100) / 100);

/**
 * SVG path data through `points`. Straight segments by default; with `smooth`, a Catmull-Rom
 * spline through every point (as cubic Béziers), which is how a hand-drawn curve is usually meant.
 */
export function pointsToPath(points: Pt[], smooth = false, closed = false): string {
  if (points.length < 2) return "";
  const p = points;
  if (!smooth) return `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}${closed ? " Z" : ""}`;
  const n = p.length;
  const at = (i: number): Pt => (closed ? p[(i + n) % n]! : p[Math.max(0, Math.min(n - 1, i))]!);
  const segs = closed ? n : n - 1;
  let d = `M${f(p[0]![0])} ${f(p[0]![1])}`;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    // Catmull-Rom (tension 0.5) to Bézier: control points a sixth of the neighbour span away.
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}
