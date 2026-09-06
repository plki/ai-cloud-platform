// Quick integration test for AI Cloud Platform back-end
// Mocks env bindings (KV/D1/R2) and tests the request handlers end-to-end.

import { handleChat, handleModels } from '../src/chat.js'
import { handleUpload } from '../src/files.js'
import { handleSearch } from '../src/search.js'
import { handleKeysApply, handleKeysStatus } from '../src/subkeys.js'
import { _resetMemoryStore } from '../src/lib/ratelimit.js'
import {
  handleAdminInit, handleAdminLogin, handleAdminLogout, handleAdminCheck,
  handleAdminConfig, handleAdminTest, handleAdminSearchConfig, handleAdminKeys,
  handleAdminLogs, handleAdminStats,
} from '../src/admin/index.js'

let passed = 0, failed = 0

const sharedState = { KV: null, D1: null, R2: null }
function freshState() {
  sharedState.KV = makeKV()
  sharedState.D1 = makeD1()
  sharedState.R2 = makeR2()
  _resetMemoryStore()
}

function makeKV(initial = {}) {
  const data = { ...initial }
  return {
    async get(k, type) {
      const v = data[k]
      if (!v) return null
      return type === 'json' ? JSON.parse(v) : v
    },
    async put(k, v) { data[k] = v },
    async delete(k) { delete data[k] },
  }
}

function makeD1() {
  const tables = {
    sub_keys: [],
    call_logs: [],
  }
  return {
    tables,
    prepare(sql) {
      let params = []
      return {
        bind(...args) { params = args; return this },
        async all() {
          if (sql.includes('SELECT * FROM sub_keys ORDER BY')) {
            return { results: tables.sub_keys.slice(0, 200) }
          }
          if (sql.includes('FROM call_logs WHERE 1=1')) {
            let rows = tables.call_logs
            return { results: rows.reverse().slice(0, 50) }
          }
          if (sql.includes('FROM call_logs') && sql.includes('created_at >= ?')) {
            return { results: [] }
          }
          if (sql.includes('SELECT * FROM sub_keys WHERE id = ?')) {
            const r = tables.sub_keys.find(x => x.id === params[0])
            return { results: r ? [r] : [] }
          }
          return { results: [] }
        },
        async first() {
          if (sql.includes('SELECT disabled FROM sub_keys')) {
            return tables.sub_keys.find(x => x.id === params[0]) || null
          }
          if (sql.includes('SELECT * FROM sub_keys WHERE id = ?')) {
            return tables.sub_keys.find(x => x.id === params[0]) || null
          }
          if (sql.includes('SELECT COUNT(*)')) return { c: 0 }
          if (sql.includes('SUM(total_tokens)')) return { t: 0 }
          return null
        },
        async run() {
          if (sql.includes('INSERT INTO sub_keys')) {
            const row = {
              id: params[0], key_hash: params[1], user_ip: params[2],
              created_at: params[3], calls_daily: 0, tokens_daily: 0,
              calls_limit: 100, tokens_limit: 100000,
              last_reset_date: params[4], disabled: 0,
            }
            if (tables.sub_keys.find(x => x.id === row.id)) {
              throw new Error('UNIQUE constraint failed')
            }
            tables.sub_keys.push(row)
            return { success: true }
          }
          if (sql.includes('UPDATE sub_keys SET disabled')) {
            const r = tables.sub_keys.find(x => x.id === params[1])
            if (r) r.disabled = params[0]
            return { success: true }
          }
          if (sql.includes('DELETE FROM sub_keys')) {
            tables.sub_keys = tables.sub_keys.filter(x => x.id !== params[0])
            return { success: true }
          }
          if (sql.includes('INSERT INTO call_logs')) {
            tables.call_logs.push({ id: tables.call_logs.length + 1, ...params })
            return { success: true }
          }
          return { success: true }
        },
      }
    },
  }
}

function makeR2() {
  const store = new Map()
  return {
    async put(k, v) { store.set(k, v) },
    async get(k) { return store.get(k) || null },
  }
}

function makeEnv(overrides = {}) {
  if (!sharedState.KV) freshState()
  return {
    KV: overrides.KV || sharedState.KV,
    D1: overrides.D1 || sharedState.D1,
    R2: overrides.R2 || sharedState.R2,
    PUBLIC_BASE_URL: 'https://test.example.com',
  }
}

