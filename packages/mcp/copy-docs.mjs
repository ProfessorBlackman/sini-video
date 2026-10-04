// Bundle the DSL reference and examples so the server works from an installed package or Docker image.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("docs/examples", { recursive: true });
cpSync("../../docs/DSL_REFERENCE.md", "docs/DSL_REFERENCE.md");
for (const ex of ["novae", "gallery"]) cpSync(`../../examples/${ex}/video.json`, `docs/examples/${ex}.json`);
