export { SiniError, load, check, plan, specFile, compileSpec, assetPathIssues, iconIssues, validateFull, validateSpec, type Loaded } from "./project.js";
export { describe, describeWithLayout, coveredAt, inspect, type Inspection } from "./describe.js";
export { renderFrame, layoutAt, outDir, renderMp4, contactSheet } from "./render.js";
export { lint, timelineRules, glyphRules, layoutRules, type LintResult } from "./lint.js";
export {
  initProject, snapshot, replaceSpec, restoreVersion, readVersion, listVersions, saveVersion, applyOps, patchProject, projectDir,
  type PatchOp, type VersionInfo,
} from "./versions.js";
export { resolveTextHotspots, cachedTextHotspots, findText } from "./ocr.js";
