/**
 * 编辑工具层：工具状态管理 + 弧线绘制 + Shift 防重叠检测
 * 不含事件处理（由 useCanvasInteraction 调用）
 */
import { ref } from 'vue'
import { autoComputeNormal } from './useCollision'
import type { PhysicsObject, SegmentObject, ParticleObject } from './usePhysics'

type ToolType = 'ball' | 'platform' | 'arc'

/** 工具状态 */
const tool = ref<ToolType>('ball')
const chargeMode = ref(false)

/** 圆弧绘制状态（三次点击：圆心 → 半径起点 → 终点角度） */
let arcPhase: 'center' | 'radius' | 'angle' = 'center'
let arcCenter: { x: number; y: number } | null = null
let arcRadius = 0
let arcStartAngle = 0
const previewArc = ref<{
  cx: number; cy: number; r: number
  startAngle: number; endAngle: number
  phase?: string
} | null>(null)

/** 线段绘制预览 */
const previewLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

/** Shift 闪烁反馈状态 */
let shiftFlashPos: { x: number; y: number } | null = null
let shiftFlashUntil = 0

/** 生成唯一 ID */
function genId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}

/** 重置圆弧绘制状态 */
function resetArcState(): void {
  arcPhase = 'center'
  arcCenter = null
  arcRadius = 0
  previewArc.value = null
}

/** 获取当前圆弧阶段（供交互层判断） */
function getArcPhase(): 'center' | 'radius' | 'angle' {
  return arcPhase
}

/** 获取圆心（供交互层判断） */
function getArcCenter(): { x: number; y: number } | null {
  return arcCenter
}

/**
 * 圆弧点击处理：三次点击状态机
 * @returns true 表示已消费此次点击（生成弧线或推进阶段），false 表示未消费
 */
function handleArcClick(
  pos: { x: number; y: number },
  shiftKey: boolean,
  onAddObject: (obj: SegmentObject) => void,
  objects: PhysicsObject[]
): boolean {
  if (arcPhase === 'center') {
    arcCenter = pos
    arcPhase = 'radius'
    previewArc.value = { cx: pos.x, cy: pos.y, r: 0, startAngle: 0, endAngle: 0 }
    return true
  } else if (arcPhase === 'radius') {
    arcRadius = Math.hypot(pos.x - arcCenter!.x, pos.y - arcCenter!.y)
    arcStartAngle = Math.atan2(pos.y - arcCenter!.y, pos.x - arcCenter!.x)
    if (arcRadius > 10) {
      arcPhase = 'angle'
      previewArc.value = {
        cx: arcCenter!.x, cy: arcCenter!.y, r: arcRadius,
        startAngle: arcStartAngle, endAngle: arcStartAngle
      }
    } else {
      resetArcState()
    }
    return true
  } else {
    const endAngle = Math.atan2(pos.y - arcCenter!.y, pos.x - arcCenter!.x)
    generateArcSegments(arcCenter!.x, arcCenter!.y, arcRadius, arcStartAngle, endAngle, shiftKey, onAddObject, objects)
    resetArcState()
    return true
  }
}

/**
 * 更新圆弧预览（鼠标移动时调用）
 */
function updateArcPreview(pos: { x: number; y: number }): void {
  if (!arcCenter) return
  if (arcPhase === 'radius') {
    const r = Math.hypot(pos.x - arcCenter.x, pos.y - arcCenter.y)
    previewArc.value = { cx: arcCenter.x, cy: arcCenter.y, r, startAngle: 0, endAngle: 0, phase: 'radius' }
  } else if (arcPhase === 'angle') {
    const endAngle = Math.atan2(pos.y - arcCenter.y, pos.x - arcCenter.x)
    previewArc.value = {
      cx: arcCenter.x, cy: arcCenter.y, r: arcRadius,
      startAngle: arcStartAngle, endAngle, phase: 'angle'
    }
  }
}

/**
 * 生成圆弧的离散线段（任意起止角度，8 条线段近似）
 */
