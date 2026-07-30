/**
 * 回归测试：真题库小球卡在圆环外
 *
 * Bug 描述：真题库（2023·浙江）中小球沿 AB 滚入圆环时，因缺口放行只判断球心角度
 * （不考虑球碰撞体积）+ 运行时几何偏紧（buildScene scale=25 → r=20px，球半径钳到 4px 占 20%），
 * 球心穿越点落在缺口边缘外，撞实体壁弹回，卡在环外无法进入。
 *
 * 关键：现有圆环测试（ring-scene/ball-through-ring）用 sceneBuilder.ts 硬编码 scale=80（r=64px），
 * 球仅占 6.25%，不能复现本 bug。本测试用与 buildScene 等价的 scale=25 几何复现并守护。
 *
 * 修复：缺口放行改为体积感知（叠加球角半径 isBallVolumeInGap）。
 * 实测证明逻辑修复单独即可让入口缺口半宽 0.4（真题库原值）下小球进入圆环，
 * 故无需调整缺口数据（遵循外科手术式修改原则，不做不必要改动）。
 */
import { describe, it, expect } from 'vitest'
import type { PhysicsObject, ParticleObject, SegmentObject } from '../../src/composables/usePhysics'
import { checkCollision } from '../../src/composables/useCollision'

// 与 buildScene/computeAutoScale 一致：worldWidth=27.2 → (800-120)/27.2 = 25
const SCALE = 25
const CANVAS_MARGIN = 60
const GROUND_BASELINE = 400

/**
 * 构建与 buildScene 等价的 2023 浙江题运行时几何（scale=25）
 * 含：滑块（球）+ 直轨道AB + 螺旋圆轨BCDE（20段近似，带入口/出口缺口）
 */
function buildZj2023Scene(entryHalfWidth: number): {
  ball: ParticleObject
  ab: SegmentObject
  arcSegments: SegmentObject[]
  cx: number; cy: number; r: number
} {
  // —— 圆弧 BCDE（与 expandArcToSegments 等价）——
  const cx = 6.88 * SCALE + CANVAS_MARGIN
  const cy = GROUND_BASELINE - 1.6 * SCALE
  const r = 0.8 * SCALE // = 20px
  const startA = -(-2.214) // 画布坐标系（角度取反）
  const endA = -(4.069)
  const entryGap = {
    centerAngle: -(-2.614),
    halfWidth: entryHalfWidth,
    initiallyOpen: true,
    triggerType: 'enterRing' as const,
    triggerAction: 'close' as const
  }
  const exitGap = {
    centerAngle: -(-1.814),
    halfWidth: 0.4,
    initiallyOpen: false,
    triggerType: 'angleCross' as const,
    triggerAngle: -Math.PI / 2,
    triggerAction: 'open' as const
  }
  const groupId = 5000
  const SEGMENTS = 20
  const arcSegments: SegmentObject[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    const a1 = startA + (endA - startA) * (i / SEGMENTS)
    const a2 = startA + (endA - startA) * ((i + 1) / SEGMENTS)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    // 完整圆（span≈2π）法线指向圆心，不翻转
    const nx = -dy / len
    const ny = dx / len
    arcSegments.push({
      id: 5000 + i,
      name: `圆轨BCDE-${i + 1}`,
      type: 'line_segment',
      x1, y1, x2, y2,
      normalX: nx,
      normalY: ny,
      friction: 0,
      restitution: 0.2,
      color: '#a78bfa',
      groupId,
      arc: { cx, cy, r, startAngle: startA, endAngle: endA, entryGap, exitGap },
      // 仅第一段携带运行时状态 + 约束开关（与 expandArcToSegments 一致）
      ...(i === 0 ? {
        arcGateState: { entryOpen: true, exitOpen: false, prevAngle: undefined, wasInside: undefined },
        constraintEnabled: true
      } : {})
    } as SegmentObject)
  }

  // —— 滑块（与 convertObject ball 等价）——
  const radiusM = 0.08
  const radiusPx = Math.max(radiusM * SCALE, 4) // 钳到 4px
  const ball: ParticleObject = {
    id: 1,
    name: '滑块',
    type: '质点',
    mass: 1,
    x: 2.768 * SCALE + CANVAS_MARGIN,
    y: GROUND_BASELINE - (3.68 + radiusM) * SCALE,
    vx: 0,
    vy: 0,
    radius: radiusPx,
    color: '#60a5fa',
    charge: 0,
    friction: 0,
    trail: []
  }

  // —— 直轨道 AB（与 convertObject platform 等价）——
  const ax = 2.768 * SCALE + CANVAS_MARGIN
  const ay = GROUND_BASELINE - 3.68 * SCALE
  const bx = 6.189 * SCALE + CANVAS_MARGIN
  const by = GROUND_BASELINE - 1.197 * SCALE
  const abDx = bx - ax
  const abDy = by - ay
  const abLen = Math.hypot(abDx, abDy) || 1
  let abNx = -abDy / abLen
  let abNy = abDx / abLen
  if (abNy > 0) { abNx = -abNx; abNy = -abNy } // 确保法线指向上方（normalY<0）
  const ab: SegmentObject = {
    id: 100,
    name: '直轨道AB',
    type: 'line_segment',
    x1: ax, y1: ay, x2: bx, y2: by,
    normalX: abNx,
    normalY: abNy,
    friction: 0,
    restitution: 0.2,
    color: '#94a3b8'
  }

  return { ball, ab, arcSegments, cx, cy, r }
}

