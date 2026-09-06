// Authentication utilities: PBKDF2 password hashing + session management
// Uses Web Crypto API (built into Workers), no external deps needed

export async function hashPassword(password, salt = null) {
  const encoder = new TextEncoder()
  const saltBuf = salt || crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  const saltHex = Array.from(saltBuf).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hash}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [saltHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)))
  const computed = await hashPassword(password, salt)
  // Constant-time comparison
  const a = new TextEncoder().encode(computed)
  const b = new TextEncoder().encode(stored)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function generateToken() {
  const buf = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(env) {
  const token = generateToken()
  const session = { token, createdAt: Date.now(), expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  await env.KV.put(`admin:session:${token}`, JSON.stringify(session), {
    expirationTtl: 7 * 24 * 60 * 60,
  })
  return token
}

export async function getSession(env, request) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/aicp_admin=([^;]+)/)
  if (!match) return null
  const token = match[1]
  const raw = await env.KV.get(`admin:session:${token}`)
  if (!raw) return null
  try {
    const session = JSON.parse(raw)
    if (session.expiresAt < Date.now()) {
      await env.KV.delete(`admin:session:${token}`)
      return null
    }
    return session
  } catch {
    return null
  }
}

export async function requireAdmin(env, request) {
  const session = await getSession(env, request)
  if (!session) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

export function sessionCookie(token, maxAge = 604800) {
  return `aicp_admin=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export function clearCookie() {
  return 'aicp_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
}