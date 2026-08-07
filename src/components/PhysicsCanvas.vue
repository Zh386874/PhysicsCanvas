<template>
  <div class="canvas-wrap">
    <!-- 编辑模式工具栏：位于画布顶部，作为独立 div 显示框 -->
    <div v-if="editMode" class="edit-toolbar">
      <button class="tool-btn" :class="{ active: tool === 'select' }" @click="tool = 'select'">
        🖱️ 选择/移动
      </button>
      <button class="tool-btn" :class="{ active: tool === 'ball' }" @click="tool = 'ball'">
        ⚽ 小球
      </button>
      <button class="tool-btn" :class="{ active: tool === 'platform' }" @click="tool = 'platform'">
        ➖ 平台
      </button>
      <button class="tool-btn" :class="{ active: tool === 'conveyor' }" @click="tool = 'conveyor'">
        📦 传送带
      </button>
      <button class="tool-btn" :class="{ active: tool === 'plate' }" @click="tool = 'plate'">
        🟫 板块
      </button>
      <button class="tool-btn" :class="{ active: tool === 'arc' }" @click="tool = 'arc'">
        ⤵ 圆弧
      </button>
      <button class="tool-btn" :class="{ active: tool === 'spring' }" @click="tool = 'spring'">
        🌀 弹簧
      </button>
      <button class="tool-btn" :class="{ active: chargeMode }" @click="chargeMode = !chargeMode">
        ⚡ 带电
      </button>
      <button
        class="tool-btn"
        :class="{ active: tool === 'field' }"
        :disabled="state.field.type === 'none'"
        @click="tool = 'field'"
      >
        ▭ 场区域
      </button>
      <span class="tool-divider"></span>
      <button class="tool-btn" @click="$emit('undo')" title="撤销 (Ctrl+Z)">↶ 撤销</button>
      <button class="tool-btn" @click="$emit('redo')" title="重做 (Ctrl+Y)">↷ 重做</button>
    </div>
    <canvas
      ref="canvasRef"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @click="onCanvasClick"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
      :style="{ cursor: cursorStyle }"
    ></canvas>
    <!-- Shift 吸附提示（仅选择/移动工具时显示） -->
    <div v-if="editMode && tool === 'select'" class="shift-hint">按住 Shift 键可快速贴合线段</div>
    <!-- 重置视图按钮（所有场景常驻右下角） -->
    <button class="reset-view-btn" title="重置视图（平移与缩放归位）" @click="resetView">
      🎯 重置视图
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { state, updatePhysics, snapshots, currentFrame } from '../composables/usePhysics'
// 渲染层：纯绘制函数
import {
  drawField,
  drawSegments,
  drawArcsVisually,
  drawTrails,
  drawObjects,
  drawSprings,
  drawVelocity,
  drawForces,
  drawPreviewLine,
  drawPreviewArc,
  drawSelectionRect,
  drawSelectionHighlight,
  drawShiftFlash,
  drawWatermark,
  drawAIToast,
  drawEditUI,
  drawFieldRegionPreview,
  drawPlateRectPreview
} from '../composables/useCanvasRenderer'
// 离屏静态层：网格 + 地面 预渲染
import {
  shouldRenderStaticLayer,
  renderStaticLayer,
  getStaticCanvas,
  resetStaticLayer
} from '../composables/useStaticLayer'
// 工具层：工具状态 + 弧线 + Shift 防重叠
import {
  tool,
  chargeMode,
  previewArc,
  previewLine,
  previewPlateRect,
  fieldRegionPreview,
  getShiftFlashState
} from '../composables/useEditTools'
// 交互层：事件处理 + 拖拽 + 平移缩放
import {
  worldOffset,
  worldScale,
  initCanvasInteraction,
  onCanvasClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  resetView,
  resizeCanvas,
  getDpr,
  getCssW,
  getCssH,
  getSelectionState,
  isDragging,
  isBatchDragging,
  isSelectionActive
} from '../composables/useCanvasInteraction'

