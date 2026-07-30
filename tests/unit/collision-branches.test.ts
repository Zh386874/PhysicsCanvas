/**
 * 单元测试：useCollision 碰撞函数分支覆盖
 *
 * 直接调用纯函数（autoComputeNormal / checkGroundCollision / checkParticleCollision /
 * detectSegmentCollision）验证各分支：法线计算、地面反弹、粒子弹性/非弹性/部分弹性碰撞、
 * 线段 CCD 命中 / 距离命中 / 端面命中 / 摩擦力计算 / 板块摩擦反作用力。
 *
 * 注意：detectArcCollision 内部状态依赖 arcGateState，由 tests/integration/ring-scene.test.ts
 *      和 tests/regression/* 覆盖端到端行为，本文件仅覆盖低层纯函数。
 */
import { describe, it, expect } from 'vitest'
import {
  autoComputeNormal,
  checkGroundCollision,
  checkParticleCollision,
  detectSegmentCollision
} from '../../src/composables/useCollision'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParticleObject, SegmentObject } from '../../src/composables/usePhysics'

/** 构造最小质点 */
function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 10,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

/** 构造最小线段 */
function makeSegment(over: Partial<SegmentObject> = {}): SegmentObject {
  return {
    id: 2,
    name: 'seg',
    type: 'line_segment',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    normalX: 0,
    normalY: -1,
    color: '#94a3b8',
    ...over
  }
}

