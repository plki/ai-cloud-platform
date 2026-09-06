// Admin: upstream config, search config, test connection
import { json, handleOptions } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'

function maskKey(config) {
  if (!config) return config
  const masked = { ...config }
  if (masked.apiKey && masked.apiKey.length > 10) {
    masked.apiKey = masked.apiKey.slice(0, 6) + '***' + masked.apiKey.slice(-4)
  }
  return masked
}

function unmaskKey(stored, incoming) {
  if (!incoming) return null
  if (incoming.includes('***')) return stored?.apiKey || null
  return incoming
}

export async function handleAdminConfig(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  if (request.method === 'GET') {
    const raw = await env.KV.get('upstream:primary')
    return json(200, raw ? maskKey(JSON.parse(raw)) : {
      baseUrl: '', apiKey: '', defaultModel: '', models: [], maxConcurrency: 5, enabled: false,
    })
  }
  if (request.method === 'POST') {
    let body
    try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }

    const stored = await env.KV.get('upstream:primary')
    const storedObj = stored ? JSON.parse(stored) : null
    const apiKey = unmaskKey(storedObj, body.apiKey)

    const config = {
      baseUrl: (body.baseUrl || '').replace(/\/+$/, ''),
      apiKey: apiKey || '',
      defaultModel: body.defaultModel || '',
      models: Array.isArray(body.models) ? body.models : [],
      maxConcurrency: Number(body.maxConcurrency) || 5,
      enabled: !!body.enabled,
    }

    await env.KV.put('upstream:primary', JSON.stringify(config))
    return json(200, { ok: true, config: maskKey(config) })
  }
  return json(405, { error: 'Method Not Allowed' })
}

export async function handleAdminTest(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  let body
  try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }
  const { baseUrl, apiKey, model } = body
  if (!baseUrl || !apiKey || !model) {
    return json(400, { ok: false, message: '缺少 baseUrl / apiKey / model' })
  }

  try {
    const r = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    })
    if (r.ok) {
      return json(200, { ok: true, message: '连接成功，模型可用' })
    }
    const t = await r.text()
    return json(200, { ok: false, message: `上游返回 ${r.status}: ${t.slice(0, 200)}` })
  } catch (e) {
    return json(200, { ok: false, message: '连接失败: ' + e.message })
  }
}

export async function handleAdminSearchConfig(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  if (request.method === 'GET') {
    const raw = await env.KV.get('search:config')
    return json(200, raw ? maskKey(JSON.parse(raw)) : { provider: '', apiKey: '', depth: 'basic' })
  }
  if (request.method === 'POST') {
    let body
    try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }
    const stored = await env.KV.get('search:config')
    const storedObj = stored ? JSON.parse(stored) : null
    const apiKey = unmaskKey(storedObj, body.apiKey)

    const config = {
      provider: body.provider || '',
      apiKey: apiKey || '',
      depth: body.depth || 'basic',
    }
    await env.KV.put('search:config', JSON.stringify(config))
    return json(200, { ok: true })
  }
  return json(405, { error: 'Method Not Allowed' })
}