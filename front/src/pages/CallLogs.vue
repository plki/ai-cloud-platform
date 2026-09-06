<template>
  <AdminLayout>
    <h2>调用日志</h2>
    <div class="filters">
      <select v-model="filterSubkey">
        <option value="">所有 Key</option>
        <option v-for="k in keys" :key="k.id" :value="k.id">{{ k.id.slice(0, 12) }}...</option>
      </select>
      <input v-model="filterModel" placeholder="模型名" />
      <button class="btn primary" @click="loadLogs">查询</button>
    </div>
    <table v-if="logs.length">
      <thead>
        <tr>
          <th>时间</th>
          <th>Key</th>
          <th>模型</th>
          <th>Token</th>
          <th>延迟</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in logs" :key="l.id">
          <td>{{ formatTime(l.created_at) }}</td>
          <td><code>{{ l.sub_key_id?.slice(0, 12) || '-' }}</code></td>
          <td>{{ l.model || '-' }}</td>
          <td>{{ l.total_tokens || '-' }}</td>
          <td>{{ l.latency_ms || '-' }} ms</td>
          <td>
            <span :class="l.error ? 'err' : 'ok'">
              {{ l.error ? '失败' : '成功' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无日志</div>
    <div v-if="logs.length" class="pagination">
      <button class="btn" :disabled="page <= 1" @click="page--; loadLogs()">上一页</button>
      <span>第 {{ page }} 页</span>
      <button class="btn" :disabled="logs.length < 50" @click="page++; loadLogs()">下一页</button>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'

const logs = ref([])
const keys = ref([])
const page = ref(1)
const filterSubkey = ref('')
const filterModel = ref('')

onMounted(async () => {
  loadKeys()
  loadLogs()
})

async function loadKeys() {
  const r = await fetch('/api/admin/keys')
  if (r.ok) keys.value = await r.json()
}

async function loadLogs() {
  const params = new URLSearchParams({ page: page.value })
  if (filterSubkey.value) params.set('sub_key_id', filterSubkey.value)
  if (filterModel.value) params.set('model', filterModel.value)
  const r = await fetch('/api/admin/logs?' + params)
  if (r.ok) logs.value = await r.json()
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<style scoped>
h2 { margin-bottom: 16px; }
.filters { display: flex; gap: 10px; margin-bottom: 16px; }
.filters select, .filters input {
  background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none;
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
th { color: var(--text-sub); font-weight: 500; }
.ok { color: #10b981; }
.err { color: #f87171; }
.empty { padding: 40px; text-align: center; color: var(--text-sub); }
.pagination { display: flex; gap: 12px; align-items: center; margin-top: 16px; justify-content: center; }
</style>
