const SERVER_NAME = "xuming-poetry-mcp";
const SERVER_VERSION = "1.0.0";
const DEFAULT_API_BASE = "https://poetry.palemoky.com";
const PROTOCOL_VERSION = "2025-06-18";

const LEGACY_PATHS = {
  "/api/v1/poems/search": "/api/search",
  "/api/v1/poems/random": "/api/poems/random",
  "/api/v1/authors": "/api/authors",
  "/api/v1/dynasties": "/api/dynasties",
  "/api/v1/types": "/api/types",
  "/api/v1/stats": "/api/stats"
};

const CANONICAL_DYNASTIES = new Map([
  ["李白", { id: 6, name: "唐" }],
  ["柳永", { id: 8, name: "宋" }],
  ["岳飞", { id: 8, name: "宋" }]
]);

const CURATED_POEMS = [
  {
    id: "curated-li-bai-shu-dao-nan",
    title: "蜀道难",
    content: [
      "噫吁嚱，危乎高哉！蜀道之难，难于上青天！",
      "蚕丛及鱼凫，开国何茫然！尔来四万八千岁，不与秦塞通人烟。",
      "西当太白有鸟道，可以横绝峨眉巅。地崩山摧壮士死，然后天梯石栈相钩连。",
      "上有六龙回日之高标，下有冲波逆折之回川。黄鹤之飞尚不得过，猿猱欲度愁攀援。",
      "青泥何盘盘，百步九折萦岩峦。扪参历井仰胁息，以手抚膺坐长叹。",
      "问君西游何时还？畏途巉岩不可攀。但见悲鸟号古木，雄飞雌从绕林间。",
      "又闻子规啼夜月，愁空山。蜀道之难，难于上青天，使人听此凋朱颜！",
      "连峰去天不盈尺，枯松倒挂倚绝壁。飞湍瀑流争喧豗，砯崖转石万壑雷。",
      "其险也如此，嗟尔远道之人胡为乎来哉！",
      "剑阁峥嵘而崔嵬，一夫当关，万夫莫开。所守或匪亲，化为狼与豺。",
      "朝避猛虎，夕避长蛇；磨牙吮血，杀人如麻。锦城虽云乐，不如早还家。",
      "蜀道之难，难于上青天，侧身西望长咨嗟！"
    ],
    author: { id: "curated-li-bai", name: "李白" },
    dynasty: { id: 6, name: "唐" },
    type: { id: 99, name: "乐府诗" },
    source: "curated-fallback"
  },
  {
    id: "curated-liu-yong-yu-lin-ling",
    title: "雨霖铃·寒蝉凄切",
    content: [
      "寒蝉凄切，对长亭晚，骤雨初歇。都门帐饮无绪，留恋处，兰舟催发。",
      "执手相看泪眼，竟无语凝噎。念去去，千里烟波，暮霭沉沉楚天阔。",
      "多情自古伤离别，更那堪，冷落清秋节！今宵酒醒何处？杨柳岸，晓风残月。",
      "此去经年，应是良辰好景虚设。便纵有千种风情，更与何人说？"
    ],
    author: { id: "curated-liu-yong", name: "柳永" },
    dynasty: { id: 8, name: "宋" },
    type: { id: 20, name: "宋词" },
    source: "curated-fallback"
  },
  {
    id: "curated-yue-fei-man-jiang-hong",
    title: "满江红·怒发冲冠",
    content: [
      "怒发冲冠，凭栏处、潇潇雨歇。抬望眼、仰天长啸，壮怀激烈。",
      "三十功名尘与土，八千里路云和月。莫等闲、白了少年头，空悲切。",
      "靖康耻，犹未雪；臣子恨，何时灭？驾长车、踏破贺兰山缺。",
      "壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。"
    ],
    author: { id: "curated-yue-fei", name: "岳飞" },
    dynasty: { id: 8, name: "宋" },
    type: { id: 20, name: "宋词" },
    source: "curated-fallback"
  }
];

