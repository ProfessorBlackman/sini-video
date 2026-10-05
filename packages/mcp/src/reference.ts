/**
 * The DSL reference in pieces. The whole file is ~54KB, more than many MCP clients show in one
 * tool result, so get_reference returns the essentials plus an index, and sections on request.
 */

interface Section {
  /** "7" or "7.3" */
  num: string;
  title: string;
  /** Text of the section, including its heading (and, for a top-level section, its subsections). */
  text: string;
}

/** Sections every author needs before writing a first spec; the rest come on request. */
const ESSENTIAL = ["1", "2", "3", "4", "5", "6", "8", "10", "11", "12", "14", "15"];

/** Names an author might ask for instead of a number. */
const ALIASES: Record<string, string> = {
  rules: "1", recipes: "15", patterns: "15", structure: "2", video: "3", theme: "4", colours: "4.1", colors: "4.1", fonts: "4.2", motion: "4.3",
  assets: "5", hotspots: "5", scenes: "6", elements: "7", layout: "7.2", types: "7.3", "element types": "7.3",
  components: "7.4", time: "8", timing: "8", animation: "9", easing: "9.1", presets: "9.2", timeline: "9.3",
  behaviors: "9.4", behaviours: "9.4", states: "9.5", transitions: "10", patches: "11", editing: "11",
  tools: "12", lint: "12", errors: "12", examples: "13", checklist: "14",
};

export function parseReference(md: string): { preamble: string; sections: Section[] } {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let preamble: string[] = [];
  let top: { num: string; title: string; start: number } | undefined;
  let sub: { num: string; title: string; start: number } | undefined;
  let inCode = false;
  const close = (s: { num: string; title: string; start: number } | undefined, end: number) => {
    if (s) sections.push({ num: s.num, title: s.title, text: lines.slice(s.start, end).join("\n").trim() });
  };
  lines.forEach((line, i) => {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) return;
    const h2 = /^## (\d+)\. (.+)$/.exec(line);
    const h3 = /^### (\d+\.\d+) (.+)$/.exec(line);
    if (h2) {
      close(sub, i);
      sub = undefined;
      close(top, i);
      if (!top) preamble = lines.slice(0, i);
      top = { num: h2[1]!, title: h2[2]!, start: i };
    } else if (h3) {
      close(sub, i);
      sub = { num: h3[1]!, title: h3[2]!, start: i };
    }
  });
  close(sub, lines.length);
  close(top, lines.length);
  return { preamble: preamble.join("\n").replace(/\n-{3,}\s*$/, "").trim(), sections };
}

const kb = (s: string) => `${Math.max(1, Math.round(Buffer.byteLength(s) / 1024))}KB`;

/** The answer to get_reference: the essentials + index, one section, or everything. */
export function referenceSection(md: string, section?: string): string {
  const { preamble, sections } = parseReference(md);
  const tops = sections.filter((s) => !s.num.includes("."));
  const key = (section ?? "").trim().toLowerCase().replace(/^§/, "");
  if (key === "all") return md;
  if (!key) {
    const essentials = tops.filter((s) => ESSENTIAL.includes(s.num)).map((s) => s.text).join("\n\n---\n\n");
    const index = tops
      .filter((s) => !ESSENTIAL.includes(s.num))
      .map((s) => {
        const subs = sections.filter((x) => x.num.startsWith(`${s.num}.`)).map((x) => `${x.num} ${x.title}`);
        return `- **${s.num}. ${s.title}** (${kb(s.text)})${subs.length ? `: ${subs.join(", ")}` : ""}`;
      })
      .join("\n");
    return [
      preamble,
      "> This is the essential part of the reference. Before writing a spec, also read section 7 (elements) and 9 (animation) with",
      "> `get_reference` and `section: \"7\"` / `\"9\"`. Start from the matching pattern in §15 Recipes (at the end of this part).",
      "> Other sections on request; `section: \"all\"` returns the whole file.",
      essentials,
      "---\n\n## Other sections (get_reference with `section`)\n\n" + index,
    ].join("\n\n");
  }
  const num = ALIASES[key] ?? key;
  const found = sections.find((s) => s.num === num);
  if (found) return found.text;
  const byTitle = sections.find((s) => s.title.toLowerCase().replace(/`/g, "").includes(key));
  if (byTitle) return byTitle.text;
  const list = tops.map((s) => `${s.num}. ${s.title}`).join("; ");
  return `No section '${section}'. Sections: ${list}. Subsections like "7.3" work too, or "all".`;
}
