/**
 * Looking at an image the way a designer would before using it: where the photographs are, where the
 * graphics (logos, icons) and the text blocks are, and how to crop each photo for the video's shape.
 * Runs in Chromium (it decodes every format and has a canvas); deterministic, no model involved.
 * Returns the regions in the image's own pixels and an annotated picture: a coordinate grid and numbered boxes.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { launchBrowser } from "./session.js";

export type RegionKind = "photo" | "graphic" | "text";
export interface ImageRegion {
  n: number;
  kind: RegionKind;
  box: [number, number, number, number];
  /** The largest crop of the requested aspect inside a photo, centred on its busiest part. */
  crop?: [number, number, number, number];
  /** For text blocks: what it says (start). */
  text?: string;
}
export interface ImageInspection { width: number; height: number; aspect: number; regions: ImageRegion[]; png: Buffer }

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

/**
 * @param textBoxes text lines found by OCR, [x, y, w, h] with their text, in image pixels
 * @param aspect width / height of the crops to suggest (the video's, e.g. 9/16)
 */
export async function inspectImage(file: string, textBoxes: { box: number[]; text: string }[], aspect: number): Promise<ImageInspection> {
  const url = `data:${MIME[extname(file).toLowerCase()] ?? "image/png"};base64,${readFileSync(file).toString("base64")}`;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.setContent("<!doctype html><body style='margin:0;background:#fff'></body>");
    const result = await page.evaluate(analyse, { url, textBoxes, aspect });
    // The annotated picture is drawn on a canvas in the page; screenshot just that canvas.
    const png = await page.locator("canvas#out").screenshot({ type: "png" });
    return { ...result, aspect, png };
  } finally {
    await browser.close();
  }
}

