<template>
  <div class="chat-page">
    <aside class="sidebar" :class="{ hidden: !sidebarOpen }">
      <div class="sidebar-head">
        <button class="btn primary" @click="onNewChat" style="flex:1">+ 新建对话</button>
        <button class="btn" @click="sidebarOpen = false" title="收起">×</button>
      </div>
      <div class="conv-list">
        <div
          v-for="c in store.conversations"
          :key="c.id"
          class="conv-item"
          :class="{ active: c.id === store.currentId }"
          @click="selectConv(c.id)"
        >
          <span class="conv-title">{{ c.title }}</span>
          <button class="conv-del" @click.stop="onDelConv(c.id)">×</button>
        </div>
        <div v-if="!store.conversations.length" class="empty-hint">
          暂无会话
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn menu-btn" @click="sidebarOpen = !sidebarOpen" title="会话列表">☰</button>
        <span class="topbar-title">{{ currentTitle || 'AI 云聊' }}</span>
        <button class="btn compare-btn" :class="{ active: store.comparing }" @click="toggleCompare" title="多模型对比">
          {{ store.comparing ? `对比 ${store.selectedModels.length}` : '对比' }}
        </button>
        <button class="btn" @click="onFiles">📎</button>
        <button class="btn" :class="{ active: searchOn }" @click="searchOn = !searchOn" title="联网搜索">
          🔍
        </button>
        <select v-model="currentModel" class="model-select">
          <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
        </select>
        <button class="btn" @click="showSettings = true" title="设置">⚙</button>
      </header>

      <div class="messages" ref="messagesEl">
        <div v-if="!currentMessages.length" class="welcome">
          <h2>你好，我是 AI 云聊助手</h2>
          <p>支持多模型对比、文件上传、联网搜索</p>
          <div class="quick-actions">
            <button class="btn" @click="onNewChat">开始新对话</button>
            <button class="btn" @click="showSettings = true">配置 API</button>
            <button class="btn" @click="$router.push('/admin')">管理员入口</button>
          </div>
        </div>

        <div v-for="(m, i) in currentMessages" :key="i" class="msg-row" :class="m.role">
          <div class="avatar">{{ m.role === 'user' ? '我' : 'AI' }}</div>
          <div class="bubble" v-html="renderMsg(m)"></div>
        </div>

        <div v-if="store.comparing" class="compare-grid">
          <div v-for="m in store.selectedModels" :key="m" class="compare-cell">
            <div class="compare-cell-head">{{ m }}</div>
            <div class="compare-cell-body" :ref="el => setCompareBody(m, el)">
              <div v-if="compareLoading[m]" class="thinking">
                <span class="spinner"></span> 等待回复...
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="loading" class="msg-row ai">
          <div class="avatar">AI</div>
          <div class="bubble thinking"><span class="spinner"></span> 等待 AI 回复...</div>
        </div>
      </div>

      <ChatInput
        v-model="inputText"
        :disabled="store.busy"
        @send="onSend"
        @stop="onStop"
      />
    </div>

    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useSettingsStore } from '../stores/settings.js'
import ChatInput from '../components/ChatInput.vue'
import SettingsModal from '../components/SettingsModal.vue'
import { renderMarkdown, escapeHtml } from '../utils/markdown.js'

const store = useChatStore()
const settings = useSettingsStore()

const sidebarOpen = ref(true)
const showSettings = ref(false)
const inputText = ref('')
const loading = ref(false)
const searchOn = ref(false)
const currentModel = ref('')
const modelOptions = ref([])
const messagesEl = ref(null)
const compareBodies = ref({})
const compareLoading = ref({})

const currentMessages = computed(() => {
  const c = store.getCurrent()
  return c ? c.messages.filter(m => m.role !== 'system') : []
})

const currentTitle = computed(() => {
  const c = store.getCurrent()
  return c ? c.title : ''
})

function setCompareBody(model, el) {
  if (el) compareBodies.value[model] = el
}

function renderMsg(m) {
  if (m.role === 'user') return escapeHtml(m.content)
  return renderMarkdown(m.content)
}