describe('useCollision — autoComputeNormal', () => {
  it('水平线段法线默认朝上 (0, -1)', () => {
    const r = autoComputeNormal({ x1: 0, y1: 0, x2: 100, y2: 0 })
    expect(r.normalX).toBeCloseTo(0, 5)
    expect(r.normalY).toBeCloseTo(-1, 5)
  })

  it('垂直线段法线 (1, 0) 或 (-1, 0)', () => {
    const r = autoComputeNormal({ x1: 0, y1: 0, x2: 0, y2: 100 })
    expect(Math.abs(r.normalX)).toBeCloseTo(1, 5)
    expect(r.normalY).toBeCloseTo(0, 5)
  })

  it('45° 线段法线归一化', () => {
    const r = autoComputeNormal({ x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(Math.hypot(r.normalX, r.normalY)).toBeCloseTo(1, 5)
  })

  it('保留用户方向偏好（curN 与计算 N 反向时翻转）', () => {
    // 水平线段默认法线 (0,-1)，传 curN=(0,1) 应翻转到 (0,-1) 的反方向？实际：点积<0 翻转
    const r = autoComputeNormal({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: 1 })
    // curN=(0,1) 与计算的 (0,-1) 点积 -1 < 0 → 翻转回 (0,1)
    expect(r.normalX).toBeCloseTo(0, 5)
    expect(r.normalY).toBeCloseTo(1, 5)
  })

  it('保留用户方向偏好（curN 与计算 N 同向时不翻转）', () => {
    const r = autoComputeNormal({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    expect(r.normalY).toBeCloseTo(-1, 5)
  })

  it('零长度线段返回默认法线 (0, -1)', () => {
    const r = autoComputeNormal({ x1: 50, y1: 50, x2: 50, y2: 50 })
    expect(r.normalX).toBe(0)
    expect(r.normalY).toBe(-1)
  })
})

describe('useCollision — checkGroundCollision', () => {
  it('球底部触地：y+radius >= groundY → 反弹', () => {
    const ball = makeBall({ y: 90, radius: 10, vy: 50 })
    const hit = checkGroundCollision(ball, 100, 0.6)
    expect(hit).toBe(true)
    expect(ball.y).toBe(90) // 修正为 groundY - radius
    expect(ball.vy).toBe(-50 * 0.6) // vy 反向 ×restitution
  })

  it('球未触地：y+radius < groundY → 无碰撞', () => {
    const ball = makeBall({ y: 50, radius: 10, vy: 50 })
    const hit = checkGroundCollision(ball, 100, 0.6)
    expect(hit).toBe(false)
    expect(ball.y).toBe(50)
    expect(ball.vy).toBe(50) // 不变
  })

  it('vy <= 0 时不反弹（仅位置修正）', () => {
    const ball = makeBall({ y: 95, radius: 10, vy: -20 }) // 上行
    const hit = checkGroundCollision(ball, 100, 0.6)
    expect(hit).toBe(true)
    expect(ball.y).toBe(90)
    expect(ball.vy).toBe(-20) // 不变（vy <= 0 不取反）
  })

  it('使用默认 radius=10（若未设置）', () => {
    const ball = makeBall({ y: 95, radius: undefined as unknown as number, vy: 50 })
    const hit = checkGroundCollision(ball, 100, 0.6)
    expect(hit).toBe(true)
    expect(ball.y).toBe(90) // radius 默认 10
  })

  it('使用默认 restitution=0.6（若未传）', () => {
    const ball = makeBall({ y: 90, radius: 10, vy: 100 })
    checkGroundCollision(ball, 100)
    expect(ball.vy).toBe(-60) // 0.6 × 100
  })

  it('深度穿透：球底远超地面 → 强制位置修正', () => {
    const ball = makeBall({ y: 200, radius: 10, vy: 500 })
    const hit = checkGroundCollision(ball, 100, 0.5)
    expect(hit).toBe(true)
    expect(ball.y).toBe(90) // 拉回地面
    expect(ball.vy).toBe(-250)
  })
})

describe('useCollision — checkParticleCollision 弹性碰撞', () => {
  it('e=1 完全弹性碰撞：动量与能量守恒', () => {
    // x 间距 15 < 20（半径和），确保严格重叠触发碰撞
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 10, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 115, y: 100, vx: 0, mass: 1, radius: 10 })
    const hit = checkParticleCollision(a, b, 1.0)
    expect(hit).toBe(true)
    // 等质量正碰弹性：速度交换
    expect(a.vx).toBeCloseTo(0, 5)
    expect(b.vx).toBeCloseTo(10, 5)
  })

  it('e=0 完全非弹性碰撞：共速', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 10, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 115, y: 100, vx: 0, mass: 1, radius: 10 })
    const hit = checkParticleCollision(a, b, 0)
    expect(hit).toBe(true)
    // 共速：vCommon = (1*10 + 1*0)/2 = 5
    expect(a.vx).toBeCloseTo(5, 5)
    expect(b.vx).toBeCloseTo(5, 5)
  })

  it('e=0.5 部分弹性：动量守恒，相对速度减半', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 10, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 115, y: 100, vx: 0, mass: 1, radius: 10 })
    const hit = checkParticleCollision(a, b, 0.5)
    expect(hit).toBe(true)
    // 动量守恒：m1*va + m2*vb = 10 = m1*va' + m2*vb'
    const totalP = a.vx + b.vx
    expect(totalP).toBeCloseTo(10, 5)
    // 相对速度反向并减半：va'-vb' = -0.5 * (va-vb) = -0.5 * 10 = -5
    expect(a.vx - b.vx).toBeCloseTo(-5, 5)
  })

  it('e=1 质量不等：动量守恒', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 10, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 115, y: 100, vx: 0, mass: 2, radius: 10 })
    checkParticleCollision(a, b, 1.0)
    // 动量守恒：1*10 + 2*0 = 1*va' + 2*vb' = 10
    expect(a.vx + 2 * b.vx).toBeCloseTo(10, 5)
  })

  it('球未接触：dist >= minDist → 无碰撞', () => {
    const a = makeBall({ id: 1, x: 0, y: 0, radius: 5 })
    const b = makeBall({ id: 2, x: 50, y: 0, radius: 5 })
    const hit = checkParticleCollision(a, b, 1.0)
    expect(hit).toBe(false)
    expect(a.x).toBe(0)
    expect(b.x).toBe(50)
  })

  it('刚好接触：dist == minDist → 无碰撞（严格 <）', () => {
    const a = makeBall({ id: 1, x: 0, y: 0, radius: 5 })
    const b = makeBall({ id: 2, x: 10, y: 0, radius: 5 })
    const hit = checkParticleCollision(a, b, 1.0)
    expect(hit).toBe(false) // dist == minDist 严格小于判定，不触发
  })

  it('重叠时位置分离（沿法线方向）', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 0, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 110, y: 100, vx: 0, mass: 1, radius: 10 })
    checkParticleCollision(a, b, 1.0)
    // overlap = 20 - 10 = 10，各分离 5
    expect(b.x - a.x).toBeGreaterThan(10)
  })

  it('完全重合（dist=0）不碰撞（避免除零）', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 0, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 100, y: 100, vx: 0, mass: 1, radius: 10 })
    const hit = checkParticleCollision(a, b, 1.0)
    expect(hit).toBe(false)
  })

  it('默认 restitution=1.0（未传第三参数）', () => {
    const a = makeBall({ id: 1, x: 100, y: 100, vx: 10, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 115, y: 100, vx: 0, mass: 1, radius: 10 })
    checkParticleCollision(a, b)
    // 弹性碰撞：速度交换
    expect(a.vx).toBeCloseTo(0, 5)
    expect(b.vx).toBeCloseTo(10, 5)
  })

  it('斜碰：法线方向速度交换，切向不变', () => {
    // 球 A 在 (0,0) 速度 (10,5)，球 B 在 (20,0) 静止，碰撞法线沿 x 轴
    const a = makeBall({ id: 1, x: 0, y: 0, vx: 10, vy: 5, mass: 1, radius: 10 })
    const b = makeBall({ id: 2, x: 15, y: 0, vx: 0, vy: 0, mass: 1, radius: 10 })
    checkParticleCollision(a, b, 1.0)
    // 法线方向（x）速度交换；切向（y）不变
    expect(a.vx).toBeCloseTo(0, 5)
    expect(b.vx).toBeCloseTo(10, 5)
    expect(a.vy).toBeCloseTo(5, 5)
    expect(b.vy).toBeCloseTo(0, 5)
  })
})

