<template>
  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-head">
        <span class="brand">
          <svg width="22" height="22" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#4d6bfe"/><text x="16" y="22" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="white">AI</text></svg>
          云聊
        </span>
      </div>

      <button class="btn new-btn" @click="onNew">
        + 新对话
      </button>

      <div class="conv-list">
        <div
          v-for="c in chat.conversations"
          :key="c.id"
          class="conv-item"
          :class="{ active: c.id === chat.currentId }"
          @click="chat.selectConversation(c.id)"
        >
          <span class="conv-title">{{ c.title || '新对话' }}</span>
          <button class="del-btn" @click.stop="chat.delConversation(c.id)">×</button>
        </div>
      </div>

      <div class="sidebar-foot">
        <button class="btn" @click="showSettings = true">⚙ 设置</button>
        <button class="btn" @click="$router.push('/admin')">🛡 管理</button>
      </div>
    </aside>

    <!-- Chat area -->
    <main class="chat-main">
      <template v-if="current">
        <!-- Compare bar -->
        <div class="compare-bar" v-if="chat.comparing">
          <span>对比模式：{{ chat.selectedModels.join(' | ') }}</span>
          <button class="btn" @click="chat.setComparing(false)">退出对比</button>
        </div>

        <!-- Messages -->
        <div class="messages" ref="msgEl">
          <div v-if="current.messages.length === 0" class="empty-msg">
            <h3>AI 云聊</h3>
            <p>开始一段新对话，或从侧边栏选择一个已有对话</p>
            <div class="quick-btns">
              <button v-for="m in quickModels" :key="m" class="btn" @click="setModel(m)">{{ m }}</button>
            </div>
          </div>

          <div
            v-for="(msg, i) in current.messages"
            :key="i"
            class="msg-row"
            :class="msg.role"
          >
            <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
            <div class="bubble" v-html="renderMarkdown(msg.content)" />
          </div>
        </div>

        <!-- Input -->
        <ChatInput
          :modelValue="inputText"
          :disabled="chat.busy"
          @send="onSend"
          @upload="onUpload"
        />
      </template>

      <template v-else>
        <div class="empty-home">
          <h2>欢迎使用 AI 云聊</h2>
          <p>请从左侧选择对话，或开始新对话</p>
          <button class="btn primary" @click="onNew">+ 新对话</button>
        </div>
      </template>
    </main>

    <!-- Settings modal -->
    <SettingsModal v-if="showSettings" @close="showSettings = false" />

    <!-- Compare modal -->
    <div v-if="showCompare" class="modal-overlay" @click.self="showCompare = false">
      <div class="modal-box">
        <div class="modal-head">
          <h3>多模型对比</h3>
          <button class="btn close-btn" @click="showCompare = false">×</button>
        </div>
        <p class="hint-text">选择 2~4 个模型并行调用，对比回答结果</p>
        <div class="model-grid">
          <label v-for="m in availableModels" :key="m" class="model-chip" :class="{ selected: selectedCompare.includes(m) }">
            <input type="checkbox" :value="m" v-model="selectedCompare" style="display:none" />
            {{ m }}
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showCompare = false">取消</button>
          <button class="btn primary" :disabled="selectedCompare.length < 2" @click="startCompare">开始对比</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useSettingsStore } from '../stores/settings.js'
import { renderMarkdown } from '../utils/markdown.js'
import ChatInput from '../components/ChatInput.vue'
import SettingsModal from '../components/SettingsModal.vue'

const chat = useChatStore()
const settings = useSettingsStore()

const inputText = ref('')
const showSettings = ref(false)
const showCompare = ref(false)
const msgEl = ref(null)
const uploadedFiles = ref([])

const current = computed(() => chat.getCurrent())

const quickModels = ['deepseek-chat', 'gpt-4o-mini', 'qwen-max']
const availableModels = ref(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'deepseek-chat', 'qwen-max', 'qwen-turbo'])
const selectedCompare = ref([])

