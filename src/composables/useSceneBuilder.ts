/**
 * 场景生成器：将 AI 解析的 JSON 转换为项目内部物理状态
 * 包含自动缩放逻辑（适配画布）和多物体/多场/几何体支持
 */

import { state, loadScene, PIXELS_PER_METER } from './usePhysics'
import type { PhysicsObject, ParticleObject, SegmentObject, FieldState } from './usePhysics'
import type { ParsedProblem, ParsedObject } from './useAIParser'

/** 默认画布尺寸（像素），用于自动缩放计算 */
const DEFAULT_CANVAS_WIDTH = 800
const DEFAULT_CANVAS_HEIGHT = 500
/** 画布边距（像素） */
const CANVAS_MARGIN = 60
/** 画布中地面基准线（像素），AI 的 y=0 对应此位置 */
const GROUND_BASELINE = 400

/** 物体颜色池 */
const COLOR_POOL = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185']

let nextId = 1000

/**
 * 计算自动缩放比例
 * 根据 AI 返回的世界坐标范围和 worldWidth，计算合适的 PIXELS_PER_METER
 */
function computeAutoScale(parsed: ParsedProblem): number {
  // 如果 AI 指定了 worldWidth，直接用它计算
  if (parsed.worldWidth && parsed.worldWidth > 0) {
    const usableWidth = DEFAULT_CANVAS_WIDTH - 2 * CANVAS_MARGIN
    return usableWidth / parsed.worldWidth
  }

  // 否则根据物体范围计算
  const allPoints: { x: number; y: number }[] = []
  for (const obj of parsed.objects) {
    if (obj.initialPosition) allPoints.push(obj.initialPosition)
    if (obj.startPoint) allPoints.push(obj.startPoint)
    if (obj.endPoint) allPoints.push(obj.endPoint)
    if (obj.center) allPoints.push(obj.center)
  }

  if (allPoints.length === 0) return PIXELS_PER_METER

  const xs = allPoints.map(p => p.x)
  const ys = allPoints.map(p => p.y)
  const worldW = Math.max(...xs) - Math.min(...xs)
  const worldH = Math.max(...ys) - Math.min(...ys)

  if (worldW <= 0 && worldH <= 0) return PIXELS_PER_METER

  const usableW = DEFAULT_CANVAS_WIDTH - 2 * CANVAS_MARGIN
  const usableH = DEFAULT_CANVAS_HEIGHT - 2 * CANVAS_MARGIN
  const scaleX = worldW > 0 ? usableW / worldW : Infinity
  const scaleY = worldH > 0 ? usableH / worldH : Infinity

  // 取较小的比例确保完整显示，但不小于原始值的 0.1 倍
  const scale = Math.min(scaleX, scaleY)
  return Math.max(scale, PIXELS_PER_METER * 0.1)
}

/**
 * 将单个 AI 物体转换为项目内部物体格式
 */
function convertObject(obj: ParsedObject, scale: number, index: number): PhysicsObject | null {
  const color = COLOR_POOL[index % COLOR_POOL.length]

  if (obj.type === 'ball') {
    const ball: ParticleObject = {
      id: nextId++,
      name: obj.id || `物体${index + 1}`,
      type: '质点',
      mass: obj.mass ?? 1,
      x: (obj.initialPosition?.x ?? 0) * scale + CANVAS_MARGIN,
      // 坐标系翻转：AI 的 y 向上为正，画布 y 向下为正
      y: GROUND_BASELINE - (obj.initialPosition?.y ?? 5) * scale,
      vx: (obj.initialVelocity?.x ?? 0) * scale,
      // vy 翻转：AI 的向上为正，画布向下为正
      vy: -(obj.initialVelocity?.y ?? 0) * scale,
      radius: Math.max((obj.radius ?? 0.2) * scale, 8),
      color,
      charge: obj.charge ?? 0,
      friction: obj.friction ?? 0,
      trail: []
    }
    return ball
  }

  if (obj.type === 'platform') {
    const x1 = (obj.startPoint?.x ?? 0) * scale + CANVAS_MARGIN
    const y1 = GROUND_BASELINE - (obj.startPoint?.y ?? 0) * scale
    const x2 = (obj.endPoint?.x ?? 1) * scale + CANVAS_MARGIN
    const y2 = GROUND_BASELINE - (obj.endPoint?.y ?? 0) * scale
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    // 法线：画布坐标系 y 向下为正，"上方"是 normalY < 0
    let normalX = -dy / len
    let normalY = dx / len
    // 确保法线指向上方（normalY < 0），否则翻转
    if (normalY > 0) {
      normalX = -normalX
      normalY = -normalY
    }
    const segment: SegmentObject = {
      id: nextId++,
      name: obj.id || `平台${index + 1}`,
      type: 'line_segment',
      x1, y1, x2, y2,
      normalX,
      normalY,
      friction: obj.friction ?? 0,
      restitution: 0.2,
      color: '#94a3b8'
    }
    return segment
  }

  if (obj.type === 'arc') {
    // 弧线用 20 段线段近似
    const cx = (obj.center?.x ?? 0) * scale
    const cy = (obj.center?.y ?? 0) * scale
    const r = Math.max((obj.arcRadius ?? 1) * scale, 10)
    const startA = obj.startAngle ?? 0
    const endA = obj.endAngle ?? Math.PI
    const segments = 20
    const arcGroupId = nextId++

    // 只返回第一段，实际使用时需要处理多段
    // 这里简化：返回弧线的第一段，外部循环处理
    const angle0 = startA
    const angle1 = startA + (endA - startA) / segments
    const x1 = cx + r * Math.cos(angle0)
    const y1 = cy + r * Math.sin(angle0)
    const x2 = cx + r * Math.cos(angle1)
    const y2 = cy + r * Math.sin(angle1)
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const segment: SegmentObject = {
      id: nextId++,
      name: obj.id || `弧线${index + 1}`,
      type: 'line_segment',
      x1, y1, x2, y2,
      normalX: -dy / len,
      normalY: dx / len,
      friction: obj.friction ?? 0,
      color: '#a78bfa',
      groupId: arcGroupId,
      arc: { cx, cy, r, startAngle: startA, endAngle: endA }
    }
    return segment
  }

  return null
}

