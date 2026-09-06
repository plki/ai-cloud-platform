<template>
  <router-view />
  <div v-if="showDisclaimer" class="disclaimer-overlay" @click.self="dismiss">
    <div class="disclaimer-modal">
      <div class="disclaimer-header">
        <span class="disclaimer-icon">⚠️</span>
        <h2>免责声明</h2>
      </div>
      <div class="disclaimer-body">
        <p>本项目（AI Cloud Platform v1.0）按 <strong>「原样」</strong> 提供，不提供任何明示或暗示的保证。</p>
        <p>使用本项目产生的所有安全风险、数据泄露、账单超支、合规问题等后果，由<strong>您自行承担</strong>。</p>
        <p>部署前请务必完整阅读：</p>
        <ul>
          <li><a href="/DISCLAIMER.md" target="_blank">DISCLAIMER.md</a> — 完整免责声明</li>
          <li><a href="/SECURITY.md" target="_blank">SECURITY.md</a> — 安全策略</li>
          <li><a href="/CHANGELOG.md" target="_blank">CHANGELOG.md</a> — 更新日志</li>
        </ul>
        <p class="disclaimer-warning">请确认您已理解并同意接受上述文件中的全部条款。如不同意，请立即停止使用本项目。</p>
      </div>
      <div class="disclaimer-footer">
        <button class="btn primary" @click="dismiss">我已知晓并同意</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showDisclaimer = ref(false)

onMounted(() => {
  const acknowledged = localStorage.getItem('disclaimer_acknowledged_v1')
  if (!acknowledged) {
    showDisclaimer.value = true
  }
})

function dismiss() {
  localStorage.setItem('disclaimer_acknowledged_v1', Date.now().toString())
  showDisclaimer.value = false
}
</script>

<style>
:root {
  --bg: #f6f7f9;
  --sidebar: #fff;
  --sidebar-hover: #f2f3f5;
  --primary: #4d6bfe;
  --primary-dark: #3b5bfd;
  --text: #1f2329;
  --text-sub: #8f959e;
  --border: #e5e6eb;
  --user-bubble: #d9e4ff;
  --code-bg: #1e1e1e;
  --msg-bg: #f7f8fa;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1d23;
    --sidebar: #20242c;
    --sidebar-hover: #2a2f38;
    --text: #e6e8ec;
    --text-sub: #8b93a1;
    --border: #30343e;
    --user-bubble: #3b5bfd;
    --msg-bg: #262b34;
    --code-bg: #15171c;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  overflow: hidden;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.btn {
  background: #f2f3f5;
  color: var(--text);
  border: 1px solid var(--border);
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background .15s;
  white-space: nowrap;
  font-family: inherit;
}
.btn:hover { background: #e7e9ee; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn.primary:hover { background: var(--primary-dark); }
.btn.danger { background: #f04142; border-color: #f04142; color: #fff; }
.btn.danger:hover { background: #d93838; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.disclaimer-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(4px);
}
.disclaimer-modal {
  background: var(--sidebar); border-radius: 16px;
  width: 560px; max-width: 92%; max-height: 88vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid #f04142;
}
.disclaimer-header {
  padding: 20px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 12px;
}
.disclaimer-icon { font-size: 28px; }
.disclaimer-header h2 { margin: 0; font-size: 20px; color: #f04142; }
.disclaimer-body { padding: 20px 24px; font-size: 14px; line-height: 1.7; }
.disclaimer-body p { margin-bottom: 12px; }
.disclaimer-body ul { margin: 12px 0 12px 20px; }
.disclaimer-body li { margin-bottom: 6px; }
.disclaimer-body a { color: var(--primary); text-decoration: underline; }
.disclaimer-warning {
  background: rgba(240, 65, 66, 0.08); border-left: 3px solid #f04142;
  padding: 12px 16px; border-radius: 6px; font-weight: 500;
}
.disclaimer-footer {
  padding: 16px 24px; border-top: 1px solid var(--border);
  display: flex; justify-content: flex-end; gap: 8px;
}
.disclaimer-footer .btn { padding: 10px 24px; font-size: 14px; }
</style>
