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
