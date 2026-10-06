/**
 * Sini MCP server. Every tool calls the same @sini/api functions as the CLI.
 * Project paths are resolved inside a root folder (SINI_ROOT, default: the working directory).
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as api from "@sini/api";
import type { Issue } from "@sini/schema";

import { referenceSection } from "./reference.js";

const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const read = (f: string) => readFileSync(DOCS + f, "utf8");

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type Result = { content: Content[]; isError?: boolean };

const text = (t: string): Result => ({ content: [{ type: "text", text: t }] });
const json = (v: unknown): Result => text(JSON.stringify(v, null, 2));
const formatIssues = (issues: Issue[]) =>
  issues.map((i) => `${i.level === "error" ? "✗" : "!"} ${i.path}: ${i.message}${i.suggestion ? ` ${i.suggestion}` : ""}`).join("\n");

export function createServer(root = process.env.SINI_ROOT ?? process.cwd()): McpServer {
  const ROOT = resolve(root);
  const project = (p?: string) => {
    const abs = resolve(ROOT, p ?? ".");
    if (abs !== ROOT && !abs.startsWith(ROOT + sep)) throw new api.SiniError(`'${p}' is outside the folder this server can use (${ROOT}).`);
    return abs;
  };
  const run = (fn: () => Result | Promise<Result>) => async (): Promise<Result> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof api.SiniError) return { content: [{ type: "text", text: `${e.message}${e.issues.length ? `\n${formatIssues(e.issues)}` : ""}` }], isError: true };
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  };

  const server = new McpServer({ name: "sini", version: VERSION }, {
    instructions:
      "Sini renders videos from a JSON spec. Read the DSL reference first: get_reference (essentials and index), then sections \"7\" and \"9\". " +
      "Workflow: create_video → validate_video / lint_video → render_contact_sheet (look at it) → update_video with patches → render_video (draft first). " +
      "Use describe_at and get_layout instead of estimating timing or text sizes. Every change creates a new version.",
  });
  // Output paths relative to the server root: inside Docker the absolute path (/work/…) means nothing to the user.
  const shown = (file: string) => {
    const rel = relative(ROOT, file);
    return rel && !rel.startsWith("..") ? `${rel} (in the folder Sini was given)` : file;
  };
  // Big videos have hundreds of elements; most are hidden at any one time.
  const filterArgs = {
    visibleOnly: z.boolean().default(true).describe("Only elements visible at that time (default true)"),
    elements: z.array(z.string()).optional().describe("Only these element ids (a component instance includes its parts)"),
  };
  const filterElements = <T extends { ref: string; visible: boolean }>(els: T[], visibleOnly: boolean, ids?: string[]) => {
    const kept = els.filter((e) => (!visibleOnly || e.visible) && (!ids?.length || ids.some((id) => e.ref === id || e.ref.startsWith(`${id}/`) || e.ref.startsWith(`${id}#`))));
    return { kept, omitted: els.length - kept.length };
  };
  const projectArg = { project: z.string().default(".").describe("Project folder (relative to the server root) containing video.json") };
  const readOnly = { readOnlyHint: true, openWorldHint: false };

  // ---------- resources ----------
  server.registerResource("reference", "sini://reference", { title: "Sini DSL reference", description: "The complete video DSL, written for AI models", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: read("DSL_REFERENCE.md") }] }));
  for (const ex of ["novae", "gallery"]) {
    if (!existsSync(`${DOCS}examples/${ex}.json`)) continue;
    server.registerResource(`example-${ex}`, `sini://examples/${ex}`, { title: `Example: ${ex}`, mimeType: "application/json" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: read(`examples/${ex}.json`) }] }));
  }

  // ---------- tools ----------
  server.registerTool("get_reference", {
    title: "Read the Sini DSL reference",
    description:
      "The DSL reference (Markdown). Without `section`: the essentials and an index of the other sections. " +
      "Then read section \"7\" (elements) and \"9\" (animation) before writing a video. " +
      "`section` takes a number (\"7\", \"7.3\"), a name (\"elements\", \"transitions\", \"examples\") or \"all\".",
    inputSchema: { section: z.string().optional().describe('Section number ("9", "9.4"), name ("behaviors"), or "all"') },
    annotations: readOnly,
  }, (a) => run(() => text(referenceSection(read("DSL_REFERENCE.md"), a.section)))());

  server.registerTool("create_video", {
    title: "Create a video project",
    description: "Create a project folder with video.json. Pass `spec` to start from your own video, or omit it for a starter.",
    inputSchema: { ...projectArg, spec: z.record(z.string(), z.unknown()).optional().describe("A complete Sini video spec"), force: z.boolean().optional() },
  }, (a) => run(() => {
    const r = api.initProject(project(a.project), { ...(a.spec ? { spec: a.spec as never } : {}), ...(a.force ? { force: true } : {}) });
    return text(`Created ${r.dir}/video.json as version ${r.version.version}.${r.issues.length ? `\n${formatIssues(r.issues)}` : ""}`);
  })());

  server.registerTool("get_video", { title: "Read the current spec", description: "Returns the project's video.json, scene-by-scene timing, and the version history.", inputSchema: projectArg, annotations: readOnly },
    (a) => run(() => {
      const dir = project(a.project);
      let timing: unknown;
      try {
        timing = api.inspect(dir);
      } catch {
        timing = "unavailable: the spec has errors";
      }
      return json({ spec: api.load(dir).spec, timing, versions: api.listVersions(dir) });
    })());

  server.registerTool("validate_video", {
    title: "Validate a spec",
    description: "Check a project's video.json (or a spec passed directly) against the DSL. Returns errors with paths and suggestions.",
    inputSchema: { ...projectArg, spec: z.record(z.string(), z.unknown()).optional() },
    annotations: readOnly,
  }, (a) => run(() => {
    const r = a.spec ? { ...api.validateSpec(a.spec), file: "(inline spec)" } : api.check(project(a.project));
    const s = r.stats;
    return text(r.ok ? `✓ Valid: ${s.scenes} scenes, ${s.elements} elements, ${s.timelineItems} timeline items.${r.issues.length ? `\n${formatIssues(r.issues)}` : ""}` : formatIssues(r.issues));
  })());

  server.registerTool("update_video", {
    title: "Change the video",
    description: "Apply patch operations (preferred: set/add/remove/move/addScene/addTimeline, see reference §11) or replace the whole spec. Validates first; saves a new version only if valid.",
    inputSchema: {
      ...projectArg,
      patch: z.array(z.record(z.string(), z.unknown())).optional().describe("Patch operations"),
      spec: z.record(z.string(), z.unknown()).optional().describe("A complete replacement spec"),
      message: z.string().optional().describe("What changed, for the version history"),
    },
  }, (a) => run(() => {
    if (!a.patch && !a.spec) throw new api.SiniError("Pass `patch` (preferred) or `spec`.");
    const r = a.patch ? api.patchProject(project(a.project), a.patch as never, a.message) : api.replaceSpec(project(a.project), a.spec as never, a.message);
    return text(`✓ Saved version ${r.version.version}: ${r.version.message}${r.issues.length ? `\n${formatIssues(r.issues)}` : ""}`);
  })());

  server.registerTool("lint_video", {
    title: "Find design problems",
    description: "Reading time, edges and safe zones, overlapping text, overflow, contrast, missing glyphs, timing problems. Run after validate.",
    inputSchema: { ...projectArg, layout: z.boolean().default(true).describe("Include checks that need the renderer") },
    annotations: readOnly,
  }, (a) => run(async () => {
    const r = await api.lint(project(a.project), { layout: a.layout });
    const acc = r.accepted ? ` ${r.accepted} accepted in lint.accept.` : "";
    return text(r.issues.length ? `${formatIssues(r.issues)}\n\n${r.issues.length} warning(s); video is ${r.duration.toFixed(2)}s.${acc}` : `✓ No problems found; video is ${r.duration.toFixed(2)}s.${acc}`);
  })());

  server.registerTool("describe_at", {
    title: "What's on screen at a time",
    description: "Lists visible elements and running animations at a time. Use it to map feedback like 'at 0:07 the text is too fast' to element ids.",
    inputSchema: { ...projectArg, time: z.number().min(0).describe("Seconds"), ...filterArgs },
    annotations: readOnly,
  }, (a) => run(() => {
    const d = api.describe(project(a.project), a.time);
    const { kept, omitted } = filterElements(d.elements, a.visibleOnly, a.elements);
    return json({ ...d, elements: kept, ...(omitted ? { omitted: `${omitted} elements not shown (hidden, or not in \`elements\`); visibleOnly: false shows hidden ones` } : {}) });
  })());

  server.registerTool("get_layout", {
    title: "Computed layout",
    description: "Exact boxes (canvas px) of every element at a time, with text overflow and shrink info. Text also has `ink`: where the letters are drawn (cap tops to descenders, overhang included); align big type by `ink`. Use instead of estimating text sizes.",
    inputSchema: { ...projectArg, time: z.number().min(0), ...filterArgs },
    annotations: readOnly,
  }, (a) => run(async () => {
    const r = await api.layoutAt(project(a.project), a.time);
    const { kept, omitted } = filterElements(r.elements, a.visibleOnly, a.elements);
    return json({ ...r, elements: kept, ...(omitted ? { omitted: `${omitted} elements not shown (hidden, or not in \`elements\`); visibleOnly: false shows hidden ones` } : {}) });
  })());

  server.registerTool("render_frame", {
    title: "Render one frame",
    description: "Returns a PNG of the video at a time.",
    inputSchema: { ...projectArg, time: z.number().min(0), scale: z.number().min(0.1).max(1).default(0.5).describe("Output scale; 0.5 keeps images small") },
    annotations: readOnly,
  }, (a) => run(async () => {
    const r = await api.renderFrame(project(a.project), a.time, { scale: a.scale });
    return { content: [{ type: "image", data: r.png.toString("base64"), mimeType: "image/png" }, { type: "text", text: shown(r.file) }] };
  })());

  server.registerTool("render_contact_sheet", {
    title: "Contact sheet",
    description: "One image with a grid of frames and timestamps: the cheapest way to see the whole video. Look at it before showing a human.",
    inputSchema: { ...projectArg, times: z.array(z.number().min(0)).optional(), count: z.number().int().min(2).max(24).default(12) },
    annotations: readOnly,
  }, (a) => run(async () => {
    const r = await api.contactSheet(project(a.project), { ...(a.times ? { times: a.times } : { count: a.count }) });
    return { content: [{ type: "image", data: r.png.toString("base64"), mimeType: "image/png" }, { type: "text", text: `${shown(r.file)}\nTimes: ${r.times.join(", ")}` }] };
  })());

  server.registerTool("render_video", {
    title: "Render the video",
    description: "Render to MP4 in the project's out/ folder. Use draft: true (half size, 15 fps, fast) while iterating.",
    inputSchema: { ...projectArg, draft: z.boolean().default(true) },
  }, (a) => run(async () => {
    const r = await api.renderMp4(project(a.project), { draft: a.draft });
    // Open lint warnings are repeated here: a render is where a model decides it's finished.
    const lint = await api.lint(project(a.project));
    const open = lint.issues.filter((i) => i.level === "warning");
    return text(
      `✓ ${shown(r.file)}\n${r.duration.toFixed(2)}s, ${r.width}×${r.height} @ ${r.fps}fps, ${r.frames} frames, rendered in ${r.seconds.toFixed(1)}s` +
        (open.length
          ? `\n\n${open.length} lint warning(s) still open. Fix them before calling the video done, or accept one in lint.accept with the reason it's wrong for this video:\n${formatIssues(open)}`
          : "\nLint: no problems."),
    );
  })());

  server.registerTool("list_versions", { title: "Version history", inputSchema: projectArg, annotations: readOnly },
    (a) => run(() => json(api.listVersions(project(a.project))))());

  server.registerTool("restore_version", {
    title: "Restore a version",
    description: "Restore an earlier version; it's saved as a new version, so nothing is lost.",
    inputSchema: { ...projectArg, version: z.number().int().min(1) },
  }, (a) => run(() => {
    const v = api.restoreVersion(project(a.project), a.version);
    return text(`✓ Restored as version ${v.version}.`);
  })());

  // ---------- prompts ----------
  server.registerPrompt("create-video", {
    title: "Make a video from a brief",
    description: "Guides the model through Sini's create → check → look → fix loop.",
    argsSchema: { brief: z.string().describe("What the video should be"), project: z.string().optional().describe("Project folder") },
  }, ({ brief, project: dir }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text:
          `Make a video with Sini for this brief:\n\n${brief}\n\n` +
          `1. Read the DSL reference: get_reference, then get_reference with section "7" and "9".\n` +
          `2. Write the spec and create_video in "${dir ?? "video"}".\n` +
          `3. validate_video and lint_video; fix everything with update_video patches.\n` +
          `4. render_contact_sheet and look at it critically: hierarchy, pacing, overlaps, empty space. Fix and repeat (2–3 rounds).\n` +
          `5. render_video with draft: true, then report what you made, what you assumed (notes), and the file path.`,
      },
    }],
  }));

  return server;
}

export async function serveStdio(root?: string): Promise<void> {
  const server = createServer(root);
  await server.connect(new StdioServerTransport());
}
