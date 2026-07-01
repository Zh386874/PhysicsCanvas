/**
 * 画布交互层：事件处理 + 拖拽 + 平移缩放
 * 不含绘制（由 useCanvasRenderer 负责）和工具状态（由 useEditTools 负责）
 * 弧线点击/预览、Shift 防重叠委托给 useEditTools
 */
import { ref, type Ref } from 'vue'
import { state } from './usePhysics'
import { autoComputeNormal } from './useCollision'
import {
  tool, chargeMode, previewLine, genId,
  handleArcClick, updateArcPreview,
  pushOutOfOverlap, triggerShiftFlash
} from './useEditTools'
import { pointToSegmentDistance } from './useCanvasRenderer'
import type { PhysicsObject, ParticleObject, SegmentObject } from './usePhysics'

// ===== 世界坐标系：平移与缩放 =====
export const worldOffset = ref({ x: 0, y: 0 })
export const worldScale = ref(1)

// ===== 高 DPI 适配 =====
let dpr = 1
let cssW = 0
let cssH = 0

// ===== 平移状态 =====
let panning = false
let panStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null

// ===== 绘制线段状态 =====
let drawing = false
let drawStart: { x: number; y: number } | null = null
let drawEnd: { x: number; y: number } | null = null
let shiftPressed = false

// ===== 拖拽物体状态 =====
let dragging = false
let dragTarget: any = null
let justDragged = false

// ===== 框选状态 =====
let selectionActive = false
let selectionStart: { x: number; y: number } | null = null
let selectionEnd: { x: number; y: number } | null = null

// ===== 批量拖拽状态 =====
let batchDragging = false
let batchDragStartPos: { x: number; y: number } | null = null
let batchDragInitial: any[] | null = null

// ===== 注入的依赖（组件实例级） =====
let canvasRef: Ref<HTMLCanvasElement | null> | null = null
let getProps: () => any = () => ({ editMode: false, selectedIds: [] })
let emitFn: (event: string, ...args: any[]) => void = () => {}

// ===== Getter（供渲染层和组件使用） =====
export function getDpr(): number { return dpr }
export function getCssW(): number { return cssW }
export function getCssH(): number { return cssH }
export function getSelectionState() {
  return { active: selectionActive, start: selectionStart, end: selectionEnd }
}
export function isPanning(): boolean { return panning }
export function isDragging(): boolean { return dragging }
export function isBatchDragging(): boolean { return batchDragging }
export function isDrawing(): boolean { return drawing }
export function isSelectionActive(): boolean { return selectionActive }

/**
 * 初始化交互层：注入 canvasRef、props getter、emit
 * 在组件 onMounted 中调用
 */
export function initCanvasInteraction(
  canvas: Ref<HTMLCanvasElement | null>,
  propsGetter: () => any,
  emitter: (event: string, ...args: any[]) => void
): void {
  canvasRef = canvas
  getProps = propsGetter
  emitFn = emitter
}

// ===== 坐标转换 =====

function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const canvas = canvasRef?.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  return {
    x: (sx - worldOffset.value.x) / worldScale.value,
    y: (sy - worldOffset.value.y) / worldScale.value
  }
}

function getMousePos(e: MouseEvent): { x: number; y: number } {
  return screenToWorld(e.clientX, e.clientY)
}

// ===== 点击检测 =====

/**
 * 检测鼠标是否点中某个物体，返回拖拽目标描述
 * @param skipSegments 是否跳过线段检测（ball 工具下传 true，避免点击线段拦截添加小球）
 */
