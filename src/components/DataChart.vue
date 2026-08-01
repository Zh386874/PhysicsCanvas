<template>
  <div class="data-chart">
    <div class="chart-header">
      <select v-model="selectedObjectId" class="obj-select" @change="renderChart">
        <option value="" disabled>选择物体</option>
        <option v-for="obj in trackableObjects" :key="obj.id" :value="obj.id">
          {{ obj.name || `物体#${obj.id}` }}
        </option>
      </select>
      <div class="chart-type-toggle">
        <button :class="{ active: chartType === 'velocity' }" @click="handleTypeChange('velocity')">
          v-t 图
        </button>
        <button :class="{ active: chartType === 'energy' }" @click="handleTypeChange('energy')">
          能量曲线
        </button>
      </div>
      <button class="collapse-btn" @click="$emit('collapse')" title="收起图表">✕</button>
    </div>
    <div ref="chartEl" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { PIXELS_PER_METER } from '../composables/usePhysics'
import { GROUND_DISABLED } from '../constants'

const props = defineProps({
  snapshots: { type: Array, default: () => [] },
  objects: { type: Array, default: () => [] },
  currentFrame: { type: Number, default: 0 }
})

defineEmits(['collapse'])

const chartEl = ref(null)
let chartInstance = null

const selectedObjectId = ref('')
const chartType = ref('velocity')

function handleTypeChange(type) {
  chartType.value = type
  renderChart()
}

// 仅质点/刚体可追踪（有 x/y/vx/vy/mass）
const trackableObjects = computed(() =>
  props.objects.filter((o) => o.type === '质点' || o.type === '刚体')
)

// 自动选择第一个可追踪物体
watch(
  trackableObjects,
  (objs) => {
    if (objs.length > 0 && !selectedObjectId.value) {
      selectedObjectId.value = objs[0].id
      renderChart()
    }
  },
  { immediate: true }
)

// 当回放帧变化时更新图表高亮
watch(
  () => props.currentFrame,
  () => {
    renderChart()
  }
)

