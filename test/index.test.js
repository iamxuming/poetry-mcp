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


test("search falls back to the deployed legacy API and restores 蜀道难", async (t) => {
  const requestedPaths = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(String(input));
    requestedPaths.push(url.pathname);
    if (url.pathname.startsWith("/api/v1/")) {
      return new Response(JSON.stringify({ error: { message: "Route not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10 } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

  const result = await callTool("search_poems", {
    query: "蜀道难",
    search_type: "title"
  }, { POETRY_API_BASE: "https://example.test" });

  assert.equal(result.isError, false);
  assert.deepEqual(requestedPaths, ["/api/v1/poems/search", "/api/search"]);
  assert.equal(result.structuredContent.data[0].title, "蜀道难");
  assert.equal(result.structuredContent.data[0].author.name, "李白");
  assert.equal(result.structuredContent.data[0].dynasty.name, "唐");
});

test("author search restores 柳永 and 岳飞", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify(url.pathname.startsWith("/api/v1/")
      ? { error: { message: "Route not found" } }
      : { data: [] }), {
      status: url.pathname.startsWith("/api/v1/") ? 404 : 200,
      headers: { "content-type": "application/json" }
    });
  });

  for (const author of ["柳永", "岳飞"]) {
    const result = await callTool("search_poems", {
      query: author,
      search_type: "author"
    }, { POETRY_API_BASE: "https://example.test" });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.data[0].author.name, author);
    assert.equal(result.structuredContent.data[0].dynasty.name, "宋");
  }
});

test("known authors and poetry types receive canonical dynasties", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    data: [
      {
        title: "测试词",
        author: { name: "柳永" },
        dynasty: { id: 6, name: "唐" },
        type: { id: 20, name: "宋词" }
      },
      {
        title: "测试诗",
        author: { name: "李白" },
        dynasty: { id: 8, name: "宋" },
        type: { id: 99, name: "其他" }
      }
    ]
  }), { status: 200, headers: { "content-type": "application/json" } }));

  const result = await callTool("search_poems", { query: "测试" }, {
    POETRY_API_BASE: "https://example.test"
  });
  assert.deepEqual(result.structuredContent.data.map((poem) => poem.dynasty.name), ["宋", "唐"]);
});


test("open route redirects to the poetry UI", async () => {
  const response = await worker.fetch(new Request("https://example.com/open"), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://gushi.xumingtech.online/");
});
