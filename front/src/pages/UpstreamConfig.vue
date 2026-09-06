<template>
  <AdminLayout>
    <h2>上游 API 配置</h2>
    <div v-if="config" class="form">
      <div class="field">
        <label>Base URL</label>
        <input v-model="config.baseUrl" placeholder="https://api.deepseek.com/v1" />
      </div>
      <div class="field">
        <label>API Key</label>
        <input v-model="config.apiKey" type="password" placeholder="sk-..." />
      </div>
      <div class="field">
        <label>默认模型</label>
        <input v-model="config.defaultModel" placeholder="deepseek-chat" />
      </div>
      <div class="field">
        <label>并发上限</label>
        <input v-model.number="config.maxConcurrency" type="number" min="1" max="50" />
      </div>
      <div class="field">
        <label>
          <input type="checkbox" v-model="config.enabled" />
          启用
        </label>
      </div>
      <div class="actions">
        <button class="btn" @click="testConn" :disabled="testing">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
        <button class="btn primary" @click="onSave" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
      <div v-if="testResult" class="result" :class="testResult.ok ? 'ok' : 'err'">
        {{ testResult.message }}
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'

const config = ref(null)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

onMounted(async () => {
  const r = await fetch('/api/admin/config')
  if (r.ok) config.value = await r.json()
})

async function onSave() {
  saving.value = true
  const r = await fetch('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.value),
  })
  saving.value = false
  if (r.ok) alert('保存成功')
}

async function testConn() {
  testing.value = true
  testResult.value = null
  try {
    const r = await fetch('/api/admin/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: config.value.baseUrl,
        apiKey: config.value.apiKey,
        model: config.value.defaultModel,
      }),
    })
    testResult.value = await r.json()
  } catch (e) {
    testResult.value = { ok: false, message: '测试失败：' + e.message }
  }
  testing.value = false
}
</script>

<style scoped>
h2 { margin-bottom: 20px; }
.form { max-width: 600px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; color: var(--text-sub); margin-bottom: 6px; }
.field input[type="text"], .field input[type="password"], .field input[type="number"] {
  width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 10px 12px; border-radius: 8px; font-size: 14px; outline: none;
}
.field input:focus { border-color: var(--primary); }
.actions { display: flex; gap: 10px; margin-top: 20px; }
.result {
  margin-top: 16px; padding: 10px 14px; border-radius: 8px; font-size: 14px;
}
.result.ok { background: rgba(52,211,153,.1); color: #10b981; }
.result.err { background: rgba(248,113,113,.1); color: #f87171; }
</style>
