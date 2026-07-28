/**
 * 测试辅助：手动构建弧线段 + 小球（不依赖 Vue reactive）
 * 基于 questionBank.ts 2023浙江题配置（坐标×1.6，画布坐标系）
 */
import type { PhysicsObject, ParticleObject, SegmentObject } from '../../src/composables/usePhysics'
import { checkCollision } from '../../src/composables/useCollision'

export const PIXELS_PER_METER = 50
const CANVAS_MARGIN = 60
const GROUND_BASELINE = 400

/**
 * 基于 questionBank.ts 2023浙江题圆轨BCDE配置
 * 圆心=(6.88,1.6) 半径=0.8 → 画布坐标 ×1.6
 */
export function buildRingScene(): { ball: ParticleObject; arcSegments: SegmentObject[] } {
  const cx = 6.88 * PIXELS_PER_METER + CANVAS_MARGIN
  const cy = GROUND_BASELINE - 1.6 * PIXELS_PER_METER
  const r = 0.8 * 1.6 * PIXELS_PER_METER // = 64px

  // 画布坐标系角度（数学坐标取反）
  const startA = -(-2.214) // = 2.214
  const endA = -(4.069)    // = -4.069 (全圆)

  const entryGap = {
    centerAngle: -(-2.614), // = 2.614
    halfWidth: 0.4,
    initiallyOpen: true,
    triggerType: 'enterRing' as const,
    triggerAction: 'close' as const,
  }
  const exitGap = {
    centerAngle: -(-1.814), // = 1.814
    halfWidth: 0.4,
    initiallyOpen: false,
    triggerType: 'angleCross' as const,
    triggerAngle: Math.PI / 2,
    triggerAction: 'open' as const,
  }

  const groupId = 1000
  const arcSegment: SegmentObject = {
    id: 1000,
    name: '圆轨BCDE-1',
    type: 'line_segment',
    x1: cx + r * Math.cos(startA),
    y1: cy + r * Math.sin(startA),
    x2: cx + r * Math.cos(startA + 0.314),
    y2: cy + r * Math.sin(startA + 0.314),
    normalX: -Math.sin(startA),
    normalY: Math.cos(startA),
    friction: 0,
    restitution: 0.2,
    color: '#a78bfa',
    groupId,
    arc: { cx, cy, r, startAngle: startA, endAngle: endA, entryGap, exitGap },
    arcGateState: { entryOpen: true, exitOpen: false, prevAngle: undefined, wasInside: undefined },
    constraintEnabled: true,
  }

  const ball: ParticleObject = {
    id: 1,
    name: '滑块',
    type: '质点',
    mass: 1,
    x: cx + r * Math.cos(2.614) + 10,
    y: cy + r * Math.sin(2.614),
    vx: -200,
    vy: 100,
    radius: 4,
    color: '#60a5fa',
    trail: [],
  }

  return { ball, arcSegments: [arcSegment] }
}

/**
 * 模拟单步物理更新（重力 + 位置 + 碰撞），不依赖 Vue
 * 简化版 subStepPhysics：只处理质点的重力、速度、位置和碰撞
 */
export function simulateStep(
  objects: PhysicsObject[],
  dt: number,
  gravity: number,
  groundY: number
): void {
  // 保存上一帧位置（供CCD使用）
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
