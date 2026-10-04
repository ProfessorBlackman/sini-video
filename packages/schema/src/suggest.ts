/** "Did you mean …?" suggestions for unknown vocabulary. */

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(up + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/** The closest candidate, if it is plausibly what was meant. */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
  const needle = input.toLowerCase();
  let best: string | undefined;
  let bestScore = Infinity;
  for (const c of candidates) {
    const hay = c.toLowerCase();
    if (hay === needle) return c;
    // Treat containment ("bottom-center" ⊃ "bottom") as a strong signal.
    // Prefer a shared beginning: "bottom-center" more likely meant "bottom" than "center".
    const prefix = hay.startsWith(needle) || needle.startsWith(hay);
    const score = prefix ? 0.5 : hay.includes(needle) || needle.includes(hay) ? 1 : distance(needle, hay);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  const limit = Math.max(2, Math.floor(input.length / 3));
  return bestScore <= limit ? best : undefined;
}

export function didYouMean(input: unknown, candidates: Iterable<string>): string | undefined {
  if (typeof input !== "string") return undefined;
  const c = closest(input, candidates);
  return c ? `Did you mean '${c}'?` : undefined;
}
