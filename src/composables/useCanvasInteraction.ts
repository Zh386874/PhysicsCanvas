/**
 * 画布交互层：事件处理 + 拖拽 + 平移缩放
 * 不含绘制（由 useCanvasRenderer 负责）和工具状态（由 useEditTools 负责）
 * 弧线点击/预览、Shift 防重叠委托给 useEditTools
 *
 * 依赖注入（DIP）：通过 PhysicsStateAccess 接口访问物理状态，
 * 而非直接 import usePhysics.state，便于测试和替换状态源
 */
import { ref, type Ref } from 'vue'
import { autoComputeNormal } from './useCollision'
import {
  tool,
  chargeMode,
  previewLine,
  genId,
  isPlatformTool,
  createPlatformLikeObject,
  handleArcClick,
  updateArcPreview,
  getSpringAnchor,
  handleSpringClick,
  updateSpringPreview,
  pushOutOfOverlap,
  snapToSegmentSurface,
  triggerShiftFlash
} from './useEditTools'
import { pointToSegmentDistance } from './useCanvasRenderer'
import type { PhysicsObject, ParticleObject, SegmentObject } from './usePhysics'
import { GROUND_DISABLED, PAN_LIMIT } from '../constants'

/**
 * 物理状态访问接口（DIP 抽象）
 * 交互层只依赖此接口，不依赖具体的 usePhysics.state
 */
export interface PhysicsStateAccess {
  /** 物体列表（只读访问） */
  readonly objects: PhysicsObject[]
  /** 地面 y 坐标（像素），>= 100000 表示禁用地面 */
  groundY: number
}

/** 拖拽模式：圆/线段端点/线段整体 */
type DragMode = 'circle' | 'endpoint' | 'segment'

/** 拖拽目标描述（含拖拽过程中动态添加的偏移量） */
interface DragTarget {
  id: number
  mode: DragMode
  endpointIdx?: 0 | 1
  /** 圆拖拽：鼠标相对圆心的偏移 */
  offsetX?: number
  offsetY?: number
  /** 线段整体拖拽：按下时的端点坐标 */
  startX1?: number
  startY1?: number
  startX2?: number
  startY2?: number
}

