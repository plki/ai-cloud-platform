<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span class="brand-mark">AI</span>
        <span>管理后台</span>
      </div>
      <nav>
        <router-link to="/admin/dashboard" class="nav-link">📊 统计</router-link>
        <router-link to="/admin/upstream" class="nav-link">🔌 上游 API</router-link>
        <router-link to="/admin/keys" class="nav-link">🔑 子 Key</router-link>
        <router-link to="/admin/search" class="nav-link">🔍 搜索服务</router-link>
        <router-link to="/admin/logs" class="nav-link">📋 调用日志</router-link>
      </nav>
      <div class="admin-foot">
        <router-link to="/" class="nav-link">↩ 返回用户端</router-link>
        <button class="btn" @click="onLogout">登出</button>
      </div>
    </aside>
    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin.js'

const router = useRouter()
const admin = useAdminStore()

onMounted(async () => {
  const status = await admin.checkStatus()
  if (!status.loggedIn) {
    router.push('/admin')
  }
})

async function onLogout() {
  await admin.logout()
  router.push('/admin')
}
</script>

<style scoped>
.admin-layout { display: flex; height: 100vh; width: 100%; }
.admin-sidebar {
  width: 220px; background: var(--sidebar); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.admin-brand {
  padding: 16px; display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--border); font-weight: 600;
}
.brand-mark {
  width: 30px; height: 30px; background: var(--primary); color: #fff;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
}
nav { flex: 1; padding: 8px; }
.nav-link {
  display: block; padding: 10px 12px; border-radius: 8px;
  color: var(--text); text-decoration: none; font-size: 14px; margin-bottom: 4px;
}
.nav-link:hover, .nav-link.router-link-active {
  background: var(--sidebar-hover); color: var(--primary);
}
.admin-foot { padding: 12px; border-top: 1px solid var(--border); }
.admin-main { flex: 1; overflow-y: auto; padding: 24px 32px; }
@media (max-width: 768px) {
  .admin-sidebar { width: 60px; }
  .admin-brand span:last-child, .nav-link { font-size: 0; }
  .nav-link::first-letter { font-size: 16px; }
  .admin-main { padding: 16px; }
}
</style>
