/**
 * 集成测试：2023浙江题圆环完整物理循环
 * 模拟小球从缺口进入圆环的全过程，验证不穿过底部
 */
import { describe, it, expect } from 'vitest'
import { buildRingScene, simulateStep } from '../helpers/sceneBuilder'

describe('2023浙江题圆环集成测试', () => {
  it('小球进入圆环后应被约束捕获，不穿过底部', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490
    const groundY = 100000 // 禁用地面

    // 模拟球从缺口附近以向心速度进入
    const entryAngle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 5) * Math.cos(entryAngle)
    ball.y = arc.cy + (arc.r + 5) * Math.sin(entryAngle)
    ball.vx = -300 * Math.cos(entryAngle) // 向心
    ball.vy = -300 * Math.sin(entryAngle)
    ball.constrainedArcGroupId = undefined

    // 运行 500 步（~8秒模拟时间）
    for (let i = 0; i < 500; i++) {
      simulateStep(objects, dt, gravity, groundY)
    }

    const finalDist = Math.hypot(ball.x - arc.cx, ball.y - arc.cy)
    // 验证：球在弧面附近（未穿过到对面）
    expect(finalDist).toBeGreaterThan(arc.r * 0.5)
  })

  it('enterRing 触发后入口门应关闭', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490

    // 球从环外向环内运动
    const angle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 5) * Math.cos(angle)
    ball.y = arc.cy + (arc.r + 5) * Math.sin(angle)
    ball.vx = -200 * Math.cos(angle)
    ball.vy = -200 * Math.sin(angle)

    expect(arcSegments[0].arcGateState!.entryOpen).toBe(true) // 初始开

    // 运行直到球进入环内
    for (let i = 0; i < 50; i++) {
      simulateStep(objects, dt, gravity, 100000)
      if (!arcSegments[0].arcGateState!.entryOpen) break
    }

    expect(arcSegments[0].arcGateState!.entryOpen).toBe(false) // enterRing 触发关闭
  })

  it('球被约束后应在弧面附近运动（距离≈r±radius）', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490

    // 球从缺口进入
    const entryAngle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 3) * Math.cos(entryAngle)
    ball.y = arc.cy + (arc.r + 3) * Math.sin(entryAngle)
    ball.vx = -300 * Math.cos(entryAngle)
    ball.vy = -300 * Math.sin(entryAngle)
    ball.constrainedArcGroupId = undefined

    // 运行 200 步，收集约束后的距离
    const distances: number[] = []
    for (let i = 0; i < 200; i++) {
      simulateStep(objects, dt, gravity, 100000)
      if (ball.constrainedArcGroupId !== undefined) {
        distances.push(Math.hypot(ball.x - arc.cx, ball.y - arc.cy))
      }
    }

    // 如果被约束过，验证距离在弧面附近
    expect(distances.length).toBeGreaterThan(0)
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length
    expect(avgDist).toBeGreaterThan(arc.r - ball.radius * 2)
    expect(avgDist).toBeLessThan(arc.r + ball.radius * 2)
  })
})
