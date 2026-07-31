const SERVER_NAME = "xuming-poetry-mcp";
const SERVER_VERSION = "1.0.0";
const DEFAULT_API_BASE = "https://poetry.palemoky.com";
const PROTOCOL_VERSION = "2025-06-18";

const TOOL_DEFINITIONS = [
  {
    name: "search_poems",
    title: "搜索古诗词",
    description: "按关键词搜索近 40 万首中国古诗词，可限定标题、正文或作者。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, description: "搜索词，例如：静夜思、月、李白" },
        search_type: {
          type: "string",
          enum: ["all", "title", "content", "author"],
          default: "all",
          description: "搜索范围"
        },
        page: { type: "integer", minimum: 1, default: 1 },
        page_size: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        language: {
          type: "string",
          enum: ["zh-Hans", "zh-Hant"],
          default: "zh-Hans",
          description: "简体或繁体中文"
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "random_poem",
    title: "随机古诗词",
    description: "随机抽取一首古诗词，可按作者、朝代、体裁筛选，或用单字进行飞花令。",
    inputSchema: {
      type: "object",
      properties: {
        author: { type: "string", description: "作者，例如：李白" },
        dynasty: { type: "string", description: "朝代，例如：唐" },
        types: {
          type: "array",
          items: { type: "string" },
          maxItems: 5,
          description: "一个或多个体裁，例如：[\"五言绝句\", \"七言绝句\"]"
        },
        character: {
          type: "string",
          minLength: 1,
          maxLength: 1,
          description: "飞花令单字，例如：春。使用时不能再指定作者、朝代或体裁。"
        },
        language: {
          type: "string",
          enum: ["zh-Hans", "zh-Hant"],
          default: "zh-Hans"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_authors",
    title: "查询作者",
    description: "分页查询古诗词作者列表。",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "integer", minimum: 1, default: 1 },
        page_size: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        language: { type: "string", enum: ["zh-Hans", "zh-Hant"], default: "zh-Hans" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_dynasties",
    title: "查询朝代",
    description: "列出诗词库中的朝代及相关信息。",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["zh-Hans", "zh-Hant"], default: "zh-Hans" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_poetry_types",
    title: "查询诗词体裁",
    description: "列出五言绝句、七言律诗、宋词、元曲等诗词体裁。",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["zh-Hans", "zh-Hant"], default: "zh-Hans" }
      },
      additionalProperties: false
    }
  },
  {
    name: "poetry_statistics",
    title: "诗词库统计",
    description: "查看诗词、作者、朝代和体裁等数据规模统计。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  }
];

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
    "access-control-expose-headers": "Mcp-Session-Id",
    ...extra
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders({ "content-type": "application/json; charset=utf-8", ...extraHeaders })
  });
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) return fallback;
  return number;
}

function languageOf(args) {
  return args.language === "zh-Hant" ? "zh-Hant" : "zh-Hans";
}

async function upstream(path, params, env) {
  const base = (env?.POETRY_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const url = new URL(path, `${base}/`);
  for (const [key, value] of params.entries()) url.searchParams.append(key, value);

  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": `${SERVER_NAME}/${SERVER_VERSION}` }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = data?.error || data?.message || `上游接口返回 HTTP ${response.status}`;
    throw new Error(String(detail));
  }
  return data;
}

function toolSuccess(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: false
  };
}

function toolFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `查询失败：${message}` }],
    isError: true
  };
}

export async function callTool(name, args = {}, env = {}) {
  try {
    switch (name) {
      case "search_poems": {
        const query = String(args.query || "").trim();
        if (!query) throw new Error("query 不能为空");
        const searchType = ["all", "title", "content", "author"].includes(args.search_type)
          ? args.search_type
          : "all";
        const params = new URLSearchParams({
          q: query,
          type: searchType,
          page: String(clampInteger(args.page, 1, 1, 100000)),
          page_size: String(clampInteger(args.page_size, 10, 1, 20)),
          lang: languageOf(args)
        });
        return toolSuccess(await upstream("/api/v1/poems/search", params, env));
      }
      case "random_poem": {
        const character = String(args.character || "").trim();
        if (character && (args.author || args.dynasty || args.types?.length)) {
          throw new Error("飞花令单字不能与作者、朝代或体裁同时使用");
        }
        if (character && Array.from(character).length !== 1) {
          throw new Error("character 必须是一个汉字");
        }
        const params = new URLSearchParams({ lang: languageOf(args) });
        if (character) params.set("char", character);
        if (args.author) params.set("author", String(args.author));
        if (args.dynasty) params.set("dynasty", String(args.dynasty));
        if (Array.isArray(args.types)) {
          for (const type of args.types.slice(0, 5)) params.append("type", String(type));
        }
        return toolSuccess(await upstream("/api/v1/poems/random", params, env));
      }
      case "list_authors": {
        const params = new URLSearchParams({
          page: String(clampInteger(args.page, 1, 1, 100000)),
          page_size: String(clampInteger(args.page_size, 20, 1, 50)),
          lang: languageOf(args)
        });
        return toolSuccess(await upstream("/api/v1/authors", params, env));
      }
      case "list_dynasties":
        return toolSuccess(
          await upstream("/api/v1/dynasties", new URLSearchParams({ lang: languageOf(args) }), env)
        );
      case "list_poetry_types":
        return toolSuccess(
          await upstream("/api/v1/types", new URLSearchParams({ lang: languageOf(args) }), env)
        );
      case "poetry_statistics":
        return toolSuccess(await upstream("/api/v1/stats", new URLSearchParams(), env));
      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    return toolFailure(error);
  }
}

export async function handleRpc(message, env = {}) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid Request");
  }

  const { id, method, params = {} } = message;
  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, title: "徐铭古诗词 MCP", version: SERVER_VERSION },
        instructions: "使用这些工具搜索中国古诗词、随机抽诗、进行飞花令，或查询作者、朝代和体裁。"
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOL_DEFINITIONS });
    case "tools/call": {
      if (!params.name) return rpcError(id, -32602, "Missing tool name");
      return rpcResult(id, await callTool(params.name, params.arguments || {}, env));
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    default:
      if (!Object.prototype.hasOwnProperty.call(message, "id")) return null;
      return rpcError(id, -32601, "Method not found", { method });
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse({
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      mcp_endpoint: `${url.origin}/mcp`,
      upstream: env?.POETRY_API_BASE || DEFAULT_API_BASE
    });
  }

  if (url.pathname !== "/mcp") return jsonResponse({ error: "Not found" }, 404);
  if (request.method === "GET") {
    return jsonResponse({
      name: SERVER_NAME,
      message: "这是 Streamable HTTP MCP 端点，请使用 POST 发送 JSON-RPC 请求。"
    });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let message;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, "Parse error"), 400);
  }
  if (Array.isArray(message)) {
    return jsonResponse(rpcError(null, -32600, "Batch requests are not supported"), 400);
  }

  const response = await handleRpc(message, env);
  if (response === null) return new Response(null, { status: 202, headers: corsHeaders() });
  return jsonResponse(response);
}

export default { fetch: handleRequest };