onMounted(() => {
  if (!chat.conversations.length) {
    chat.newConversation()
  } else if (!chat.currentId) {
    chat.selectConversation(chat.conversations[0].id)
  }
})

watch(() => current.value?.messages, () => {
  nextTick(() => {
    if (msgEl.value) msgEl.value.scrollTop = msgEl.value.scrollHeight
  })
}, { deep: true })

function onNew() {
  chat.newConversation()
  uploadedFiles.value = []
}

function setModel(m) {
  settings.saveSettings({ ...settings.config, model: m })
}

async function onSend(text) {
  if (!current.value) return
  uploadedFiles.value = []
  chat.addMessage('user', text)
  inputText.value = ''

  const stream = await startStream(text, null)
  if (stream) {
    chat.busy = true
    await processStream(stream)
    chat.busy = false
  }
}

async function startStream(text, modelOverride) {
  const { config, userKey } = settings
  const body = {
    messages: current.value.messages.map(m => ({ role: m.role, content: m.content })),
    files: uploadedFiles.value.map(f => f.url),
    search: false,
  }

  if (chat.comparing && chat.selectedModels.length > 1) {
    body.models = chat.selectedModels
  } else {
    body.model = modelOverride || config.model || 'gpt-3.5-turbo'
  }

  // Pass user settings if available (fallback to KV upstream if not set)
  if (config.baseUrl) body.baseUrl = config.baseUrl
  if (config.apiKey) body.apiKey = config.apiKey

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      chat.addMessage('assistant', `错误: ${j.error || res.statusText}`)
      return null
    }
    return res
  } catch (e) {
    chat.addMessage('assistant', `网络错误: ${e.message}`)
    return null
  }
}

async function processStream(res) {
  chat.addMessage('assistant', '')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const modelPrefix = {}

  if (chat.comparing) {
    for (const m of chat.selectedModels) modelPrefix[m] = ''
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const lines = buf.split('\n')
    buf = lines.pop() || ''

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || !line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      let event = 'message'
      let payload = data
      if (line.startsWith('event: ')) {
        const parts = raw.split('\n')
        for (const p of parts) {
          if (p.startsWith('event: ')) event = p.slice(7).trim()
          if (p.startsWith('data: ')) payload = p.slice(6).trim()
        }
      }

      if (event === 'message' || event === 'chunk') {
        try {
          const j = JSON.parse(payload)
          const delta = j.choices?.[0]?.delta?.content || ''
          if (delta) {
            const c = chat.getCurrent()
            if (c && c.messages.length) {
              const last = c.messages[c.messages.length - 1]
              last.content += delta
            }
          }
        } catch {}
      }

      // Multi-model: model-0, model-1, ...
      if (event.startsWith('model-') && !event.endsWith('-error') && !event.endsWith('-done')) {
        try {
          const j = JSON.parse(payload)
          const delta = j.choices?.[0]?.delta?.content || ''
          const idx = event.replace('model-', '')
          const model = chat.selectedModels[parseInt(idx)]
          if (delta && model) {
            modelPrefix[model] = (modelPrefix[model] || '') + delta
          }
        } catch {}
      }

      if (event.endsWith('-error')) {
        try {
          const j = JSON.parse(payload)
          const c = chat.getCurrent()
          if (c) {
            c.messages.push({ role: 'assistant', content: `[${j.model} 出错] ${j.error}` })
          }
        } catch {}
      }
    }

    await nextTick()
  }

  if (chat.comparing) {
    const c = chat.getCurrent()
    if (c && c.messages.length) {
      const last = c.messages[c.messages.length - 1]
      let summary = '### 多模型对比结果\n\n'
      for (const [m, text] of Object.entries(modelPrefix)) {
        summary += `**${m}**:\n${text || '(无响应)'}\n\n---\n\n`
      }
      last.content = summary
    }
  }
}

