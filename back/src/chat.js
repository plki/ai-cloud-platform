// Chat API: SSE streaming + multi-model concurrent compare
import { json, maskedKey } from './lib/http.js'
import { recordLog } from './lib/log.js'

// Pull upstream config from KV. In dev, fall back to defaults from request body.
async function getUpstream(env, fallback) {
  const raw = await env.KV.get('upstream:primary')
  if (raw) {
    try { return { ...JSON.parse(raw), ...fallback } } catch {}
  }
  return fallback
}

function openaiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

export async function handleChat(request, env) {
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })
  let body
  try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }

  const { messages, files = [], search = false } = body
  let { model, models, baseUrl, apiKey } = body
  if (!Array.isArray(messages) || !messages.length) {
    return json(400, { error: '消息不能为空' })
  }

  // 如果是匿名使用：baseUrl/apiKey 来自用户前端（设置中保存）
  // 如果是子 Key 使用：则从 KV 读管理员配置
  if (!baseUrl || !apiKey) {
    const upstream = await getUpstream(env, {})
    if (!baseUrl) baseUrl = upstream.baseUrl
    if (!apiKey) apiKey = upstream.apiKey
  }
  if (!apiKey) return json(400, { error: '请先在设置中配置 API Key' })
  if (!baseUrl) baseUrl = 'https://api.openai.com/v1'

  // 单模型 vs 多模型对比
  let useCompare = Array.isArray(models) && models.length > 1
  let targetModels
  if (useCompare) {
    targetModels = models
  } else if (model) {
    targetModels = [model]
  } else {
    const upstream = await getUpstream(env, {})
    targetModels = [upstream.defaultModel || 'gpt-3.5-turbo']
  }

  // 联网搜索（拼到第一条 user message 之前）
  let processedMessages = messages
  if (search) {
    try {
      const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content || ''
      const searchResults = await performSearch(env, lastUserText)
      if (searchResults) {
        processedMessages = [
          {
            role: 'system',
            content: `以下是来自网络的最新搜索结果，请参考这些信息回答用户问题：\n\n${searchResults}`,
          },
          ...messages,
        ]
      }
    } catch (e) {
      // 搜索失败不阻断对话
      console.error('Search failed:', e.message)
    }
  }

  // 文件作为 image_url 注入（多模态）
  if (files.length) {
    // 找最后一条 user message
    let lastUserIdx = -1
    for (let i = processedMessages.length - 1; i >= 0; i--) {
      if (processedMessages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx >= 0) {
      const lastUser = processedMessages[lastUserIdx]
      lastUser.content = buildMultimodalContent(lastUser.content, files)
    }
  }

  const start = Date.now()
  // 不记录 apiKey/baseUrl/用户消息内容到日志（仅记录元数据）
  const logMeta = { subKeyId: body.subKeyId, latency_ms: Date.now() - start }
  if (useCompare) {
    return streamMultiCompare(targetModels, processedMessages, baseUrl, apiKey, env, start, logMeta)
  } else {
    return streamSingle(targetModels[0], processedMessages, baseUrl, apiKey, env, start, logMeta)
  }
}

// ===== Search =====
async function performSearch(env, query) {
  const raw = await env.KV.get('search:config')
  if (!raw) return null
  let config
  try { config = JSON.parse(raw) } catch { return null }
  if (!config.provider || !config.apiKey) return null

  if (config.provider === 'tavily') {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.apiKey,
        query: query.slice(0, 200),
        max_results: 5,
        search_depth: config.depth || 'basic',
      }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return (j.results || []).map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n')
  }
  if (config.provider === 'serpapi') {
    const url = `https://serpapi.com/search.json?api_key=${encodeURIComponent(config.apiKey)}&q=${encodeURIComponent(query)}&num=5`
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json()
    return (j.organic_results || []).map(r => `[${r.title}](${r.link})\n${r.snippet}`).join('\n\n')
  }
  if (config.provider === 'bing') {
    const r = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'Ocp-Apim-Subscription-Key': config.apiKey },
    })
    if (!r.ok) return null
    const j = await r.json()
    return (j.webPages?.value || []).map(r => `[${r.name}](${r.url})\n${r.snippet}`).join('\n\n')
  }
  return null
}

