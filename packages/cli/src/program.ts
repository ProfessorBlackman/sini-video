import { createRequire } from "node:module";
import { Command } from "commander";
import { runValidate } from "./validate-command.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

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

  return program;
}
