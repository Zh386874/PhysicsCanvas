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
      <button class="tool-btn" :class="{ active: chargeMode }" @click="chargeMode = !chargeMode">⚡ 带电</button>
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
import { autoComputeNormal } from '../composables/useCollision'

const props = defineProps({
  mode: { type: String, default: 'live' },
  aiToast: { type: String, default: '' },
  editMode: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['seek', 'add-object', 'update-object', 'remove-object', 'export-scene', 'import-scene', 'update-selected', 'batch-update'])

const canvasRef = ref(null)
let ctx = null
let rafId = null
let lastTime = 0

// 编辑工具状态
const tool = ref('ball') // 'ball' | 'platform' | 'arc'
const chargeMode = ref(false) // 带电粒子模式：添加小球时自动设 charge=1

// 圆弧绘制状态（三次点击：圆心 → 半径起点 → 终点角度）
let arcPhase = 'center'         // 'center' | 'radius' | 'angle'
let arcCenter = null            // 圆心 {x, y}
let arcRadius = 0               // 半径
let arcStartAngle = 0           // 起点角度
const previewArc = ref(null)    // 预览 { cx, cy, r, startAngle, endAngle }

// 世界坐标系：平移与缩放
const worldOffset = ref({ x: 0, y: 0 })
const worldScale = ref(1)
let panning = false           // 中键平移中
let panStart = null           // { x, y, offsetX, offsetY }

// 高 DPI 适配：dpr 与 CSS 逻辑尺寸（绘制坐标均用 CSS 像素）
let dpr = 1
let cssW = 0
let cssH = 0

// 拖拽/绘制状态
let drawing = false           // 是否正在绘制线段
let drawStart = null          // 绘制起点 {x, y}
let drawEnd = null            // 绘制终点 {x, y}
let shiftPressed = false      // Shift 键按下（吸附水平/垂直）

// 拖拽物体状态
let dragging = false          // 是否正在拖拽物体
let dragTarget = null         // { id, mode: 'circle'|'endpoint'|'segment', endpointIdx?: 0|1, offsetX, offsetY }
let justDragged = false       // 刚结束拖拽，用于阻止本次 mouseup 后的 click 误添加

// 框选状态（右键拖拽矩形选择）
let selectionActive = false   // 是否正在框选
let selectionStart = null     // 框选起点 {x, y}（世界坐标）
let selectionEnd = null       // 框选终点 {x, y}（世界坐标）

// 批量拖拽状态（多选时拖拽其中一个，整组平移）
let batchDragging = false     // 是否正在批量拖拽
let batchDragStartPos = null  // 批量拖拽起点 {x, y}
let batchDragInitial = null   // 批量拖拽初始位置快照 [{ id, ...原坐标 }]

// 临时预览线段（绘制中）
const previewLine = ref(null)

// Shift 防重叠放置的绿色闪烁反馈（时间戳 + 位置）
let shiftFlashUntil = 0
let shiftFlashPos = null  // {x, y}

const cursorStyle = computed(() => {
  if (!props.editMode) return 'default'
  if (selectionActive) return 'crosshair'
  if (dragging || batchDragging) return 'grabbing'
  return 'crosshair'
})

/**
 * 屏幕坐标 → 世界坐标（考虑平移和缩放）
 */
function screenToWorld(clientX, clientY) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  return {
    x: (sx - worldOffset.value.x) / worldScale.value,
    y: (sy - worldOffset.value.y) / worldScale.value
  }
}

/**
 * 获取鼠标在世界坐标系中的位置
 */
function getMousePos(e) {
  return screenToWorld(e.clientX, e.clientY)
}

/**
 * 生成唯一 ID
 */
function genId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

/**
 * 画布点击：编辑模式 + 小球工具 → 添加小球
 * Shift 防重叠：按下 Shift 时检测重叠，沿法线自动推出到不重叠位置
 */
function onCanvasClick(e) {
  if (!props.editMode || tool.value !== 'ball') return
  // 拖拽或绘制后不触发添加
  if (dragging || drawing) return
  // 刚结束拖拽（mouseup 后立即触发的 click），跳过本次添加
  if (justDragged) {
    justDragged = false
    return
  }
  const pos = getMousePos(e)
  const radius = 15
  let finalX = pos.x
  let finalY = pos.y

  // Shift 防重叠：检测并沿法线推出
  if (e.shiftKey) {
    const corrected = pushOutOfOverlap(finalX, finalY, radius)
    if (corrected) {
      finalX = corrected.x
      finalY = corrected.y
      // 绿色闪烁反馈
      shiftFlashPos = { x: finalX, y: finalY }
      shiftFlashUntil = Date.now() + 700
    }
  }

  const newObj = {
    id: genId(),
    name: '小球' + (state.objects.length + 1),
    type: '质点',
    x: finalX,
    y: finalY,
    vx: 0,
    vy: 0,
    radius: radius,
    mass: 1,
    charge: chargeMode.value ? 1 : 0,
    color: chargeMode.value ? '#fbbf24' : '#60a5fa',
    trail: []
  }
  emit('add-object', newObj)
}