function onNewChat() {
  store.newConversation()
  nextTick(scrollToBottom)
}

function selectConv(id) {
  store.selectConversation(id)
  nextTick(scrollToBottom)
}

function onDelConv(id) {
  if (confirm('确定删除该会话？')) store.delConversation(id)
}

function scrollToBottom() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

function toggleCompare() {
  if (store.comparing) {
    store.setComparing(false, [])
  } else {
    const models = modelOptions.value.length
      ? modelOptions.value.slice(0, Math.min(3, modelOptions.value.length))
      : ['deepseek-chat', 'qwen-max']
    store.setComparing(true, models)
  }
}

function onFiles() {
  alert('请在输入框内点击 📎 按钮上传文件')
}

async function refreshModels() {
  if (!settings.config.baseUrl || !settings.config.apiKey) {
    modelOptions.value = settings.config.model ? [settings.config.model] : []
    return
  }
  try {
    const r = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: settings.config.baseUrl,
        apiKey: settings.config.apiKey,
      }),
    })
    const j = await r.json()
    if (j.models && j.models.length) {
      modelOptions.value = j.models
      if (!currentModel.value && settings.config.model) {
        currentModel.value = settings.config.model
      }
    }
  } catch {}
}

async function onSend(text) {
  if (!text.trim() || store.busy) return
  if (!settings.config.apiKey || !settings.config.baseUrl) {
    showSettings.value = true
    return
  }
  if (!store.currentId) store.newConversation()
  const c = store.getCurrent()

  store.addMessage('user', text)
  await nextTick()
  scrollToBottom()

  loading.value = true
  store.busy = true

  const body = {
    messages: c.messages.slice(),
    model: currentModel.value || settings.config.model,
    search: searchOn.value,
  }

  if (store.comparing && store.selectedModels.length > 1) {
    body.models = store.selectedModels
    await sendCompare(body, c)
  } else {
    await sendSingle(body, c)
  }

  loading.value = false
  store.busy = false
  await nextTick()
  scrollToBottom()
}

async function sendSingle(body, c) {
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      c.messages.push({ role: 'system', content: '错误: ' + (err.error || resp.status) })
      store.saveConvs()
      return
    }
    await streamSSE(resp, (delta) => {
      const last = c.messages[c.messages.length - 1]
      if (last && last.role === 'assistant') {
        last.content += delta
      } else {
        c.messages.push({ role: 'assistant', content: delta })
      }
      store.saveConvs()
      nextTick(scrollToBottom)
    })
  } catch (e) {
    c.messages.push({ role: 'system', content: '请求失败: ' + e.message })
    store.saveConvs()
  }
}

async function sendCompare(body, c) {
  for (const m of store.selectedModels) compareLoading.value[m] = true
  const compareTexts = {}

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      c.messages.push({ role: 'system', content: '错误: ' + (err.error || resp.status) })
      store.saveConvs()
      return
    }
    await streamSSE(resp, (delta, event) => {
      const m = event?.replace('model-', '') || 'default'
      compareTexts[m] = (compareTexts[m] || '') + delta
      const el = compareBodies.value[m]
      if (el) el.innerHTML = renderMarkdown(compareTexts[m])
    })
    c.messages.push({
      role: 'system',
      content: '多模型对比结果：\n' + store.selectedModels.map(m =>
        `[${m}]\n${compareTexts[m] || '(无内容)'}`
      ).join('\n\n---\n\n'),
    })
    store.saveConvs()
  } catch (e) {
    c.messages.push({ role: 'system', content: '请求失败: ' + e.message })
    store.saveConvs()
  } finally {
    for (const m of store.selectedModels) compareLoading.value[m] = false
  }
}

async function streamSSE(resp, onDelta) {
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = chunk.split('\n')
      let event = 'message'
      let data = ''
      for (const l of lines) {
        if (l.startsWith('event:')) event = l.slice(6).trim()
        else if (l.startsWith('data:')) data += l.slice(5).trim()
      }
      if (!data) continue
      if (data === '[DONE]') continue
      try {
        const j = JSON.parse(data)
        const delta = j.choices?.[0]?.delta?.content
        if (delta) onDelta(delta, event)
      } catch {}
    }
  }
}