onMounted(() => {
  nextTick(() => {
    if (chartEl.value) {
      chartInstance = echarts.init(chartEl.value)
      renderChart()
    }
  })
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

function renderChart() {
  if (!chartInstance) return
  const objId = Number(selectedObjectId.value)
  if (!objId) return

  const obj = props.objects.find((o) => o.id === objId)
  if (!obj) return

  const mass = obj.mass || 1
  const gravity =
    props.snapshots.length > 0
      ? (props.snapshots[0].gravity || 490) / PIXELS_PER_METER // m/s²
      : 9.8
  const groundY = props.snapshots.length > 0 ? props.snapshots[0].groundY : 400
  const groundDisabled = groundY >= GROUND_DISABLED

  // 从 snapshots 提取该物体的时序数据
  const times = [] // 秒
  const vxArr = [] // m/s
  const vyArr = [] // m/s（正=向上）
  const speedArr = [] // m/s
  const keArr = [] // J (½mv²)
  const peArr = [] // J (mgh)
  const meArr = [] // J (ke+pe)

  for (let i = 0; i < props.snapshots.length; i++) {
    const frame = props.snapshots[i]
    const snap = frame.objects.find((o) => o.id === objId)
    if (!snap) continue

    const t = frame.timestamp / 1000 // ms → s
    times.push(t.toFixed(3))

    const vxMs = snap.vx / PIXELS_PER_METER
    const vyMs = -snap.vy / PIXELS_PER_METER // 画布 y 向下为正 → 物理坐标取反
    const speedMs = Math.hypot(vxMs, vyMs)

    vxArr.push(+vxMs.toFixed(4))
    vyArr.push(+vyMs.toFixed(4))
    speedArr.push(+speedMs.toFixed(4))

    // 势能：以 groundY 为基准，高度 h = (groundY - snap.y) / PIXELS_PER_METER
    const h = groundDisabled ? 0 : (groundY - snap.y) / PIXELS_PER_METER
    const ke = 0.5 * mass * speedMs * speedMs
    const pe = groundDisabled ? 0 : mass * gravity * Math.max(0, h) // h<0 时势能为 0（地面以下）
    keArr.push(+ke.toFixed(6))
    peArr.push(+pe.toFixed(6))
    meArr.push(+(ke + pe).toFixed(6))
  }

  // 当前帧索引标记线
  const currentIdx = Math.min(props.currentFrame, times.length - 1)

  if (chartType.value === 'velocity') {
    chartInstance.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: { data: ['vx', 'vy', '速率'], textStyle: { color: '#94a3b8' } },
        grid: { left: 50, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: times, name: 't/s', axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', name: 'v/(m/s)', axisLabel: { color: '#94a3b8' } },
        series: [
          {
            name: 'vx',
            type: 'line',
            data: vxArr,
            itemStyle: { color: '#60a5fa' },
            showSymbol: false
          },
          {
            name: 'vy',
            type: 'line',
            data: vyArr,
            itemStyle: { color: '#f87171' },
            showSymbol: false
          },
          {
            name: '速率',
            type: 'line',
            data: speedArr,
            itemStyle: { color: '#fbbf24' },
            showSymbol: false
          }
        ],
        // 当前帧标记线
        markLine:
          currentIdx >= 0
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#22d3ee', type: 'dashed' },
                data: [{ xAxis: times[currentIdx] }]
              }
            : undefined,
        backgroundColor: 'transparent'
      },
      true
    )
  } else {
    chartInstance.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: { data: ['动能', '势能', '机械能'], textStyle: { color: '#94a3b8' } },
        grid: { left: 50, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: times, name: 't/s', axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', name: 'E/J', axisLabel: { color: '#94a3b8' } },
        series: [
          {
            name: '动能',
            type: 'line',
            data: keArr,
            itemStyle: { color: '#f59e0b' },
            showSymbol: false
          },
          {
            name: '势能',
            type: 'line',
            data: peArr,
            itemStyle: { color: '#3b82f6' },
            showSymbol: false
          },
          {
            name: '机械能',
            type: 'line',
            data: meArr,
            itemStyle: { color: '#22c55e' },
            showSymbol: false
          }
        ],
        markLine:
          currentIdx >= 0
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#22d3ee', type: 'dashed' },
                data: [{ xAxis: times[currentIdx] }]
              }
            : undefined,
        backgroundColor: 'transparent'
      },
      true
    )
  }
}

// 窗口 resize 时重绘
function onResize() {
  chartInstance?.resize()
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<style scoped>
.data-chart {
  background: rgba(var(--vsd-panel-rgb), 0.92);
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  padding: 0.5rem 0.75rem;
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.obj-select {
  padding: 0.25rem 0.5rem;
  background: rgba(var(--vsd-panel-light-rgb), 0.8);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.3);
  border-radius: 4px;
  color: var(--vsd-info);
  font-size: 0.78rem;
  outline: none;
}

.obj-select option {
  background: var(--vsd-panel-light);
  color: var(--vsd-text);
}

.chart-type-toggle {
  display: flex;
  gap: 0.2rem;
  background: rgba(var(--vsd-panel-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 4px;
  padding: 0.1rem;
}

.chart-type-toggle button {
  padding: 0.2rem 0.5rem;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vsd-text-muted);
  cursor: pointer;
  font-size: 0.72rem;
  transition: all 0.2s;
}

.chart-type-toggle button.active {
  background: rgba(var(--vsd-blue-rgb), 0.3);
  color: var(--vsd-info);
}

.collapse-btn {
  margin-left: auto;
  padding: 0.2rem 0.4rem;
  border: none;
  background: transparent;
  color: var(--vsd-text-dim);
  cursor: pointer;
  font-size: 0.85rem;
}

.collapse-btn:hover {
  color: var(--vsd-text-muted);
}

.chart-container {
  width: 100%;
  height: 200px;
}
</style>
