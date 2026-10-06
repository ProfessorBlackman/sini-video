export { compile, type CompileOptions, type CompiledPlan, type ReadingWindow } from "./compile.js";
export { frameAt, elementFrame, isVisible, planElements, clamp01, type Frame, type ElementFrame, type SceneFrame, type PartFrame, type CursorFrame } from "./evaluate.js";
export { describeAt, type Description } from "./describe.js";
export { parseMarkup, formatLike, formatNumber, countText, type Run, type ParsedText } from "./markup.js";
export { easeFn, spring, EASE_NAMES, type EaseSpec, type EaseFn } from "./ease.js";
export { parseCss, toCss, mix, resolveColour, resolvePaint, contrast, luminance, over, type RGBA } from "./colour.js";
export * from "./defaults.js";
export type * from "./plan.js";
export { pointsToPath } from "./path.js";
