import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import type { Plan } from "@sini/core";
import { launchBrowser, RenderSession } from "./session.js";

export interface VideoOptions {
  /** Draft: half size, 15 fps, fast encode. */
  draft?: boolean;
  /** Parallel pages. Default: half the CPU cores, 2–6. */
  workers?: number;
  /** Called after each frame with (done, total). */
  onProgress?: (done: number, total: number) => void;
  /** Keep a SHA-256 of every frame (for determinism checks). */
  hashes?: boolean;
}

export interface VideoResult {
  file: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  duration: number;
  seconds: number;
  frameHashes?: string[];
}

export function frameTimes(duration: number, fps: number): number[] {
  const n = Math.max(1, Math.round(duration * fps));
  return Array.from({ length: n }, (_, i) => i / fps);
}

export async function renderVideo(plan: Plan, out: string, opts: VideoOptions = {}): Promise<VideoResult> {
  const started = Date.now();
  const draft = !!opts.draft;
  const fps = draft ? Math.min(15, plan.fps) : plan.fps;
  const scale = draft ? 0.5 : 1;
  // JPEG frames: PNG encoding of grainy 1080×1920 frames costs ~1s each, JPEG ~0.14s.
  // Frames are re-encoded to H.264 immediately, so q95 is visually lossless here.
  const format = "jpeg";
  const quality = draft ? 88 : 95;
  const times = frameTimes(plan.duration, fps);
  const workers = Math.max(1, Math.min(opts.workers ?? Math.max(2, Math.min(6, Math.floor(availableParallelism() / 2))), times.length));
  const dir = mkdtempSync(join(tmpdir(), "sini-frames-"));
  const hashes: string[] = new Array(times.length);
  const browser = await launchBrowser();
  let done = 0;
  try {
    const sessions = await Promise.all(Array.from({ length: workers }, () => RenderSession.open(plan, { scale, browser })));
    // Contiguous ranges keep each page's work local in time.
    const per = Math.ceil(times.length / workers);
    await Promise.all(
      sessions.map(async (s, w) => {
        for (let i = w * per; i < Math.min(times.length, (w + 1) * per); i++) {
          const buf = await s.frame(times[i]!, format, quality);
          writeFileSync(join(dir, `f_${String(i).padStart(6, "0")}.jpg`), buf);
          if (opts.hashes) hashes[i] = createHash("sha256").update(buf).digest("hex");
          opts.onProgress?.(++done, times.length);
        }
        await s.close();
      }),
    );
  } finally {
    await browser.close();
  }
  try {
    await ffmpeg([
      "-y", "-loglevel", "error",
      "-framerate", String(fps),
      "-i", join(dir, "f_%06d.jpg"),
      // JPEG frames are full-range; convert to the limited-range BT.709 every player expects,
      // and tag it so, whichever ffmpeg build is doing the work.
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv:out_color_matrix=bt709,format=yuv420p",
      "-c:v", "libx264",
      "-preset", draft ? "veryfast" : "medium",
      "-crf", draft ? "26" : "19",
      "-pix_fmt", "yuv420p",
      "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-movflags", "+faststart",
      out,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return {
    file: out,
    frames: times.length,
    fps,
    width: Math.ceil(plan.width * scale),
    height: Math.ceil(plan.height * scale),
    duration: plan.duration,
    seconds: (Date.now() - started) / 1000,
    ...(opts.hashes ? { frameHashes: hashes } : {}),
  };
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.SINI_FFMPEG ?? "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`Couldn't run ffmpeg (${e.message}). Install FFmpeg or set SINI_FFMPEG.`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.trim()}`))));
  });
}
