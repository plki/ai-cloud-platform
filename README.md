# AI Cloud Platform v2

云端 AI 对话平台，前后端分离架构。

## 功能

- 多人对话 / 流式 SSE
- 多模型同时对比（同一问题并行调用多个模型）
- 文件上传（R2 存储，公开 URL）
- 联网搜索（Tavily / SerpAPI / Bing）
- 用户子 Key + 配额管理
- 管理员后台：首次设密码 / 上游 API / 搜索服务 / 子 Key / 调用日志 / 运营统计

## 架构

| 层级 | 技术 |
|------|------|
| 前端 | Vite 5 + Vue 3 + Vue Router + Pinia + Chart.js |
| 后端 | Cloudflare Workers (ES Modules) |
| 存储 | KV（配置/会话） + D1（子 Key/日志） + R2（文件） |
| 部署 | Cloudflare Pages + Workers（GitHub Actions 自动） |

## 部署

### 一次性配置

1. **Cloudflare 资源创建**：
   ```bash
   # D1 数据库
   wrangler d1 create ai-cloud-platform
   # 把返回的 database_id 填到 back/wrangler.toml

   # KV namespace
   wrangler kv namespace create KV
   # 把返回的 id 填到 back/wrangler.toml

   # R2 bucket
   wrangler r2 bucket create ai-cloud-uploads
   ```

2. **GitHub Secrets 配置**（仓库 Settings → Secrets）：
   - `CF_API_TOKEN`：Cloudflare API Token（Workers/R2/D1/Pages 权限）
   - `CF_ACCOUNT_ID`：Cloudflare 账户 ID

3. **Cloudflare Pages 部署**：
   - 在 Cloudflare Dashboard 创建 Pages 项目 `ai-cloud-platform`
   - 连接 GitHub 仓库，框架选 Vue，构建命令 `npm run build`，输出目录 `front/dist`
   - 根目录设为 `front`（重要，否则会读到根目录的 package.json）

4. **Workers 部署**：
   - 在 Cloudflare Dashboard 创建 Worker（也可用 wrangler）
   - 部署命令会在 GitHub Actions 中自动执行

### 本地开发

```bash
# 前端
cd front
npm install
npm run dev
# 访问 http://localhost:5173

# 后端
cd back
npm install
npm run dev
# 访问 http://localhost:8787
```

前端通过 vite proxy 把 `/api/*` 转发到 `http://localhost:8787`。

## 安全

- 管理员密码使用 PBKDF2 哈希（10 万次迭代）
- 登录失败 5 次锁定 15 分钟
- 路径穿越防护：所有文件操作走 R2 key 拼接
- 上传 MIME 校验：仅接受图片/PDF/文本文档
- API Key 在日志中脱敏

## 许可证

MIT
