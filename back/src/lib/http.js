const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export function json(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS })
}

export function maskedKey(key) {
  if (!key || key.length < 10) return '***'
  return key.slice(0, 6) + '***' + key.slice(-4)
}