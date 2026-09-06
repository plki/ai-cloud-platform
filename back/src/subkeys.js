// Sub-key management: apply / status / (admin-level via admin/index.js)
import { json } from './lib/http.js'
import { getClientIP } from './lib/ratelimit.js'

function generateKey() {
  const uuid = crypto.randomUUID().replace(/-/g, '')
  return `sk-aicp-${uuid.slice(0, 8)}-${uuid.slice(8, 24)}`
}

function hashKey(key) {
  // Simple hash for key identification (not for login)
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  }
  return h.toString(16)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

async function checkAndResetDaily(env, keyId, row) {
  const today = todayStr()
  if (row.last_reset_date !== today) {
    await env.D1.prepare(`
      UPDATE sub_keys SET calls_daily = 0, tokens_daily = 0, last_reset_date = ?
      WHERE id = ?
    `).bind(today, keyId).run()
  }
  return today
}

export async function handleKeysApply(request, env) {
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })

  const ip = getClientIP(request)
  const key = generateKey()
  const keyHash = hashKey(key)
  const now = Date.now()
  const today = todayStr()

  try {
    // Check if upstream is configured
    const upstream = await env.KV.get('upstream:primary')
    if (!upstream) return json(400, { error: '管理员未配置上游 API，无法申请 Key' })

    await env.D1.prepare(`
      INSERT INTO sub_keys (id, key_hash, user_ip, created_at, calls_daily, tokens_daily, calls_limit, tokens_limit, last_reset_date)
      VALUES (?, ?, ?, ?, 0, 0, 100, 100000, ?)
    `).bind(key, keyHash, ip, now, today).run()

    return json(200, { ok: true, key })
  } catch (e) {
    if (e.message?.includes('UNIQUE')) {
      return json(400, { error: '该 IP 已申请过 Key' })
    }
    return json(500, { error: '申请失败: ' + e.message })
  }
}

export async function handleKeysStatus(request, env) {
  if (request.method !== 'GET') return json(405, { error: '仅支持 GET' })

  const auth = request.headers.get('Authorization') || ''
  const key = auth.replace(/^Bearer\s+/i, '').trim()
  if (!key) return json(401, { error: '缺少 Authorization' })

  const keyHash = hashKey(key)

  try {
    const row = await env.D1.prepare('SELECT * FROM sub_keys WHERE id = ?').bind(key).first()
    if (!row) return json(404, { error: 'Key 不存在' })
    if (row.disabled) return json(403, { error: 'Key 已被禁用' })

    await checkAndResetDaily(env, key, row)

    const updated = await env.D1.prepare('SELECT * FROM sub_keys WHERE id = ?').bind(key).first()
    const callsLeft = Math.max(0, updated.calls_limit - updated.calls_daily)
    const tokensLeft = Math.max(0, updated.tokens_limit - updated.tokens_daily)

    return json(200, { ok: true, calls_left: callsLeft, tokens_left: tokensLeft })
  } catch (e) {
    return json(500, { error: '查询失败: ' + e.message })
  }
}

// Admin-level key management (called from admin routes)
export async function handleAdminKeys(request, env) {
  if (request.method === 'GET') {
    const rows = await env.D1.prepare('SELECT * FROM sub_keys ORDER BY created_at DESC LIMIT 200').all()
    return json(200, rows.results || [])
  }
  return json(405, { error: 'Method Not Allowed' })
}