<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box">
      <div class="modal-head">
        <h3>API 设置</h3>
        <button class="btn close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="field">
        <label>Base URL</label>
        <input v-model="form.baseUrl" placeholder="如 https://api.deepseek.com/v1" />
        <div class="hint">OpenAI 兼容接口，留空默认 https://api.openai.com/v1</div>
      </div>
      <div class="field">
        <label>API Key</label>
        <input v-model="form.apiKey" type="password" placeholder="sk-..." autocomplete="off" />
        <div class="hint">仅保存在你当前浏览器的 localStorage，不会上传到服务器</div>
      </div>
      <div class="field">
        <label>模型名</label>
        <input v-model="form.model" placeholder="如 deepseek-chat / qwen-max / gpt-4o-mini" />
      </div>

      <div v-if="settings.userKey" class="key-info">
        <label>你的 API Key</label>
        <div class="key-display">
          <code>{{ settings.userKey }}</code>
          <button class="btn" @click="copyKey">复制</button>
        </div>
        <div v-if="settings.userKeyQuota" class="quota">
          <span>剩余 {{ settings.userKeyQuota.calls_left }} 次 / {{ settings.userKeyQuota.tokens_left?.toLocaleString() }} tokens</span>
        </div>
        <button class="btn" @click="onApplyKey">重新申请 Key</button>
      </div>
      <div v-else class="key-info">
        <button class="btn primary" @click="onApplyKey">申请个人 API Key</button>
        <div class="hint">申请后可将此 Key 用于外部工具调用（如 curl）</div>
      </div>

      <div class="modal-actions">
        <button class="btn" @click="$emit('close')">关闭</button>
        <button class="btn primary" @click="onSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings.js'

const emit = defineEmits(['close'])
const settings = useSettingsStore()

const form = reactive({
  baseUrl: settings.config.baseUrl || '',
  apiKey: settings.config.apiKey || '',
  model: settings.config.model || '',
})

onMounted(() => {
  settings.fetchQuota()
})

function onSave() {
  settings.saveSettings({ ...form })
  emit('close')
}

function copyKey() {
  navigator.clipboard.writeText(settings.userKey)
}

async function onApplyKey() {
  try {
    const r = await fetch('/api/keys/apply', { method: 'POST' })
    const j = await r.json()
    if (j.key) {
      settings.setUserKey(j.key)
      alert('API Key 申请成功！请妥善保存，只显示这一次：\n' + j.key)
    } else {
      alert('申请失败：' + (j.error || '未知错误'))
    }
  } catch (e) {
    alert('申请失败：' + e.message)
  }
}
</script>

<style scoped>
.modal-overlay {
  display: flex; align-items: center; justify-content: center;
  position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 100;
}
.modal-box {
  background: var(--sidebar); border: 1px solid var(--border); border-radius: 14px;
  width: 520px; max-width: 92%; padding: 22px; max-height: 90vh; overflow-y: auto;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-head h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 4px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; color: var(--text-sub); margin-bottom: 5px; }
.field input {
  width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 9px 11px; border-radius: 8px; font-size: 13px; outline: none;
}
.field input:focus { border-color: var(--primary); }
.hint { font-size: 12px; color: var(--text-sub); margin-top: 4px; }
.key-info { background: var(--msg-bg); padding: 12px; border-radius: 8px; margin-bottom: 14px; }
.key-info label { display: block; font-size: 13px; color: var(--text-sub); margin-bottom: 6px; }
.key-display { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.key-display code { flex: 1; font-size: 12px; word-break: break-all; background: var(--code-bg); color: #e6e6e6; padding: 4px 8px; border-radius: 4px; }
.quota { font-size: 12px; color: var(--text-sub); margin-bottom: 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
</style>
