/**
 * mergeResetState 单元测试 + "重置丢失配置" bug 回归
 *
 * 验证重置语义：物理状态（位置/速度/几何/运行时字段）从 baseline 恢复，
 * 配置参数（缺口/摩擦/质量等）保留 current。
 */
import { describe, it, expect } from 'vitest'
import { mergeResetState } from '../../src/composables/usePhysics'
import type { PhysicsObject, ParticleObject, SegmentObject } from '../../src/composables/usePhysics'
import { buildRingScene, simulateStep } from '../helpers/sceneBuilder'

describe('mergeResetState — 重置合并', () => {
  it('质点：位置/速度从 baseline 恢复，配置(mass/friction)保留 current，运行时字段重置', () => {
    const ball: ParticleObject = {
      id: 1, name: 'b', type: '质点', mass: 2, x: 100, y: 100, vx: 50, vy: 0,
      radius: 10, color: '#fff', friction: 0.3, trail: [{ x: 1, y: 1 }],
      prevX: 90, prevY: 90, constrainedArcGroupId: 5
    }
    const baseline: PhysicsObject[] = [JSON.parse(JSON.stringify(ball))]

    // 物理移动 + 用户改配置
    ball.x = 200; ball.y = 200; ball.vx = 60; ball.vy = 30
    ball.friction = 0.9; ball.mass = 3

    const merged = mergeResetState([ball], baseline) as ParticleObject[]
    const m = merged[0]
    expect(m.x).toBe(100)       // 位置重置
    expect(m.y).toBe(100)
    expect(m.vx).toBe(50)       // 速度重置
    expect(m.vy).toBe(0)
    expect(m.friction).toBe(0.9) // 配置保留 current
    expect(m.mass).toBe(3)       // 配置保留 current
    expect(m.trail).toEqual([])  // 运行时重置
    expect(m.prevX).toBeUndefined()
    expect(m.prevY).toBeUndefined()
    expect(m.constrainedArcGroupId).toBeUndefined()
  })

  it('弧线段（核心 bug）：entryGap.halfWidth 保留 current，arcGateState 按 initiallyOpen 重置', () => {
    const arc: SegmentObject = {
      id: 2, name: 'arc', type: 'line_segment',
      x1: 0, y1: 0, x2: 10, y2: 0, normalX: 0, normalY: 1,
      friction: 0.2, groupId: 1,
      arc: {
        cx: 5, cy: 5, r: 10, startAngle: 0, endAngle: 6.28,
        entryGap: { centerAngle: 0, halfWidth: 0.4, initiallyOpen: true, triggerType: 'enterRing', triggerAction: 'close' }
      },
      arcGateState: { entryOpen: false, exitOpen: true, prevAngle: 1.5, wasInside: true },
      constraintEnabled: true
    }
    const baseline: PhysicsObject[] = [JSON.parse(JSON.stringify(arc))] // halfWidth=0.4

    // 用户播放中修改缺口宽度
    arc.arc!.entryGap!.halfWidth = 0.99

    const merged = mergeResetState([arc], baseline) as SegmentObject[]
    const m = merged[0]
    expect(m.arc!.entryGap!.halfWidth).toBe(0.99) // 配置保留（修复核心 bug）
    expect(m.friction).toBe(0.2)                   // 配置保留
    expect(m.constraintEnabled).toBe(true)         // 配置保留
    expect(m.arcGateState!.entryOpen).toBe(true)   // 按 entryGap.initiallyOpen 重置
    expect(m.arcGateState!.exitOpen).toBe(false)   // exitGap 未定义 → false
    expect(m.arcGateState!.prevAngle).toBeUndefined()
    expect(m.arcGateState!.wasInside).toBeUndefined()
  })

  it('板块(movable)：几何+velocity 从 baseline 恢复，friction/mass 保留 current', () => {
    const plate: SegmentObject = {
      id: 3, name: 'plate', type: 'line_segment',
      x1: 0, y1: 100, x2: 50, y2: 100, normalX: 0, normalY: 1,
      friction: 0.3, movable: true, mass: 1, velocity: { x: 10, y: 0 }
    }
    const baseline: PhysicsObject[] = [JSON.parse(JSON.stringify(plate))]

    // 物理移动板块 + 用户改摩擦
    plate.x1 = 20; plate.x2 = 70; plate.velocity = { x: 25, y: 0 }; plate.friction = 0.5

    const merged = mergeResetState([plate], baseline) as SegmentObject[]
    const m = merged[0]
    expect(m.x1).toBe(0)              // 几何重置
    expect(m.x2).toBe(50)
    expect(m.velocity!.x).toBe(10)    // 板块速度重置（物理状态）
    expect(m.friction).toBe(0.5)      // 配置保留
    expect(m.mass).toBe(1)            // 配置保留
  })

  it('传送带(velocity && !movable)：几何从 baseline 恢复，belt speed 保留 current', () => {
    const belt: SegmentObject = {
      id: 4, name: 'belt', type: 'line_segment',
      x1: 0, y1: 200, x2: 100, y2: 200, normalX: 0, normalY: 1,
      friction: 0.2, velocity: { x: 5, y: 0 } // 传送带（非 movable）
    }
    const baseline: PhysicsObject[] = [JSON.parse(JSON.stringify(belt))]

    // 物理平移传送带 + 用户改带速
    belt.x1 = 15; belt.x2 = 115; belt.velocity = { x: 8, y: 0 }

    const merged = mergeResetState([belt], baseline) as SegmentObject[]
    const m = merged[0]
    expect(m.x1).toBe(0)             // 几何重置
    expect(m.x2).toBe(100)
    expect(m.velocity!.x).toBe(8)    // 带速=配置，保留 current
  })

  it('静态线段：几何/法线保留 current（用户编辑端点），arcGateState 重置', () => {
    const seg: SegmentObject = {
      id: 5, name: 'seg', type: 'line_segment',
      x1: 0, y1: 0, x2: 10, y2: 0, normalX: 0, normalY: 1, friction: 0.1
    }
    const baseline: PhysicsObject[] = [JSON.parse(JSON.stringify(seg))]

    // 用户播放中编辑端点
    seg.x1 = 5; seg.x2 = 20; seg.normalX = 0.5; seg.normalY = 0.866

    const merged = mergeResetState([seg], baseline) as SegmentObject[]
    const m = merged[0]
    expect(m.x1).toBe(5)            // 几何保留 current（静态线段物理不移）
    expect(m.x2).toBe(20)
    expect(m.normalX).toBe(0.5)     // 法线保留 current
    expect(m.friction).toBe(0.1)
    expect(m.arcGateState).toBeUndefined() // 无 arc → undefined
  })

  it('回归：播放中修改缺口配置后重置，配置保留且球位置回到播放起始', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects: PhysicsObject[] = [ball, ...arcSegments]
    const baseline: PhysicsObject[] = JSON.parse(JSON.stringify(objects))

    // 模拟播放：球位置变化
    simulateStep(objects, 0.016, 490, 100000)
    simulateStep(objects, 0.016, 490, 100000)

    // 播放中修改缺口配置（复现 bug 场景）
    const arc = objects.find(o => o.type === 'line_segment') as SegmentObject
    arc.arc!.entryGap!.halfWidth = 0.99

    // 重置
    const merged = mergeResetState(objects, baseline)
    const mergedArc = merged.find(o => o.type === 'line_segment') as SegmentObject
    const mergedBall = merged.find(o => o.type === '质点') as ParticleObject
    const baselineBall = baseline.find(o => o.type === '质点') as ParticleObject

    expect(mergedArc.arc!.entryGap!.halfWidth).toBe(0.99) // 配置保留 ✅
    expect(mergedBall.x).toBe(baselineBall.x)             // 位置重置到播放起始 ✅
    expect(mergedBall.y).toBe(baselineBall.y)
  })
})
