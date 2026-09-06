// Main Worker entry point: route /api/* requests
import { handleOptions, json } from './lib/http.js'
import { handleChat, handleModels } from './chat.js'
import { handleUpload } from './files.js'
import { handleSearch } from './search.js'
import { handleKeysApply, handleKeysStatus, handleAdminKeys } from './subkeys.js'
import {
  handleAdminInit, handleAdminLogin, handleAdminLogout, handleAdminCheck,
  handleAdminConfig, handleAdminTest, handleAdminSearchConfig,
  handleAdminLogs, handleAdminStats,
} from './admin/index.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') return handleOptions()

    // ---- 用户端 API ----
    if (path === '/api/chat') return handleChat(request, env)
    if (path === '/api/models') return handleModels(request, env)
    if (path === '/api/upload') return handleUpload(request, env)
    if (path === '/api/search') return handleSearch(request, env)
    if (path === '/api/keys/apply') return handleKeysApply(request, env)
    if (path === '/api/keys/status') return handleKeysStatus(request, env)

    // ---- 管理员 API ----
    if (path === '/api/admin/init') return handleAdminInit(request, env)
    if (path === '/api/admin/login') return handleAdminLogin(request, env)
    if (path === '/api/admin/logout') return handleAdminLogout(request, env)
    if (path === '/api/admin/check') return handleAdminCheck(request, env)
    if (path === '/api/admin/config') return handleAdminConfig(request, env)
    if (path === '/api/admin/test') return handleAdminTest(request, env)
    if (path === '/api/admin/search') return handleAdminSearchConfig(request, env)
    if (path === '/api/admin/keys') return handleAdminKeys(request, env)
    if (path === '/api/admin/logs') return handleAdminLogs(request, env)
    if (path === '/api/admin/stats') return handleAdminStats(request, env)

    // ---- 默认：404 ----
    return json(404, { error: 'Not Found' })
  },
}