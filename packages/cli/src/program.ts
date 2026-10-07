import { createRequire } from "node:module";
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { assetText, contactSheet, describeWithLayout, initProject, inspect, layoutAt, lint, listVersions, patchProject, renderFrame, renderMp4, restoreVersion, SiniError, snapshot, type PatchOp } from "@sini/api";
import { formatIssue, runValidate } from "./validate-command.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/** Run a command body, printing SiniErrors (with their issues) instead of stack traces. */
export function guard(fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof SiniError) {
        console.error(e.message);
        for (const i of e.issues) console.error(formatIssue(i));
      } else if (process.env.SINI_DEBUG) {
        throw e;
      } else {
        console.error(`Error: ${(e as Error).message}\n(set SINI_DEBUG=1 for a stack trace)`);
      }
      process.exitCode = 1;
    }
  };
}

export function createProgram(): Command {
  const program = new Command()
    .name("sini")
    .description("Describe a video; your AI writes it, Sini renders it.")
    .version(version, "-v, --version");

  program
    .command("init")
    .description("Create a project folder with a starter video (or --from an existing spec)")
    .argument("[dir]", "project folder", ".")
    .option("--from <file>", "start from this spec file")
    .option("--force", "overwrite an existing video.json")
    .action((dir: string, opts: { from?: string; force?: boolean }) =>
      guard(() => {
        const spec = opts.from ? JSON.parse(readFileSync(opts.from, "utf8")) : undefined;
        const r = initProject(dir, { ...(spec ? { spec } : {}), ...(opts.force ? { force: true } : {}) });
        console.log(`✓ Created ${r.dir}/video.json (version ${r.version.version})`);
      })(),
    );

  program
    .command("patch")
    .description("Apply a JSON patch (list of operations) and save a new version")
    .argument("<patch>", "patch file, or - for stdin")
    .argument("[project]", "project folder or spec file", ".")
    .option("-m, --message <text>", "version message")
    .action((patchFile: string, project: string, opts: { message?: string }) =>
      guard(() => {
        const ops = JSON.parse(readFileSync(patchFile === "-" ? 0 : patchFile, "utf8")) as PatchOp[];
        const r = patchProject(project, ops, opts.message);
        for (const i of r.issues) console.log(formatIssue(i));
        console.log(`✓ Saved version ${r.version.version}: ${r.version.message}`);
      })(),
    );

  program
    .command("save")
    .description("Record the current video.json as a new version (after editing it directly)")
    .argument("[project]", "project folder or spec file", ".")
    .option("-m, --message <text>", "version message", "edit")
    .action((project: string, opts: { message: string }) =>
      guard(() => {
        const v = snapshot(project, opts.message);
        console.log(`✓ Saved version ${v.version}: ${v.message}`);
      })(),
    );

  program
    .command("versions")
    .description("List saved versions")
    .argument("[project]", "project folder or spec file", ".")
    .action((project: string) =>
      guard(() => {
        const vs = listVersions(project);
        if (!vs.length) return void console.log("No versions yet. Run 'sini save' or 'sini patch'.");
        for (const v of vs) console.log(`v${v.version}  ${v.time}  ${v.message}`);
      })(),
    );

  program
    .command("checkout")
    .description("Restore an earlier version (saved as a new version)")
    .argument("<version>", "version number")
    .argument("[project]", "project folder or spec file", ".")
    .action((version: string, project: string) =>
      guard(() => {
        const v = restoreVersion(project, Number(version.replace(/^v/, "")));
        console.log(`✓ Restored as version ${v.version}: ${v.message}`);
      })(),
    );

  program
    .command("validate")
    .description("Check a video spec against the Sini DSL")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((project: string, opts: { json?: boolean }) => {
      process.exitCode = runValidate(project, opts);
    });

  program
    .command("lint")
    .description("Find design problems: reading time, edges, safe zones, overlaps, contrast, glyphs")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .option("--no-layout", "skip checks that need the renderer (faster)")
    .action((project: string, opts: { json?: boolean; layout?: boolean }) =>
      guard(async () => {
        const r = await lint(project, { layout: opts.layout !== false });
        if (opts.json) return void console.log(JSON.stringify(r, null, 2));
        for (const i of r.issues) console.log(formatIssue(i));
        const n = r.issues.length;
        const acc = r.accepted ? `, ${r.accepted} accepted in lint.accept` : "";
        console.log(n === 0 ? `✓ No problems found (${r.duration.toFixed(2)}s video${acc}).` : `\n${n} warning${n === 1 ? "" : "s"} (${r.duration.toFixed(2)}s video${acc}).`);
      })(),
    );

  program
    .command("inspect")
    .description("Show scene timings: where the seconds go")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((project: string, opts: { json?: boolean }) =>
      guard(() => {
        const r = inspect(project);
        if (opts.json) return void console.log(JSON.stringify(r, null, 2));
        const t = r.timing;
        console.log(`Video ${r.duration.toFixed(2)}s${t.target ? ` (target ${t.target}s, natural ${t.natural.toFixed(2)}s)` : ""}`);
        for (const s of r.scenes) {
          console.log(`  ${s.id.padEnd(16)} ${s.start.toFixed(2).padStart(6)} → ${s.end.toFixed(2).padStart(6)}  ${s.duration.toFixed(2)}s${s.auto ? " (auto)" : ""}  ${s.elements} elements${s.transition ? `  enters by ${s.transition}` : ""}`);
        }
      })(),
    );

  program
    .command("at")
    .description("Describe what is on screen and what is animating at a time (seconds)")
    .argument("<time>", "time in seconds")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((time: string, project: string, opts: { json?: boolean }) =>
      guard(async () => {
        const d = await describeWithLayout(project, Number(time));
        if (opts.json) return void console.log(JSON.stringify(d, null, 2));
        console.log(`t = ${d.time}s`);
        for (const s of d.scenes) console.log(`scene ${s.id} at ${s.local}s${s.transition ? `, ${s.transition}` : ""}`);
        for (const e of d.elements) {
          const state = e.visible ? `${e.highlighted ? "highlighted" : "visible"}${e.opacity !== undefined ? ` (opacity ${e.opacity})` : ""}${e.coveredBy ? `, covered by ${e.coveredBy}` : ""}` : "hidden";
          const anim = e.animating.length ? `  ⟳ ${e.animating.join(", ")}` : "";
          console.log(`  ${e.ref} [${e.type}] ${state}${e.text ? ` "${e.text}"` : ""}${anim}`);
        }
      })(),
    );

  program
    .command("text")
    .description("List the text in an image asset (OCR), with boxes in the image's pixels")
    .argument("<asset>", "image asset id")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((asset: string, project: string, opts: { json?: boolean }) =>
      guard(async () => {
        const r = await assetText(project, asset);
        if (opts.json) return void console.log(JSON.stringify(r, null, 2));
        console.log(`${r.asset}: ${r.file}${r.width ? ` (${r.width}×${r.height} px)` : ""}`);
        for (const l of r.lines) console.log(`  [${l.box.join(", ")}]  ${l.text}`);
      })(),
    );

  program
    .command("frame")
    .description("Render one frame to a PNG")
    .argument("<time>", "time in seconds")
    .argument("[project]", "project folder or spec file", ".")
    .option("-o, --out <file>", "output PNG path (default: out/frame-<time>.png)")
    .option("--scale <factor>", "output scale, e.g. 0.5", "1")
    .action((time: string, project: string, opts: { out?: string; scale: string }) =>
      guard(async () => {
        const { file } = await renderFrame(project, Number(time), { ...(opts.out ? { out: opts.out } : {}), scale: Number(opts.scale) });
        console.log(file);
      })(),
    );

  program
    .command("layout")
    .description("Show the computed box of every element at a time")
    .argument("<time>", "time in seconds")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((time: string, project: string, opts: { json?: boolean }) =>
      guard(async () => {
        const r = await layoutAt(project, Number(time));
        if (opts.json) return void console.log(JSON.stringify(r, null, 2));
        console.log(`t = ${r.time}s, canvas ${r.width}×${r.height}`);
        for (const e of r.elements) {
          const b = e.box;
          const moved = JSON.stringify(e.box) !== JSON.stringify(e.current) ? `  now ${e.current.x},${e.current.y} ${e.current.width}×${e.current.height}` : "";
          const extra = [e.visible ? "" : "hidden", e.overflow ? "OVERFLOW" : "", e.shrink ? `shrunk to ${Math.round(e.shrink * 100)}%` : "", e.fontSize ? `${e.fontSize}px` : ""].filter(Boolean).join(", ");
          console.log(`  ${e.ref} [${e.type}] ${b.x},${b.y} ${b.width}×${b.height}${moved}${extra ? `  (${extra})` : ""}`);
        }
      })(),
    );

  program
    .command("sheet")
    .description("Render a contact sheet: a grid of frames with timestamps")
    .argument("[project]", "project folder or spec file", ".")
    .option("--times <list>", "comma-separated times in seconds")
    .option("--count <n>", "number of evenly spaced frames", "12")
    .option("-o, --out <file>", "output PNG path (default: out/sheet.png)")
    .action((project: string, opts: { times?: string; count: string; out?: string }) =>
      guard(async () => {
        const r = await contactSheet(project, {
          ...(opts.times ? { times: opts.times.split(",").map(Number) } : { count: Number(opts.count) }),
          ...(opts.out ? { out: opts.out } : {}),
        });
        console.log(`${r.file}  (${r.times.map((t) => `${t}s`).join(", ")})`);
      })(),
    );

  program
    .command("render")
    .description("Render the video to MP4")
    .argument("[project]", "project folder or spec file", ".")
    .option("--draft", "fast preview: half size, 15 fps")
    .option("-o, --out <file>", "output MP4 path (default: out/video.mp4 or out/draft.mp4)")
    .option("--workers <n>", "parallel browser pages")
    .action((project: string, opts: { draft?: boolean; out?: string; workers?: string }) =>
      guard(async () => {
        let last = -1;
        const r = await renderMp4(project, {
          ...(opts.draft ? { draft: true } : {}),
          ...(opts.out ? { out: opts.out } : {}),
          ...(opts.workers ? { workers: Number(opts.workers) } : {}),
          onProgress: (done, total) => {
            const pct = Math.floor((done / total) * 10) * 10;
            if (pct !== last && process.stderr.isTTY) process.stderr.write(`\rRendering ${done}/${total} frames`);
            last = pct;
          },
        });
        if (process.stderr.isTTY) process.stderr.write("\n");
        for (const w of r.warnings) console.log(`! ${w}`);
        console.log(`✓ ${r.file}  (${r.duration.toFixed(2)}s, ${r.width}×${r.height} @ ${r.fps}fps, ${r.frames} frames, rendered in ${r.seconds.toFixed(1)}s)`);
      })(),
    );

  program
    .command("mcp")
    .description("Run the MCP server on stdio (for Claude Desktop, Claude Code, Cursor, …)")
    .option("--root <dir>", "folder the server may read and write (default: current directory)")
    .action(async (opts: { root?: string }) => {
      const { serveStdio } = await import("@sini/mcp");
      await serveStdio(opts.root);
    });

  program
    .command("serve")
    .description("Run the MCP server over HTTP, for AI chat apps on the web (Claude, ChatGPT, …); see docs/SELF_HOSTING.md")
    .option("--root <dir>", "folder for projects (default: current directory)")
    .option("--port <n>", "port (default: $PORT or 8080)")
    .option("--host <addr>", "address to listen on", "0.0.0.0")
    .option("--key <key>", "access key (default: $SINI_KEY); connect at /mcp/<key>")
    .option("--public-url <url>", "the address people reach it at, for links (default: $SINI_PUBLIC_URL, or from each request)")
    .option("--open", "serve without a key (only behind your own authentication)")
    .action((opts: { root?: string; port?: string; host: string; key?: string; publicUrl?: string; open?: boolean }) =>
      guard(async () => {
        const { serveHttp } = await import("@sini/mcp");
        await serveHttp({
          host: opts.host,
          ...(opts.root ? { root: opts.root } : {}),
          ...(opts.port ? { port: Number(opts.port) } : {}),
          ...(opts.key ? { key: opts.key } : {}),
          ...(opts.publicUrl ? { publicUrl: opts.publicUrl } : {}),
          ...(opts.open ? { open: true } : {}),
        });
      })(),
    );

  return program;
}
