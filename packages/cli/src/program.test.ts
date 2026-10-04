import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { createProgram } from "./program.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("sini CLI", () => {
  it("reports the package version", () => {
    const program = createProgram();
    expect(program.version()).toBe(pkg.version);
    expect(program.name()).toBe("sini");
  });
});
