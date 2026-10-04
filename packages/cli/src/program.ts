import { createRequire } from "node:module";
import { Command } from "commander";
import { describe, layoutAt, renderFrame, SiniError } from "@sini/api";
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
        process.exitCode = 1;
      } else throw e;
    }
  };
}

export function createProgram(): Command {
  const program = new Command()
    .name("sini")
    .description("Describe a video; your AI writes it, Sini renders it.")
    .version(version, "-v, --version");

  program
    .command("validate")
    .description("Check a video spec against the Sini DSL")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((project: string, opts: { json?: boolean }) => {
      process.exitCode = runValidate(project, opts);
    });

  program
    .command("at")
    .description("Describe what is on screen and what is animating at a time (seconds)")
    .argument("<time>", "time in seconds")
    .argument("[project]", "project folder or spec file", ".")
    .option("--json", "machine-readable output")
    .action((time: string, project: string, opts: { json?: boolean }) =>
      guard(() => {
        const d = describe(project, Number(time));
        if (opts.json) return void console.log(JSON.stringify(d, null, 2));
        console.log(`t = ${d.time}s`);
        for (const s of d.scenes) console.log(`scene ${s.id} at ${s.local}s${s.transition ? `, ${s.transition}` : ""}`);
        for (const e of d.elements) {
          const state = e.visible ? (e.opacity !== undefined ? `visible (opacity ${e.opacity})` : "visible") : "hidden";
          const anim = e.animating.length ? `  ⟳ ${e.animating.join(", ")}` : "";
          console.log(`  ${e.ref} [${e.type}] ${state}${e.text ? ` "${e.text}"` : ""}${anim}`);
        }
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

  return program;
}
