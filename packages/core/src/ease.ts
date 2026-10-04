/** Easing functions. Pure: also bundled into the browser runtime. */

export type EaseFn = (x: number) => number;

const c1 = 1.70158;
const c3 = c1 + 1;
const c2 = c1 * 1.525;

const families: Record<string, { in: EaseFn; out: EaseFn; inOut: EaseFn }> = {
  sine: {
    in: (x) => 1 - Math.cos((x * Math.PI) / 2),
    out: (x) => Math.sin((x * Math.PI) / 2),
    inOut: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  },
  cubic: {
    in: (x) => x * x * x,
    out: (x) => 1 - (1 - x) ** 3,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  },
  quart: {
    in: (x) => x ** 4,
    out: (x) => 1 - (1 - x) ** 4,
    inOut: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  },
  expo: {
    in: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
    out: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
    inOut: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  },
  back: {
    in: (x) => c3 * x * x * x - c1 * x * x,
    out: (x) => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2,
    inOut: (x) => (x < 0.5 ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2 : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2),
  },
};

function bounceOut(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** A damped spring that settles by x = 1. `bounce` 0 = no overshoot, 1 = very bouncy. */
export function spring(bounce = 0.3): EaseFn {
  const zeta = Math.max(0.15, 1 - bounce * 0.85);
  const omega = 11;
  if (zeta >= 1) return (x) => (x >= 1 ? 1 : 1 - (1 + omega * x) * Math.exp(-omega * x));
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return (x) => {
    if (x >= 1) return 1;
    return 1 - Math.exp(-zeta * omega * x) * (Math.cos(wd * x) + ((zeta * omega) / wd) * Math.sin(wd * x));
  };
}

export type EaseSpec = string | { spring: { bounce?: number } };

export function easeFn(spec: EaseSpec | undefined): EaseFn {
  if (spec === undefined || spec === "linear") return (x) => x;
  if (typeof spec === "object") return spring(spec.spring?.bounce);
  if (spec === "spring") return spring();
  if (spec === "bounce.out") return bounceOut;
  const [fam, kind] = spec.split(".") as [string, "in" | "out" | "inOut" | undefined];
  const f = families[fam];
  if (f && kind && f[kind]) return f[kind];
  return (x) => x;
}

export const EASE_NAMES = [
  "linear", "spring",
  ...Object.keys(families).flatMap((f) => [`${f}.in`, `${f}.out`, `${f}.inOut`]),
];
