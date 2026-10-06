import { describe, expect, it } from "vitest";
import { findText } from "./ocr.js";

const w = (text: string, x: number) => ({ text, bbox: { x0: x, y0: 10, x1: x + 50, y1: 30 } });

describe("finding text hotspots in OCR words", () => {
  const words = [w("Invoices", 0), w("Export", 300), w("PDF", 360), w("Clients", 600)];
  it("matches a phrase across words and unions their boxes", () => {
    expect(findText(words, "Export PDF")).toEqual([300, 10, 110, 20]);
  });
  it("tolerates small OCR misreads and punctuation", () => {
    expect(findText([w("Exp0rt", 300), w("PDF…", 360)], "export pdf")).toEqual([300, 10, 110, 20]);
  });
  it("returns null when the text isn't there", () => {
    expect(findText(words, "Download CSV")).toBeNull();
  });
});

describe("OCR tiles", () => {
  it("cover the image with overlapping half-size tiles", async () => {
    const { tiles } = await import("./ocr.js");
    const t = tiles(1440, 900);
    expect(t.every((r) => r.left >= 0 && r.top >= 0 && r.left + r.width <= 1440 && r.top + r.height <= 900)).toBe(true);
    // A small label anywhere (here a 140×40 button in the top-right corner) sits whole inside some tile.
    const inside = (x: number, y: number, w: number, h: number) => t.some((r) => x >= r.left && y >= r.top && x + w <= r.left + r.width && y + h <= r.top + r.height);
    expect(inside(1290, 10, 140, 40)).toBe(true);
    expect(inside(700, 430, 140, 40)).toBe(true);
  });
});
