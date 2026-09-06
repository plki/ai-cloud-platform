// Simple IP-based rate limiter using KV / in-memory (per isolate)

const memoryStore = new Map()

export async function rateLimit(env, key, limit = 5, windowSec = 900) {
  const now = Date.now()
  const storeKey = `rl:${key}`
  let entry = memoryStore.get(storeKey)
  if (!entry) {
    entry = await env.KV.get(storeKey, 'json')
    if (!entry) entry = { count: 0, resetAt: now + windowSec * 1000 }
  }
  if (now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowSec * 1000 }
  }
  entry.count++
  memoryStore.set(storeKey, entry)
  await env.KV.put(storeKey, JSON.stringify(entry), { expirationTtl: windowSec })
  return entry.count > limit
}

export function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}