function onStop() {
  location.reload()
}

watch(() => settings.config, refreshModels, { deep: true, immediate: true })
onMounted(() => {
  refreshModels()
  if (store.conversations.length && !store.currentId) {
    store.selectConversation(store.conversations[0].id)
  }
  if (settings.config.model) currentModel.value = settings.config.model
})
</script>

<style scoped>
.chat-page { display: flex; height: 100vh; width: 100%; }
.sidebar {
  width: 260px; background: var(--sidebar); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0; transition: margin-left .25s;
}
.sidebar.hidden { margin-left: -260px; }
.sidebar-head { padding: 12px; display: flex; gap: 8px; border-bottom: 1px solid var(--border); }
.conv-list { flex: 1; overflow-y: auto; padding: 8px; }
.conv-item {
  display: flex; align-items: center; gap: 6px; padding: 10px;
  border-radius: 8px; cursor: pointer; font-size: 13px;
}
.conv-item:hover, .conv-item.active { background: var(--sidebar-hover); }
.conv-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-del {
  background: none; border: none; color: #f04142; cursor: pointer; font-size: 14px;
  display: none;
}
.conv-item:hover .conv-del { display: block; }
.empty-hint { padding: 20px; color: var(--text-sub); font-size: 13px; text-align: center; }

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  height: 52px; background: var(--sidebar); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px; gap: 10px; flex-shrink: 0;
}
.menu-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; }
.topbar-title { font-size: 15px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.model-select {
  background: var(--sidebar); color: var(--text); border: 1px solid var(--border);
  padding: 6px 10px; border-radius: 8px; font-size: 13px; outline: none;
  max-width: 220px; min-width: 0;
}
.compare-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

.messages { flex: 1; overflow-y: auto; padding: 24px; }
.msg-row { max-width: 860px; margin: 0 auto 18px; display: flex; }
.msg-row.user { justify-content: flex-end; }
.avatar {
  width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center;
  justify-content: center; font-size: 16px; flex-shrink: 0; margin-right: 10px;
  background: var(--sidebar-hover);
}
.msg-row.user .avatar { margin: 0 0 0 10px; background: var(--primary); order: 2; }
.bubble {
  max-width: 82%; padding: 10px 14px; border-radius: 12px; line-height: 1.6;
  font-size: 14px; word-break: break-word;
}
.msg-row.user .bubble { background: var(--user-bubble); color: var(--text); white-space: pre-wrap; }
.msg-row.ai .bubble, .msg-row.system .bubble { background: var(--msg-bg); }
.msg-row.system .bubble { color: #f59e0b; }
.thinking { display: flex; align-items: center; gap: 10px; color: var(--text-sub); font-size: 13px; }
.spinner {
  width: 15px; height: 15px; border: 2px solid var(--border); border-top-color: var(--primary);
  border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.welcome {
  text-align: center; padding: 60px 20px; color: var(--text-sub);
}
.welcome h2 { color: var(--text); margin-bottom: 12px; font-size: 22px; }
.welcome p { margin-bottom: 24px; }
.quick-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

.compare-grid {
  display: grid; gap: 12px; max-width: 1200px; margin: 0 auto 18px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.compare-cell {
  background: var(--msg-bg); border-radius: 12px; overflow: hidden;
  border: 1px solid var(--border);
}
.compare-cell-head {
  padding: 8px 12px; background: var(--sidebar-hover); font-size: 12px;
  font-weight: 600; border-bottom: 1px solid var(--border);
}
.compare-cell-body { padding: 12px; min-height: 60px; font-size: 14px; line-height: 1.6; }

@media (max-width: 768px) {
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 50; box-shadow: 2px 0 12px rgba(0,0,0,.2); }
  .sidebar.hidden { margin-left: -260px; }
  .topbar { padding: 0 10px; gap: 6px; }
  .topbar-title { font-size: 13px; }
  .model-select { max-width: 100px; font-size: 12px; }
  .messages { padding: 14px; }
  .msg-row { max-width: 100%; }
  .bubble { max-width: 88%; }
}
</style>