/**
 * 检测 (x,y) 半径 r 的新球是否与现有物体重叠
 * 返回首个重叠的障碍物 { type: 'circle'|'segment', obj, penetration, nx, ny }
 * nx,ny 为从障碍物指向新球中心的法线方向
 */
function findOverlap(x, y, r) {
  const threshold = 2
  for (const obj of state.objects) {
    if (obj.type === '质点') {
      const dx = x - obj.x
      const dy = y - obj.y
      const dist = Math.hypot(dx, dy)
      const minDist = r + (obj.radius || 10) + threshold
      if (dist < minDist) {
        const safeDist = dist > 1e-6 ? dist : 1
        return {
          type: 'circle',
          obj,
          penetration: minDist - dist,
          nx: dx / safeDist,
          ny: dy / safeDist
        }
      }
    } else if (obj.type === 'line_segment') {
      const dist = pointToSegmentDist(x, y, obj.x1, obj.y1, obj.x2, obj.y2)
      const minDist = r + threshold
      if (dist < minDist) {
        // 法线方向：使用线段法线（指向新球所在侧）
        let nx = obj.normalX || 0
        let ny = obj.normalY || 0
        // 若法线方向与“线段→新球”方向相反，则翻转
        const cx = (obj.x1 + obj.x2) / 2
        const cy = (obj.y1 + obj.y2) / 2
        const toBallX = x - cx
        const toBallY = y - cy
        if (nx * toBallX + ny * toBallY < 0) {
          nx = -nx
          ny = -ny
        }
        return {
          type: 'segment',
          obj,
          penetration: minDist - dist,
          nx,
          ny
        }
      }
    }
  }
  return null
}

/**
 * 从重叠位置沿法线迭代推出，直到不重叠或达到最大尝试次数
 * 返回修正后的 {x, y}，若无需修正返回 null
 */
function pushOutOfOverlap(x, y, r) {
  let cx = x
  let cy = y
  const maxAttempts = 200
  for (let i = 0; i < maxAttempts; i++) {
    const overlap = findOverlap(cx, cy, r)
    if (!overlap) {
      // 已无重叠，若发生过位移则返回结果
      return i > 0 ? { x: cx, y: cy } : null
    }
    // 沿法线方向小步移动（每次 1px），保证最终脱离
    cx += overlap.nx
    cy += overlap.ny
  }
  // 达到最大次数仍有重叠：返回当前位置（尽力修正）
  return { x: cx, y: cy }
}

/**
 * 检测鼠标是否点中某个物体，返回拖拽目标描述
 * @param {Object} pos 鼠标世界坐标
 * @param {boolean} skipSegments 是否跳过线段检测（ball 工具下传 true，避免点击线段拦截添加小球）
 */
