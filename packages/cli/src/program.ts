import { createRequire } from "node:module";
import { Command } from "commander";
import { describe, SiniError } from "@sini/api";
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

  return program;
}
