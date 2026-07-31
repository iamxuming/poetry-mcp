import test from "node:test";
import assert from "node:assert/strict";

import worker, { callTool, handleRpc } from "../src/index.js";

test("initialize returns MCP server metadata", async () => {
  const response = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  assert.equal(response.result.serverInfo.name, "xuming-poetry-mcp");
  assert.equal(response.result.capabilities.tools.listChanged, false);
});

test("tools/list exposes the poetry tools", async () => {
  const response = await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const names = response.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "search_poems",
    "random_poem",
    "list_authors",
    "list_dynasties",
    "list_poetry_types",
    "poetry_statistics"
  ]);
});

test("random poem rejects mixed character and author filters", async () => {
  const response = await callTool("random_poem", { character: "春", author: "李白" });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /不能与作者/);
});

test("HTTP endpoint accepts JSON-RPC", async () => {
  const request = new Request("https://example.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" })
  });
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { jsonrpc: "2.0", id: 3, result: {} });
});
