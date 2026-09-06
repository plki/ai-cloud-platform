// D1 logging helper
export async function recordLog(env, { model, prompt_tokens, completion_tokens, total_tokens, latency_ms, error, ...rest }) {
  try {
    await env.D1.prepare(`
      INSERT INTO call_logs (sub_key_id, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      rest.subKeyId || null,
      model || null,
      prompt_tokens || null,
      completion_tokens || null,
      total_tokens || null,
      latency_ms || null,
      error || null,
      Date.now()
    ).run()
  } catch (e) {
    console.error('Failed to record log:', e.message)
  }
}
