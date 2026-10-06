import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";

let root: string;
let client: Client;

type ToolResult = { content: { type: string; text?: string; data?: string }[]; isError?: boolean };
const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as ToolResult;
const textOf = (r: ToolResult) => r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "sini-mcp-"));
  cpSync(new URL("../../../examples/novae", import.meta.url), join(root, "novae"), { recursive: true });
  const server = createServer(root);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
});
afterAll(async () => {
  await client?.close();
  rmSync(root, { recursive: true, force: true });
});

describe("MCP server", () => {
  it("lists the tools and the reference", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["get_reference", "create_video", "validate_video", "update_video", "lint_video", "describe_at", "get_layout", "render_frame", "render_contact_sheet", "render_video", "list_versions", "restore_version"]));
    const ref = await client.readResource({ uri: "sini://reference" });
    expect(String((ref.contents[0] as { text: string }).text)).toContain("Sini DSL Reference");
  });

  it("validates and describes an existing project", async () => {
    expect(textOf(await call("validate_video", { project: "novae" }))).toMatch(/✓ Valid/);
    const d = JSON.parse(textOf(await call("describe_at", { project: "novae", time: 0.6 })));
    expect(d.elements.find((e: { ref: string }) => e.ref === "line-1").visible).toBe(true);
  });

  it("creates, patches (with validation) and versions a project", async () => {
    expect(textOf(await call("create_video", { project: "fresh" }))).toMatch(/version 1/);
    const bad = await call("update_video", { project: "fresh", patch: [{ op: "set", path: "headline.enter", value: "wordreveal" }] });
    expect(bad.isError).toBe(true);
    expect(textOf(bad)).toMatch(/Did you mean 'wordReveal'/);
    expect(textOf(await call("update_video", { project: "fresh", patch: [{ op: "set", path: "headline.style.size", value: 170 }], message: "bigger" }))).toMatch(/version 2: bigger/);
    expect(JSON.parse(textOf(await call("list_versions", { project: "fresh" }))).length).toBe(2);
  });

  it("refuses paths outside its root", async () => {
    const r = await call("validate_video", { project: "../.." });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/outside the folder/);
  });

  it("returns frames as images", async () => {
    const r = await call("render_frame", { project: "fresh", time: 1, scale: 0.25 });
    expect(r.content[0]?.type).toBe("image");
    expect((r.content[0]?.data ?? "").length).toBeGreaterThan(1000);
  }, 60_000);
});

describe("reference in sections", () => {
  it("returns the essentials with an index, then sections on request", async () => {
    const first = textOf(await call("get_reference"));
    expect(Buffer.byteLength(first)).toBeLessThan(25_000);
    expect(first).toContain("## 10. Transitions");
    expect(first).toContain("**7. Elements**");
    expect(first).not.toContain("### 7.3 Element types");
    expect(textOf(await call("get_reference", { section: "7" }))).toMatch(/^## 7\. Elements/);
    expect(textOf(await call("get_reference", { section: "behaviors" }))).toMatch(/^### 9\.4 Behaviors/);
    expect(textOf(await call("get_reference", { section: "nope" }))).toContain("No section 'nope'");
    expect(Buffer.byteLength(textOf(await call("get_reference", { section: "all" })))).toBeGreaterThan(50_000);
  });
});

describe("layout and describe filters", () => {
  it("show only visible elements by default, and say how many were left out", async () => {
    const all = JSON.parse(textOf(await call("get_layout", { project: "novae", time: 1, visibleOnly: false })));
    const vis = JSON.parse(textOf(await call("get_layout", { project: "novae", time: 1 })));
    expect(vis.elements.every((e: { visible: boolean }) => e.visible)).toBe(true);
    expect(vis.elements.length).toBeLessThan(all.elements.length);
    expect(vis.omitted).toContain(`${all.elements.length - vis.elements.length} elements not shown`);
  }, 60_000);
});

describe("design review", () => {
  it("comes with every contact sheet and in the create-video prompt", async () => {
    const r = await call("render_contact_sheet", { project: "novae", count: 4 });
    expect(textOf(r)).toContain("Name the 3 biggest problems");
    const p = await client.getPrompt({ name: "create-video", arguments: { brief: "A 10s reel" } });
    expect(JSON.stringify(p.messages)).toContain("design review");
  }, 120_000);
});
