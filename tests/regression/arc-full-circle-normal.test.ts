/**
 * 回归测试：完整圆弧（span≈2π）法线/角度范围处理
 *
 * Lessons Learned：
 * "isAngleInRange function fails for full arcs (span≈2π); add special case to return
 *  true when arc span is approximately 2π"
 *
 * 完整圆弧（startAngle ≈ endAngle + 2π）所有角度都应落入范围内，但常规角度比较
 * 会在边界处失败。本测试守护 isAngleInRange 对 span≈2π 的特殊处理。
 *
 * 由于 isAngleInRange 是 useCollision 内部函数（未导出），通过 detectArcCollision
 * 行为间接验证：完整圆弧对球做完整圆周约束（任何角度都能命中）。
 */
import { describe, it, expect } from 'vitest'
import { detectArcCollision } from '../../src/composables/useCollision'
import type { ParticleObject, SegmentObject } from '../../src/composables/usePhysics'

function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 5,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

/** 构造完整圆弧（span≈2π） */
function makeFullCircleArc(cx: number, cy: number, r: number): SegmentObject {
  return {
    id: 1000,
    name: 'full-circle',
    type: 'line_segment',
    x1: cx + r,
    y1: cy,
    x2: cx + r * Math.cos(0.1),
    y2: cy + r * Math.sin(0.1),
    normalX: -1,
    normalY: 0,
    color: '#a78bfa',
    groupId: 1000,
    arc: {
      cx,
      cy,
      r,
      startAngle: 0,
      endAngle: Math.PI * 2 - 0.001 // span ≈ 2π（避免浮点误差）
    }
  }
}

describe('回归：完整圆弧（span≈2π）isAngleInRange 特殊处理', () => {
  it('球从外侧碰完整圆弧顶部 → 命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    // 球在圆弧顶部外侧，向下移动撞弧
    const ball = makeBall({
      x: cx,
      y: cy - r - 5,
      vy: 100,
      prevX: cx,
      prevY: cy - r - 50
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    expect(hit).toBe(true)
  })

  it('球从外侧碰完整圆弧右侧 → 命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    // 球在圆弧右侧外侧，向左移动撞弧
    const ball = makeBall({
      x: cx + r + 5,
      y: cy,
      vx: -100,
      prevX: cx + r + 50,
      prevY: cy
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    expect(hit).toBe(true)
  })

  it('球从外侧碰完整圆弧底部 → 命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    // 球在圆弧底部外侧，向上移动撞弧
    const ball = makeBall({
      x: cx,
      y: cy + r + 5,
      vy: -100,
      prevX: cx,
      prevY: cy + r + 50
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    expect(hit).toBe(true)
  })

  it('球从外侧碰完整圆弧左侧 → 命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    // 球在圆弧左侧外侧，向右移动撞弧
    const ball = makeBall({
      x: cx - r - 5,
      y: cy,
      vx: 100,
      prevX: cx - r - 50,
      prevY: cy
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    expect(hit).toBe(true)
  })

  it('球远离圆弧 → 不命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    const ball = makeBall({
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      prevX: 100,
      prevY: 100
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    expect(hit).toBe(false)
  })

  it('球在圆心附近（远小于 r）→ 不命中（远离弧线）', () => {
    const cx = 400,
      cy = 250,
      r = 100
    const arc = makeFullCircleArc(cx, cy, r)
    const ball = makeBall({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      prevX: cx,
      prevY: cy
    })
    const hit = detectArcCollision(ball, arc, 0.016, 490)
    // 球在圆心，距离弧线 r=100 > radius=5，不命中
    expect(hit).toBe(false)
  })
})

describe('回归：完整圆弧 vs 部分弧（对照）', () => {
  it('部分弧（span=π）只在弧覆盖的角度范围命中', () => {
    const cx = 400,
      cy = 250,
      r = 100
    // 半圆：startAngle=0, endAngle=π（覆盖角度 [0, π]，即下半圆，画布 y 向下）
    const arc: SegmentObject = {
      id: 1000,
      name: 'half-circle',
      type: 'line_segment',
      x1: cx + r,
      y1: cy,
      x2: cx + r * Math.cos(Math.PI),
      y2: cy + r * Math.sin(Math.PI),
      normalX: -1,
      normalY: 0,
      color: '#a78bfa',
      groupId: 1000,
      arc: {
        cx,
        cy,
        r,
        startAngle: 0,
        endAngle: Math.PI
      }
    }
    // 球在圆弧底部（py > cy，atan2 = π/2 ∈ [0, π]）→ 命中
    const ballHit = makeBall({
      x: cx,
      y: cy + r + 5,
      vy: -100,
      prevX: cx,
      prevY: cy + r + 50
    })
    expect(detectArcCollision(ballHit, arc, 0.016, 490)).toBe(true)

    // 球在圆弧顶部（py < cy，atan2 = -π/2 ∉ [0, π]）→ 不命中
    const ballMiss = makeBall({
      x: cx,
      y: cy - r - 5,
      vy: 100,
      prevX: cx,
      prevY: cy - r - 50
    })
    expect(detectArcCollision(ballMiss, arc, 0.016, 490)).toBe(false)
  })
})
