// Sub-key management: apply / status / (admin-level via admin/index.js)
import { json } from './lib/http.js'
import { getClientIP, rateLimit } from './lib/ratelimit.js'

function generateKey() {
  // Workers 中可使用 Web Crypto API
  const buf = new Uint8Array(24)
  crypto.getRandomValues(buf)
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sk-aicp-${hex.slice(0, 8)}-${hex.slice(8, 32)}-${hex.slice(32, 48)}`
}

async function hashKey(key) {
  // SHA-256 加密哈希，前 16 字节作为 key_hash（64 字符）
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(key))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
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
  const key = `ratelimit:apply:${ip}`
  const hit = await env.KV.get(key)
  if (hit && parseInt(hit) >= 5) {
    return json(429, { error: '申请过于频繁，请 1 小时后再试' })
  }
  await env.KV.put(key, String((parseInt(hit) || 0) + 1), { expirationTtl: 3600 })

  const newKey = generateKey()
  const keyHash = await hashKey(newKey)
  const now = Date.now()
  const today = todayStr()

  try {
    const upstream = await env.KV.get('upstream:primary')
    if (!upstream) return json(400, { error: '管理员未配置上游 API，无法申请 Key' })

    await env.D1.prepare(`
      INSERT INTO sub_keys (id, key_hash, user_ip, created_at, calls_daily, tokens_daily, calls_limit, tokens_limit, last_reset_date)
      VALUES (?, ?, ?, ?, 0, 0, 100, 100000, ?)
    `).bind(newKey, keyHash, ip, now, today).run()

    return json(200, { ok: true, key: newKey })
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
  const userKey = auth.replace(/^Bearer\s+/i, '').trim()
  if (!userKey) return json(401, { error: '缺少 Authorization' })

  const keyHash = await hashKey(userKey)

  try {
    const row = await env.D1.prepare('SELECT * FROM sub_keys WHERE id = ?').bind(userKey).first()
    if (!row) return json(404, { error: 'Key 不存在' })
    if (row.disabled) return json(403, { error: 'Key 已被禁用' })

    await checkAndResetDaily(env, userKey, row)

    const updated = await env.D1.prepare('SELECT * FROM sub_keys WHERE id = ?').bind(userKey).first()
    const callsLeft = Math.max(0, updated.calls_limit - updated.calls_daily)
    const tokensLeft = Math.max(0, updated.tokens_limit - updated.tokens_daily)

    return json(200, { ok: true, calls_left: callsLeft, tokens_left: tokensLeft })
  } catch (e) {
    return json(500, { error: '查询失败: ' + e.message })
  }
}

// Admin-level key management (called from admin routes)
// Admin-level key management is in admin/keys.js