<template>
  <div class="inputbar">
    <div class="input-wrap">
      <textarea
        v-model="text"
        ref="textareaEl"
        class="input-area"
        placeholder="输入消息，回车发送（Shift+Enter 换行）..."
        rows="1"
        @keydown="onKeydown"
        @input="autoResize"
      ></textarea>
      <button class="btn primary send-btn" @click="onSend">发送</button>
    </div>
    <div class="input-hint">
      <button class="hint-btn" @click="onUpload" title="上传文件">
        📎
      </button>
      <span class="hint-text">使用 AI 前请先在设置中配置 API</span>
      <input ref="fileInput" type="file" style="display:none" accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.txt,.md,.docx" @change="onFileChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ modelValue: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'upload'])

const text = ref(props.modelValue || '')
const textareaEl = ref(null)
const fileInput = ref(null)

watch(() => props.modelValue, v => { text.value = v || '' })

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  }
}

function onSend() {
  if (!text.value.trim() || props.disabled) return
  emit('send', text.value)
  text.value = ''
  autoResize()
}

function autoResize() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function onUpload() {
  fileInput.value?.click()
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) emit('upload', file)
  e.target.value = ''
}
</script>

<style scoped>
.inputbar {
  background: var(--sidebar); border-top: 1px solid var(--border);
  padding: 12px 24px; flex-shrink: 0;
}
.input-wrap {
  max-width: 860px; margin: 0 auto;
  display: flex; gap: 10px; align-items: flex-end;
}
.input-area {
  flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 11px 14px; border-radius: 12px; font-size: 14px; outline: none;
  resize: none; min-height: 44px; max-height: 160px;
  font-family: inherit; line-height: 1.5;
}
.input-area:focus { border-color: var(--primary); }
.input-area::placeholder { color: var(--text-sub); }
.send-btn { height: 44px; padding: 0 22px; flex-shrink: 0; }
.input-hint {
  max-width: 860px; margin: 6px auto 0;
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-sub);
}
.hint-btn { background: none; border: none; font-size: 16px; cursor: pointer; }
.hint-text { flex: 1; }
</style>