function normalizePoetryData(value) {
  if (Array.isArray(value)) return value.map(normalizePoetryData);
  if (!value || typeof value !== "object") return value;
  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, normalizePoetryData(child)])
  );
  const authorName = normalized.author?.name || (normalized.name && normalized.dynasty ? normalized.name : null);
  const canonical = CANONICAL_DYNASTIES.get(authorName);
  if (canonical) normalized.dynasty = { ...canonical };
  if (normalized.type?.name === "宋词") normalized.dynasty = { id: 8, name: "宋" };
  if (normalized.type?.name === "元曲") normalized.dynasty = { id: 9, name: "元" };
  return normalized;
}

function curatedMatches(query, searchType) {
  const needle = query.toLowerCase();
  return CURATED_POEMS.filter((poem) => {
    if (searchType === "title") return poem.title.toLowerCase().includes(needle);
    if (searchType === "author") return poem.author.name.toLowerCase().includes(needle);
    if (searchType === "content") return poem.content.some((line) => line.toLowerCase().includes(needle));
    return poem.title.toLowerCase().includes(needle) ||
      poem.author.name.toLowerCase().includes(needle) ||
      poem.content.some((line) => line.toLowerCase().includes(needle));
  });
}

function mergeCuratedSearch(data, query, searchType) {
  const matches = curatedMatches(query, searchType);
  if (!matches.length) return data;
  const payload = data && typeof data === "object" ? { ...data } : {};
  const upstreamItems = Array.isArray(payload.data) ? payload.data : [];
  const seen = new Set(matches.map((poem) => `${poem.author.name}\u0000${poem.title}`));
  payload.data = [
    ...matches,
    ...upstreamItems.filter((poem) => !seen.has(`${poem.author?.name || ""}\u0000${poem.title || ""}`))
  ];
  if (payload.pagination) {
    payload.pagination = { ...payload.pagination, total: Math.max(payload.pagination.total || 0, payload.data.length) };
  }
  return payload;
}

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


function poetryAppHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>古诗词查询</title>
<style>
:root{--ink:#211d18;--muted:#756d62;--paper:#f8f3e8;--red:#b83a2b;--line:#d9c9ae}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font-family:"Noto Serif SC","Songti SC",serif}
main{min-height:100vh;padding:42px 24px;background:linear-gradient(145deg,#fbf8efcc,#efe6d5dd)}
.wrap{max-width:1050px;margin:auto}.brand{font-size:26px;font-weight:700}.brand b{display:inline-grid;place-items:center;width:46px;height:46px;margin-right:14px;border:2px solid var(--red);border-radius:9px;color:var(--red)}
.hero{text-align:center;padding:55px 0 26px}.eyebrow{color:var(--red);letter-spacing:.35em}.hero h1{font-size:clamp(48px,8vw,88px);margin:24px 0 10px;font-weight:600}.sub{font-size:24px;color:var(--muted)}
.search{display:flex;gap:10px;margin:34px auto 18px;padding:8px;border:1.5px solid var(--red);border-radius:18px;background:#fffaf1;box-shadow:0 12px 30px #6b4f2a18}
.search input{flex:1;min-width:0;border:0;outline:0;background:transparent;padding:18px 20px;font-size:20px;color:var(--ink)}
.search button{border:0;border-radius:12px;padding:0 48px;background:var(--red);color:white;font-size:22px;font-weight:700;cursor:pointer}
.hot{text-align:center;color:var(--muted);margin-bottom:32px}.hot button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:5px 9px}.hot button:hover{color:var(--red)}
.status{text-align:center;color:var(--muted);padding:30px}.results{display:grid;gap:18px}
.poem{background:#fffaf1;border:1px solid var(--line);border-radius:18px;padding:26px 30px;box-shadow:0 8px 24px #5d452415}
.meta{color:var(--red);font-size:15px}.poem h2{font-size:30px;margin:10px 0 18px}.lines{font-size:18px;line-height:2;white-space:pre-wrap}.error{color:#a52020}
@media(max-width:640px){main{padding:22px 14px}.hero{padding-top:30px}.sub{font-size:18px}.search button{padding:0 24px}.poem{padding:22px}.poem h2{font-size:25px}}
</style>
</head>
<body>
<main><div class="wrap">
<div class="brand"><b>诗</b>古诗词查询</div>
<section class="hero"><div class="eyebrow">千年文脉 · 一键寻诗</div><h1>古诗词查询</h1><div class="sub">搜诗名、作者或诗句</div></section>
<form id="searchForm" class="search"><input id="keyword" autocomplete="off" placeholder="例如：李白、蜀道难、床前明月光"><button>查询</button></form>
<div class="hot">热门搜索：<button data-q="李白">李白</button> / <button data-q="柳永">柳永</button> / <button data-q="岳飞">岳飞</button> / <button data-q="蜀道难">蜀道难</button></div>
<div id="status" class="status">输入关键词开始查询</div><section id="results" class="results"></section>
</div></main>
<script>
const form=document.getElementById("searchForm"),input=document.getElementById("keyword"),statusEl=document.getElementById("status"),results=document.getElementById("results");
document.querySelectorAll("[data-q]").forEach(function(btn){btn.addEventListener("click",function(){input.value=btn.dataset.q;search(btn.dataset.q)})});
form.addEventListener("submit",function(e){e.preventDefault();search(input.value)});
function addText(parent,tag,text,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=text;parent.appendChild(el);return el}
async function search(raw){
 const q=String(raw||"").trim();if(!q)return;
 statusEl.className="status";statusEl.textContent="正在查询…";results.replaceChildren();
 try{
  const res=await fetch("/mcp",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:Date.now(),method:"tools/call",params:{name:"search_poems",arguments:{query:q,search_type:"all",page:1,page_size:20}}})});
  const json=await res.json(),tool=json.result;
  if(!res.ok||tool&&tool.isError)throw new Error(tool&&tool.content&&tool.content[0]&&tool.content[0].text||"查询失败");
  const poems=tool&&tool.structuredContent&&Array.isArray(tool.structuredContent.data)?tool.structuredContent.data:[];
  if(!poems.length){statusEl.textContent="暂未找到相关诗词";return}
  statusEl.textContent="找到 "+poems.length+" 条结果";
  poems.forEach(function(p){
   const card=document.createElement("article");card.className="poem";
   const dynasty=p.dynasty&&p.dynasty.name||"未知朝代",author=p.author&&p.author.name||"佚名",type=p.type&&p.type.name||"";
   addText(card,"div",dynasty+" · "+author+(type?" · "+type:""),"meta");
   addText(card,"h2",p.title||"无题");
   addText(card,"div",Array.isArray(p.content)?p.content.join("\\n"):String(p.content||""),"lines");
   results.appendChild(card);
  });
 }catch(err){statusEl.className="status error";statusEl.textContent=err&&err.message||"查询失败，请稍后重试"}
}
</script>
</body></html>`;
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: corsHeaders({
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors *"
    })
  });
}

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

  let response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": `${SERVER_NAME}/${SERVER_VERSION}` }
  });
  if (response.status === 404 && LEGACY_PATHS[path]) {
    url.pathname = LEGACY_PATHS[path];
    response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": `${SERVER_NAME}/${SERVER_VERSION}` }
    });
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message || `上游接口返回 HTTP ${response.status}`;
    throw new Error(String(detail));
  }
  return data;
}

function toolSuccess(data) {
  data = normalizePoetryData(data);
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
        let result;
        try {
          result = await upstream("/api/v1/poems/search", params, env);
        } catch (error) {
          if (!curatedMatches(query, searchType).length) throw error;
          result = { data: [], pagination: { page: 1, pageSize: Number(params.get("page_size")), hasMore: false } };
        }
        return toolSuccess(mergeCuratedSearch(result, query, searchType));
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

  if (request.method === "GET" && url.pathname === "/app") {
    return htmlResponse(poetryAppHtml());
  }

  if (request.method === "GET" && url.pathname === "/open") {
    return Response.redirect(new URL("/app", url.origin), 302);
  }

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
