<template>
  <AdminLayout>
    <h2>运营统计</h2>
    <div v-if="stats" class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">今日调用</div>
        <div class="stat-value">{{ stats.today_calls }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月调用</div>
        <div class="stat-value">{{ stats.month_calls }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">活跃 Key</div>
        <div class="stat-value">{{ stats.active_keys }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日 Token</div>
        <div class="stat-value">{{ stats.today_tokens?.toLocaleString() }}</div>
      </div>
    </div>
    <div v-if="stats" class="charts">
      <div class="chart-card">
        <h3>24 小时调用趋势</h3>
        <div ref="trendEl" class="chart-canvas"></div>
      </div>
      <div class="chart-card">
        <h3>模型使用占比</h3>
        <div ref="modelsEl" class="chart-canvas"></div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const stats = ref(null)
const trendEl = ref(null)
const modelsEl = ref(null)
let trendChart, modelsChart

onMounted(async () => {
  const r = await fetch('/api/admin/stats')
  if (r.ok) {
    stats.value = await r.json()
    drawCharts()
  }
})

function drawCharts() {
  if (trendEl.value && stats.value.trend) {
    trendChart = new Chart(trendEl.value, {
      type: 'line',
      data: {
        labels: stats.value.trend.map(t => t.hour + 'h'),
        datasets: [{
          label: '调用次数',
          data: stats.value.trend.map(t => t.count),
          borderColor: '#4d6bfe',
          backgroundColor: 'rgba(77,107,254,.1)',
          fill: true,
          tension: 0.3,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    })
  }
  if (modelsEl.value && stats.value.models) {
    modelsChart = new Chart(modelsEl.value, {
      type: 'doughnut',
      data: {
        labels: Object.keys(stats.value.models),
        datasets: [{
          data: Object.values(stats.value.models),
          backgroundColor: ['#4d6bfe', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'],
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    })
  }
}
</script>

<style scoped>
h2 { margin-bottom: 20px; }
.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px; margin-bottom: 20px;
}
.stat-card {
  background: var(--msg-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px;
}
.stat-label { color: var(--text-sub); font-size: 12px; margin-bottom: 6px; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--text); }
.charts { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.chart-card {
  background: var(--msg-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px;
}
.chart-card h3 { font-size: 14px; margin-bottom: 12px; }
.chart-canvas { height: 280px; }
@media (max-width: 768px) {
  .charts { grid-template-columns: 1fr; }
}
</style>
