<template>
  <div class="canvas-wrap">
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
    <!-- 编辑模式工具栏 -->
    <div v-if="editMode" class="edit-toolbar">
      <button class="tool-btn" :class="{ active: tool === 'ball' }" @click="tool = 'ball'">⚽ 小球</button>
      <button class="tool-btn" :class="{ active: tool === 'platform' }" @click="tool = 'platform'">➖ 平台</button>
      <button class="tool-btn" :class="{ active: tool === 'arc' }" @click="tool = 'arc'">⤵ 圆弧</button>
      <button class="tool-btn" :class="{ active: tool === 'spring' }" @click="tool = 'spring'">🌀 弹簧</button>
      <button class="tool-btn" :class="{ active: chargeMode }" @click="chargeMode = !chargeMode">⚡ 带电</button>
      <button class="tool-btn" @click="$emit('undo')" title="撤销 (Ctrl+Z)">↶ 撤销</button>
      <button class="tool-btn" @click="$emit('redo')" title="重做 (Ctrl+Y)">↷ 重做</button>
      <button class="tool-btn" @click="$emit('export-scene')">💾 导出</button>
      <button class="tool-btn" @click="$emit('import-scene')">📂 导入</button>
    </div>
    <!-- 重置视图按钮（所有场景常驻右下角） -->
    <button class="reset-view-btn" title="重置视图（平移与缩放归位）" @click="resetView">🎯 重置视图</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { state, updatePhysics, snapshots, currentFrame } from '../composables/usePhysics'
// 渲染层：纯绘制函数
import {
  drawGrid, drawField, drawGround, drawSegments, drawArcsVisually,
  drawTrails, drawObjects, drawSprings, drawVelocity, drawForces,
  drawPreviewLine, drawPreviewArc,
  drawSelectionRect, drawSelectionHighlight,
  drawShiftFlash, drawWatermark, drawAIToast, drawEditUI
} from '../composables/useCanvasRenderer'
// 工具层：工具状态 + 弧线 + Shift 防重叠
import {
  tool, chargeMode, previewArc, previewLine, getShiftFlashState
} from '../composables/useEditTools'
// 交互层：事件处理 + 拖拽 + 平移缩放
import {
  worldOffset, worldScale,
  initCanvasInteraction,
  onCanvasClick, onMouseDown, onMouseMove, onMouseUp, onWheel,
  resetView, resizeCanvas,
  getDpr, getCssW, getCssH, getSelectionState,
  isDragging, isBatchDragging, isSelectionActive
} from '../composables/useCanvasInteraction'

const props = defineProps({
  mode: { type: String, default: 'live' },
  aiToast: { type: String, default: '' },
  editMode: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['seek', 'add-object', 'update-object', 'remove-object', 'export-scene', 'import-scene', 'undo', 'redo', 'update-selected', 'batch-update'])

const canvasRef = ref(null)
let rafId = null
let lastTime = 0

const cursorStyle = computed(() => {
  if (!props.editMode) return 'default'
  if (isSelectionActive()) return 'crosshair'
  if (isDragging() || isBatchDragging()) return 'grabbing'
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
  return state.objects.map(obj => {
    const snap = frameObjects.find(s => s.id === obj.id)
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
  const rc = { ctx, cssW, cssH, dpr }

  // 高 DPI：基础变换设为 dpr 缩放，后续所有绘制用 CSS 像素坐标
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const objects = getDisplayObjects()
  const field = getDisplayField()
  const groundY = getDisplayGroundY()

  // 应用世界坐标变换（平移 + 缩放），叠加在 dpr 之上
  ctx.save()
  ctx.translate(worldOffset.value.x, worldOffset.value.y)
  ctx.scale(worldScale.value, worldScale.value)

  drawGrid(rc)
  drawField(rc, field)
  drawGround(rc, groundY)
  drawSegments(rc, objects)
  drawArcsVisually(rc, objects)
  drawTrails(rc, objects, props.mode === 'replay')
  drawObjects(rc, objects)
  drawSprings(rc, objects)
  drawVelocity(rc, objects)
  drawForces(rc, objects, state.gravity, state.field, state.showForce)
  drawPreviewLine(rc, previewLine.value)
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

onMounted(() => {
  // 注入交互层依赖：canvasRef、props getter、emit
  initCanvasInteraction(canvasRef, () => props, emit)
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  rafId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style scoped>
.canvas-wrap {
  flex: 1;
  background: #0a0e27;
  overflow: hidden;
  position: relative;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.edit-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 0.4rem;
  padding: 0.4rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  z-index: 10;
}

.reset-view-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(34, 211, 238, 0.4);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.85);
  color: #67e8f9;
  cursor: pointer;
  font-size: 0.8rem;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
  z-index: 10;
}

.reset-view-btn:hover {
  background: rgba(34, 211, 238, 0.18);
  border-color: rgba(34, 211, 238, 0.7);
  color: #a5f3fc;
}

.tool-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.5);
  color: #c4b5fd;
}

.tool-btn.active {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(96, 165, 250, 0.1));
  border-color: rgba(167, 139, 250, 0.6);
  color: #c4b5fd;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.3);
}
</style>