function hitTest(pos: { x: number; y: number }, skipSegments = false): any {
  if (!skipSegments) {
    // 先检测线段端点（优先级高，便于编辑端点）
    for (const obj of state.objects) {
      if (obj.type === 'line_segment') {
        const seg = obj as SegmentObject
        const d1 = Math.hypot(pos.x - seg.x1, pos.y - seg.y1)
        const d2 = Math.hypot(pos.x - seg.x2, pos.y - seg.y2)
        if (d1 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 0 }
        if (d2 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 1 }
      }
    }
    // 再检测线段整体（点击在线段附近 5px）
    for (const obj of state.objects) {
      if (obj.type === 'line_segment') {
        const seg = obj as SegmentObject
        const dist = pointToSegmentDistance(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2)
        if (dist <= 5) return { id: obj.id, mode: 'segment' }
      }
    }
  }
  // 最后检测圆
  for (const obj of state.objects) {
    if (obj.type === '质点') {
      const p = obj as ParticleObject
      const d = Math.hypot(pos.x - p.x, pos.y - p.y)
      if (d <= (p.radius || 10)) return { id: obj.id, mode: 'circle' }
    }
  }
  return null
}

// ===== 画布点击：添加小球 + Shift 防重叠 =====

function onCanvasClick(e: MouseEvent): void {
  const props = getProps()
  if (!props.editMode || tool.value !== 'ball') return
  if (dragging || drawing) return
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
    const corrected = pushOutOfOverlap(finalX, finalY, radius, state.objects)
    if (corrected) {
      finalX = corrected.x
      finalY = corrected.y
      triggerShiftFlash({ x: finalX, y: finalY })
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
  emitFn('add-object', newObj)
}

// ===== 鼠标按下 =====
// 中键：平移画布（任何场景）
// 右键：框选
// 左键：拖拽优先，未命中按工具行为（platform 绘制 / arc 三次点击）

function onMouseDown(e: MouseEvent): void {
  const props = getProps()
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
      batchDragInitial = props.selectedIds.map((id: number) => {
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

  // 圆弧工具：三次点击（圆心 → 半径起点 → 终点角度），委托给 useEditTools
  if (tool.value === 'arc') {
    handleArcClick(pos, e.shiftKey, (obj) => emitFn('add-object', obj), state.objects)
    return
  }
  // ball 工具：mousedown 不做事，由 click 添加
}

// ===== 鼠标移动 =====

function onMouseMove(e: MouseEvent): void {
  const props = getProps()
  // 中键平移（任何场景下都可用）
  if (panning && panStart) {
    const canvas = canvasRef?.value
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
    const dx = pos.x - batchDragStartPos!.x
    const dy = pos.y - batchDragStartPos!.y
    const updates = batchDragInitial.map(item => {
      if (item.x !== undefined) {
        return { id: item.id, props: { x: item.x + dx, y: item.y + dy } }
      }
      return { id: item.id, props: { x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy } }
    })
    emitFn('batch-update', updates)
    return
  }

  // 圆弧预览：委托给 useEditTools
  if (tool.value === 'arc') {
    updateArcPreview(pos)
    return
  }

  // 线段绘制预览
  if (drawing && tool.value === 'platform') {
    let endX = pos.x
    let endY = pos.y
    // Shift 吸附：水平或垂直
    if (shiftPressed) {
      const dx = pos.x - drawStart!.x
      const dy = pos.y - drawStart!.y
      if (Math.abs(dx) > Math.abs(dy)) {
        endY = drawStart!.y
      } else {
        endX = drawStart!.x
      }
    }
    drawEnd = { x: endX, y: endY }
    previewLine.value = { x1: drawStart!.x, y1: drawStart!.y, x2: endX, y2: endY }
    return
  }

  // 物体拖拽
  if (dragging && dragTarget) {
    const obj = state.objects.find(o => o.id === dragTarget.id)
    if (!obj) return
    if (dragTarget.mode === 'circle') {
      emitFn('update-object', { id: obj.id, props: { x: pos.x - dragTarget.offsetX, y: pos.y - dragTarget.offsetY } })
    } else if (dragTarget.mode === 'endpoint') {
      const newProps = dragTarget.endpointIdx === 0
        ? { x1: pos.x, y1: pos.y }
        : { x2: pos.x, y2: pos.y }
      // 自动重算法线
      const tempSeg = { ...obj, ...newProps }
      const normal = autoComputeNormal(tempSeg)
      newProps.normalX = normal.normalX
      newProps.normalY = normal.normalY
      emitFn('update-object', { id: obj.id, props: newProps })
    } else if (dragTarget.mode === 'segment') {
      // 整体平移
      const dx = pos.x - dragTarget.offsetX
      const dy = pos.y - dragTarget.offsetY
      emitFn('update-object', {
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

// ===== 鼠标抬起 =====

function onMouseUp(e: MouseEvent): void {
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
    emitFn('update-selected', ids)
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

  // 线段绘制完成
  if (drawing && tool.value === 'platform') {
    drawing = false
    const pos = getMousePos(e)
    let endX = pos.x
    let endY = pos.y
    if (shiftPressed) {
      const dx = pos.x - drawStart!.x
      const dy = pos.y - drawStart!.y
      if (Math.abs(dx) > Math.abs(dy)) endY = drawStart!.y
      else endX = drawStart!.x
    }
    // 线段长度过短则忽略
    const len = Math.hypot(endX - drawStart!.x, endY - drawStart!.y)
    if (len > 10) {
      const tempSeg = { x1: drawStart!.x, y1: drawStart!.y, x2: endX, y2: endY }
      const normal = autoComputeNormal(tempSeg)
      const newObj = {
        id: genId(),
        name: '平台' + (state.objects.filter(o => o.type === 'line_segment').length + 1),
        type: 'line_segment',
        x1: drawStart!.x,
        y1: drawStart!.y,
        x2: endX,
        y2: endY,
        normalX: normal.normalX,
        normalY: normal.normalY,
        restitution: 0.3,
        friction: 0.5,
        color: '#475569'
      }
      emitFn('add-object', newObj)
    }
    previewLine.value = null
    drawStart = null
    drawEnd = null
  }

  // 拖拽结束
  if (dragging) {
    dragging = false
    dragTarget = null
    // 标记刚结束拖拽，阻止紧随其后的 click 事件误添加小球
    justDragged = true
    setTimeout(() => { justDragged = false }, 0)
  }
}

// ===== 矩形选框计算 =====
// 圆：圆心在矩形内；线段：任一端点在矩形内

function getObjectsInRect(p1: { x: number; y: number } | null, p2: { x: number; y: number } | null): number[] {
  if (!p1 || !p2) return []
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  const ids: number[] = []
  for (const obj of state.objects) {
    if (obj.type === '质点') {
      const p = obj as ParticleObject
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        ids.push(obj.id)
      }
    } else if (obj.type === 'line_segment') {
      const seg = obj as SegmentObject
      const in1 = seg.x1 >= minX && seg.x1 <= maxX && seg.y1 >= minY && seg.y1 <= maxY
      const in2 = seg.x2 >= minX && seg.x2 <= maxX && seg.y2 >= minY && seg.y2 <= maxY
      if (in1 || in2) ids.push(obj.id)
    }
  }
  return ids
}

// ===== 滚轮缩放：以鼠标位置为中心 =====

function onWheel(e: WheelEvent): void {
  const canvas = canvasRef?.value
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

// ===== 限制 worldOffset 范围，防止场景完全移出视野 =====

function clampOffset(offset: { x: number; y: number }, scale: number, _canvas: HTMLCanvasElement): { x: number; y: number } {
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

// ===== 重置视图 =====

function resetView(): void {
  worldOffset.value = { x: 0, y: 0 }
  worldScale.value = 1
}

// ===== 调整画布尺寸（高 DPI 适配）=====

function resizeCanvas(): void {
  const canvas = canvasRef?.value
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
  // 仅当场景启用水平地面时才跟随容器更新；null/100000 表示禁用（斜面/自定义场景）
  if (state.groundY !== null && state.groundY !== 100000) {
    state.groundY = cssH - 60
  }
}

export {
  onCanvasClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  resetView,
  resizeCanvas
}
