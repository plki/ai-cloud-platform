import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAdminStore = defineStore('admin', () => {
  const loggedIn = ref(false)
  const initialized = ref(false)

  async function checkStatus() {
    try {
      const r = await fetch('/api/admin/check')
      if (r.ok) {
        const data = await r.json()
        initialized.value = data.initialized
        loggedIn.value = data.loggedIn
        return data
      }
    } catch {}
    initialized.value = false
    loggedIn.value = false
    return { initialized: false, loggedIn: false }
  }

  async function login(password) {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await r.json()
    if (r.ok) loggedIn.value = true
    return data
  }

  async function initAdmin(password) {
    const r = await fetch('/api/admin/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await r.json()
    if (r.ok) {
      initialized.value = true
      loggedIn.value = true
    }
    return data
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    loggedIn.value = false
  }

  return { loggedIn, initialized, checkStatus, login, initAdmin, logout }
})
