/**
 * 物理定律契约测试（不可篡改）
 *
 * 本文件是物理铁律的不可动摇契约。AI 只能运行这些测试，不能修改。
 * 详见 CLAUDE.md「物理定律契约测试」章节。
 *
 * 覆盖四个铁律：
 *   1. 自由落体匀加速（牛顿第二定律）：v = g·t
 *   2. 无外力匀速运动（牛顿第一定律）：v 恒定
 *   3. 弹性碰撞动量 + 能量守恒（restitution = 1）
 *   4. 完全非弹性碰撞动量守恒（restitution = 0，碰后共速）
 *
 * 设计说明：
 *   - 契约 1 断言速度定律 v=g·t 而非位移 0.5·g·t²，因为 simulateStep 采用半隐式欧拉，
 *     速度精确但位移存在 O(1/n) 离散误差。速度定律是牛顿第二定律的直接体现。
 *   - 契约 3/4 直接调用 checkCollision 并传 gravity=0，排除重力对速度的干扰，
 *     只验证碰撞响应本身的守恒性。
 *   - 禁用地面用 GROUND_DISABLED 常量（groundY=100000），球永远无法触地。
 */
import { describe, it, expect } from 'vitest'
import { simulateStep } from '../helpers/sceneBuilder'
import { checkCollision } from '../../src/composables/useCollision'
import { PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParticleObject, PhysicsObject } from '../../src/composables/usePhysics'

// 重力加速度（像素/s²）= 9.8 m/s² × PIXELS_PER_METER。用计算而非魔法数字 490。
const G = 9.8 * PIXELS_PER_METER
const DT = 1 / 60
const STEPS = 60
const T = STEPS * DT // 1 秒

/** 构造一个最小合法质点 */
function makeBall(over: Partial<ParticleObject>): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 4,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

describe('物理定律契约 — 自由落体匀加速（牛顿第二定律）', () => {
  it('纯重力下 v = g·t，水平速度不变', () => {
    const ball = makeBall({ vx: 0, vy: 0 })
    for (let i = 0; i < STEPS; i++) {
      simulateStep([ball], DT, G, GROUND_DISABLED)
    }
    // 速度定律：半隐式欧拉速度精确，v_y = g·t
    expect(ball.vy).toBeCloseTo(G * T, 6)
    // 无水平力：v_x 保持 0
    expect(ball.vx).toBeCloseTo(0, 6)
  })
})

describe('物理定律契约 — 无外力匀速运动（牛顿第一定律）', () => {
  it('无重力、无碰撞时速度恒定，位移 = v·t', () => {
    const ball = makeBall({ vx: 100, vy: -50, x: 0, y: 0 })
    for (let i = 0; i < STEPS; i++) {
      simulateStep([ball], DT, 0, GROUND_DISABLED)
    }
    // 速度不变
    expect(ball.vx).toBeCloseTo(100, 6)
    expect(ball.vy).toBeCloseTo(-50, 6)
    // 位移 = v·t（无加速度，精确）
    expect(ball.x).toBeCloseTo(100 * T, 6)
    expect(ball.y).toBeCloseTo(-50 * T, 6)
  })
})

describe('物理定律契约 — 弹性碰撞动量 + 能量守恒（restitution = 1）', () => {
  it('不等质量正面弹性碰撞：总动量与总动能均守恒', () => {
    const a = makeBall({ id: 1, name: 'A', mass: 2, x: 0, y: 0, vx: 100, vy: 0, radius: 10 })
    const b = makeBall({ id: 2, name: 'B', mass: 1, x: 15, y: 0, vx: 0, vy: 0, radius: 10 })

    const momentumBefore = a.mass * a.vx + b.mass * b.vx
    const energyBefore = 0.5 * a.mass * a.vx * a.vx + 0.5 * b.mass * b.vx * b.vx

    // 直接调用 checkCollision：gravity=0 排除重力，particleRestitution=1 弹性
    checkCollision([a, b] as PhysicsObject[], GROUND_DISABLED, 0.6, 1.0, DT, 0)

    const momentumAfter = a.mass * a.vx + b.mass * b.vx
    const energyAfter = 0.5 * a.mass * a.vx * a.vx + 0.5 * b.mass * b.vx * b.vx

    // 动量守恒（铁律）
    expect(momentumAfter).toBeCloseTo(momentumBefore, 6)
    // 动能守恒（弹性碰撞铁律）
    expect(energyAfter).toBeCloseTo(energyBefore, 6)
  })
})

describe('物理定律契约 — 完全非弹性碰撞动量守恒（restitution = 0）', () => {
  it('不等质量正面非弹性碰撞：总动量守恒且碰后共速', () => {
    const a = makeBall({ id: 1, name: 'A', mass: 2, x: 0, y: 0, vx: 100, vy: 0, radius: 10 })
    const b = makeBall({ id: 2, name: 'B', mass: 1, x: 15, y: 0, vx: 0, vy: 0, radius: 10 })

    const momentumBefore = a.mass * a.vx + b.mass * b.vx
    // 共同速度：vCommon = (m1·v1 + m2·v2) / (m1 + m2)
    const vCommon = momentumBefore / (a.mass + b.mass)

    // 直接调用 checkCollision：gravity=0，particleRestitution=0 完全非弹性
    checkCollision([a, b] as PhysicsObject[], GROUND_DISABLED, 0.6, 0.0, DT, 0)

    const momentumAfter = a.mass * a.vx + b.mass * b.vx

    // 动量守恒（铁律）
    expect(momentumAfter).toBeCloseTo(momentumBefore, 6)
    // 碰后共速（完全非弹性碰撞定义）
    expect(a.vx).toBeCloseTo(vCommon, 6)
    expect(b.vx).toBeCloseTo(vCommon, 6)
  })
})