function mockReq(method, url, body, headers = {}) {
  const init = { method, headers: new Headers(headers) }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (body instanceof FormData || body instanceof ReadableStream) {
      init.body = body
    } else {
      init.body = JSON.stringify(body)
      init.headers.set('Content-Type', 'application/json')
    }
  }
  return new Request(url, init)
}

function setCookieSession(env, token) {
  env.KV.put(`admin:session:${token}`, JSON.stringify({
    token, createdAt: Date.now(), expiresAt: Date.now() + 3600000,
  }))
}

async function test(name, fn) {
  try {
    await fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
    failed++
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: expected ${expected}, got ${actual}`)
}

function assertOk(cond, msg) {
  if (!cond) throw new Error(msg || 'assertOk')
}

// ==================== Tests ====================

await test('chat: 405 on GET', async () => {
  freshState()
  const r = await handleChat(mockReq('GET', 'http://x/api/chat'), makeEnv())
  assertEqual(r.status, 405, 'status')
})

await test('chat: 400 on empty body', async () => {
  freshState()
  const r = await handleChat(mockReq('POST', 'http://x/api/chat', {}), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('chat: 400 when no apiKey', async () => {
  freshState()
  const r = await handleChat(mockReq('POST', 'http://x/api/chat', {
    messages: [{ role: 'user', content: 'hi' }],
  }), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('chat: 502 on upstream connection fail', async () => {
  freshState()
  const env = makeEnv()
  await env.KV.put('upstream:primary', JSON.stringify({ baseUrl: 'http://127.0.0.1:1', apiKey: 'sk-test' }))
  const r = await handleChat(mockReq('POST', 'http://x/api/chat', {
    messages: [{ role: 'user', content: 'hi' }],
  }), env)
  assertEqual(r.status, 502, 'status')
})

await test('models: 400 when no apiKey', async () => {
  freshState()
  const r = await handleModels(mockReq('POST', 'http://x/api/models', {}), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('upload: 405 on GET', async () => {
  freshState()
  const r = await handleUpload(mockReq('GET', 'http://x/api/upload'), makeEnv())
  assertEqual(r.status, 405, 'status')
})

await test('upload: 400 without multipart', async () => {
  freshState()
  const r = await handleUpload(mockReq('POST', 'http://x/api/upload', {}), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('search: 400 on empty query', async () => {
  freshState()
  const r = await handleSearch(mockReq('POST', 'http://x/api/search', { query: '' }), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('search: 400 when not configured', async () => {
  freshState()
  const r = await handleSearch(mockReq('POST', 'http://x/api/search', { query: 'test' }), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('keys/apply: 200 returns new key', async () => {
  freshState()
  const env = makeEnv()
  await env.KV.put('upstream:primary', JSON.stringify({ baseUrl: 'http://x', apiKey: 'sk' }))
  const r = await handleKeysApply(mockReq('POST', 'http://x/api/keys/apply'), env)
  assertEqual(r.status, 200, 'status')
  const j = await r.json()
  assertOk(j.ok, 'ok')
  assertOk(j.key.startsWith('sk-aicp-'), 'key prefix')
})

await test('keys/apply: 400 when upstream not configured', async () => {
  freshState()
  const r = await handleKeysApply(mockReq('POST', 'http://x/api/keys/apply'), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('keys/apply: 429 after 5 hits from same IP', async () => {
  freshState()
  const env = makeEnv()
  await env.KV.put('upstream:primary', JSON.stringify({ baseUrl: 'http://x', apiKey: 'sk' }))
  for (let i = 0; i < 5; i++) {
    const r = await handleKeysApply(mockReq('POST', 'http://x/api/keys/apply', null, {
      'CF-Connecting-IP': '1.2.3.4',
    }), env)
    assertEqual(r.status, 200, `attempt ${i + 1}`)
  }
  const r6 = await handleKeysApply(mockReq('POST', 'http://x/api/keys/apply', null, {
    'CF-Connecting-IP': '1.2.3.4',
  }), env)
  assertEqual(r6.status, 429, '6th attempt')
})

await test('keys/status: 401 without auth', async () => {
  freshState()
  const r = await handleKeysStatus(mockReq('GET', 'http://x/api/keys/status'), makeEnv())
  assertEqual(r.status, 401, 'status')
})

await test('admin/init: 400 short password', async () => {
  freshState()
  const r = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'short' }), makeEnv())
  assertEqual(r.status, 400, 'status')
})

await test('admin/init: 200 on first init', async () => {
  freshState()
  const env = makeEnv()
  const r = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  assertEqual(r.status, 200, 'status')
  const stored = await env.KV.get('admin:hash')
  assertOk(stored, 'hash stored')
})

await test('admin/init: 400 on re-init', async () => {
  const env = makeEnv()
  await env.KV.put('admin:hash', 'existing:hash')
  const r = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  assertEqual(r.status, 400, 'status')
})

await test('admin/login: 401 wrong password', async () => {
  freshState()
  const env = makeEnv()
  const init = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  await init.text()
  const r = await handleAdminLogin(mockReq('POST', 'http://x/api/admin/login', { password: 'wrong' }), env)
  assertEqual(r.status, 401, 'status')
})

await test('admin/check: returns initialized + loggedIn', async () => {
  freshState()
  const env = makeEnv()
  await env.KV.put('admin:hash', 'salt:hash')  // pre-initialized
  const r = await handleAdminCheck(mockReq('GET', 'http://x/api/admin/check'), env)
  const j = await r.json()
  assertEqual(j.initialized, true, 'initialized')
})

await test('admin/config: 401 without session', async () => {
  freshState()
  const env = makeEnv()
  await env.KV.put('admin:hash', 'salt:hash')
  const r = await handleAdminConfig(mockReq('GET', 'http://x/api/admin/config'), env)
  assertEqual(r.status, 401, 'status')
})

await test('admin/config: GET returns masked', async () => {
  freshState()
  const env = makeEnv()
  const initR = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  const cookie = initR.headers.get('Set-Cookie') || ''
  await env.KV.put('upstream:primary', JSON.stringify({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-verylongapikey12345' }))
  const r = await handleAdminConfig(mockReq('GET', 'http://x/api/admin/config', null, {
    Cookie: cookie.split(';')[0],
  }), env)
  assertEqual(r.status, 200, 'status')
  const j = await r.json()
  assertOk(j.apiKey.includes('***'), 'apiKey masked')
})

await test('admin/keys: POST toggle', async () => {
  freshState()
  const env = makeEnv()
  const initR = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  const cookie = initR.headers.get('Set-Cookie') || ''
  await env.KV.put('upstream:primary', JSON.stringify({ baseUrl: 'http://x', apiKey: 'sk' }))
  const applyR = await handleKeysApply(mockReq('POST', 'http://x/api/keys/apply'), env)
  const j = await applyR.json()
  const r = await handleAdminKeys(mockReq('POST', 'http://x/api/admin/keys', { action: 'toggle', id: j.key }, {
    Cookie: cookie.split(';')[0],
  }), env)
  assertEqual(r.status, 200, 'status')
})

await test('admin/logs: 200 returns array', async () => {
  freshState()
  const env = makeEnv()
  const initR = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  const cookie = initR.headers.get('Set-Cookie') || ''
  const r = await handleAdminLogs(mockReq('GET', 'http://x/api/admin/logs', null, {
    Cookie: cookie.split(';')[0],
  }), env)
  assertEqual(r.status, 200, 'status')
  const rows = await r.json()
  assertOk(Array.isArray(rows), 'rows is array')
})

await test('admin/stats: 200 returns shape', async () => {
  freshState()
  const env = makeEnv()
  const initR = await handleAdminInit(mockReq('POST', 'http://x/api/admin/init', { password: 'longenough123' }), env)
  const cookie = initR.headers.get('Set-Cookie') || ''
  const r = await handleAdminStats(mockReq('GET', 'http://x/api/admin/stats', null, {
    Cookie: cookie.split(';')[0],
  }), env)
  assertEqual(r.status, 200, 'status')
  const j = await r.json()
  assertOk('today_calls' in j, 'today_calls')
  assertOk('trend' in j, 'trend')
  assertOk('models' in j, 'models')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