function generateArcSegments(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
  reverse: boolean,
  onAddObject: (obj: SegmentObject) => void,
  objects: PhysicsObject[]
): void {
  const numSegments = 8
  let delta = endAngle - startAngle
  while (delta <= 0) delta += Math.PI * 2
  if (reverse) delta = delta - Math.PI * 2
  const step = delta / numSegments
  const groupId = genId()
  const arcName = '弧线' + (Math.floor(objects.filter(o => o.name?.startsWith('弧线')).length / 8) + 1)
  for (let i = 0; i < numSegments; i++) {
    const a1 = startAngle + i * step
    const a2 = startAngle + (i + 1) * step
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const tempSeg = { x1, y1, x2, y2 }
    const normal = autoComputeNormal(tempSeg)
    const newObj: SegmentObject = {
      id: genId(),
      groupId,
      name: arcName,
      type: 'line_segment',
      arc: { cx, cy, r, startAngle, endAngle: startAngle + delta },
      x1, y1, x2, y2,
      normalX: normal.normalX,
      normalY: normal.normalY,
      restitution: 0.3,
      friction: 0.5,
      color: '#7c3aed'
    }
    onAddObject(newObj)
  }
}

// ===== Shift 防重叠 =====

/** 点到线段距离 */
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

interface OverlapResult {
  type: 'circle' | 'segment'
  obj: PhysicsObject
  penetration: number
  nx: number
  ny: number
}

/**
 * 检测 (x,y) 半径 r 的新球是否与现有物体重叠
 * 返回首个重叠障碍物，nx/ny 为从障碍物指向新球中心的法线方向
 */
function findOverlap(x: number, y: number, r: number, objects: PhysicsObject[]): OverlapResult | null {
  const threshold = 2
  for (const obj of objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      const dx = x - p.x, dy = y - p.y
      const dist = Math.hypot(dx, dy)
      const minDist = r + (p.radius || 10) + threshold
      if (dist < minDist) {
        const safeDist = dist > 1e-6 ? dist : 1
        return { type: 'circle', obj, penetration: minDist - dist, nx: dx / safeDist, ny: dy / safeDist }
      }
    } else if (obj.type === 'line_segment') {
      const seg = obj as SegmentObject
      const dist = pointToSegmentDist(x, y, seg.x1, seg.y1, seg.x2, seg.y2)
      const minDist = r + threshold
      if (dist < minDist) {
        let nx = seg.normalX || 0, ny = seg.normalY || 0
        const cx = (seg.x1 + seg.x2) / 2, cy = (seg.y1 + seg.y2) / 2
        const toBallX = x - cx, toBallY = y - cy
        if (nx * toBallX + ny * toBallY < 0) { nx = -nx; ny = -ny }
        return { type: 'segment', obj, penetration: minDist - dist, nx, ny }
      }
    }
  }
  return null
}

/**
 * 从重叠位置沿法线迭代推出，直到不重叠或达到最大尝试次数
 * 返回修正后的 {x, y}，若无需修正返回 null
 */
function pushOutOfOverlap(x: number, y: number, r: number, objects: PhysicsObject[]): { x: number; y: number } | null {
  let cx = x, cy = y
  const maxAttempts = 200
  for (let i = 0; i < maxAttempts; i++) {
    const overlap = findOverlap(cx, cy, r, objects)
    if (!overlap) return i > 0 ? { x: cx, y: cy } : null
    cx += overlap.nx
    cy += overlap.ny
  }
  return { x: cx, y: cy }
}

/** 触发 Shift 闪烁反馈 */
function triggerShiftFlash(pos: { x: number; y: number }): void {
  shiftFlashPos = pos
  shiftFlashUntil = Date.now() + 700
}

/** 获取 Shift 闪烁状态（供渲染层使用） */
function getShiftFlashState(): { pos: { x: number; y: number } | null; until: number } {
  // 清理过期状态
  if (shiftFlashPos && Date.now() >= shiftFlashUntil) {
    shiftFlashPos = null
  }
  return { pos: shiftFlashPos, until: shiftFlashUntil }
}

export {
  tool,
  chargeMode,
  previewArc,
  previewLine,
  genId,
  resetArcState,
  getArcPhase,
  getArcCenter,
  handleArcClick,
  updateArcPreview,
  findOverlap,
  pushOutOfOverlap,
  triggerShiftFlash,
  getShiftFlashState
}
