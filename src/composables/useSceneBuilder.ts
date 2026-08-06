/**
 * 场景生成器：将 AI 解析的 JSON 转换为项目内部物理状态
 * 物体坐标统一按 PIXELS_PER_METER=50 换算像素，支持多物体/多场/几何体
 */

import { state, loadScene, PIXELS_PER_METER } from './usePhysics'
import type {
  PhysicsObject,
  ParticleObject,
  SegmentObject,
  SpringObject,
  FieldState
} from './usePhysics'
import type { ParsedProblem, ParsedObject, ParsedArc, ParsedSpring } from '../types/aiProblem'
import { validateParsedProblem } from '../utils/aiSchema'
import { CANVAS_MARGIN, GROUND_BASELINE } from '../constants'

/** 物体颜色池 */
const COLOR_POOL = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185']

let nextId = 1000

/**
 * 将单个 AI 物体转换为项目内部物体格式
 */
function convertObject(obj: ParsedObject, scale: number, index: number): PhysicsObject | null {
  const color = COLOR_POOL[index % COLOR_POOL.length]

  if (obj.type === 'ball') {
    const radiusM = obj.radius ?? 0.2
    const radiusPx = Math.max(radiusM * scale, 4)
    // initialPosition.y 语义为"球底高度"（球与下方表面的接触点高度），球心 = 球底 + 半径
    const bottomY = obj.initialPosition?.y ?? 0
    const ball: ParticleObject = {
      id: nextId++,
      name: obj.id || `物体${index + 1}`,
      type: '质点',
      mass: obj.mass ?? 1,
      x: (obj.initialPosition?.x ?? 0) * scale + CANVAS_MARGIN,
      // 球心 = 球底 + 半径（米单位计算后转像素）；坐标系翻转：AI 的 y 向上为正，画布 y 向下为正
      y: GROUND_BASELINE - (bottomY + radiusM) * scale,
      vx: (obj.initialVelocity?.x ?? 0) * scale,
      // vy 翻转：AI 的向上为正，画布向下为正
      vy: -(obj.initialVelocity?.y ?? 0) * scale,
      radius: radiusPx,
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
      x1,
      y1,
      x2,
      y2,
      normalX,
      normalY,
      friction: obj.friction ?? 0,
      // 颜色按语义区分：传送带（青）/ 板块（红）/ 普通平台（灰），与 useEditTools 工厂保持一致
      color: obj.beltVelocity ? '#0891b2' : obj.movable ? '#dc2626' : '#94a3b8',
      // 传送带速度（SI m/s → 像素/s，y 需翻转）；板块需初始 velocity 才能受重力下落
      velocity: obj.beltVelocity
        ? {
            x: obj.beltVelocity.x * scale,
            y: -obj.beltVelocity.y * scale
          }
        : obj.movable
          ? { x: 0, y: 0 }
          : undefined,
      // 板块模型：可移动线段
      movable: obj.movable ?? false,
      mass: obj.movable ? (obj.mass ?? 1) : undefined
    }
    return segment
  }

  if (obj.type === 'plate') {
    const x1 = (obj.startPoint?.x ?? 0) * scale + CANVAS_MARGIN
    const y1 = GROUND_BASELINE - (obj.startPoint?.y ?? 0) * scale
    const x2 = (obj.endPoint?.x ?? 1) * scale + CANVAS_MARGIN
    const y2 = GROUND_BASELINE - (obj.endPoint?.y ?? 0) * scale
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    // 法线指向上方（normalY < 0）
    let normalX = -dy / len
    let normalY = dx / len
    if (normalY > 0) {
      normalX = -normalX
      normalY = -normalY
    }
    const segment: SegmentObject = {
      id: nextId++,
      name: obj.id || `板块${index + 1}`,
      type: 'line_segment',
      subtype: 'plate',
      x1,
      y1,
      x2,
      y2,
      normalX,
      normalY,
      restitution: 0.2,
      color: '#dc2626',
      movable: true, // 板块可移动（触发物理更新分支）
      mass: obj.mass ?? 1, // 默认质量 1
      velocity: { x: 0, y: 0 }, // 初始静止，使重力分支生效
      // 物理厚度（米→像素），默认 0.1m；参与碰撞与支撑检测
      physicsThickness: (obj.physicsThickness ?? 0.1) * scale,
      // 静态倾角（弧度），物理更新中保持不变
      angle: obj.angle ?? 0,
      // 强制上下表面摩擦分离；默认 上0.3 / 下0.1
      frictionTop: obj.frictionTop ?? 0.3,
      frictionBottom: obj.frictionBottom ?? 0.1,
      // 矩形板块模型字段
      centerX: (x1 + x2) / 2 - normalX * (((obj.physicsThickness ?? 0.1) * scale) / 2),
      centerY: (y1 + y2) / 2 - normalY * (((obj.physicsThickness ?? 0.1) * scale) / 2),
      width: len,
      height: (obj.physicsThickness ?? 0.1) * scale
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
      x1,
      y1,
      x2,
      y2,
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
function expandArcToSegments(obj: ParsedArc, scale: number, index: number): SegmentObject[] {
  const cx = (obj.center?.x ?? 0) * scale + CANVAS_MARGIN
  // 弧线圆心 y 翻转
  const cy = GROUND_BASELINE - (obj.center?.y ?? 0) * scale
  const r = Math.max((obj.arcRadius ?? 1) * scale, 10)
  // 角度从数学坐标系（y向上）转为画布坐标系（y向下）：取反
  // questionBank/useAIParser 中的角度是数学坐标系下的，
  // 需转为画布坐标系与 detectArcCollision/updateArcGates 的 atan2(obj.y-cy, obj.x-cx) 一致
  const startA = -(obj.startAngle ?? 0)
  const endA = -(obj.endAngle ?? Math.PI)
  const segments = 20
  const arcGroupId = nextId++
  const result: SegmentObject[] = []

  // 弧线缺口定义：角度取反转为画布坐标系（halfWidth 无方向性，不取反）；触发器配置透传
  const entryGap = obj.entryGap
    ? {
        centerAngle: -obj.entryGap.centerAngle,
        halfWidth: obj.entryGap.halfWidth,
        initiallyOpen: obj.entryGap.initiallyOpen,
        triggerType: obj.entryGap.triggerType,
        triggerAngle:
          obj.entryGap.triggerAngle !== undefined ? -obj.entryGap.triggerAngle : undefined,
        triggerAction: obj.entryGap.triggerAction
      }
    : undefined
  const exitGap = obj.exitGap
    ? {
        centerAngle: -obj.exitGap.centerAngle,
        halfWidth: obj.exitGap.halfWidth,
        initiallyOpen: obj.exitGap.initiallyOpen,
        triggerType: obj.exitGap.triggerType,
        triggerAngle:
          obj.exitGap.triggerAngle !== undefined ? -obj.exitGap.triggerAngle : undefined,
        triggerAction: obj.exitGap.triggerAction
      }
    : undefined
  const hasGates = !!(entryGap || exitGap)
  // 仅第一段携带 arcGateState（detectArcCollision/updateArcGates 通过 groupId 去重，只处理第一段）
  // 初始开关状态由 gap.initiallyOpen 决定（默认 false = 关闭）
  const arcGateState = hasGates
    ? {
        entryOpen: entryGap?.initiallyOpen ?? false,
        exitOpen: exitGap?.initiallyOpen ?? false,
        prevAngle: undefined,
        wasInside: undefined
      }
    : undefined

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
    // 法线：弧线默认指向上方（normalY < 0）；完整圆轨物体在内侧绕圈，法线应指向圆心（不翻转）
    const angleSpan = Math.abs(endA - startA)
    const isFullCircle = Math.abs(angleSpan - 2 * Math.PI) < 0.01
    let nx = -dy / len
    let ny = dx / len
    if (!isFullCircle && ny > 0) {
      nx = -nx
      ny = -ny
    }
    result.push({
      id: nextId++,
      name: `${obj.id || `弧线${index + 1}`}-${i + 1}`,
      type: 'line_segment',
      x1,
      y1,
      x2,
      y2,
      normalX: nx,
      normalY: ny,
      friction: obj.friction ?? 0,
      restitution: 0.2,
      color: '#a78bfa',
      groupId: arcGroupId,
      arc: { cx, cy, r, startAngle: startA, endAngle: endA, entryGap, exitGap },
      // 仅第一段携带运行时状态 + 约束动力学开关
      ...(i === 0
        ? {
            ...(arcGateState ? { arcGateState } : {}),
            constraintEnabled: true
          }
        : {})
    })
  }
  return result
}

/**
 * 将弹簧 AI 物体转换为内部格式
 * 需要在所有球体转换完成后调用（依赖 idMap 解析连接关系）
 */
function convertSpring(
  obj: ParsedSpring,
  scale: number,
  index: number,
  idMap: Map<string, number>
): SpringObject | null {
  if (!obj.ballId || !idMap.has(obj.ballId)) return null
  const ballId = idMap.get(obj.ballId)!
  const anchorX = (obj.anchor?.x ?? 0) * scale + CANVAS_MARGIN
  const anchorY = GROUND_BASELINE - (obj.anchor?.y ?? 0) * scale
  const naturalLength = Math.max((obj.naturalLength ?? 1) * scale, 10)
  const k = obj.k ?? 50
  return {
    id: nextId++,
    name: obj.id || `弹簧${index + 1}`,
    type: 'spring',
    anchorX,
    anchorY,
    ballId,
    naturalLength,
    k,
    color: '#34d399'
  }
}

/**
 * 主函数：将 AI 解析结果构建为可运行场景
 */
export function buildScene(parsed: ParsedProblem): {
  success: boolean
  message: string
  objectCount: number
} {
  if (!parsed.objects || parsed.objects.length === 0) {
    return { success: false, message: 'AI 未识别到任何物体', objectCount: 0 }
  }

  // 0. 物理量前置校验：非法输入不进入 loadScene，避免污染物理状态
  const check = validateParsedProblem(parsed)
  if (!check.ok) {
    return { success: false, message: check.message || '物理量非法', objectCount: 0 }
  }

  // 1. 统一换算比例：所有场景按 PIXELS_PER_METER=50 转像素，保证物理量（重力/速度/电场）与预设场景一致
  const scale = PIXELS_PER_METER

  // 2. 转换所有物体（先非弹簧，后弹簧——弹簧需引用球的内部 id）
  const physicsObjects: PhysicsObject[] = []
  const idMap = new Map<string, number>() // ParsedObject.id → 内部数字 id

  parsed.objects.forEach((obj, index) => {
    if (obj.type === 'spring') return // 弹簧在第二遍处理
    if (obj.type === 'arc') {
      physicsObjects.push(...expandArcToSegments(obj, scale, index))
    } else {
      const converted = convertObject(obj, scale, index)
      if (converted) {
        physicsObjects.push(converted)
        if (obj.id) idMap.set(obj.id, converted.id)
      }
    }
  })

  // 第二遍：处理弹簧（依赖 idMap 解析连接关系）
  parsed.objects.forEach((obj, index) => {
    if (obj.type !== 'spring') return
    const spring = convertSpring(obj, scale, index, idMap)
    if (spring) physicsObjects.push(spring)
  })

  if (physicsObjects.length === 0) {
    return { success: false, message: '物体转换失败', objectCount: 0 }
  }

  // 3. 构建场状态（支持复合场）
  // 电场 E 需乘 scale（因为 F=qE，加速度 a=qE/m，像素加速度需 a×scale）
  // 磁场 B 不需缩放（因为 F=qvB，v 已是 px/s，a=qvB/m 直接是 px/s²）
  // Ey 需翻转：AI 的 y 向上为正，画布 y 向下为正
  const parsedRegion = parsed.field?.region
  const field: FieldState = {
    type: parsed.field?.type || 'none',
    E: {
      x: (parsed.field?.E?.x || 0) * scale,
      y: -(parsed.field?.E?.y || 0) * scale
    },
    B: parsed.field?.B || 0,
    region: parsedRegion
      ? {
          x: parsedRegion.x * scale,
          y: parsedRegion.y * scale,
          width: parsedRegion.width * scale,
          height: parsedRegion.height * scale
        }
      : undefined
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

  // 7. 碰撞恢复系数（可选，未指定则保持默认）
  if (parsed.particleRestitution !== undefined) {
    state.particleRestitution = parsed.particleRestitution
  }
  if (parsed.groundRestitution !== undefined) {
    state.groundRestitution = parsed.groundRestitution
  }

  return {
    success: true,
    message: `已生成场景：${parsed.title || 'AI 解析场景'}，共 ${physicsObjects.length} 个物体`,
    objectCount: physicsObjects.length
  }
}