function hitTest(pos, skipSegments = false) {
  if (!skipSegments) {
    // 先检测线段端点（优先级高，便于编辑端点）
    for (const obj of state.objects) {
      if (obj.type === 'line_segment') {
        const d1 = Math.hypot(pos.x - obj.x1, pos.y - obj.y1)
        const d2 = Math.hypot(pos.x - obj.x2, pos.y - obj.y2)
        if (d1 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 0 }
        if (d2 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 1 }
      }
    }
    // 再检测线段整体（点击在线段附近 5px）
    for (const obj of state.objects) {
      if (obj.type === 'line_segment') {
        const dist = pointToSegmentDist(pos.x, pos.y, obj.x1, obj.y1, obj.x2, obj.y2)
        if (dist <= 5) return { id: obj.id, mode: 'segment' }
      }
    }
  }
  // 最后检测圆
  for (const obj of state.objects) {
    if (obj.type === '质点') {
      const d = Math.hypot(pos.x - obj.x, pos.y - obj.y)
      if (d <= (obj.radius || 10)) return { id: obj.id, mode: 'circle' }
    }
  }
  return null
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * 鼠标按下：编辑模式下，拖拽优先级最高（任何工具下都生效）
 * - 右键（button===2）：进入框选模式
 * - 中键（button===1）：平移画布
 * - 左键：先 hitTest，命中物体则拖拽；多选时整组平移；未命中按工具行为
 */
function onMouseDown(e) {
  // 中键（button === 1）：平移画布（任何场景下都可用）
  if (e.button === 1) {
    panning = true
    panStart = {
      x: e.clientX,
      y: e.clientY,
      offsetX: worldOffset.value.x,
      offsetY: worldOffset.value.y
    }
    e.preventDefault()
    return
  }

  if (!props.editMode) return
  shiftPressed = e.shiftKey

  // 右键（button === 2）：进入框选模式
  if (e.button === 2) {
    const pos = getMousePos(e)
    selectionActive = true
    selectionStart = pos
    selectionEnd = pos
    return
  }

  // 非左键不处理编辑
  if (e.button !== 0) return

  const pos = getMousePos(e)

  // 拖拽优先：ball 工具下只检测圆（避免点击线段拦截添加小球）；其他工具完整 hitTest
  const hit = hitTest(pos, tool.value === 'ball')
  if (hit) {
    // 多选批量拖拽：点击的物体在 selectedIds 内且选中数 > 1，整组平移
    if (props.selectedIds.length > 1 && props.selectedIds.includes(hit.id)) {
      batchDragging = true
      batchDragStartPos = pos
      // 记录所有选中物体的初始坐标
      batchDragInitial = props.selectedIds.map(id => {
        const o = state.objects.find(o => o.id === id)
        if (!o) return null
        if (o.type === '质点') return { id, x: o.x, y: o.y }
        return { id, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }
      }).filter(Boolean)
      return
    }
    // 单选拖拽
    dragging = true
    dragTarget = hit
    const obj = state.objects.find(o => o.id === hit.id)
    if (hit.mode === 'circle') {
      hit.offsetX = pos.x - obj.x
      hit.offsetY = pos.y - obj.y
    } else if (hit.mode === 'segment') {
      hit.offsetX = pos.x
      hit.offsetY = pos.y
      hit.startX1 = obj.x1
      hit.startY1 = obj.y1
      hit.startX2 = obj.x2
      hit.startY2 = obj.y2
    }
    return
  }

  // 未命中物体：platform 工具开始绘制线段
  if (tool.value === 'platform') {
    drawing = true
    drawStart = pos
    drawEnd = pos
    previewLine.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
    return
  }

  // 圆弧工具：三次点击（圆心 → 半径起点 → 终点角度）
  if (tool.value === 'arc') {
    if (arcPhase === 'center') {
      // 第一次点击：记录圆心
      arcCenter = pos
      arcPhase = 'radius'
      previewArc.value = { cx: pos.x, cy: pos.y, r: 0, startAngle: 0, endAngle: 0 }
    } else if (arcPhase === 'radius') {
      // 第二次点击：确定半径和起点角度
      arcRadius = Math.hypot(pos.x - arcCenter.x, pos.y - arcCenter.y)
      arcStartAngle = Math.atan2(pos.y - arcCenter.y, pos.x - arcCenter.x)
      if (arcRadius > 10) {
        arcPhase = 'angle'
        previewArc.value = { cx: arcCenter.x, cy: arcCenter.y, r: arcRadius, startAngle: arcStartAngle, endAngle: arcStartAngle }
      } else {
        // 半径太小，重置
        arcPhase = 'center'
        arcCenter = null
        previewArc.value = null
      }
    } else {
      // 第三次点击：确定终点角度，生成弧线
      const endAngle = Math.atan2(pos.y - arcCenter.y, pos.x - arcCenter.x)
      generateArcSegments(arcCenter.x, arcCenter.y, arcRadius, arcStartAngle, endAngle, e.shiftKey)
      arcPhase = 'center'
      arcCenter = null
      arcRadius = 0
      previewArc.value = null
    }
    return
  }
  // ball 工具：mousedown 不做事，由 click 添加
}

/**
 * 生成圆弧的离散线段（任意起止角度，8 条线段近似）
 * @param {number} cx 圆心 x
 * @param {number} cy 圆心 y
 * @param {number} r 半径
 * @param {number} startAngle 起点角度（弧度）
 * @param {number} endAngle 终点角度（弧度）
 * @param {boolean} reverse 反向（Shift 按下时逆时针变顺时针）
 */
function generateArcSegments(cx, cy, r, startAngle, endAngle, reverse) {
  const numSegments = 8
  // 规范化角度差为正向（逆时针为正）
  let delta = endAngle - startAngle
  while (delta <= 0) delta += Math.PI * 2
  if (reverse) delta = delta - Math.PI * 2  // Shift 反向（顺时针）
  const step = delta / numSegments
  const groupId = genId()  // 同一弧线的所有线段共享 groupId
  const arcName = '弧线' + (Math.floor(state.objects.filter(o => o.name?.startsWith('弧线')).length / 8) + 1)
  for (let i = 0; i < numSegments; i++) {
    const a1 = startAngle + i * step
    const a2 = startAngle + (i + 1) * step
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const tempSeg = { x1, y1, x2, y2 }
    const normal = autoComputeNormal(tempSeg)
    const newObj = {
      id: genId(),
      groupId,
      name: arcName,
      type: 'line_segment',
      arc: { cx, cy, r, startAngle, endAngle: startAngle + delta },  // 弧线元数据，用于视觉绘制
      x1, y1, x2, y2,
      normalX: normal.normalX,
      normalY: normal.normalY,
      restitution: 0.3,
      friction: 0.5,
      color: '#7c3aed'
    }
    emit('add-object', newObj)
  }
}

/**
 * 鼠标移动：绘制预览线段 或 拖拽物体
 */
function onMouseMove(e) {
  // 中键平移（任何场景下都可用）
  if (panning && panStart) {
    const canvas = canvasRef.value
    const rawOffset = {
      x: panStart.offsetX + (e.clientX - panStart.x),
      y: panStart.offsetY + (e.clientY - panStart.y)
    }
    worldOffset.value = canvas ? clampOffset(rawOffset, worldScale.value, canvas) : rawOffset
    return
  }

  if (!props.editMode) return
  shiftPressed = e.shiftKey

  const pos = getMousePos(e)

  // 框选：更新选框终点
  if (selectionActive) {
    selectionEnd = pos
    return
  }

  // 批量拖拽：整组平移
  if (batchDragging && batchDragInitial) {
    const dx = pos.x - batchDragStartPos.x
    const dy = pos.y - batchDragStartPos.y
    const updates = batchDragInitial.map(item => {
      if (item.x !== undefined) {
        return { id: item.id, props: { x: item.x + dx, y: item.y + dy } }
      }
      return { id: item.id, props: { x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy } }
    })
    emit('batch-update', updates)
    return
  }

  // 圆弧预览：根据阶段显示不同预览
  if (tool.value === 'arc' && arcCenter) {
    if (arcPhase === 'radius') {
      // 半径阶段：显示圆心和当前半径的圆 + 半径线
      const r = Math.hypot(pos.x - arcCenter.x, pos.y - arcCenter.y)
      previewArc.value = { cx: arcCenter.x, cy: arcCenter.y, r, startAngle: 0, endAngle: 0, phase: 'radius' }
      return
    } else if (arcPhase === 'angle') {
      // 角度阶段：显示半径圆 + 从起点到当前角度的弧线
      const endAngle = Math.atan2(pos.y - arcCenter.y, pos.x - arcCenter.x)
      previewArc.value = { cx: arcCenter.x, cy: arcCenter.y, r: arcRadius, startAngle: arcStartAngle, endAngle, phase: 'angle' }
      return
    }
  }

  if (drawing && tool.value === 'platform') {
    let endX = pos.x
    let endY = pos.y
    // Shift 吸附：水平或垂直
    if (shiftPressed) {
      const dx = pos.x - drawStart.x
      const dy = pos.y - drawStart.y
      if (Math.abs(dx) > Math.abs(dy)) {
        endY = drawStart.y
      } else {
        endX = drawStart.x
      }
    }
    drawEnd = { x: endX, y: endY }
    previewLine.value = { x1: drawStart.x, y1: drawStart.y, x2: endX, y2: endY }
    return
  }

  if (dragging && dragTarget) {
    const obj = state.objects.find(o => o.id === dragTarget.id)
    if (!obj) return
    if (dragTarget.mode === 'circle') {
      emit('update-object', { id: obj.id, props: { x: pos.x - dragTarget.offsetX, y: pos.y - dragTarget.offsetY } })
    } else if (dragTarget.mode === 'endpoint') {
      const newProps = dragTarget.endpointIdx === 0
        ? { x1: pos.x, y1: pos.y }
        : { x2: pos.x, y2: pos.y }
      // 自动重算法线
      const tempSeg = { ...obj, ...newProps }
      const normal = autoComputeNormal(tempSeg)
      newProps.normalX = normal.normalX
      newProps.normalY = normal.normalY
      emit('update-object', { id: obj.id, props: newProps })
    } else if (dragTarget.mode === 'segment') {
      // 整体平移
      const dx = pos.x - dragTarget.offsetX
      const dy = pos.y - dragTarget.offsetY
      emit('update-object', {
        id: obj.id,
        props: {
          x1: dragTarget.startX1 + dx,
          y1: dragTarget.startY1 + dy,
          x2: dragTarget.startX2 + dx,
          y2: dragTarget.startY2 + dy
        }
      })
    }
  }
}

/**
 * 鼠标抬起：完成绘制线段 或 结束拖拽 或 结束框选
 */
function onMouseUp(e) {
  // 清除平移状态（任何按键松开都清除）
  if (panning) {
    panning = false
    panStart = null
    return
  }

  // 框选结束：计算矩形内的物体并 emit 多选
  if (selectionActive) {
    selectionActive = false
    const ids = getObjectsInRect(selectionStart, selectionEnd)
    emit('update-selected', ids)
    selectionStart = null
    selectionEnd = null
    return
  }

  // 批量拖拽结束
  if (batchDragging) {
    batchDragging = false
    batchDragStartPos = null
    batchDragInitial = null
    justDragged = true
    setTimeout(() => { justDragged = false }, 0)
    return
  }

  if (drawing && tool.value === 'platform') {
    drawing = false
    const pos = getMousePos(e)
    let endX = pos.x
    let endY = pos.y
    if (shiftPressed) {
      const dx = pos.x - drawStart.x
      const dy = pos.y - drawStart.y
      if (Math.abs(dx) > Math.abs(dy)) endY = drawStart.y
      else endX = drawStart.x
    }
    // 线段长度过短则忽略
    const len = Math.hypot(endX - drawStart.x, endY - drawStart.y)
    if (len > 10) {
      const tempSeg = { x1: drawStart.x, y1: drawStart.y, x2: endX, y2: endY }
      const normal = autoComputeNormal(tempSeg)
      const newObj = {
        id: genId(),
        name: '平台' + (state.objects.filter(o => o.type === 'line_segment').length + 1),
        type: 'line_segment',
        x1: drawStart.x,
        y1: drawStart.y,
        x2: endX,
        y2: endY,
        normalX: normal.normalX,
        normalY: normal.normalY,
        restitution: 0.3,
        friction: 0.5,
        color: '#475569'
      }
      emit('add-object', newObj)
    }
    previewLine.value = null
    drawStart = null
    drawEnd = null
  }

  if (dragging) {
    dragging = false
    dragTarget = null
    // 标记刚结束拖拽，阻止紧随其后的 click 事件误添加小球
    justDragged = true
    setTimeout(() => { justDragged = false }, 0)
  }
}

/**
 * 计算矩形选框内的物体 id 列表
 * - 圆：圆心在矩形内
 * - 线段：任一端点在矩形内
 * 矩形由两个对角点定义（自动归一化）
 */
function getObjectsInRect(p1, p2) {
  if (!p1 || !p2) return []
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  const ids = []
  for (const obj of state.objects) {
    if (obj.type === '质点') {
      if (obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY) {
        ids.push(obj.id)
      }
    } else if (obj.type === 'line_segment') {
      // 任一端点在矩形内即选中
      const in1 = obj.x1 >= minX && obj.x1 <= maxX && obj.y1 >= minY && obj.y1 <= maxY
      const in2 = obj.x2 >= minX && obj.x2 <= maxX && obj.y2 >= minY && obj.y2 <= maxY
      if (in1 || in2) ids.push(obj.id)
    }
  }
  return ids
}

/**
 * 滚轮缩放：以鼠标位置为中心
 */
function onWheel(e) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.max(0.3, Math.min(5, worldScale.value * factor))
  // 以鼠标为中心缩放：保持鼠标点对应的世界坐标不变
  const worldX = (mouseX - worldOffset.value.x) / worldScale.value
  const worldY = (mouseY - worldOffset.value.y) / worldScale.value
  worldOffset.value = clampOffset({
    x: mouseX - worldX * newScale,
    y: mouseY - worldY * newScale
  }, newScale, canvas)
  worldScale.value = newScale
}