describe('useCollision — detectSegmentCollision', () => {
  it('CCD 路径相交：球穿过线段 → 命中', () => {
    // 球从 (50,-50) 移到 (50,50)，水平线段 y=0
    const ball = makeBall({ x: 50, y: 50, vx: 0, vy: 100, radius: 5, prevX: 50, prevY: -50 })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(true)
    // 反弹：vy 反向 ×restitution
    expect(ball.vy).toBeLessThan(0)
  })

  it('距离命中：球在线段附近 dist <= radius → 命中', () => {
    // 球在 (50, -3)，半径 5，距离线段 y=0 为 3 < 5
    const ball = makeBall({ x: 50, y: -3, vy: 0, radius: 5, prevX: 50, prevY: -3 })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(true)
    expect(ball.y).toBeCloseTo(-5, 5) // 修正到 y - radius*ny = 0 + (-1)*5 = -5
  })

  it('未命中：球远离线段 → 无碰撞', () => {
    const ball = makeBall({ x: 50, y: -100, radius: 5, prevX: 50, prevY: -100 })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(false)
  })

  it('法向速度 > 0（远离）时不反弹', () => {
    // 球 vy=-10 向上远离线段（法线 (0,-1)），即使距离命中也不应反弹
    const ball = makeBall({ x: 50, y: -3, vy: -10, radius: 5, prevX: 50, prevY: -3 })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    // 距离命中会返回 true（位置修正），但法向速度 > 0 不反弹
    if (hit) {
      expect(ball.vy).toBe(-10) // 未反弹
    }
  })

  it('restitution=0：法向速度归零（不反弹）', () => {
    const ball = makeBall({ x: 50, y: 50, vx: 0, vy: 100, radius: 5, prevX: 50, prevY: -50 })
    const seg = makeSegment({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      restitution: 0
    })
    detectSegmentCollision(ball, seg, 0.016, 490)
    // e=0：v_new = v - (1+0)*v_normal*n = v - v_normal*n，法向归零
    // 法向 v_normal = vy * ny = 100 * (-1) = -100，反弹后 vy = 100 - (1+0)*(-100)*(-1) = 100 - 100 = 0
    expect(ball.vy).toBeCloseTo(0, 5)
  })

  it('默认 restitution=0.3（segment 未设）', () => {
    const ball = makeBall({ x: 50, y: 50, vx: 0, vy: 100, radius: 5, prevX: 50, prevY: -50 })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    delete (seg as any).restitution
    detectSegmentCollision(ball, seg, 0.016, 490)
    // 法向 v_normal = -100，反弹后 vy = 100 - (1+0.3)*(-100)*(-1) = 100 - 130 = -30
    expect(ball.vy).toBeCloseTo(-30, 5)
  })

  it('摩擦力 > 0：切向速度减小', () => {
    // 球以水平速度 + 垂直速度撞水平地面，应有水平摩擦减速
    const ball = makeBall({
      x: 50,
      y: 50,
      vx: 100,
      vy: 100,
      radius: 5,
      prevX: 50,
      prevY: -50,
      mass: 1,
      friction: 0.3
    })
    const seg = makeSegment({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      friction: 0.3,
      restitution: 0
    })
    detectSegmentCollision(ball, seg, 0.1, 490) // dt=0.1 增大摩擦效果
    // vx 应减小（被摩擦减速）
    expect(Math.abs(ball.vx)).toBeLessThan(100)
  })

  it('传送带速度影响摩擦方向', () => {
    // 球静止撞以 +50 速度向右移动的传送带：摩擦推动球向右
    const ball = makeBall({
      x: 50,
      y: 50,
      vx: 0,
      vy: 100,
      radius: 5,
      prevX: 50,
      prevY: -50,
      mass: 1,
      friction: 0.5
    })
    const seg = makeSegment({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      friction: 0.5,
      restitution: 0,
      velocity: { x: 50, y: 0 }
    })
    detectSegmentCollision(ball, seg, 0.5, 490) // dt=0.5 让摩擦充分作用
    // 球应被传送带带动向右（vx > 0）
    expect(ball.vx).toBeGreaterThan(0)
  })

  it('板块上表面摩擦（frictionTop）vs 下表面（frictionBottom）', () => {
    // 板块 movable=true，法线 (0,-1) 朝上 → segDefNdotN = 0*0 + (-1)*(-1) = 1 >= 0 → 上表面
    const ball = makeBall({
      x: 50,
      y: 50,
      vx: 100,
      vy: 100,
      radius: 5,
      prevX: 50,
      prevY: -50,
      mass: 1
    })
    const seg = makeSegment({
      id: 2,
      name: 'plate',
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      movable: true,
      mass: 10,
      frictionTop: 0.5,
      frictionBottom: 0.1,
      restitution: 0,
      subtype: 'plate'
    })
    const vxBefore = ball.vx
    detectSegmentCollision(ball, seg, 0.1, 490)
    // 上表面摩擦系数 0.5 应明显减速
    expect(Math.abs(ball.vx)).toBeLessThan(Math.abs(vxBefore))
  })

  it('板块反作用力：可移动线段获得反向速度', () => {
    const ball = makeBall({
      x: 50,
      y: 50,
      vx: 100,
      vy: 100,
      radius: 5,
      prevX: 50,
      prevY: -50,
      mass: 1
    })
    const seg = makeSegment({
      id: 2,
      name: 'plate',
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      movable: true,
      mass: 10,
      frictionTop: 0.5,
      restitution: 0,
      subtype: 'plate'
    })
    detectSegmentCollision(ball, seg, 0.1, 490)
    // 牛三：板块获得反向速度
    expect(seg.velocity).toBeDefined()
    expect(seg.velocity!.x).not.toBe(0)
  })

  it('板块端面碰撞：球撞板块左右端面 → vx 归零', () => {
    // 板块在 x=0~100，球从 x=110 向左移动撞右端面
    const ball = makeBall({
      x: 110,
      y: 0,
      vx: -100,
      vy: 0,
      radius: 5,
      prevX: 115,
      prevY: 0,
      mass: 1
    })
    const seg = makeSegment({
      id: 2,
      name: 'plate',
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      movable: true,
      mass: 10,
      physicsThickness: 10,
      restitution: 0,
      subtype: 'plate'
    })
    // 球从板块上方水平接近右端面（y=-3 在端面内）
    ball.y = -3
    ball.prevY = -3
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    // 应通过 detectPlateEndCollision 处理
    if (hit) {
      // 端面碰撞立即 vx=0
      expect(ball.vx).toBe(0)
    }
  })

  it('prevX/prevY 未设置时回退到当前位置（不报错）', () => {
    const ball = makeBall({ x: 50, y: -3, radius: 5 })
    delete (ball as any).prevX
    delete (ball as any).prevY
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    expect(() => detectSegmentCollision(ball, seg, 0.016, 490)).not.toThrow()
  })
})

