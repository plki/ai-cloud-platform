// Simple IP-based rate limiter using KV
// Uses in-memory Map to avoid repeated KV reads within the same isolate.
// Note: in-memory store is per-isolate; KV is the authoritative store for
// cross-isolate enforcement. A small race window exists across isolates.

const memoryStore = new Map()

export async function rateLimit(env, key, limit = 5, windowSec = 900) {
  const now = Date.now()
  const storeKey = `rl:${key}`

  // Try in-memory first (fast path for same-isolate bursts)
  let entry = memoryStore.get(storeKey)
  if (!entry || now > entry.resetAt) {
    // Fall back to KV
    try {
      const stored = await env.KV.get(storeKey, 'json')
      entry = stored && stored.resetAt > now ? stored : null
    } catch {}
    if (!entry) {
      entry = { count: 0, resetAt: now + windowSec * 1000 }
    }
  }

  entry.count++
  const blocked = entry.count > limit

  memoryStore.set(storeKey, entry)
  try {
    await env.KV.put(storeKey, JSON.stringify(entry), { expirationTtl: windowSec })
  } catch {}

  return blocked
}

export function _resetMemoryStore() {
  memoryStore.clear()
}

export function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