/**
 * 限制 worldOffset 范围，防止场景完全移出视野
 * 允许世界中心点在 ±3000 像素范围内移动
 */
function clampOffset(offset, scale, canvas) {
  // 用 CSS 逻辑尺寸计算（与绘制坐标一致）
  const halfW = cssW / 2
  const halfH = cssH / 2
  const limit = 3000
  const minX = halfW - limit * scale
  const maxX = halfW + limit * scale
  const minY = halfH - limit * scale
  const maxY = halfH + limit * scale
  return {
    x: Math.max(minX, Math.min(maxX, offset.x)),
    y: Math.max(minY, Math.min(maxY, offset.y))
  }
}

/**
 * 重置视图：worldOffset 归零、worldScale 归 1
 */
function resetView() {
  worldOffset.value = { x: 0, y: 0 }
  worldScale.value = 1
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.parentElement.getBoundingClientRect()
  // 高 DPI 适配：backing store 按 dpr 放大，CSS 尺寸不变，绘制坐标用 CSS 像素
  dpr = window.devicePixelRatio || 1
  cssW = rect.width
  cssH = rect.height
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  ctx = canvas.getContext('2d')
  // 仅当场景启用水平地面时才跟随容器更新；null 表示禁用（斜面/自定义场景）
  if (state.groundY !== null && state.groundY !== 100000) {
    state.groundY = cssH - 60
  }
}

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

