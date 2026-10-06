import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fontKind, parseMetadata, plan, resolveFonts, SiniError, validateSpec } from "./index.js";

const META = `name: "Test Sans"
license: "OFL"
fonts {
  name: "Test Sans"
  style: "normal"
  weight: 400
  filename: "TestSans[wght].ttf"
}
fonts {
  name: "Test Sans"
  style: "italic"
  weight: 400
  filename: "TestSans-Italic[wght].ttf"
}
axes {
  tag: "wght"
  min_value: 200.0
  max_value: 800.0
}
`;
const TTF = new Uint8Array([0, 1, 0, 0, 9, 9, 9, 9]);

const spec = (assets: Record<string, unknown>, display = "Test Sans") => ({
  version: "0.4", video: { format: "16:9" }, assets, theme: { fonts: { display } },
  scenes: [{ id: "a", duration: 1, elements: [{ id: "t", type: "text", content: "Hi" }] }],
});

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const project = (s: unknown) => {
  const d = mkdtempSync(join(tmpdir(), "sini-fonts-"));
  dirs.push(d);
  writeFileSync(join(d, "video.json"), JSON.stringify(s));
  return d;
};

describe("font assets", () => {
  it("validate google, url and src forms", () => {
    expect(validateSpec(spec({ f: { type: "font", google: "Test Sans" } })).ok).toBe(true);
    expect(validateSpec(spec({ f: { type: "font", url: "https://x.test/a.woff2", family: "Test Sans", weight: "200 800" } })).ok).toBe(true);
    const codes = (a: unknown) => validateSpec(spec({ f: a })).issues.map((i) => i.code);
    expect(codes({ type: "font", url: "http://x.test/a.ttf", family: "Test Sans" })).toContain("bad-font");
    expect(codes({ type: "font", url: "https://x.test/a.ttf" })).toContain("missing-family");
    expect(codes({ type: "font", google: "Test Sans", src: "a.ttf", family: "Test Sans" })).toContain("font-source");
    expect(codes({ type: "font", src: "https://x.test/a.ttf", family: "Test Sans" })).toContain("remote-asset");
  });

  it("read Google Fonts metadata and recognise font files", () => {
    const m = parseMetadata(META);
    expect(m).toMatchObject({ name: "Test Sans", wght: [200, 800] });
    expect(m.fonts.map((f) => f.style)).toEqual(["normal", "italic"]);
    expect(fontKind(TTF)).toBe("ttf");
    expect(fontKind(new TextEncoder().encode("wOF2abcd"))).toBe("woff2");
    expect(fontKind(new TextEncoder().encode("<html>"))).toBeNull();
  });

  it("download a Google family once, pin it, and compile its faces", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("/ofl/testsans/METADATA.pb")) return new Response(META);
      if (url.includes("/ofl/testsans/TestSans")) return new Response(TTF);
      if (url.endsWith("OFL.txt")) return new Response("licence");
      return new Response("", { status: 404 });
    });
    const d = project(spec({ f: { type: "font", google: "Test Sans" } }));
    expect(plan(d).plan.report.map((r) => r.code)).toContain("font-not-downloaded");
    const r = await resolveFonts(d);
    expect(r.downloaded).toEqual([{ family: "Test Sans", files: 2, source: "Google Fonts: Test Sans" }]);
    expect(existsSync(join(d, "fonts/test-sans/OFL.txt"))).toBe(true);
    const lock = JSON.parse(readFileSync(join(d, "fonts/fonts.lock.json"), "utf8"));
    expect(lock["google:Test Sans"].faces.map((f: { weight: string }) => f.weight)).toEqual(["200 800", "200 800"]);
    const faces = plan(d).plan.fontAssets;
    expect(faces.map((f) => [f.family, f.weight, f.style])).toEqual([["Test Sans", "200 800", "normal"], ["Test Sans", "200 800", "italic"]]);
    const before = urls.length;
    expect((await resolveFonts(d)).downloaded).toEqual([]); // already there: no network
    expect(urls.length).toBe(before);
  });

  it("refuse a URL that isn't a font, and explain a missing network", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("down")) throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
      return new Response("<html>not a font</html>");
    });
    const notFont = project(spec({ f: { type: "font", url: "https://x.test/page", family: "Test Sans" } }));
    await expect(resolveFonts(notFont)).rejects.toThrow(/isn't a font file/);
    const offline = project(spec({ f: { type: "font", url: "https://down.test/a.ttf", family: "Test Sans" } }));
    await expect(resolveFonts(offline)).rejects.toThrow(SiniError);
    await expect(resolveFonts(offline)).rejects.toThrow(/network access/);
  });
});
