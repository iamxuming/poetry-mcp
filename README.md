# 徐铭古诗词 MCP

一个面向 ChatGPT、Codex 和其他 MCP 客户端的中国古诗词查询服务。项目部署在 Cloudflare Workers，数据查询由 [palemoky/chinese-poetry-api](https://github.com/palemoky/chinese-poetry-api) 提供，覆盖唐诗、宋词、元曲等近 40 万首作品。

## MCP 工具

- `search_poems`：按全文、标题、正文或作者搜索古诗词
- `random_poem`：随机抽取诗词，可限定作者、朝代、体裁，或进行飞花令
- `list_authors`：分页查询作者
- `list_dynasties`：查询朝代
- `list_poetry_types`：查询诗词体裁
- `poetry_statistics`：查看诗词库统计数据

## 计划地址

```text
https://poetry-mcp.xumingtech.online/mcp
```

该端点采用 Streamable HTTP MCP（JSON-RPC 2.0）。根路径和 `/health` 可用于健康检查。

## 本地开发

```bash
npm install
npm test
npm run dev
```

默认上游 API 为 `https://poetry.palemoky.com`，可在 `wrangler.jsonc` 中修改 `POETRY_API_BASE`。

## 部署

```bash
npx wrangler login
npm run deploy
```

部署成功后，可在 Cloudflare Workers 中为 Worker 添加自定义域名 `poetry-mcp.xumingtech.online`。

## MCP 初始化测试

```bash
curl -X POST "https://poetry-mcp.xumingtech.online/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

## 数据与致谢

- 上游 API：[palemoky/chinese-poetry-api](https://github.com/palemoky/chinese-poetry-api)
- 数据集：[chinese-poetry/chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)

请遵守上游服务的限流规则与相关许可证。