function drawGrid() {
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.06)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x < cssW; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, cssH)
    ctx.stroke()
  }
  for (let y = 0; y < cssH; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(cssW, y)
    ctx.stroke()
  }
}

function drawGround() {
  const groundY = getDisplayGroundY()
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(cssW, groundY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('地面', 10, groundY + 18)
}

function drawField() {
  const canvas = canvasRef.value
  if (!canvas) return
  const step = 60
  // 回放模式下使用快照中的 field，保证场可视化与帧一致
  const field = getDisplayField()
  const symbol = field.type

  if (symbol === 'magnetic') {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.stroke()
        if (field.B >= 0) {
          // ⊙ 向里：画实心点
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // ⊗ 向外：画叉
          ctx.beginPath()
          ctx.moveTo(x - 4, y - 4)
          ctx.lineTo(x + 4, y + 4)
          ctx.moveTo(x + 4, y - 4)
          ctx.lineTo(x - 4, y + 4)
          ctx.stroke()
        }
      }
    }
  } else if (symbol === 'electric') {
    const ex = field.E.x
    const ey = field.E.y
    const mag = Math.sqrt(ex * ex + ey * ey)
    if (mag < 0.01) return
    // 归一化方向
    const dx = (ex / mag) * 20
    const dy = (ey / mag) * 20
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.fillStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        // 箭头线
        ctx.beginPath()
        ctx.moveTo(x - dx / 2, y - dy / 2)
        ctx.lineTo(x + dx / 2, y + dy / 2)
        ctx.stroke()
        // 箭头头
        const angle = Math.atan2(dy, dx)
        ctx.beginPath()
        ctx.moveTo(x + dx / 2, y + dy / 2)
        ctx.lineTo(
          x + dx / 2 - 5 * Math.cos(angle - 0.4),
          y + dy / 2 - 5 * Math.sin(angle - 0.4)
        )
        ctx.lineTo(
          x + dx / 2 - 5 * Math.cos(angle + 0.4),
          y + dy / 2 - 5 * Math.sin(angle + 0.4)
        )
        ctx.closePath()
        ctx.fill()
      }
    }
  }
}

