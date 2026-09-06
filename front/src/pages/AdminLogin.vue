<template>
  <div class="login-page">
    <div class="login-box">
      <h2>管理员登录</h2>

      <div v-if="!status.initialized">
        <p>首次使用，请设置管理员密码：</p>
        <input type="password" v-model="password" placeholder="设置密码（至少 8 位）" />
        <input type="password" v-model="confirmPwd" placeholder="确认密码" />
        <button class="btn primary" :disabled="loading" @click="onInit">初始化</button>
      </div>

      <div v-else-if="!status.loggedIn">
        <p>请输入管理员密码：</p>
        <input type="password" v-model="password" placeholder="密码" @keydown.enter="onLogin" />
        <button class="btn primary" :disabled="loading" @click="onLogin">登录</button>
      </div>

      <div v-else>
        <p>已登录，正在跳转...</p>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin.js'

const router = useRouter()
const admin = useAdminStore()

const password = ref('')
const confirmPwd = ref('')
const error = ref('')
const loading = ref(false)
const status = reactive({ initialized: false, loggedIn: false })

onMounted(async () => {
  await refresh()
  password.value = ''
  confirmPwd.value = ''
  if (status.initialized && status.loggedIn) {
    router.push('/admin/dashboard')
  }
})

async function refresh() {
  const data = await admin.checkStatus()
  Object.assign(status, data)
}

async function onInit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = '密码至少 8 位'
    return
  }
  if (password.value !== confirmPwd.value) {
    error.value = '两次密码不一致'
    return
  }
  loading.value = true
  const res = await admin.initAdmin(password.value)
  loading.value = false
  if (res.error) {
    error.value = res.error
  } else {
    password.value = ''
    confirmPwd.value = ''
    router.push('/admin/dashboard')
  }
}

async function onLogin() {
  error.value = ''
  if (!password.value) return
  loading.value = true
  const res = await admin.login(password.value)
  loading.value = false
  if (res.error) {
    error.value = res.error
  } else {
    password.value = ''
    router.push('/admin/dashboard')
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--bg);
}
.login-box {
  background: var(--sidebar); border: 1px solid var(--border);
  border-radius: 14px; padding: 32px; width: 360px;
}
.login-box h2 { margin-bottom: 20px; }
.login-box p { color: var(--text-sub); margin-bottom: 12px; font-size: 14px; }
.login-box input {
  width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text);
  padding: 10px 12px; border-radius: 8px; font-size: 14px; outline: none; margin-bottom: 12px;
}
.login-box input:focus { border-color: var(--primary); }
.login-box .btn { width: 100%; padding: 10px; margin-top: 8px; }
.error { color: #f04142; font-size: 13px; margin-top: 12px; }
</style>
