/**
 * Text markup: `*italic*`, `**bold**`, `[words]{color}` and `\n` line breaks.
 * Produces runs plus the plain text used for word, character and line counts.
 */

export interface Run {
  text: string;
  italic?: boolean;
  bold?: boolean;
  color?: string;
}

export interface ParsedText {
  runs: Run[];
  plain: string;
  words: number;
  /** Non-whitespace characters (the parts of charReveal and typewriter). */
  chars: number;
  /** Lines as written with \n. */
  lines: number;
  /** Words that count for reading time: pieces containing a letter or digit. */
  readingWords: number;
  /** [start, end) of the first number in `plain`, for countUp and number rolls. */
  number?: { start: number; end: number; value: number; decimals: number; separator: string };
}

export function parseMarkup(src: string): ParsedText {
  const runs: Run[] = [];
  let italic = false;
  let bold = false;
  let buf = "";
  const flush = (color?: string) => {
    if (buf) runs.push({ text: buf, ...(italic ? { italic } : {}), ...(bold ? { bold } : {}), ...(color ? { color } : {}) });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length && "*[]{}".includes(src[i + 1]!)) {
      buf += src[++i];
      continue;
    }
    if (c === "*" && src[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
      continue;
    }
    if (c === "*") {
      flush();
      italic = !italic;
      continue;
    }
    if (c === "[") {
      const close = src.indexOf("]{", i);
      const end = close >= 0 ? src.indexOf("}", close) : -1;
      if (close > i && end > close) {
        flush();
        // The coloured span may itself contain italic/bold markers.
        const inner = parseMarkup(src.slice(i + 1, close));
        const color = src.slice(close + 2, end).trim();
        for (const r of inner.runs) {
          runs.push({ ...r, ...(italic || r.italic ? { italic: true } : {}), ...(bold || r.bold ? { bold: true } : {}), color });
        }
        i = end;
        continue;
      }
    }
    buf += c;
  }
  flush();
  const plain = runs.map((r) => r.text).join("");
  return { runs, plain, ...countText(plain), ...findNumber(plain) };
}

export function countText(plain: string) {
  const pieces = plain.split(/\s+/).filter(Boolean);
  return {
    words: pieces.length,
    chars: [...plain].filter((c) => !/\s/.test(c)).length,
    lines: plain.split("\n").length,
    readingWords: pieces.filter((w) => /[\p{L}\p{N}]/u.test(w)).length,
  };
}

function findNumber(plain: string): { number?: NonNullable<ParsedText["number"]> } {
  const m = /\d{1,3}(?:([,.  ])\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/.exec(plain);
  if (!m) return {};
  const raw = m[0];
  const separator = m[1] ?? "";
  const cleaned = separator ? raw.split(separator).join("") : raw;
  const decMatch = /[.,](\d+)$/.exec(cleaned);
  const decimals = decMatch && (separator === "" || cleaned.indexOf(separator) < 0) ? decMatch[1]!.length : 0;
  const value = Number(cleaned.replace(",", "."));
  return { number: { start: m.index, end: m.index + raw.length, value, decimals, separator } };
}

/** Format a number the way it was written (same decimals and thousands separator). */
export function formatLike(value: number, n: { decimals: number; separator: string }): string {
  const fixed = Math.abs(value).toFixed(n.decimals);
  const [int, dec] = fixed.split(".");
  const grouped = n.separator ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, n.separator) : int!;
  const decSep = n.separator === "." ? "," : ".";
  return (value < 0 ? "-" : "") + grouped + (dec ? decSep + dec : "");
}
