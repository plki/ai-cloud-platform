// Admin: shared helpers (auth + CORS wrapper)
import { requireAdmin } from '../lib/auth.js'

export async function adminGuard(env, request) {
  return await requireAdmin(env, request)
}