function drawTrails(objects) {
  // 回放模式不画实时轨迹（位置是快照的，轨迹会错乱）
  if (props.mode === 'replay') return
  for (const obj of objects) {
    if (!obj.trail || obj.trail.length < 2) continue
    ctx.strokeStyle = obj.color + '40'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.trail[0].x, obj.trail[0].y)
    for (let i = 1; i < obj.trail.length; i++) {
      ctx.lineTo(obj.trail[i].x, obj.trail[i].y)
    }
    ctx.stroke()
  }
}

function drawObjects(objects) {
  for (const obj of objects) {
    if (obj.type === 'line_segment') continue
    const r = obj.radius || 10

    // 光晕
    ctx.beginPath()
    ctx.arc(obj.x, obj.y, r + 6, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(obj.x, obj.y, r, obj.x, obj.y, r + 6)
    glow.addColorStop(0, obj.color + '40')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fill()

    // 物体
    ctx.beginPath()
    ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2)
    ctx.fillStyle = obj.color
    ctx.fill()

    // 名称
    ctx.fillStyle = '#e0e6ff'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(obj.name, obj.x, obj.y - r - 8)
  }
}

/**
 * 绘制所有线段物体
 * 包括：线段本身、法线方向箭头、内侧（实体面）半透明填充
 */
function drawSegments(objects) {
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const { x1, y1, x2, y2, normalX, normalY } = seg
    const nx = normalX || 0
    const ny = normalY || 0

    // 1. 内侧半透明面（沿法线方向偏移 30px 形成四边形）
    const offset = 30
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
    ctx.lineTo(x1 + nx * offset, y1 + ny * offset)
    ctx.closePath()
    ctx.fill()

    // 2. 线段本身
    ctx.strokeStyle = seg.color || '#475569'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // 3. 法线箭头（从中点指向内侧，浅紫色半透明）
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const arrowLen = 20
    const tipX = midX + nx * arrowLen
    const tipY = midY + ny * arrowLen
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(midX, midY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
    // 箭头头
    const angle = Math.atan2(ny, nx)
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 5 * Math.cos(angle - 0.4), tipY - 5 * Math.sin(angle - 0.4))
    ctx.lineTo(tipX - 5 * Math.cos(angle + 0.4), tipY - 5 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fillStyle = 'rgba(167, 139, 250, 0.7)'
    ctx.fill()

    // 4. 名称
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(seg.name || '线段', midX, midY - 10)
  }
}

function drawVelocity(objects) {
  for (const obj of objects) {
    if (Math.abs(obj.vx) < 1 && Math.abs(obj.vy) < 1) continue
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.x, obj.y)
    ctx.lineTo(obj.x + obj.vx * 0.3, obj.y + obj.vy * 0.3)
    ctx.stroke()
  }
}

