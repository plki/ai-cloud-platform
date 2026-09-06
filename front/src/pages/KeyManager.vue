<template>
  <AdminLayout>
    <div class="head">
      <h2>子 Key 管理</h2>
      <button class="btn" @click="loadKeys">刷新</button>
    </div>
    <table v-if="keys.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>每日调用</th>
          <th>每日 Token</th>
          <th>状态</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="k in keys" :key="k.id">
          <td><code>{{ k.id.slice(0, 12) }}...</code></td>
          <td>{{ k.calls_daily }} / {{ k.calls_limit }}</td>
          <td>{{ k.tokens_daily?.toLocaleString() }} / {{ k.tokens_limit?.toLocaleString() }}</td>
          <td>
            <span :class="k.disabled ? 'off' : 'on'">
              {{ k.disabled ? '已禁用' : '启用中' }}
            </span>
          </td>
          <td>{{ formatTime(k.created_at) }}</td>
          <td>
            <button class="btn" @click="toggle(k)">
              {{ k.disabled ? '启用' : '禁用' }}
            </button>
            <button class="btn danger" @click="del(k)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无子 Key</div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'

const keys = ref([])

onMounted(loadKeys)

async function loadKeys() {
  const r = await fetch('/api/admin/keys')
  if (r.ok) keys.value = await r.json()
}

async function toggle(k) {
  await fetch('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle', id: k.id }),
  })
  loadKeys()
}

async function del(k) {
  if (!confirm('确定删除？')) return
  await fetch('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id: k.id }),
  })
  loadKeys()
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
th { color: var(--text-sub); font-weight: 500; }
.on { color: #10b981; }
.off { color: #f87171; }
.empty { padding: 40px; text-align: center; color: var(--text-sub); }
</style>