async function onUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: formData })
    const j = await r.json()
    if (j.ok) {
      uploadedFiles.value.push({ name: j.filename, url: j.url })
      chat.addMessage('user', `[上传了文件: ${j.filename}](${j.url})`)
    } else {
      alert('上传失败: ' + j.error)
    }
  } catch (e) {
    alert('上传失败: ' + e.message)
  }
}

function startCompare() {
  chat.setComparing(true, [...selectedCompare.value])
  showCompare.value = false
}
</script>

<style scoped>
.layout { display: flex; height: 100vh; width: 100%; }

.sidebar {
  width: 260px; background: var(--sidebar); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.sidebar-head {
  padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center;
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; }
.new-btn { margin: 12px; width: calc(100% - 24px); }
.conv-list { flex: 1; overflow-y: auto; padding: 4px 8px; }
.conv-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  font-size: 13px; color: var(--text); margin-bottom: 2px;
}
.conv-item:hover { background: var(--sidebar-hover); }
.conv-item.active { background: var(--primary); color: #fff; }
.conv-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.del-btn {
  background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0;
  color: inherit; padding: 0 4px; flex-shrink: 0;
}
.conv-item:hover .del-btn { opacity: 0.6; }
.del-btn:hover { opacity: 1 !important; }
.sidebar-foot {
  padding: 12px; border-top: 1px solid var(--border);
  display: flex; gap: 8px;
}
.sidebar-foot .btn { flex: 1; text-align: center; font-size: 12px; padding: 8px 4px; }

.chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.compare-bar {
  background: var(--primary); color: #fff; padding: 8px 24px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; flex-shrink: 0;
}
.compare-bar .btn { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.4); color: #fff; }

.messages { flex: 1; overflow-y: auto; padding: 20px 0; }
.empty-msg {
  text-align: center; padding: 60px 24px; color: var(--text-sub);
}
.empty-msg h3 { font-size: 22px; margin-bottom: 10px; color: var(--text); }
.quick-btns { display: flex; gap: 8px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
.quick-btns .btn { font-size: 12px; }

.msg-row { display: flex; gap: 12px; padding: 6px 24px; margin-bottom: 4px; }
.msg-row.user { flex-direction: row-reverse; }
.msg-row.assistant { flex-direction: row; }
.avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; background: var(--msg-bg); flex-shrink: 0; }
.msg-row.user .avatar { background: var(--user-bubble); }
.bubble {
  max-width: 72%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.6;
  word-break: break-word;
}
.msg-row.user .bubble { background: var(--user-bubble); border-bottom-right-radius: 4px; }
.msg-row.assistant .bubble { background: var(--msg-bg); border-bottom-left-radius: 4px; }

.bubble :deep(pre) { position: relative; margin: 8px 0; border-radius: 8px; overflow: hidden; }
.bubble :deep(code) { font-size: 13px; }
.bubble :deep(.copy-btn) {
  position: absolute; top: 6px; right: 8px; background: rgba(255,255,255,.15);
  border: none; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 4px; cursor: pointer;
}
.bubble :deep(h3) { margin: 12px 0 6px; }
.bubble :deep(li) { margin: 4px 0; }
.bubble :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; }
.bubble :deep(th), .bubble :deep(td) { border: 1px solid var(--border); padding: 6px 10px; font-size: 13px; }

.empty-home {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; color: var(--text-sub);
}
.empty-home h2 { color: var(--text); margin: 0; }

.modal-overlay {
  display: flex; align-items: center; justify-content: center;
  position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 100;
}
.modal-box {
  background: var(--sidebar); border: 1px solid var(--border); border-radius: 14px;
  width: 480px; max-width: 92%; padding: 22px; max-height: 90vh; overflow-y: auto;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.modal-head h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 4px; }
.hint-text { color: var(--text-sub); font-size: 13px; margin-bottom: 14px; }
.model-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.model-chip {
  padding: 7px 14px; border: 1px solid var(--border); border-radius: 20px;
  font-size: 13px; cursor: pointer; background: var(--msg-bg);
}
.model-chip.selected { background: var(--primary); border-color: var(--primary); color: #fff; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
