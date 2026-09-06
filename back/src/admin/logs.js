// Admin: call logs + statistics
import { json, handleOptions } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'

export async function handleAdminLogs(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const subKeyId = url.searchParams.get('sub_key_id') || null
  const model = url.searchParams.get('model') || null
  const limit = 50
  const offset = (page - 1) * limit

  let sql = 'SELECT * FROM call_logs WHERE 1=1'
  const params = []
  if (subKeyId) {
    sql += ' AND sub_key_id = ?'
    params.push(subKeyId)
  }
  if (model) {
    sql += ' AND model LIKE ?'
    params.push('%' + model + '%')
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  try {
    const result = await env.D1.prepare(sql).bind(...params).all()
    return json(200, result.results || [])
  } catch (e) {
    return json(500, { error: '查询失败: ' + e.message })
  }
}

export async function handleAdminStats(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    const todayCalls = await env.D1.prepare(
      'SELECT COUNT(*) AS c FROM call_logs WHERE created_at >= ?'
    ).bind(startOfDay).first()

    const monthCalls = await env.D1.prepare(
      'SELECT COUNT(*) AS c FROM call_logs WHERE created_at >= ?'
    ).bind(startOfMonth).first()

    const todayTokens = await env.D1.prepare(
      'SELECT COALESCE(SUM(total_tokens), 0) AS t FROM call_logs WHERE created_at >= ? AND total_tokens IS NOT NULL'
    ).bind(startOfDay).first()

    const activeKeys = await env.D1.prepare(
      'SELECT COUNT(*) AS c FROM sub_keys WHERE disabled = 0'
    ).first()

    const trendRows = await env.D1.prepare(`
      SELECT
        CAST((created_at / 3600000) AS INTEGER) % 24 AS hour,
        COUNT(*) AS count
      FROM call_logs
      WHERE created_at >= ?
      GROUP BY hour
      ORDER BY hour
    `).bind(now.getTime() - 24 * 60 * 60 * 1000).all()

    const trend = Array.from({ length: 24 }, (_, h) => {
      const row = (trendRows.results || []).find(r => r.hour === h)
      return { hour: h, count: row?.count || 0 }
    })

    const modelRows = await env.D1.prepare(`
      SELECT model, COUNT(*) AS count
      FROM call_logs
      WHERE created_at >= ? AND model IS NOT NULL
      GROUP BY model
      ORDER BY count DESC
      LIMIT 10
    `).bind(startOfMonth).all()

    const models = {}
    for (const r of modelRows.results || []) {
      models[r.model] = r.count
    }

    return json(200, {
      today_calls: todayCalls?.c || 0,
      month_calls: monthCalls?.c || 0,
      today_tokens: todayTokens?.t || 0,
      active_keys: activeKeys?.c || 0,
      trend,
      models,
    })
  } catch (e) {
    return json(500, { error: '统计失败: ' + e.message })
  }
}