// ===== Single-model SSE =====
async function streamSingle(model, messages, baseUrl, apiKey, env, start, logMeta) {
  let upstream
  try {
    upstream = await fetch(openaiUrl(baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })
  } catch (e) {
    recordLog(env, { ...logMeta, model, error: e.message, latency_ms: Date.now() - start })
    return json(502, { error: '连接上游失败: ' + e.message })
  }
  if (!upstream.ok) {
    const t = await upstream.text().catch(() => '')
    recordLog(env, { ...logMeta, model, error: `HTTP ${upstream.status}: ${t.slice(0, 500)}`, latency_ms: Date.now() - start })
    return json(502, { error: `上游错误: ${t.slice(0, 500)}` })
  }

// Tee 上游响应体：一路给客户端（SSE），另一路解析 usage 用于记录日志
  const [clientStream, logStream] = upstream.body.tee()
  let promptTokens = 0, completionTokens = 0, totalTokens = 0
  ;(async () => {
    try {
      const reader = logStream.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
      }
      try {
        const usage = JSON.parse(buf)?.usage
        if (usage) {
          promptTokens = usage.prompt_tokens || 0
          completionTokens = usage.completion_tokens || 0
          totalTokens = usage.total_tokens || 0
        }
      } catch {}
      recordLog(env, { ...logMeta, model, promptTokens, completionTokens, totalTokens, latency_ms: Date.now() - start })
    } catch (e) {
      console.error('streamSingle log error:', e.message)
    }
  })()

  return new Response(clientStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ===== Multi-model compare =====
async function streamMultiCompare(modelList, messages, baseUrl, apiKey, env, start, logMeta) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc = new TextEncoder()

  async function callAndStream(model, eventName) {
    try {
      const r = await fetch(openaiUrl(baseUrl, '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
      })
      if (!r.ok) {
        const err = `HTTP ${r.status}`
        await writer.write(enc.encode(`event: ${eventName}-error\ndata: ${JSON.stringify({ model, error: err })}\n\n`))
        return
      }
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          const data = dataLine.slice(5).trim()
          if (data === '[DONE]') {
            await writer.write(enc.encode(`event: done-${eventName}\ndata: [DONE]\n\n`))
            continue
          }
          await writer.write(enc.encode(`event: ${eventName}\ndata: ${data}\n\n`))
        }
      }
    } catch (e) {
      await writer.write(enc.encode(`event: ${eventName}-error\ndata: ${JSON.stringify({ model, error: e.message })}\n\n`))
    }
  }

  ;(async () => {
    const calls = modelList.map((m, i) => callAndStream(m, `model-${i}`))
    await Promise.all(calls)
    await writer.write(enc.encode(`event: all-done\ndata: [DONE]\n\n`))
    await writer.close()
    recordLog(env, { ...logMeta, model: modelList.join(','), latency_ms: Date.now() - start })
  })()

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ===== Models list =====
export async function handleModels(request, env) {
  let baseUrl, apiKey
  try {
    const body = await request.json()
    baseUrl = body.baseUrl
    apiKey = body.apiKey
  } catch {}
  if (!baseUrl || !apiKey) {
    const upstream = await getUpstream(env, {})
    baseUrl = upstream.baseUrl
    apiKey = upstream.apiKey
  }
  if (!baseUrl || !apiKey) return json(400, { ok: false, error: '缺少 baseUrl 或 apiKey' })

  try {
    const r = await fetch(openaiUrl(baseUrl, '/models'), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) return json(200, { ok: true, models: [] })
    const j = await r.json()
    const models = (j.data || []).map(m => m.id).sort()
    return json(200, { ok: true, models })
  } catch (e) {
    return json(200, { ok: true, models: [] })
  }
}