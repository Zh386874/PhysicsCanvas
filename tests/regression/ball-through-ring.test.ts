/**
 * 回归测试：小球穿过圆环 bug
 * 精确复现 bug 场景，验证修复后不再出现
 *
 * Bug 描述：真题库中小球从缺口进入圆环后，因 tryActivateArcConstraint 和
 * detectArcCollision 都使用 closest.dist > radius 判定，球深入环内 >4px 时
 * 两者都失效，球穿过圆环底部。
 *
 * 修复：tryActivateArcConstraint 添加 catch-up 逻辑，球在环内+门全关时
 * 跳过距离判定强制激活约束。
 */
import { describe, it, expect } from 'vitest'
import { buildRingScene, simulateStep } from '../helpers/sceneBuilder'

describe('回归：小球穿过圆环 bug', () => {
  it('球从缺口进入后不应穿过圆环底部', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490

    // 精确复现 bug 场景：球从缺口角度进入
    const entryAngle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 3) * Math.cos(entryAngle)
    ball.y = arc.cy + (arc.r + 3) * Math.sin(entryAngle)
    ball.vx = -400 * Math.cos(entryAngle) // 高速向心
    ball.vy = -400 * Math.sin(entryAngle)
    ball.constrainedArcGroupId = undefined

    // 运行 300 步（~5秒）
    for (let i = 0; i < 300; i++) {
      simulateStep(objects, dt, gravity, 100000)
    }

    const finalDist = Math.hypot(ball.x - arc.cx, ball.y - arc.cy)

    // 回归断言：球不应穿过到圆心对面
    // 修复前：球会落到圆环底部下方，dist 远小于 r
    // 修复后：球被约束在弧面，dist ≈ r ± radius
    expect(finalDist).toBeGreaterThan(arc.r * 0.5)
  })

  it('球在环内应最终被约束捕获', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490

    const entryAngle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 3) * Math.cos(entryAngle)
    ball.y = arc.cy + (arc.r + 3) * Math.sin(entryAngle)
    ball.vx = -400 * Math.cos(entryAngle)
    ball.vy = -400 * Math.sin(entryAngle)
    ball.constrainedArcGroupId = undefined

    let constrained = false
    let constrainedAtStep = -1
    for (let i = 0; i < 300; i++) {
      simulateStep(objects, dt, gravity, 100000)
      if (ball.constrainedArcGroupId !== undefined) {
        constrained = true
        constrainedAtStep = i
        break
      }
    }

    expect(constrained).toBe(true) // 球应被约束捕获
    expect(constrainedAtStep).toBeLessThan(100) // 应在前100步内捕获
  })

  it('球被约束后不应脱离到圆心对面（除非自然脱离条件）', () => {
    const { ball, arcSegments } = buildRingScene()
    const objects = [ball, ...arcSegments]
    const arc = arcSegments[0].arc!
    const dt = 0.016
    const gravity = 490

    const entryAngle = arc.entryGap!.centerAngle
    ball.x = arc.cx + (arc.r + 3) * Math.cos(entryAngle)
    ball.y = arc.cy + (arc.r + 3) * Math.sin(entryAngle)
    ball.vx = -400 * Math.cos(entryAngle)
    ball.vy = -400 * Math.sin(entryAngle)
    ball.constrainedArcGroupId = undefined

    // 运行 500 步，持续监控球的位置
    let minDist = Infinity
    let wasConstrained = false
    for (let i = 0; i < 500; i++) {
      simulateStep(objects, dt, gravity, 100000)
      const dist = Math.hypot(ball.x - arc.cx, ball.y - arc.cy)
      if (ball.constrainedArcGroupId !== undefined) {
        wasConstrained = true
        minDist = Math.min(minDist, dist)
      }
    }

    // 球应曾被约束
    expect(wasConstrained).toBe(true)
    // 约束期间球不应穿过到圆心（dist 不应远小于 r-radius）
    // 允许自然脱离（速度过大飞出），但脱离前不应穿过底部
    expect(minDist).toBeGreaterThan(arc.r * 0.3)
  })
})
