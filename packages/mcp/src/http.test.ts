import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";
import { createHttpApp } from "./http.js";

type ToolResult = { content: { type: string; text?: string }[]; isError?: boolean };
let root: string;
let app: Server;
let base: string;
let client: Client;
const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as ToolResult;
const textOf = (r: ToolResult) => r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
const linkIn = (s: string) => /https?:\/\/\S+/.exec(s)?.[0] ?? "";

// A 2×2 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "sini-http-"));
  app = createHttpApp({ root, key: "s3cret", waitSeconds: 60 });
  await new Promise<void>((ok) => app.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  client = new Client({ name: "test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/s3cret`)));
});
afterAll(async () => {
  await client?.close();
  await new Promise((ok) => app.close(ok));
  rmSync(root, { recursive: true, force: true });
});

describe("sini serve", () => {
  it("refuses a wrong key, and accepts a bearer header", async () => {
    expect((await fetch(`${base}/mcp/nope`, { method: "POST", body: "{}" })).status).toBe(401);
    const c = new Client({ name: "t", version: "1" });
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: "Bearer s3cret" } } }));
    expect((await c.listTools()).tools.map((t) => t.name)).toContain("render_status");
    await c.close();
  });

  it("adds assets, makes an upload page, renders in the background and hands out a download link", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["add_asset", "get_upload_link", "get_download_link", "render_status"]));

    expect(textOf(await call("add_asset", { project: "demo", data: PNG.toString("base64"), name: "dot.png" }))).toContain("assets/dot.png");
    expect((await call("add_asset", { project: "demo", data: Buffer.from("hello").toString("base64"), name: "x.png" })).isError).toBe(true);

    // The upload page and a PUT to it; a tampered link is refused.
    const up = linkIn(textOf(await call("get_upload_link", { project: "demo" })));
    expect((await fetch(up)).status).toBe(200);
    const put = await fetch(`${up}&name=${encodeURIComponent("my logo.png")}`, { method: "PUT", body: PNG });
    expect(await put.json()).toMatchObject({ path: "assets/my-logo.png", kind: "png" });
    expect((await fetch(up.replace(/sig=\w+/, "sig=" + "0".repeat(40)))).status).toBe(403);

    const created = await call("create_video", { project: "demo", spec: {
      version: "0.4", video: { format: "1:1" }, assets: { dot: "assets/dot.png" },
      scenes: [{ id: "a", duration: 1, elements: [{ id: "i", type: "image", asset: "dot", layout: { anchor: "center", width: 200, height: 200 }, enter: "none" }] }],
    } });
    expect(textOf(created)).toContain("version 1");
    const r = textOf(await call("render_video", { project: "demo", draft: true }));
    expect(r).toContain("Download");
    const link = linkIn(r.slice(r.indexOf("Download")));
    const full = await fetch(link);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    const part = await fetch(link, { headers: { range: "bytes=0-99" } });
    expect(part.status).toBe(206);
    expect((await part.arrayBuffer()).byteLength).toBe(100);
    expect(textOf(await call("render_status", { project: "demo" }))).toContain("Download");

    // Only out/ is shareable.
    expect((await call("get_download_link", { project: "demo", file: "video.json" })).isError).toBe(true);
  }, 120_000);
});

describe("long renders", () => {
  it("answer 'still rendering' and finish through render_status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sini-http-slow-"));
    const slow = createHttpApp({ root: dir, key: "k", waitSeconds: 0.01 });
    await new Promise<void>((ok) => slow.listen(0, "127.0.0.1", ok));
    const c = new Client({ name: "t", version: "1" });
    await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(slow.address() as AddressInfo).port}/mcp/k`)));
    const run = async (name: string, args: Record<string, unknown>) => textOf((await c.callTool({ name, arguments: args })) as ToolResult);
    try {
      await run("create_video", { project: "p", spec: { version: "0.4", video: { format: "1:1" }, scenes: [{ id: "a", duration: 1, elements: [{ id: "t", type: "text", content: "Hi" }] }] } });
      expect(await run("render_video", { project: "p", draft: true })).toMatch(/Still (rendering|waiting)/);
      let status = "";
      for (let i = 0; i < 120 && !status.includes("Download"); i++) {
        status = await run("render_status", { project: "p" });
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(status).toContain("Download");
    } finally {
      await c.close();
      await new Promise((ok) => slow.close(ok));
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