function drawForces(objects) {
  if (!state.showForce) return
  for (const obj of objects) {
    if (obj.type === 'line_segment') continue
    const r = obj.radius || 10

    // 重力箭头（红色，竖直向下）—— 仅当重力不为 0 时绘制
    const fgy = obj.mass * state.gravity
    if (fgy > 0.01) {
      const gLen = Math.min(fgy * 2, 50)
      drawArrow(obj.x, obj.y, obj.x, obj.y + gLen, 'rgba(239, 68, 68, 0.8)', 2)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('mg', obj.x + 6, obj.y + gLen / 2)
    }

    // 电磁场力（仅当存在场且物体带电时绘制）
    const charge = obj.charge || 0
    if (charge !== 0) {
      if (state.field.type === 'electric') {
        // 电场力 Fe = qE（绿色）
        const Fex = charge * state.field.E.x
        const Fey = charge * state.field.E.y
        const feMag = Math.hypot(Fex, Fey)
        if (feMag > 0.01) {
          const feLen = Math.min(feMag * 0.8, 60)
          const ex = obj.x + (Fex / feMag) * feLen
          const ey = obj.y + (Fey / feMag) * feLen
          drawArrow(obj.x, obj.y, ex, ey, 'rgba(34, 197, 94, 0.9)', 2)
          ctx.fillStyle = 'rgba(34, 197, 94, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qE', ex + 4, ey)
        }
      } else if (state.field.type === 'magnetic') {
        // 洛伦兹力 F = qv×B（紫色，垂直于速度）
        // Fx = q*vy*B, Fy = -q*vx*B
        const Fmx = charge * obj.vy * state.field.B
        const Fmy = -charge * obj.vx * state.field.B
        const fmMag = Math.hypot(Fmx, Fmy)
        if (fmMag > 0.01) {
          const fmLen = Math.min(fmMag * 0.8, 60)
          const mx = obj.x + (Fmx / fmMag) * fmLen
          const my = obj.y + (Fmy / fmMag) * fmLen
          drawArrow(obj.x, obj.y, mx, my, 'rgba(168, 85, 247, 0.9)', 2)
          ctx.fillStyle = 'rgba(168, 85, 247, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qvB', mx + 4, my)
        }
      }
    }

    // 查找物体是否贴近某条线段（在斜面上）
    const seg = findContactSegment(obj, objects)
    if (seg) {
      const nx = seg.normalX
      const ny = seg.normalY
      // 斜面倾角 α（线段与水平方向夹角）
      const segDx = seg.x2 - seg.x1
      const segDy = seg.y2 - seg.y1
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy)
      const cosA = Math.abs(segDx) / segLen // 斜面与水平夹角 α 的余弦：cos(α)=dx/len
      // 支持力 N = mg*cos(α)，方向沿法线（指向内侧）
      const N = obj.mass * state.gravity * cosA
      const nLen = Math.min(N * 2, 50)
      drawArrow(
        obj.x, obj.y,
        obj.x + nx * nLen, obj.y + ny * nLen,
        'rgba(148, 163, 184, 0.8)', 2
      )
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
      ctx.fillText('N', obj.x + nx * nLen + 4, obj.y + ny * nLen)

      // 摩擦力 f = μ*N，方向沿斜面与运动方向相反
      const mu = obj.friction || 0
      if (mu > 0) {
        const f = mu * N
        const fLen = Math.min(f * 2, 40)
        // 斜面方向单位向量
        const tx = segDx / segLen
        const ty = segDy / segLen
        // 摩擦力方向：与速度沿斜面分量方向相反
        const vAlong = obj.vx * tx + obj.vy * ty
        const dir = vAlong >= 0 ? -1 : 1
        drawArrow(
          obj.x, obj.y,
          obj.x + tx * fLen * dir, obj.y + ty * fLen * dir,
          'rgba(251, 146, 60, 0.8)', 2
        )
        ctx.fillStyle = 'rgba(251, 146, 60, 0.9)'
        ctx.fillText('f', obj.x + tx * fLen * dir + 4, obj.y + ty * fLen * dir)
      }
    }
  }
}

/**
 * 绘制带箭头的线段
 */
function drawArrow(x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  // 箭头头
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 6 * Math.cos(angle - 0.4), y2 - 6 * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - 6 * Math.cos(angle + 0.4), y2 - 6 * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

/**
 * 查找物体当前接触的线段（距离小于半径+阈值）
 * 阈值收紧到 +1，避免物体实际未接触却被判定为接触而画出错误支持力
 */
function findContactSegment(obj, objects) {
  const threshold = (obj.radius || 10) + 1
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const dist = pointToSegmentDistance(obj.x, obj.y, seg.x1, seg.y1, seg.x2, seg.y2)
    if (dist <= threshold) return seg
  }
  return null
}

/**
 * 点到线段距离
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function drawWatermark() {
  if (props.mode !== 'replay') return
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('回放模式', cssW - 16, 24)
}

/**
 * 绘制 AI 解析提示（画布左上角，3秒后由父组件清空）
 */