/** 批量拖拽初始状态项（质点存 x/y，线段存四端点） */
interface BatchDragItem {
  id: number
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

/** 画布组件 props 的最小契约（交互层依赖） */
interface CanvasProps {
  editMode: boolean
  selectedIds: number[]
}

/** 点击检测结果（与 DragTarget 同构，hitTest 返回基础字段，onMouseDown 补充偏移量） */

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
let dragTarget: DragTarget | null = null
let justDragged = false

// ===== 框选状态 =====
let selectionActive = false
let selectionStart: { x: number; y: number } | null = null
let selectionEnd: { x: number; y: number } | null = null

// ===== 批量拖拽状态 =====
let batchDragging = false

// ===== groundY 初始化防抖：仅首次/重置后对齐一次，避免侧栏收起时模型位置漂移 =====
let groundInitialized = false

export function resetGroundInitialized(): void {
  groundInitialized = false
}

let batchDragStartPos: { x: number; y: number } | null = null
let batchDragInitial: BatchDragItem[] | null = null

// ===== 注入的依赖（组件实例级） =====
let canvasRef: Ref<HTMLCanvasElement | null> | null = null
let getProps: () => CanvasProps = () => ({ editMode: false, selectedIds: [] })
let emitFn: (event: string, ...args: unknown[]) => void = () => {}
let stateAccess: PhysicsStateAccess = { objects: [], groundY: 400 }

// ===== Getter（供渲染层和组件使用） =====
export function getDpr(): number {
  return dpr
}
export function getCssW(): number {
  return cssW
}
export function getCssH(): number {
  return cssH
}
export function getSelectionState() {
  return { active: selectionActive, start: selectionStart, end: selectionEnd }
}
export function isPanning(): boolean {
  return panning
}
export function isDragging(): boolean {
  return dragging
}
export function isBatchDragging(): boolean {
  return batchDragging
}
export function isDrawing(): boolean {
  return drawing
}
export function isSelectionActive(): boolean {
  return selectionActive
}

/**
 * 初始化交互层：注入 canvasRef、props getter、emit、stateAccess
 * 在组件 onMounted 中调用
 * @param stateAccess 物理状态访问接口（DIP：依赖抽象而非具体 usePhysics.state）
 */
export function initCanvasInteraction(
  canvas: Ref<HTMLCanvasElement | null>,
  propsGetter: () => CanvasProps,
  emitter: (event: string, ...args: unknown[]) => void,
  state: PhysicsStateAccess
): void {
  canvasRef = canvas
  getProps = propsGetter
  emitFn = emitter
  stateAccess = state
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
function hitTest(pos: { x: number; y: number }, skipSegments = false): DragTarget | null {
  if (!skipSegments) {
    // 先检测线段端点（优先级高，便于编辑端点）
    for (const obj of stateAccess.objects) {
      if (obj.type === 'line_segment') {
        const seg = obj as SegmentObject
        const d1 = Math.hypot(pos.x - seg.x1, pos.y - seg.y1)
        const d2 = Math.hypot(pos.x - seg.x2, pos.y - seg.y2)
        if (d1 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 0 }
        if (d2 <= 8) return { id: obj.id, mode: 'endpoint', endpointIdx: 1 }
      }
    }
    // 再检测线段整体（点击在线段附近 5px）
    for (const obj of stateAccess.objects) {
      if (obj.type === 'line_segment') {
        const seg = obj as SegmentObject
        const dist = pointToSegmentDistance(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2)
        if (dist <= 5) return { id: obj.id, mode: 'segment' }
      }
    }
  }
  // 最后检测圆
  for (const obj of stateAccess.objects) {
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
    const corrected = pushOutOfOverlap(finalX, finalY, radius, stateAccess.objects)
    if (corrected) {
      finalX = corrected.x
      finalY = corrected.y
      triggerShiftFlash({ x: finalX, y: finalY })
    }
  }

  const newObj = {
    id: genId(),
    name: '小球' + (stateAccess.objects.length + 1),
    type: '质点',
    x: finalX,
    y: finalY,
    vx: 0,
    vy: 0,
    radius: radius,
    mass: 1,
    charge: chargeMode.value ? 1 : 0,
    color: chargeMode.value ? '#DCDCAA' : '#569CD6',
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
    e.preventDefault()
    const pos = getMousePos(e)
    selectionActive = true
    selectionStart = pos
    selectionEnd = pos
    return
  }

  // 非左键不处理编辑
  if (e.button !== 0) return

  const pos = getMousePos(e)

  // 弹簧工具：第二次点击（已有锚点）→ 选择球并创建弹簧
  if (tool.value === 'spring' && getSpringAnchor()) {
    handleSpringClick(pos, stateAccess.objects, (obj) => emitFn('add-object', obj))
    return
  }

  // 拖拽优先：ball 工具下只检测圆（避免点击线段拦截添加小球）；其他工具完整 hitTest
  const hit = hitTest(pos, tool.value === 'ball')
  if (hit) {
    // 多选批量拖拽：点击的物体在 selectedIds 内且选中数 > 1，整组平移
    if (props.selectedIds.length > 1 && props.selectedIds.includes(hit.id)) {
      batchDragging = true
      batchDragStartPos = pos
      batchDragInitial = props.selectedIds
        .map((id: number): BatchDragItem | null => {
          const o = stateAccess.objects.find((o) => o.id === id)
          if (!o) return null
          if (o.type === '质点' || o.type === '刚体') return { id, x: o.x, y: o.y }
          if (o.type === 'line_segment') return { id, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }
          return null
        })
        .filter((item): item is BatchDragItem => item !== null)
      return
    }
    // 单选拖拽
    dragging = true
    dragTarget = hit
    const obj = stateAccess.objects.find((o) => o.id === hit.id)
    if (!obj) return
    if (hit.mode === 'circle') {
      const p = obj as ParticleObject
      hit.offsetX = pos.x - p.x
      hit.offsetY = pos.y - p.y
    } else if (hit.mode === 'segment') {
      const s = obj as SegmentObject
      hit.offsetX = pos.x
      hit.offsetY = pos.y
      hit.startX1 = s.x1
      hit.startY1 = s.y1
      hit.startX2 = s.x2
      hit.startY2 = s.y2
    }
    return
  }

  // 未命中物体：平台类工具（platform/conveyor/plate）开始绘制线段
  if (isPlatformTool(tool.value)) {
    drawing = true
    drawStart = pos
    drawEnd = pos
    previewLine.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
    return
  }

  // select 工具：点击空白处清除选择（不添加新物体）
  if (tool.value === 'select') {
    emitFn('update-selected', [])
    return
  }

  // 圆弧工具：三次点击（圆心 → 半径起点 → 终点角度），委托给 useEditTools
  if (tool.value === 'arc') {
    handleArcClick(pos, e.shiftKey, (obj) => emitFn('add-object', obj), stateAccess.objects)
    return
  }
  // 弹簧工具：第一次点击（设置固定端），第二次点击在选择球时已提前处理
  if (tool.value === 'spring') {
    handleSpringClick(pos, stateAccess.objects, (obj) => emitFn('add-object', obj))
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
    const updates = batchDragInitial.map((item) => {
      if (item.x !== undefined) {
        // 质点/刚体：x 和 y 同时存在
        return { id: item.id, props: { x: item.x + dx, y: item.y! + dy } }
      }
      // 线段：x1/y1/x2/y2 同时存在
      return {
        id: item.id,
        props: { x1: item.x1! + dx, y1: item.y1! + dy, x2: item.x2! + dx, y2: item.y2! + dy }
      }
    })
    emitFn('batch-update', updates)
    return
  }

  // 圆弧预览：委托给 useEditTools
  if (tool.value === 'arc') {
    updateArcPreview(pos)
    return
  }

  // 弹簧预览：从锚点到鼠标位置
  if (tool.value === 'spring') {
    updateSpringPreview(pos)
    return
  }

  // 线段绘制预览（平台类工具共用）
  if (drawing && isPlatformTool(tool.value)) {
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
    // 模块级 let 变量在函数调用后会丢失窄化，用局部 const 保存以保持非空类型
    const target = dragTarget
    const obj = stateAccess.objects.find((o) => o.id === target.id)
    if (!obj) return
    if (target.mode === 'circle') {
      let targetX = pos.x - target.offsetX!
      let targetY = pos.y - target.offsetY!
      // Shift 吸附：精准落到最近线段表面（边缘接触）
      if (shiftPressed) {
        const p = obj as ParticleObject
        const snapped = snapToSegmentSurface(targetX, targetY, p.radius || 10, stateAccess.objects)
        if (snapped) {
          targetX = snapped.x
          targetY = snapped.y
          triggerShiftFlash({ x: targetX, y: targetY })
        }
      }
      emitFn('update-object', { id: obj.id, props: { x: targetX, y: targetY } })
    } else if (target.mode === 'endpoint') {
      const newProps: {
        x1?: number
        y1?: number
        x2?: number
        y2?: number
        normalX?: number
        normalY?: number
      } = target.endpointIdx === 0 ? { x1: pos.x, y1: pos.y } : { x2: pos.x, y2: pos.y }
      // 自动重算法线
      const tempSeg = { ...obj, ...newProps } as SegmentObject
      const normal = autoComputeNormal(tempSeg)
      newProps.normalX = normal.normalX
      newProps.normalY = normal.normalY
      emitFn('update-object', { id: obj.id, props: newProps })
    } else if (target.mode === 'segment') {
      // 整体平移
      const dx = pos.x - target.offsetX!
      const dy = pos.y - target.offsetY!
      emitFn('update-object', {
        id: obj.id,
        props: {
          x1: target.startX1! + dx,
          y1: target.startY1! + dy,
          x2: target.startX2! + dx,
          y2: target.startY2! + dy
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
    setTimeout(() => {
      justDragged = false
    }, 0)
    return
  }

  // 线段绘制完成（platform/conveyor/plate 共用，属性由工厂函数差异化）
  if (drawing && isPlatformTool(tool.value)) {
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
      // isPlatformTool 已保证 tool.value 为 'platform' | 'conveyor' | 'plate'，类型断言安全
      const newObj = createPlatformLikeObject(
        tool.value as 'platform' | 'conveyor' | 'plate',
        drawStart!.x,
        drawStart!.y,
        endX,
        endY,
        stateAccess.objects
      )
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
    setTimeout(() => {
      justDragged = false
    }, 0)
  }
}

// ===== 矩形选框计算 =====
// 圆：圆心在矩形内；线段：任一端点在矩形内

function getObjectsInRect(
  p1: { x: number; y: number } | null,
  p2: { x: number; y: number } | null
): number[] {
  if (!p1 || !p2) return []
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  const ids: number[] = []
  for (const obj of stateAccess.objects) {
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
  worldOffset.value = clampOffset(
    {
      x: mouseX - worldX * newScale,
      y: mouseY - worldY * newScale
    },
    newScale,
    canvas
  )
  worldScale.value = newScale
}

// ===== 限制 worldOffset 范围，防止场景完全移出视野 =====

function clampOffset(
  offset: { x: number; y: number },
  scale: number,
  _canvas: HTMLCanvasElement
): { x: number; y: number } {
  // 用 CSS 逻辑尺寸计算（与绘制坐标一致）
  const halfW = cssW / 2
  const halfH = cssH / 2
  const limit = PAN_LIMIT
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
// 注意：不使用 RAF 节流，因为 ResizeObserver 已在每帧渲染前触发，
// 同步更新 canvas backing store 确保下一帧的 draw() 使用正确的尺寸，
// 避免 CSS 尺寸已变但 backing store 未更新导致浏览器拉伸画布内容

function resizeCanvas(): void {
  const canvas = canvasRef?.value
  if (!canvas) return
  // 用 canvas 自身的 bounding rect 获取实际 CSS 显示尺寸
  // canvas 由 CSS flex/width 控制显示尺寸，backing store 跟随实际尺寸
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  // 高 DPI 适配：backing store 按 dpr 放大，CSS 尺寸不变，绘制坐标用 CSS 像素
  dpr = window.devicePixelRatio || 1
  cssW = rect.width
  cssH = rect.height
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  // CSS 显示尺寸由 flex/width 控制，不设置 style.width/height 避免覆盖 flex 布局
  // 仅在首次/重置后对齐一次 groundY 到底部；避免侧栏收起导致 cssH 变化、
  // 物体相对地面移动，用户感知为"模型大小变化"
  if (!groundInitialized && stateAccess.groundY !== null && stateAccess.groundY < GROUND_DISABLED) {
    stateAccess.groundY = cssH - 60
    groundInitialized = true
  }
}

export { onCanvasClick, onMouseDown, onMouseMove, onMouseUp, onWheel, resetView, resizeCanvas }
