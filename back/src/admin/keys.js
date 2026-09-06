// Admin: sub-key management (toggle / delete)
import { json, handleOptions } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'

export async function handleAdminKeys(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const guard = await requireAdmin(env, request)
  if (guard) return guard

  if (request.method === 'GET') {
    const rows = await env.D1.prepare(
      'SELECT * FROM sub_keys ORDER BY created_at DESC LIMIT 200'
    ).all()
    return json(200, rows.results || [])
  }
  if (request.method === 'POST') {
    let body
    try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }
    const { action, id } = body
    if (!action || !id) return json(400, { error: '缺少 action 或 id' })

    if (action === 'toggle') {
      const row = await env.D1.prepare('SELECT disabled FROM sub_keys WHERE id = ?').bind(id).first()
      if (!row) return json(404, { error: 'Key 不存在' })
      const newVal = row.disabled ? 0 : 1
      await env.D1.prepare('UPDATE sub_keys SET disabled = ? WHERE id = ?').bind(newVal, id).run()
      return json(200, { ok: true, disabled: newVal === 1 })
    }
    if (action === 'delete') {
      await env.D1.prepare('DELETE FROM sub_keys WHERE id = ?').bind(id).run()
      return json(200, { ok: true })
    }
    return json(400, { error: '未知 action' })
  }
  return json(405, { error: 'Method Not Allowed' })
}