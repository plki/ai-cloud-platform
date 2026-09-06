<template>
  <router-view />
</template>

<script setup>
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
