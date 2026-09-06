<template>
  <AdminLayout>
    <h2>搜索服务配置</h2>
    <div v-if="config" class="form">
      <div class="field">
        <label>搜索服务</label>
        <select v-model="config.provider">
          <option value="">关闭</option>
          <option value="tavily">Tavily</option>
          <option value="serpapi">SerpAPI</option>
          <option value="bing">Bing Search</option>
        </select>
      </div>
      <div class="field" v-if="config.provider">
        <label>API Key</label>
        <input v-model="config.apiKey" type="password" placeholder="API Key" />
      </div>
      <div class="field" v-if="config.provider === 'tavily'">
        <label>搜索深度</label>
        <select v-model="config.depth">
          <option value="basic">Basic (快)</option>
          <option value="advanced">Advanced (深)</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn primary" @click="onSave" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'

const config = ref(null)
const saving = ref(false)

onMounted(async () => {
  const r = await fetch('/api/admin/search')
  if (r.ok) config.value = await r.json()
})

async function onSave() {
  saving.value = true
  const r = await fetch('/api/admin/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.value),
  })
  saving.value = false
  if (r.ok) alert('保存成功')
}
</script>

<style scoped>
h2 { margin-bottom: 20px; }
.form { max-width: 600px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; color: var(--text-sub); margin-bottom: 6px; }
.field input, .field select {
  width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 10px 12px; border-radius: 8px; font-size: 14px; outline: none;
}
.field input:focus, .field select:focus { border-color: var(--primary); }
.actions { margin-top: 20px; }
</style>
