import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('../pages/ChatPage.vue') },
  { path: '/admin', component: () => import('../pages/AdminLogin.vue') },
  { path: '/admin/dashboard', component: () => import('../pages/Dashboard.vue') },
  { path: '/admin/upstream', component: () => import('../pages/UpstreamConfig.vue') },
  { path: '/admin/keys', component: () => import('../pages/KeyManager.vue') },
  { path: '/admin/search', component: () => import('../pages/SearchConfig.vue') },
  { path: '/admin/logs', component: () => import('../pages/CallLogs.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