const props = defineProps({
  mode: { type: String, default: 'live' },
  aiToast: { type: String, default: '' },
  editMode: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'seek',
  'add-object',
  'update-object',
  'remove-object',
  'undo',
  'redo',
  'update-selected',
  'batch-update'
])

const canvasRef = ref(null)
let rafId = null
let lastTime = 0
let resizeObserver = null

const cursorStyle = computed(() => {
  if (!props.editMode) return 'default'
  if (isSelectionActive()) return 'crosshair'
  if (isDragging() || isBatchDragging()) return 'grabbing'
  if (tool.value === 'select') return 'default'
  return 'crosshair'
})

/**
 * 获取当前要绘制的物体数组：
 * live 模式 → state.objects
 * replay 模式 → 用快照帧的位置/速度覆盖 state.objects
 */
function getDisplayObjects() {
  if (props.mode !== 'replay' || snapshots.value.length === 0) {
    return state.objects
  }
  const frame = snapshots.value[currentFrame.value]
  if (!frame) return state.objects
  // 向后兼容：旧快照是数组，新快照是 { objects, field, groundY, ... }
  const frameObjects = Array.isArray(frame) ? frame : frame.objects
  // 合并：用快照的位置/速度，加上 state.objects 的颜色/半径/名称
  return state.objects.map((obj) => {
    const snap = frameObjects.find((s) => s.id === obj.id)
    if (!snap) return obj
    return { ...obj, x: snap.x, y: snap.y, vx: snap.vx, vy: snap.vy }
  })
}

/**
 * 回放模式下获取快照中的 field，否则用当前 state.field
 * 向后兼容：旧快照无 field 字段时回退 state.field
 */
function getDisplayField() {
  if (props.mode === 'replay' && snapshots.value.length > 0) {
    const frame = snapshots.value[currentFrame.value]
    if (frame && !Array.isArray(frame) && frame.field) {
      return frame.field
    }
  }
  return state.field
}

/**
 * 回放模式下获取快照中的 groundY，否则用当前 state.groundY
 */
function getDisplayGroundY() {
  if (props.mode === 'replay' && snapshots.value.length > 0) {
    const frame = snapshots.value[currentFrame.value]
    if (frame && !Array.isArray(frame) && frame.groundY !== undefined) {
      return frame.groundY
    }
  }
  return state.groundY
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = getDpr()
  const cssW = getCssW()
  const cssH = getCssH()
  const rc = { ctx, cssW, cssH, dpr, worldOffset: worldOffset.value, worldScale: worldScale.value }

  // 高 DPI：基础变换设为 dpr 缩放，后续所有绘制用 CSS 像素坐标
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const objects = getDisplayObjects()
  const field = getDisplayField()
  const groundY = getDisplayGroundY()
  const offset = worldOffset.value
  const scale = worldScale.value

  // 静态层（网格+地面）：输入不变时不重绘，每帧仅 blit 一次，减少重复绘制
  if (shouldRenderStaticLayer(cssW * dpr, cssH * dpr, offset.x, offset.y, scale, groundY)) {
    renderStaticLayer(dpr, cssW, cssH, offset.x, offset.y, scale, groundY)
  }
  const staticCanvas = getStaticCanvas()
  if (staticCanvas) {
    ctx.drawImage(staticCanvas, 0, 0, cssW, cssH)
  } else {
    // 兜底：静态层未就绪时不出现黑屏
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, cssW, cssH)
  }

  // 应用世界坐标变换（平移 + 缩放），叠加在 dpr 之上
  ctx.save()
  ctx.translate(offset.x, offset.y)
  ctx.scale(scale, scale)

  drawField(rc, field)
  drawFieldRegionPreview(rc, fieldRegionPreview.value, field)
  drawSegments(rc, objects)
  drawArcsVisually(rc, objects, props.selectedIds, state.showGateColors)
  drawTrails(rc, objects, props.mode === 'replay')
  drawObjects(rc, objects)
  drawSprings(rc, objects)
  drawVelocity(rc, objects)
  drawForces(rc, objects, state.gravity, state.field, state.showForce)
  drawPreviewLine(rc, previewLine.value)
  drawPlateRectPreview(rc, previewPlateRect.value)
  drawPreviewArc(rc, previewArc.value)
  drawSelectionHighlight(rc, objects, props.selectedIds)
  drawSelectionRect(rc, getSelectionState())
  drawShiftFlash(rc, getShiftFlashState())

  ctx.restore()

  // UI 层（不随世界变换）：水印、提示、工具指示
  drawWatermark(rc, props.mode)
  drawAIToast(rc, props.aiToast)
  drawEditUI(rc, {
    mode: props.mode,
    aiToast: props.aiToast,
    editMode: props.editMode,
    tool: tool.value,
    chargeMode: chargeMode.value
  })
}