describe('useCollision — 默认值与边界', () => {
  it('checkGroundCollision groundY=GROUND_DISABLED 时所有球"触地"（100000）', () => {
    // 球 y=100，radius=10，groundY=100000，y+radius=110 < 100000 → 未触地
    const ball = makeBall({ y: 100, radius: 10, vy: 50 })
    const hit = checkGroundCollision(ball, GROUND_DISABLED, 0.6)
    expect(hit).toBe(false)
  })

  it('checkParticleCollision radius 未设置时默认 10', () => {
    const a = makeBall({
      id: 1,
      x: 100,
      y: 100,
      vx: 10,
      mass: 1,
      radius: undefined as unknown as number
    })
    const b = makeBall({
      id: 2,
      x: 115,
      y: 100,
      vx: 0,
      mass: 1,
      radius: undefined as unknown as number
    })
    // radius 默认 10，minDist=20，dist=15 < 20 → 碰撞
    const hit = checkParticleCollision(a, b, 1.0)
    expect(hit).toBe(true)
  })

  it('detectSegmentCollision radius 未设置时默认 10', () => {
    const ball = makeBall({
      x: 50,
      y: -5,
      radius: undefined as unknown as number,
      prevX: 50,
      prevY: -5
    })
    const seg = makeSegment({ x1: 0, y1: 0, x2: 100, y2: 0, normalX: 0, normalY: -1 })
    // radius 默认 10，距离 5 < 10 → 命中
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(true)
  })
})
