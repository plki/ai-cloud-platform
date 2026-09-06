import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const config = ref(loadSettings())
  const userKey = ref(localStorage.getItem('aicp_user_key') || '')
  const userKeyQuota = ref(null)

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem('aicp_settings')) || {} }
    catch { return {} }
  }

  function saveSettings(s = null) {
    if (s) config.value = s
    try { localStorage.setItem('aicp_settings', JSON.stringify(config.value)) }
    catch {}
  }

  function setUserKey(key) {
    userKey.value = key
    localStorage.setItem('aicp_user_key', key)
  }

  async function fetchQuota() {
    if (!userKey.value) return
    try {
      const r = await fetch(`/api/keys/status`, {
        headers: { 'Authorization': `Bearer ${userKey.value}` }
      })
      if (r.ok) {
        userKeyQuota.value = await r.json()
      }
    } catch {}
  }

  const hasConfig = computed(() => !!(config.value.baseUrl || config.value.model))

  return { config, userKey, userKeyQuota, saveSettings, setUserKey, fetchQuota, hasConfig }
})