function loop(now) {
  if (lastTime === 0) lastTime = now
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  // 回放模式或编辑模式：跳过物理更新
  if (props.mode === 'live' && !props.editMode) {
    updatePhysics(dt)
  }
  draw()
  rafId = requestAnimationFrame(loop)
}

// 工具栏显隐会改变画布可用高度，需在 editMode 切换后重新计算 canvas 尺寸
watch(
  () => props.editMode,
  () => {
    nextTick(() => resizeCanvas())
  }
)

onMounted(() => {
  // 注入交互层依赖：canvasRef、props getter、emit、state（DIP：通过接口访问状态）
  initCanvasInteraction(canvasRef, () => props, emit, state)
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)

  // 使用 ResizeObserver 监测 canvas 父容器尺寸变化
  // 侧栏收起/展开、拖拽 splitter 等都会改变 canvas 可用空间，需要同步更新 backing store
  // 避免 canvas.width 属性与 CSS 显示尺寸脱节导致浏览器隐式缩放
  const canvas = canvasRef.value
  if (canvas && canvas.parentElement) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(canvas.parentElement)
  }

  rafId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeCanvas)
  resetStaticLayer()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.canvas-wrap {
  flex: 1;
  background: var(--vsd-bg);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

canvas {
  flex: 1;
  width: 100%;
  display: block;
}

.edit-toolbar {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.8rem;
  background: rgba(var(--vsd-panel-rgb), 0.95);
  border-bottom: 1px solid rgba(var(--vsd-purple-rgb), 0.3);
  backdrop-filter: blur(8px);
  z-index: 10;
  flex-wrap: wrap;
}

.tool-divider {
  width: 1px;
  background: rgba(var(--vsd-purple-rgb), 0.2);
  margin: 0 0.2rem;
}

.reset-view-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(var(--vsd-cyan-rgb), 0.4);
  border-radius: 6px;
  background: rgba(var(--vsd-panel-rgb), 0.85);
  color: var(--vsd-cyan);
  cursor: pointer;
  font-size: 0.8rem;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
  z-index: 10;
}

.reset-view-btn:hover {
  background: rgba(var(--vsd-cyan-rgb), 0.18);
  border-color: rgba(var(--vsd-cyan-rgb), 0.7);
  color: var(--vsd-cyan);
}

.shift-hint {
  position: absolute;
  right: 12px;
  top: 12px;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(var(--vsd-yellow-rgb), 0.4);
  border-radius: 6px;
  background: rgba(var(--vsd-panel-rgb), 0.85);
  color: var(--vsd-yellow);
  font-size: 0.8rem;
  backdrop-filter: blur(8px);
  z-index: 10;
  pointer-events: none;
}

.tool-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 6px;
  background: rgba(var(--vsd-panel-rgb), 0.6);
  color: var(--vsd-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(var(--vsd-purple-rgb), 0.15);
  border-color: rgba(var(--vsd-purple-rgb), 0.5);
  color: var(--vsd-purple);
}

.tool-btn.active {
  background: linear-gradient(
    135deg,
    rgba(var(--vsd-purple-rgb), 0.25),
    rgba(var(--vsd-info-rgb), 0.1)
  );
  border-color: rgba(var(--vsd-purple-rgb), 0.6);
  color: var(--vsd-purple);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
