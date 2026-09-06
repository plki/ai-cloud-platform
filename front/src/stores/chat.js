import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref(loadConvs())
  const currentId = ref(null)
  const busy = ref(false)
  const comparing = ref(false)
  const selectedModels = ref([])

  function loadConvs() {
    try { return JSON.parse(localStorage.getItem('aicp_convs')) || [] }
    catch { return [] }
  }

  function saveConvs() {
    try { localStorage.setItem('aicp_convs', JSON.stringify(conversations.value)) }
    catch {}
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }

  function newConversation() {
    const c = { id: newId(), title: '新对话', messages: [] }
    conversations.value.unshift(c)
    currentId.value = c.id
    saveConvs()
    return c
  }

  function selectConversation(id) {
    currentId.value = id
  }

  function delConversation(id) {
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (currentId.value === id) currentId.value = null
    saveConvs()
  }

  function getCurrent() {
    return conversations.value.find(c => c.id === currentId.value)
  }

  function addMessage(role, content) {
    const c = getCurrent()
    if (!c) return
    c.messages.push({ role, content })
    if (c.title === '新对话' && role === 'user') {
      c.title = content.slice(0, 20)
    }
    saveConvs()
  }

  function updateLastAssistant(content) {
    const c = getCurrent()
    if (!c || !c.messages.length) return
    const last = c.messages[c.messages.length - 1]
    if (last.role === 'assistant') {
      last.content = content
    } else {
      c.messages.push({ role: 'assistant', content })
    }
    saveConvs()
  }

  function setComparing(val, models = []) {
    comparing.value = val
    selectedModels.value = models
  }

  return {
    conversations, currentId, busy, comparing, selectedModels,
    newConversation, selectConversation, delConversation,
    getCurrent, addMessage, updateLastAssistant, setComparing, saveConvs,
  }
})
