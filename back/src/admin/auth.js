// Admin: init, login, logout, check
import { json, handleOptions } from '../lib/http.js'
import { hashPassword, verifyPassword, createSession, sessionCookie, clearCookie, getSession } from '../lib/auth.js'
import { rateLimit, getClientIP } from '../lib/ratelimit.js'

export async function handleAdminInit(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })

  const existing = await env.KV.get('admin:hash')
  if (existing) return json(400, { error: '已初始化' })

  let body
  try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }
  const { password } = body
  if (!password || password.length < 8) return json(400, { error: '密码至少 8 位' })

  const ip = getClientIP(request)
  if (await rateLimit(env, `init:${ip}`, 3, 3600)) {
    return json(429, { error: '请求过于频繁' })
  }

  const hashed = await hashPassword(password)
  await env.KV.put('admin:hash', hashed)

  const token = await createSession(env)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(token),
    },
  })
}

export async function handleAdminLogin(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })

  const stored = await env.KV.get('admin:hash')
  if (!stored) return json(400, { error: '尚未初始化' })

  let body
  try { body = await request.json() } catch { return json(400, { error: '无效 JSON' }) }
  const { password } = body

  const ip = getClientIP(request)
  if (await rateLimit(env, `login:${ip}`, 5, 900)) {
    return json(429, { error: '尝试次数过多，请 15 分钟后再试' })
  }

  const ok = await verifyPassword(password, stored)
  if (!ok) return json(401, { error: '密码错误' })

  const token = await createSession(env)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(token),
    },
  })
}

export async function handleAdminLogout(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  if (request.method !== 'POST') return json(200, { ok: true }, { 'Set-Cookie': clearCookie() })

  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/aicp_admin=([^;]+)/)
  if (match) {
    await env.KV.delete(`admin:session:${match[1]}`)
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie(),
    },
  })
}

export async function handleAdminCheck(request, env) {
  if (request.method === 'OPTIONS') return handleOptions()
  const hash = await env.KV.get('admin:hash')
  const session = await getSession(env, request)
  return json(200, { initialized: !!hash, loggedIn: !!session })
}