/** Runs in the page. Plain JS only (no imports, no closures over Node). */
async function analyse({ url, textBoxes, aspect }: { url: string; textBoxes: { box: number[]; text: string }[]; aspect: number }) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  // ---- measure at full resolution: photos are never perfectly flat; web UI mostly is ----
  const work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const wc = work.getContext("2d", { willReadFrequently: true })!;
  wc.drawImage(img, 0, 0);
  const px = wc.getImageData(0, 0, W, H).data;
  const C = Math.max(8, Math.ceil(Math.max(W, H) / 320));
  const cols = Math.ceil(W / C);
  const rows = Math.ceil(H / C);
  const rgb = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
  };
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
  };
  // More than 3 distinct colours along a run of pixels: not flat UI.
  const flatRun = (pts: (i: number) => number, n: number) => {
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      seen.add(pts(i));
      if (seen.size > 3) return false;
    }
    return true;
  };

  // Lines that look like real text: wide, about one line tall, with a word in them. OCR also "reads"
  // photographs, producing tall boxes of nonsense; those mustn't hide the photo.
  const heights = textBoxes.map((t) => t.box[3]!).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)] ?? 0;
  textBoxes = textBoxes.filter((t) => {
    const [, , bw, bh] = t.box as [number, number, number, number];
    return bh <= Math.max(3 * typical, 60) && bw >= bh * 1.2 && /\p{L}{3,}/u.test(t.text);
  });
  // Cells covered by text lines (OCR) are text, not picture.
  const textCell = new Uint8Array(cols * rows);
  for (const t of textBoxes) {
    const [x, y, bw, bh] = t.box as [number, number, number, number];
    for (let cy = Math.floor(y / C); cy <= Math.floor((y + bh) / C) && cy < rows; cy++) {
      for (let cx = Math.floor(x / C); cx <= Math.floor((x + bw) / C) && cx < cols; cx++) textCell[cy * cols + cx] = 1;
    }
  }
  const kind = new Uint8Array(cols * rows); // 0 flat, 1 detail
  const busy = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x0 = cx * C;
      const y0 = cy * C;
      const cw = Math.min(C, W - x0);
      const ch = Math.min(C, H - y0);
      let s = 0;
      let s2 = 0;
      for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) {
        const l = lum(x, y);
        s += l;
        s2 += l * l;
      }
      const n = cw * ch;
      busy[cy * cols + cx] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
      if (!textCell[cy * cols + cx] && !flatRun((i) => rgb(x0 + (i % cw), y0 + Math.floor(i / cw)), n)) kind[cy * cols + cx] = 1;
    }
  }

  // ---- connected regions of detail cells (after closing small gaps, e.g. a label on a photo) ----
  const components = (close: boolean) => {
    let grid = Uint8Array.from(kind);
    if (close) {
      const morph = (src: Uint8Array, dilate: boolean) => {
        const out = new Uint8Array(src.length);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          let v = dilate ? 0 : 1;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            const on = yy >= 0 && yy < rows && xx >= 0 && xx < cols ? src[yy * cols + xx]! : dilate ? 0 : 1;
            v = dilate ? v | on : v & on;
          }
          out[y * cols + x] = v;
        }
        return out;
      };
      grid = morph(morph(grid, true), false);
    }
    const seen = new Uint8Array(grid.length);
    const out: { x0: number; y0: number; x1: number; y1: number; cells: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      const b = { x0: cols, y0: rows, x1: 0, y1: 0, cells: 0 };
      while (stack.length) {
        const j = stack.pop()!;
        const x = j % cols;
        const y = (j - x) / cols;
        b.cells++;
        b.x0 = Math.min(b.x0, x);
        b.y0 = Math.min(b.y0, y);
        b.x1 = Math.max(b.x1, x);
        b.y1 = Math.max(b.y1, y);
        for (const k of [j - 1, j + 1, j - cols, j + cols]) {
          if (k < 0 || k >= grid.length || seen[k] || !grid[k]) continue;
          if ((k === j - 1 && x === 0) || (k === j + 1 && x === cols - 1)) continue;
          seen[k] = 1;
          stack.push(k);
        }
      }
      out.push(b);
    }
    return out;
  };
  const toImage = (b: { x0: number; y0: number; x1: number; y1: number }): [number, number, number, number] => {
    const x0 = b.x0 * C;
    const y0 = b.y0 * C;
    return [x0, y0, Math.min(W, (b.x1 + 1) * C) - x0, Math.min(H, (b.y1 + 1) * C) - y0];
  };
  // Snap a photo's edges to where the picture really starts: the first rows and columns that aren't flat.
  const snap = (r: [number, number, number, number]): [number, number, number, number] => {
    let [x0, y0] = r;
    let x1 = r[0] + r[2] - 1;
    let y1 = r[1] + r[3] - 1;
    const rowFlat = (y: number) => flatRun((i) => rgb(x0 + i, y), x1 - x0 + 1);
    const colFlat = (x: number) => flatRun((i) => rgb(x, y0 + i), y1 - y0 + 1);
    for (let k = 0; k < C && y0 > 0 && !rowFlat(y0 - 1); k++) y0--;
    while (y0 < y1 && rowFlat(y0)) y0++;
    for (let k = 0; k < C && y1 < H - 1 && !rowFlat(y1 + 1); k++) y1++;
    while (y1 > y0 && rowFlat(y1)) y1--;
    for (let k = 0; k < C && x0 > 0 && !colFlat(x0 - 1); k++) x0--;
    while (x0 < x1 && colFlat(x0)) x0++;
    for (let k = 0; k < C && x1 < W - 1 && !colFlat(x1 + 1); k++) x1++;
    while (x1 > x0 && colFlat(x1)) x1--;
    return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  };
  const area = W * H;
  const all = components(true);
  const big = (b: { x0: number; y0: number; x1: number; y1: number }) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * C * C;
  // Split a region along gutters (flat full-height columns or full-width rows), so a row of product
  // cards becomes one region per photo; then snap each piece and keep the ones big enough to use.
  const split = (r: [number, number, number, number], depth = 0): [number, number, number, number][] => {
    const [x, y, rw, rh] = r;
    if (depth > 6) return [r];
    const flatCol = (cx: number) => flatRun((i) => rgb(cx, y + i), rh);
    const flatRow = (cy: number) => flatRun((i) => rgb(x + i, cy), rw);
    const cut = (len: number, flat: (k: number) => boolean): [number, number] | null => {
      for (let k = 1; k < len - 1; k++) {
        if (!flat(k)) continue;
        let e = k;
        while (e + 1 < len - 1 && flat(e + 1)) e++;
        if (e - k + 1 >= 4) return [k, e];
        k = e;
      }
      return null;
    };
    const c = cut(rw, (k) => flatCol(x + k));
    if (c) return [...split(snap([x, y, c[0], rh]), depth + 1), ...split(snap([x + c[1] + 1, y, rw - c[1] - 1, rh]), depth + 1)];
    const rr = cut(rh, (k) => flatRow(y + k));
    if (rr) return [...split(snap([x, y, rw, rr[0]]), depth + 1), ...split(snap([x, y + rr[1] + 1, rw, rh - rr[1] - 1]), depth + 1)];
    return [r];
  };
  const photos = all
    .filter((b) => big(b) >= area * 0.012 && b.cells / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)) >= 0.6)
    .flatMap((b) => split(snap(toImage(b))))
    .filter((r) => r[2] * r[3] >= area * 0.012 && r[2] >= 4 * C && r[3] >= 4 * C);
  const inside = (a: number[], b: number[]) => a[0]! >= b[0]! - 2 && a[1]! >= b[1]! - 2 && a[0]! + a[2]! <= b[0]! + b[2]! + 2 && a[1]! + a[3]! <= b[1]! + b[3]! + 2;
  const graphics = components(false)
    .map((b) => toImage(b))
    .filter((r) => r[2] * r[3] >= area * 0.0006 && r[2] * r[3] <= area * 0.05 && r[2] >= 2 * C && r[3] >= 2 * C && !photos.some((p) => inside(r, p)));

  // Text lines grouped into blocks: close below each other and overlapping horizontally.
  const lines = [...textBoxes].sort((a, b) => a.box[1]! - b.box[1]!);
  const blocks: { box: number[]; text: string[] }[] = [];
  for (const l of lines) {
    const [x, y, bw, bh] = l.box as [number, number, number, number];
    const b = blocks.find((k) => {
      const [kx, ky, kw, kh] = k.box as [number, number, number, number];
      return y - (ky + kh) < bh * 1.2 && y >= ky && x < kx + kw && x + bw > kx;
    });
    if (b) {
      const [kx, ky, kw, kh] = b.box as [number, number, number, number];
      const nx = Math.min(kx, x);
      const ny = Math.min(ky, y);
      b.box = [nx, ny, Math.max(kx + kw, x + bw) - nx, Math.max(ky + kh, y + bh) - ny];
      b.text.push(l.text);
    } else blocks.push({ box: [x, y, bw, bh], text: [l.text] });
  }

  // The largest crop of the aspect inside a photo, centred on its most detailed part.
  const cropFor = (r: [number, number, number, number]): [number, number, number, number] => {
    let cw = r[2];
    let ch = cw / aspect;
    if (ch > r[3]) {
      ch = r[3];
      cw = ch * aspect;
    }
    // Centre of detail (busy cells weighted) inside the region.
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let cy = Math.floor(r[1] / C); cy <= Math.floor((r[1] + r[3]) / C) && cy < rows; cy++) {
      for (let cx = Math.floor(r[0] / C); cx <= Math.floor((r[0] + r[2]) / C) && cx < cols; cx++) {
        const v = busy[cy * cols + cx]!;
        sx += v * (cx + 0.5) * C;
        sy += v * (cy + 0.5) * C;
        sw += v;
      }
    }
    const fx = sw ? sx / sw : r[0] + r[2] / 2;
    const fy = sw ? sy / sw : r[1] + r[3] / 2;
    const x = Math.min(Math.max(r[0], fx - cw / 2), r[0] + r[2] - cw);
    const y = Math.min(Math.max(r[1], fy - ch / 2), r[1] + r[3] - ch);
    return [Math.round(x), Math.round(y), Math.round(cw), Math.round(ch)];
  };

  const regions: { n: number; kind: "photo" | "graphic" | "text"; box: [number, number, number, number]; crop?: [number, number, number, number]; text?: string }[] = [];
  const ordered = (a: number[], b: number[]) => a[1]! - b[1]! || a[0]! - b[0]!;
  for (const p of photos.sort(ordered)) regions.push({ n: 0, kind: "photo", box: p, crop: cropFor(p) });
  for (const g of graphics.sort(ordered)) regions.push({ n: 0, kind: "graphic", box: g });
  for (const b of blocks.sort((a, c) => ordered(a.box, c.box))) {
    const t = b.text.join(" ");
    // OCR "reads" stray letters in photographs; real text set over a photo has at least two words.
    if (photos.some((p) => inside(b.box, p)) && !/\p{L}{3,}.*\s.*\p{L}{3,}/u.test(t)) continue;
    regions.push({ n: 0, kind: "text", box: b.box.map(Math.round) as [number, number, number, number], text: t.length > 60 ? `${t.slice(0, 57)}…` : t });
  }
  regions.forEach((r, i) => (r.n = i + 1));

  // ---- the annotated picture ----
  const scale = Math.min(1, 1100 / W, 1400 / H);
  const out = document.createElement("canvas");
  out.id = "out";
  out.width = Math.round(W * scale);
  out.height = Math.round(H * scale);
  out.style.display = "block";
  document.body.appendChild(out);
  const g = out.getContext("2d")!;
  g.drawImage(img, 0, 0, out.width, out.height);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(0, 0, out.width, out.height);
  // Grid every 100 image px (200 or 500 for big images), labelled along the top and left.
  const step = Math.max(W, H) > 3000 ? 500 : Math.max(W, H) > 1600 ? 200 : 100;
  g.lineWidth = 1;
  g.font = "11px sans-serif";
  for (let x = step; x < W; x += step) {
    g.strokeStyle = x % (step * 5) === 0 ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.18)";
    g.beginPath();
    g.moveTo(x * scale + 0.5, 0);
    g.lineTo(x * scale + 0.5, out.height);
    g.stroke();
    g.fillStyle = "#000";
    g.fillText(String(x), x * scale + 2, 11);
  }
  for (let y = step; y < H; y += step) {
    g.strokeStyle = y % (step * 5) === 0 ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.18)";
    g.beginPath();
    g.moveTo(0, y * scale + 0.5);
    g.lineTo(out.width, y * scale + 0.5);
    g.stroke();
    g.fillStyle = "#000";
    g.fillText(String(y), 2, y * scale - 2);
  }
  const colour = { photo: "#e0218a", graphic: "#f08c00", text: "#1c7ed6" } as const;
  for (const r of regions) {
    const [x, y, bw, bh] = r.box;
    g.strokeStyle = colour[r.kind];
    g.lineWidth = r.kind === "photo" ? 3 : 2;
    g.setLineDash([]);
    g.strokeRect(x * scale, y * scale, bw * scale, bh * scale);
    if (r.crop) {
      g.setLineDash([6, 4]);
      g.lineWidth = 2;
      g.strokeRect(r.crop[0] * scale, r.crop[1] * scale, r.crop[2] * scale, r.crop[3] * scale);
      g.setLineDash([]);
    }
    const label = `${r.n} ${r.kind}`;
    g.font = "bold 13px sans-serif";
    const lw = g.measureText(label).width + 10;
    g.fillStyle = colour[r.kind];
    g.fillRect(x * scale, y * scale, lw, 18);
    g.fillStyle = "#fff";
    g.fillText(label, x * scale + 5, y * scale + 13);
  }
  return { width: W, height: H, regions };
}
