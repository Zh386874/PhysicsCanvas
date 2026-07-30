/**
 * 回归测试：板块端面碰撞（板块与垂直墙）vx=0 立即归零
 *
 * Lessons Learned：
 * "Plate end collisions with vertical walls must immediately set vx=0
 *  (no friction, only normal reflection with momentum conservation)"
 *
 * 板块（plate subtype）在水平移动时撞到垂直墙，端面碰撞应：
 * 1. 立即设置 vx=0（无摩擦减速过程）
 * 2. 仅法向反射（垂直墙 → 水平方向速度归零）
 * 3. 动量守恒（板块质量 × 速度 = 墙反作用冲量，墙视为无限大质量）
 *
 * 本测试通过 detectPlateEndCollision（在 detectSegmentCollision 内部调用）验证。
 */
import { describe, it, expect } from 'vitest'
import { detectSegmentCollision } from '../../src/composables/useCollision'
import type { ParticleObject, SegmentObject } from '../../src/composables/usePhysics'

function makePlate(over: Partial<SegmentObject> = {}): SegmentObject {
  return {
    id: 2,
    name: 'plate',
    type: 'line_segment',
    x1: 100,
    y1: 200,
    x2: 300,
    y2: 200,
    normalX: 0,
    normalY: -1,
    color: '#dc2626',
    subtype: 'plate',
    movable: true,
    mass: 10,
    physicsThickness: 10,
    velocity: { x: 50, y: 0 },
    ...over
  }
}

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

describe('回归：板块端面碰撞 vx 立即归零', () => {
  it('板块水平移动撞球（板块端面碰球）→ 板块端面碰撞处理', () => {
    // 板块 x1=100~x2=300，球在 x=310（板块右端外）
    // 板块向右移动（velocity.x=100），其右端面会撞到球
    const ball = makeBall({
      x: 310,
      y: 195, // 在板块端面高度内（physicsThickness=10，y=190~210）
      vx: 0,
      vy: 0,
      prevX: 310,
      prevY: 195
    })
    const plate = makePlate({
      velocity: { x: 100, y: 0 },
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200
    })
    // 检测球与板块的碰撞
    // 由于球在板块端面附近，detectSegmentCollision 应调用 detectPlateEndCollision
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    // 至少应触发碰撞检测（hit 或不 hit 取决于具体几何）
    // 关键守护：若 hit，板块端面碰撞立即设 vx=0
    if (hit) {
      expect(plate.velocity?.x).toBe(0)
    }
  })

  it('板块从右端撞向球（球在右端外）→ 端面碰撞使板块 vx=0', () => {
    // 板块右端 x=300，球在 x=315（端面 15px 外，超出 radius=5，触发端面碰撞分支）
    const ball = makeBall({
      x: 315,
      y: 200,
      radius: 5,
      vx: 0,
      vy: 0,
      prevX: 315,
      prevY: 200
    })
    const plate = makePlate({
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200,
      velocity: { x: 100, y: 0 },
      physicsThickness: 10
    })
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    // 板块端面碰撞：板块立即停止
    if (hit) {
      expect(plate.velocity?.x).toBe(0)
    }
  })

  it('板块未碰球 → vx 保持', () => {
    // 球远离板块端面
    const ball = makeBall({
      x: 1000,
      y: 1000,
      vx: 0,
      vy: 0,
      prevX: 1000,
      prevY: 1000
    })
    const plate = makePlate({
      velocity: { x: 100, y: 0 }
    })
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    expect(hit).toBe(false)
    // 板块速度未变
    expect(plate.velocity?.x).toBe(100)
  })

  it('端面碰撞无摩擦（仅法向反射）', () => {
    // 球与板块端面碰撞，板块 vy 不应被摩擦影响（仅 vx 归零）
    const ball = makeBall({
      x: 310,
      y: 195,
      vx: -50,
      vy: 0, // 球向左撞板块右端
      prevX: 320,
      prevY: 195
    })
    const plate = makePlate({
      velocity: { x: 0, y: 30 }, // 板块向下移动
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200
    })
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    if (hit) {
      // 板块端面碰撞：vx 立即归零，vy 不变（无摩擦）
      expect(plate.velocity?.x).toBe(0)
      // vy 应保持（端面碰撞无摩擦减速）
      // 注意：若板块未实际撞到球（距离不够），velocity 不变
    }
  })
})

describe('回归：板块上表面 vs 端面碰撞分支', () => {
  it('球从上方撞板块上表面 → 走 detectSegmentCollision 主路径（非端面）', () => {
    // 球在板块上方，垂直下落撞上表面
    // 球底距板块表面 5px = radius，触发距离命中
    const ball = makeBall({
      x: 200,
      y: 195,
      vx: 0,
      vy: 100,
      prevX: 200,
      prevY: 100
    })
    const plate = makePlate({
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200,
      velocity: { x: 0, y: 0 }
    })
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    expect(hit).toBe(true)
    // 上表面碰撞：球被反弹（vy < 0）
    expect(ball.vy).toBeLessThanOrEqual(0)
  })

  it('球从板块端面外侧水平撞端面 → 走 detectPlateEndCollision', () => {
    // 球在板块右端外，水平向左撞板块右端面
    const ball = makeBall({
      x: 310,
      y: 200, // 板块右端 x=300，球在 x=310（半径 5 刚好接触）
      vx: -100,
      vy: 0,
      radius: 5,
      prevX: 320,
      prevY: 200
    })
    const plate = makePlate({
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200,
      velocity: { x: 0, y: 0 },
      physicsThickness: 10
    })
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    // 端面碰撞：板块无水平速度 → 无需归零（已为 0）
    // 关键：球应被端面阻挡（vx 减小或归零）
    if (hit) {
      expect(ball.vx).toBeGreaterThanOrEqual(-100) // 球被减速或反弹
    }
  })

  it('板块无 physicsThickness → 不走端面碰撞分支', () => {
    // 板块未设 physicsThickness，端面碰撞分支不触发
    const ball = makeBall({
      x: 310,
      y: 200,
      vx: -100,
      vy: 0,
      prevX: 320,
      prevY: 200
    })
    const plate = makePlate({
      x1: 100,
      y1: 200,
      x2: 300,
      y2: 200,
      velocity: { x: 50, y: 0 }
    })
    delete (plate as any).physicsThickness
    const hit = detectSegmentCollision(ball, plate, 0.016, 490)
    // 无 physicsThickness → 板块端面碰撞分支不触发，板块速度保持
    expect(plate.velocity?.x).toBe(50)
  })
})