/** 单步物理更新（重力 + 位置 + 碰撞），不依赖 Vue */
function step(objects: PhysicsObject[], dt: number, gravity: number, groundY: number): void {
  for (const obj of objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      p.prevX = p.x
      p.prevY = p.y
      p.vy += gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
  }
  checkCollision(objects, groundY, 0.6, 1.0, dt, gravity)
}

describe('回归：真题库小球卡在圆环外（scale=25 真实几何）', () => {
  it('小球沿AB滚入应能进入圆环（球心进入环内）', () => {
    const { ball, ab, arcSegments, cx, cy, r } = buildZj2023Scene(0.4)
    const objects: PhysicsObject[] = [ball, ab, ...arcSegments]
    const dt = 0.016
    const gravity = 10 * SCALE // = 250 px/s²
    const groundY = 100000 // 禁用地面

    let entered = false
    for (let i = 0; i < 800; i++) {
      step(objects, dt, gravity, groundY)
      const dist = Math.hypot(ball.x - cx, ball.y - cy)
      if (dist < r) entered = true
    }
    // 修复后：球应能进入圆环（dist < r）
    expect(entered).toBe(true)
  })

  it('小球进入圆环后应被弧线约束捕获（constrainedArcGroupId 被设置）', () => {
    const { ball, ab, arcSegments } = buildZj2023Scene(0.4)
    const objects: PhysicsObject[] = [ball, ab, ...arcSegments]
    const dt = 0.016
    const gravity = 10 * SCALE
    const groundY = 100000

    let constrained = false
    for (let i = 0; i < 800; i++) {
      step(objects, dt, gravity, groundY)
      if (ball.constrainedArcGroupId !== undefined) {
        constrained = true
        break
      }
    }
    expect(constrained).toBe(true)
  })

  it('小球不应卡在环外（最终位置应在环内或已穿越，而非停在缺口外侧）', () => {
    const { ball, ab, arcSegments, cx, cy, r } = buildZj2023Scene(0.4)
    const objects: PhysicsObject[] = [ball, ab, ...arcSegments]
    const dt = 0.016
    const gravity = 10 * SCALE
    const groundY = 100000

    let lastDist = 0
    for (let i = 0; i < 800; i++) {
      step(objects, dt, gravity, groundY)
      lastDist = Math.hypot(ball.x - cx, ball.y - cy)
    }
    // 修复后：球不应长期停在环外远端（dist >> r）。
    // 允许球已进入环内（dist≈r）或被约束/穿越。断言最终未卡在环外远端。
    expect(lastDist).toBeLessThan(r * 1.8)
  })
})

