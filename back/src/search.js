// Standalone search endpoint (user-facing)
import { json } from './lib/http.js'

async function getSearchConfig(env) {
  const raw = await env.KV.get('search:config')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function searchTavily(apiKey, query, depth = 'basic') {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: depth }),
  })
  if (!r.ok) return null
  const j = await r.json()
  return (j.results || []).slice(0, 5).map(r => ({ title: r.title, url: r.url, snippet: r.content }))
}

async function searchSerp(apiKey, query) {
  const r = await fetch(
    `https://serpapi.com/search.json?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&num=5`
  )
  if (!r.ok) return null
  const j = await r.json()
  return (j.organic_results || []).slice(0, 5).map(r => ({ title: r.title, url: r.link, snippet: r.snippet }))
}

async function searchBing(apiKey, query) {
  const r = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`,
    { headers: { 'Ocp-Apim-Subscription-Key': apiKey } }
  )
  if (!r.ok) return null
  const j = await r.json()
  return (j.webPages?.value || []).slice(0, 5).map(r => ({ title: r.name, url: r.url, snippet: r.snippet }))
}

export async function handleSearch(request, env) {
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })
  let body
  try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }

  const { query } = body
  if (!query || !query.trim()) return json(400, { error: '查询不能为空' })

  const config = await getSearchConfig(env)
  if (!config || !config.provider || !config.apiKey) {
    return json(400, { error: '管理员未配置搜索服务' })
  }

  let results = null
  if (config.provider === 'tavily') results = await searchTavily(config.apiKey, query, config.depth)
  else if (config.provider === 'serpapi') results = await searchSerp(config.apiKey, query)
  else if (config.provider === 'bing') results = await searchBing(config.apiKey, query)

  if (!results) return json(502, { error: '搜索服务暂时不可用' })

  return json(200, { ok: true, results })
}