function drawAIToast() {
  if (!props.aiToast) return
  const canvas = canvasRef.value
  // 背景胶囊
  ctx.font = 'bold 13px sans-serif'
  const metrics = ctx.measureText(props.aiToast)
  const padX = 12
  const padY = 6
  const boxW = metrics.width + padX * 2
  const boxH = 26
  const x = 16
  const y = 16
  ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'
  roundRect(ctx, x, y, boxW, boxH, 13)
  ctx.fill()
  // 文字
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(props.aiToast, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}

/**
 * 圆角矩形辅助
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 绘制 Shift 防重叠修正的绿色闪烁反馈（700ms 内淡出）
 */
function drawShiftFlash() {
  if (!ctx || !shiftFlashPos) return
  const now = Date.now()
  if (now >= shiftFlashUntil) {
    shiftFlashPos = null
    return
  }
  const remaining = shiftFlashUntil - now
  const alpha = Math.min(1, remaining / 700)
  const r = 15
  // 外圈绿色光晕（随时间扩散）
  const expand = (1 - alpha) * 20
  ctx.strokeStyle = 'rgba(34, 197, 94, ' + (alpha * 0.9) + ')'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(34, 197, 94, ' + alpha + ')'
  ctx.shadowBlur = 15
  ctx.beginPath()
  ctx.arc(shiftFlashPos.x, shiftFlashPos.y, r + 6 + expand, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
}

/**
 * 绘制右键框选矩形（半透明蓝色边框 + 极淡蓝色填充）
 * 在世界坐标系中绘制，与物体一起随平移/缩放
 */
function drawSelectionRect() {
  if (!ctx || !selectionActive || !selectionStart || !selectionEnd) return
  const minX = Math.min(selectionStart.x, selectionEnd.x)
  const maxX = Math.max(selectionStart.x, selectionEnd.x)
  const minY = Math.min(selectionStart.y, selectionEnd.y)
  const maxY = Math.max(selectionStart.y, selectionEnd.y)
  // 填充
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
  // 边框
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
  ctx.setLineDash([])
}

/**
 * 绘制选中物体的高亮描边（蓝色发光）
 * - 圆：外圈蓝色光晕
 * - 线段：沿线段加粗蓝色描边
 */
function drawSelectionHighlight(objects) {
  if (!ctx) return
  const selectedSet = new Set(props.selectedIds)
  if (selectedSet.size === 0) return
  for (const obj of objects) {
    if (!selectedSet.has(obj.id)) continue
    if (obj.type === '质点') {
      const r = obj.radius || 10
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)'
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(96, 165, 250, 0.8)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(obj.x, obj.y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    } else if (obj.type === 'line_segment') {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(96, 165, 250, 0.7)'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(obj.x1, obj.y1)
      ctx.lineTo(obj.x2, obj.y2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  // 高 DPI：基础变换设为 dpr 缩放，后续所有绘制用 CSS 像素坐标
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const objects = getDisplayObjects()

  // 应用世界坐标变换（平移 + 缩放），叠加在 dpr 之上
  ctx.save()
  ctx.translate(worldOffset.value.x, worldOffset.value.y)
  ctx.scale(worldScale.value, worldScale.value)

  drawGrid()
  drawField()
  drawGround()
  drawSegments(objects)
  drawArcsVisually(objects)
  drawTrails(objects)
  drawObjects(objects)
  drawVelocity(objects)
  drawForces(objects)
  drawPreviewLine()
  drawPreviewArc()
  drawSelectionHighlight(objects)
  drawSelectionRect()
  drawShiftFlash()

  ctx.restore()

  // UI 层（不随世界变换）：水印、提示、工具指示
  drawWatermark()
  drawAIToast()
  drawEditUI()
}

/**
 * 按 groupId 分组绘制平滑弧线描边（覆盖在线段上，视觉更平滑）
 */
function drawArcsVisually(objects) {
  if (!ctx) return
  // 按 groupId 分组，只处理带 arc 元数据的线段
  const groups = new Map()
  for (const obj of objects) {
    if (obj.type === 'line_segment' && obj.groupId && obj.arc) {
      if (!groups.has(obj.groupId)) groups.set(obj.groupId, [])
      groups.get(obj.groupId).push(obj)
    }
  }
  for (const [, segs] of groups) {
    if (segs.length === 0) continue
    const { cx, cy, r, startAngle, endAngle } = segs[0].arc
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.stroke()
  }
}

/**
 * 绘制线段预览（绘制中显示虚线）
 */
function drawPreviewLine() {
  if (!previewLine.value || !ctx) return
  const { x1, y1, x2, y2 } = previewLine.value
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  // 端点标记
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)'
  ctx.beginPath()
  ctx.arc(x1, y1, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x2, y2, 3, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 绘制圆弧预览（三阶段不同显示）
 */
function drawPreviewArc() {
  if (!previewArc.value || !ctx) return
  const { cx, cy, r, phase } = previewArc.value
  if (r < 1) return
  // 圆心标记
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  if (phase === 'radius') {
    // 半径阶段：淡虚线圆 + 半径线
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  } else if (phase === 'angle') {
    // 角度阶段：淡虚线圆 + 实线弧线高亮
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    // 实线弧（从起点到当前角度）
    let { startAngle, endAngle } = previewArc.value
    let delta = endAngle - startAngle
    while (delta <= 0) delta += Math.PI * 2
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, startAngle + delta)
    ctx.stroke()
    // 起点标记
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.arc(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle), 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * 编辑模式 UI：画布右上角工具指示
 */
function drawEditUI() {
  if (!props.editMode || !ctx) return
  let text = '工具：' + (
    tool.value === 'ball' ? '⚽ 小球（点击添加，拖拽移动）' :
    tool.value === 'platform' ? '➖ 平台（拖拽绘制，Shift 吸附）' :
    '⤵ 圆弧（三次点击：圆心→半径起点→终点，Shift反向）'
  )
  if (chargeMode.value) text += '  ⚡带电粒子'
  ctx.font = '12px sans-serif'
  const metrics = ctx.measureText(text)
  const padX = 10
  const boxW = metrics.width + padX * 2
  const boxH = 24
  const x = cssW - boxW - 16
  const y = 16
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  roundRect(ctx, x, y, boxW, boxH, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, boxW, boxH, 6)
  ctx.stroke()
  ctx.fillStyle = '#c4b5fd'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
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