/**
 * 将弧线物体展开为多段线段（20段近似）
 */
function expandArcToSegments(obj: ParsedObject, scale: number, index: number): SegmentObject[] {
  const cx = (obj.center?.x ?? 0) * scale + CANVAS_MARGIN
  // 弧线圆心 y 翻转
  const cy = GROUND_BASELINE - (obj.center?.y ?? 0) * scale
  const r = Math.max((obj.arcRadius ?? 1) * scale, 10)
  const startA = obj.startAngle ?? 0
  const endA = obj.endAngle ?? Math.PI
  const segments = 20
  const arcGroupId = nextId++
  const result: SegmentObject[] = []

  for (let i = 0; i < segments; i++) {
    const a1 = startA + (endA - startA) * (i / segments)
    const a2 = startA + (endA - startA) * ((i + 1) / segments)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    // 法线：确保指向上方（normalY < 0）
    let nx = -dy / len
    let ny = dx / len
    if (ny > 0) { nx = -nx; ny = -ny }
    result.push({
      id: nextId++,
      name: `${obj.id || `弧线${index + 1}`}-${i + 1}`,
      type: 'line_segment',
      x1, y1, x2, y2,
      normalX: nx,
      normalY: ny,
      friction: obj.friction ?? 0,
      restitution: 0.2,
      color: '#a78bfa',
      groupId: arcGroupId,
      arc: { cx, cy, r, startAngle: startA, endAngle: endA }
    })
  }
  return result
}

/**
 * 主函数：将 AI 解析结果构建为可运行场景
 */
export function buildScene(parsed: ParsedProblem): { success: boolean; message: string; objectCount: number } {
  if (!parsed.objects || parsed.objects.length === 0) {
    return { success: false, message: 'AI 未识别到任何物体', objectCount: 0 }
  }

  // 1. 计算自动缩放
  const scale = computeAutoScale(parsed)

  // 2. 转换所有物体
  const physicsObjects: PhysicsObject[] = []
  parsed.objects.forEach((obj, index) => {
    if (obj.type === 'arc') {
      // 弧线展开为多段
      physicsObjects.push(...expandArcToSegments(obj, scale, index))
    } else {
      const converted = convertObject(obj, scale, index)
      if (converted) physicsObjects.push(converted)
    }
  })

  if (physicsObjects.length === 0) {
    return { success: false, message: '物体转换失败', objectCount: 0 }
  }

  // 3. 构建场状态（支持复合场）
  // 电场 E 需乘 scale（因为 F=qE，加速度 a=qE/m，像素加速度需 a×scale）
  // 磁场 B 不需缩放（因为 F=qvB，v 已是 px/s，a=qvB/m 直接是 px/s²）
  // Ey 需翻转：AI 的 y 向上为正，画布 y 向下为正
  const field: FieldState = {
    type: parsed.field?.type || 'none',
    E: {
      x: (parsed.field?.E?.x || 0) * scale,
      y: -(parsed.field?.E?.y || 0) * scale
    },
    B: parsed.field?.B || 0
  }

  // 4. 重力（SI 单位转像素：g × scale）
  // 重力方向向下（画布 y 正方向），AI 的重力正值表示向下，无需翻转
  const gravity = (parsed.gravity ?? 9.8) * scale

  // 5. 地面高度（坐标系翻转）
  // AI 的 groundY 是世界坐标 y（向上为正），需转为画布坐标（向下为正）
  let groundY: number | null
  if (parsed.groundY === null) {
    groundY = null // 禁用地面（如纯磁场场景）
  } else {
    // AI 的 groundY=0 对应画布 GROUND_BASELINE
    groundY = GROUND_BASELINE - (parsed.groundY ?? 0) * scale
  }

  // 6. 加载场景
  loadScene(physicsObjects, [], field, gravity, groundY)

  return {
    success: true,
    message: `已生成场景：${parsed.title || 'AI 解析场景'}，共 ${physicsObjects.length} 个物体`,
    objectCount: physicsObjects.length
  }
}
