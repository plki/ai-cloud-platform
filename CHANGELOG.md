# 更新日志

本项目的所有重要变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-09-06

首个 1.0 正式发布版本。完成前后端分离架构重构，修复 1.0 之前发现的所有 P0/P1 缺陷。

### 新增

- **前后端分离架构**：前端 Vite + Vue 3 独立部署到 Cloudflare Pages；后端 Cloudflare Workers (ES Modules) 独立部署
- **多模型对比**：同一问题并行调用 2~4 个模型，结果以 markdown 表格汇总
- **SSE 流式响应**：基于 Server-Sent Events 的实时输出，支持单模型与多模型并发流
- **文件上传**：支持 png/jpg/gif/webp/svg/pdf/txt/md/docx，单文件最大 25MB，存储于 R2
- **联网搜索**：支持 Tavily / SerpAPI / Bing 三家搜索服务商
- **子 Key 配额系统**：用户可申请个人 API Key，默认每日 100 次调用 / 100,000 tokens
- **管理后台**：
  - 首次使用强制设置管理员密码（PBKDF2 + 10 万次迭代）
  - 上游 API 配置（含连接测试）
  - 搜索服务配置
  - 子 Key 管理（启用/禁用/删除）
  - 调用日志（按 Key / 模型筛选，分页）
  - 运营统计（24 小时趋势图 + 模型占比图）
- **安全机制**：
  - 管理员登录失败 5 次锁定 15 分钟
  - 管理员 init 失败 3 次锁定 1 小时
  - 子 Key 申请失败 5 次锁定 1 小时
  - API Key SHA-256 哈希存储
  - 用户密码 PBKDF2 哈希存储
  - CORS、HttpOnly、SameSite=Lax cookie
  - 上传 MIME 类型白名单
  - 输出 API Key 脱敏
- **CI/CD**：GitHub Actions 自动部署（Pages + Workers + D1 schema 同步）
- **测试**：23 项集成测试覆盖所有 API 路由

### 修复（1.0 之前深度 bug 修复）

#### 高危
- **XSS 漏洞**：`utils/markdown.js` 之前直接通过 `v-html` 注入 `marked.parse` 输出，未做 HTML 过滤。现已加 DOMPurify 清洗，并禁用 `script`/`iframe`/`onerror`/`onload` 等危险标签与属性
- **streamSingle 缺少日志记录**：之前成功路径不写 `call_logs`，统计数据缺失。已用 `body.tee()` 异步消费一份流来提取 token usage
- **handleAdminLogout OPTIONS 错误**：之前在 `request.method === 'OPTIONS'` 分支直接返回 200 但缺少 CORS 头，浏览器跨域请求会失败
- **ratelimit TOCTOU 竞争**：之前 read-modify-write 非原子，多个并发请求可能同时通过限流。已重构为 KV 优先 + 内存缓存的递增模式
- **App.vue 缺 `</style>` 标签**：导致 Vite 构建失败
- **admin/keys.js 重复 export**：`handleAdminKeys` 重复定义导致 `requireAdmin` 守卫不生效，未登录用户可操作子 Key

#### 中危
- **processedMessages.mapIndex 无效 API**：之前用 `messages.mapIndex?.(...)` 这种不存在的方法，导致多文件上传时崩溃。已改为手动 reverse 查找
- **subkeys.js hashKey 未使用**：计算了 SHA-256 但未参与 D1 存储，潜在可通过碰撞伪造 Key 唯一性
- **SettingsModal onMounted 覆盖用户输入**：用户填写 form 后，onMounted 用 settings.config 旧值覆盖了 form。已移除
- **vite.config.js 缺少 allowedHosts**：开发环境被 Vite 拒绝跨域请求
- **front-deploy.yml cache-dependency-path 路径错误**：与 working-directory 不一致导致缓存失效

#### 低危
- **subkeys.js generateKey 用 crypto.randomUUID**：替换为 `crypto.getRandomValues(24 bytes)`，随机性更可控
- **handleKeysApply 缺少 IP 限流**：用户可无限申请子 Key。已加 5/小时限流
- **admin/config.js 掩码判断**：用 `apiKey.includes('***')` 判断是否掩码；用户清空密码再保存会触发。已改为检查非空且非掩码
- **admin/keys.js toggle race**：并发 toggle 时偶发状态错乱。已用 `RETURNING disabled` 原子化
- **KeyManager.vue 失败提示缺失**：toggle/del 失败时无任何反馈。已加 alert
- **AdminLogin.vue 残留密码**：已登录时仍显示密码输入框。已清空
- **CallLogs.vue 下一页按钮**：用 `!logs.length` 判断不够精确，已改为 `logs.length < 50`
- **ChatInput.vue v-model 初始化**：缺少 `immediate: true`，与父组件 modelValue 同步延迟一拍
- **SSE 分帧错误**：之前用 `\n` split 错位。已改为 `\n\n` 找事件边界，符合 SSE 规范
- **ChatPage.vue streaming 错误**：失败时留空消息。已用 `updateLastAssistant` 替换

### 变更

- **从 v1 迁移到 v2**：原 v1 单文件 Cloudflare Pages 架构已废弃，迁移到前后端分离
- **依赖**：移除 `axios`（改用 fetch）；新增 `dompurify`（XSS 清洗）
- **前端构建**：ChatPage 改 lazy import，bundle 拆为 9 个 chunk

### 安全公告

- 请所有从 v1 升级到 v2 的用户立即轮换所有 API Key（v1 时期存储方式不同，可能有遗留数据）
- 部署前请设置强密码（至少 8 位，推荐 16+ 位含特殊字符）
- 启用 Cloudflare Access 策略保护 `/admin/*` 路径

## [Unreleased]

### 待办
- 端到端 Playwright 测试
- 多租户隔离（当前所有用户共享同一上游 API 配置）
- 模型可用性健康检查
- 限额超额时友好降级
