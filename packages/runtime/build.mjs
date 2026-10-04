import { build } from "esbuild";

await build({
  entryPoints: ["src/runtime.ts"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: "dist/runtime.js",
  legalComments: "none",
  logLevel: "warning",
});
