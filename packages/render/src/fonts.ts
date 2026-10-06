import { fileURLToPath } from "node:url";

const FONT_DIR = fileURLToPath(new URL("../fonts/", import.meta.url));

interface Face { file: string; weight: string; style: "normal" | "italic" }

/** Bundled families (SIL OFL). Variable fonts cover their whole weight range. */
export const BUNDLED: Record<string, Face[]> = {
  "Inter Tight": [
    { file: "inter-tight/InterTight-Variable.ttf", weight: "100 900", style: "normal" },
    { file: "inter-tight/InterTight-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  "Instrument Serif": [
    { file: "instrument-serif/InstrumentSerif-Regular.ttf", weight: "400", style: "normal" },
    { file: "instrument-serif/InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
  ],
  "Bricolage Grotesque": [{ file: "bricolage-grotesque/BricolageGrotesque-Variable.ttf", weight: "200 800", style: "normal" }],
  Fraunces: [
    { file: "fraunces/Fraunces-Variable.ttf", weight: "100 900", style: "normal" },
    { file: "fraunces/Fraunces-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  "DM Serif Display": [
    { file: "dm-serif-display/DMSerifDisplay-Regular.ttf", weight: "400", style: "normal" },
    { file: "dm-serif-display/DMSerifDisplay-Italic.ttf", weight: "400", style: "italic" },
  ],
  "Space Grotesk": [{ file: "space-grotesk/SpaceGrotesk-Variable.ttf", weight: "300 700", style: "normal" }],
  Manrope: [{ file: "manrope/Manrope-Variable.ttf", weight: "200 800", style: "normal" }],
  "JetBrains Mono": [
    { file: "jetbrains-mono/JetBrainsMono-Variable.ttf", weight: "100 800", style: "normal" },
    { file: "jetbrains-mono/JetBrainsMono-Italic-Variable.ttf", weight: "100 800", style: "italic" },
  ],
};

export function fontFile(family: string, style: "normal" | "italic" = "normal"): string | undefined {
  const faces = BUNDLED[family];
  const face = faces?.find((f) => f.style === style) ?? faces?.[0];
  return face ? FONT_DIR + face.file : undefined;
}

const url = (path: string) => `file://${encodeURI(path)}`;

export function fontFaceCss(extra: { family: string; src: string; weight?: string; style?: string }[] = []): string {
  const rules: string[] = [];
  for (const [family, faces] of Object.entries(BUNDLED)) {
    for (const f of faces) {
      rules.push(`@font-face{font-family:"${family}";src:url("${url(FONT_DIR + f.file)}");font-weight:${f.weight};font-style:${f.style};font-display:block}`);
    }
  }
  for (const f of extra) rules.push(`@font-face{font-family:"${f.family}";src:url("${url(f.src)}");${f.weight ? `font-weight:${f.weight};` : ""}${f.style ? `font-style:${f.style};` : ""}font-display:block}`);
  return rules.join("\n");
}
