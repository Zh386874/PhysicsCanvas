/**
 * 单元测试：弧线碰撞检测与约束激活
 * 通过 checkCollision 公共 API 测试各子场景
 */
import { describe, it, expect } from 'vitest'
import { checkCollision } from '../../src/composables/useCollision'
import { buildRingScene } from '../helpers/sceneBuilder'

describe('弧线碰撞检测单元测试', () => {
  it('球在弧面外侧触碰时应激活约束', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 球放在弧面外侧触碰位置（非缺口角度）
    const testAngle = 0 // 非缺口角度
    ball.x = arc.cx + (arc.r + ball.radius - 1) * Math.cos(testAngle)
    ball.y = arc.cy + (arc.r + ball.radius - 1) * Math.sin(testAngle)
    ball.vx = 0
    ball.vy = 0
    ball.constrainedArcGroupId = undefined
    // 关闭入口门（避免缺口干扰）
    arcSegments[0].arcGateState!.entryOpen = false

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBe(arcSegments[0].groupId)
  })

  it('gate 开 + 球在缺口角度范围 → 不激活约束（允许穿过）', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 球放在入口缺口中心，刚好在弧面上
    ball.x = arc.cx + arc.r * Math.cos(arc.entryGap!.centerAngle)
    ball.y = arc.cy + arc.r * Math.sin(arc.entryGap!.centerAngle)
    ball.constrainedArcGroupId = undefined
    // entryOpen 默认为 true（buildRingScene 设置）

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBeUndefined()
  })

  it('gate 关 + 球在环内深处 → 应激活约束（catch-up 机制）', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 模拟球已穿过缺口进入环内，离弧面 10px（> radius=4px）
    const testAngle = arc.entryGap!.centerAngle + 0.5 // 离开缺口角度范围
    ball.x = arc.cx + (arc.r - 10) * Math.cos(testAngle) // 环内 10px
    ball.y = arc.cy + (arc.r - 10) * Math.sin(testAngle)
    ball.constrainedArcGroupId = undefined
    // 手动关闭入口门（模拟 enterRing 已触发）
    arcSegments[0].arcGateState!.entryOpen = false

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBe(arcSegments[0].groupId)
  })

  it('gate 关 + 球在弧外远处 → 不激活约束', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 球在弧外 50px（非缺口角度）
    const testAngle = 0
    ball.x = arc.cx + (arc.r + 50) * Math.cos(testAngle)
    ball.y = arc.cy + (arc.r + 50) * Math.sin(testAngle)
    ball.constrainedArcGroupId = undefined
    arcSegments[0].arcGateState!.entryOpen = false

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBeUndefined()
  })

  it('gate 关 + 球在弧外触碰 → 应激活约束', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 球在弧面外侧触碰（非缺口角度）
    const testAngle = Math.PI // 底部，非缺口
    ball.x = arc.cx + (arc.r + ball.radius - 1) * Math.cos(testAngle)
    ball.y = arc.cy + (arc.r + ball.radius - 1) * Math.sin(testAngle)
    ball.constrainedArcGroupId = undefined
    arcSegments[0].arcGateState!.entryOpen = false

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBe(arcSegments[0].groupId)
  })

  it('gate 开 + 球在缺口但深入环内 → 不激活约束（缺口放行优先）', () => {
    const { ball, arcSegments } = buildRingScene()
    const arc = arcSegments[0].arc!
    // 球在缺口角度范围内，但深入环内 20px
    ball.x = arc.cx + (arc.r - 20) * Math.cos(arc.entryGap!.centerAngle)
    ball.y = arc.cy + (arc.r - 20) * Math.sin(arc.entryGap!.centerAngle)
    ball.constrainedArcGroupId = undefined
    // entryOpen 默认为 true

    checkCollision([ball, ...arcSegments], 100000, 0.6, 1.0, 0.016, 490)
    expect(ball.constrainedArcGroupId).toBeUndefined()
  })
})
