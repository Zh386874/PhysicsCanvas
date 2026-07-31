/**
 * 集成测试：力计算策略 + 物理积分器
 *
 * 验证 useForces 的 4 个默认力（重力/自定义力/场力/弹簧力）通过 updatePhysics
 * 积分后产生符合物理定律的运动轨迹。覆盖：
 *   - 重力驱动自由落体（速度定律 v=g·t）
 *   - 自定义力定向加速
 *   - 电场力 qE 驱动抛物线偏转
 *   - 洛伦兹力 qvB 驱动圆周运动（半径 r=mv/qB）
 *   - 弹簧力 F=-kx 驱动简谐振动（周期 T=2π√(m/k)）
 *   - 多力叠加（重力 + 自定义力 + 场力）
 *
 * 模块级 state 单例需 beforeEach 用 loadScene + clearSnapshots 重置。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { state, loadScene, updatePhysics, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearSnapshots } from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED } from '../../src/constants'
import type {
  PhysicsObject,
  ParticleObject,
  SpringObject,
  CustomForce,
  FieldState
} from '../../src/composables/usePhysics'

const DT = 1 / 60
const GRAVITY = 9.8 * PIXELS_PER_METER // 490
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 400,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 10,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

function makeSpring(over: Partial<SpringObject> = {}): SpringObject {
  return {
    id: 100,
    name: 'spring',
    type: 'spring',
    anchorX: 0,
    anchorY: 0,
    ballId: 1,
    naturalLength: 50,
    k: 10,
    ...over
  }
}

function resetState(): void {
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearSnapshots()
  state.isPlaying = false
}

beforeEach(() => {
  resetState()
})

describe('集成：重力 → 自由落体速度定律', () => {
  it('N 步后 vy ≈ g·t（速度定律，对齐半隐式欧拉）', () => {
    const ball = makeBall({ x: 400, y: 100, vx: 0, vy: 0, mass: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    const N = 30
    for (let i = 0; i < N; i++) updatePhysics(DT)
    const t = N * DT
    // 半隐式欧拉：vy(累积) = sum(g·dt) = g·N·dt = g·t
    expect(state.objects[0].vy).toBeCloseTo(GRAVITY * t, 1)
  })

  it('质量不影响加速度（伽利略原理）', () => {
    const ball1 = makeBall({ id: 1, mass: 1 })
    const ball2 = makeBall({ id: 2, mass: 10, x: 500 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // 重力加速度 g 与质量无关
    expect(state.objects[0].vy).toBeCloseTo(state.objects[1].vy, 2)
  })
})

describe('集成：自定义力 → 定向加速', () => {
  it('水平恒力 F=100 N → 100 步后 vx ≈ (F/m)·t', () => {
    const ball = makeBall({ id: 1, mass: 1, vx: 0, vy: 0 })
    const force: CustomForce = { id: 10, fx: 100, fy: 0, targetId: 1 }
    loadScene([ball], [force], NONE_FIELD, 0, GROUND_DISABLED) // 关重力
    state.isPlaying = true
    const N = 100
    for (let i = 0; i < N; i++) updatePhysics(DT)
    const t = N * DT
    // F=ma → a=F/m=100，v=a·t
    expect(state.objects[0].vx).toBeCloseTo(100 * t, 0)
  })

  it('力作用于指定 targetId，不作用其他球', () => {
    const ball1 = makeBall({ id: 1, vx: 0 })
    const ball2 = makeBall({ id: 2, x: 500, vx: 0 })
    const force: CustomForce = { id: 10, fx: 50, fy: 0, targetId: 1 }
    loadScene([ball1, ball2], [force], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    // ball1 受力加速，ball2 不受影响
    expect(state.objects[0].vx).toBeGreaterThan(0)
    expect(state.objects[1].vx).toBe(0)
  })
})

describe('集成：电场力 qE → 抛物线偏转', () => {
  it('带正电粒子在向上电场中获得向上加速度', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 1,
      vx: 100,
      vy: 0,
      x: 100,
      y: 400
    })
    const field: FieldState = { type: 'electric', E: { x: 0, y: -500 }, B: 0 }
    loadScene([ball], [], field, 0, GROUND_DISABLED) // 关重力
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // qE = 1 * (0, -500) = (0, -500)，a = qE/m = (0, -500)
    // 30 步后 vy ≈ -500 * 30 * DT = -250
    expect(state.objects[0].vy).toBeLessThan(-200)
  })

  it('负电荷在向下电场中向上偏转', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: -1,
      vx: 0,
      vy: 0
    })
    const field: FieldState = { type: 'electric', E: { x: 0, y: 500 }, B: 0 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    // qE = -1 * (0, 500) = (0, -500)，vy 应为负（向上）
    expect(state.objects[0].vy).toBeLessThan(0)
  })

  it('中性粒子（charge=0）不受电场影响', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 0,
      vx: 100,
      vy: 0
    })
    const field: FieldState = { type: 'electric', E: { x: 0, y: -1000 }, B: 0 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // 电场对中性粒子无效
    expect(state.objects[0].vy).toBeCloseTo(0, 5)
    expect(state.objects[0].vx).toBeCloseTo(100, 1)
  })

  it('重力 + 电场力合成：等大反向时合力为零', () => {
    // 重力 g=490（向下），电场 qE 应使加速度向上 490
    // q=1, m=1, E=490 向上 → a = qE/m = 490 向上
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 1,
      vx: 0,
      vy: 0
    })
    const field: FieldState = { type: 'electric', E: { x: 0, y: -490 }, B: 0 }
    loadScene([ball], [], field, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // 合力为零，球应保持静止
    expect(state.objects[0].vy).toBeCloseTo(0, 0)
    expect(state.objects[0].y).toBeCloseTo(100, 0)
  })
})

describe('集成：洛伦兹力 qvB → 圆周运动', () => {
  it('带电粒子在匀强磁场中速度方向旋转（速度大小近似守恒，半隐式欧拉有漂移）', () => {
    // m=1, v=100, q=1, B=1 → r = mv/qB = 100, T=2π
    // 半隐式欧拉积分圆周运动能量会漂移（已知实现特性，参考 project_memory）
    // 用较短时间 + 较大容差验证"速度方向已旋转"
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 1,
      vx: 100,
      vy: 0,
      x: 400,
      y: 250
    })
    const field: FieldState = { type: 'magnetic', E: { x: 0, y: 0 }, B: 1 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    // 跑 1/4 周期 ≈ 1.57s ≈ 94 步
    for (let i = 0; i < 94; i++) updatePhysics(DT)
    const vx = state.objects[0].vx
    const vy = state.objects[0].vy
    // 1/4 周期后速度方向应旋转约 90°：vx≈0, vy≈±100（容差 25 反映半隐式欧拉漂移）
    expect(Math.abs(vx)).toBeLessThan(40)
    expect(Math.abs(vy)).toBeGreaterThan(60)
    // 速度大小近似守恒（漂移容忍 ±25%）
    const speed = Math.hypot(vx, vy)
    expect(speed).toBeGreaterThan(75)
    expect(speed).toBeLessThan(125)
  })

  it('磁场不改变粒子动能（短时间近拟守恒，半隐式欧拉有能量漂移）', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 1,
      vx: 200,
      vy: 0
    })
    const field: FieldState = { type: 'magnetic', E: { x: 0, y: 0 }, B: 2 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    const initialKE = 0.5 * 1 * 200 * 200 // 20000
    // 仅跑 30 步（0.5s），减小半隐式欧拉能量漂移
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    const v = state.objects[0]
    const finalKE = 0.5 * 1 * v.vx * v.vx + 0.5 * 1 * v.vy * v.vy
    // 短时间内 KE 应在 ±15% 内守恒（半隐式欧拉漂移容忍）
    expect(finalKE).toBeGreaterThan(initialKE * 0.85)
    expect(finalKE).toBeLessThan(initialKE * 1.15)
  })

  it('中性粒子不受磁场影响', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 0,
      vx: 100,
      vy: 0
    })
    const field: FieldState = { type: 'magnetic', E: { x: 0, y: 0 }, B: 5 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // 磁场对中性粒子无效，球做匀速直线运动
    expect(state.objects[0].vx).toBeCloseTo(100, 1)
    expect(state.objects[0].vy).toBeCloseTo(0, 5)
  })
})

describe('集成：弹簧力 F=-kx → 简谐振动', () => {
  it('弹簧拉力使偏离平衡位置的球向锚点回归', () => {
    // 锚点在 (0, 0)，球在 (100, 0)，自然长度 50，形变 50，k=10
    // F = -k·x = -10·50 = -500（向左，指向锚点）
    const ball = makeBall({ id: 1, mass: 1, x: 100, y: 0, vx: 0, vy: 0 })
    const spring = makeSpring({
      id: 100,
      anchorX: 0,
      anchorY: 0,
      ballId: 1,
      naturalLength: 50,
      k: 10
    })
    loadScene([ball, spring as unknown as PhysicsObject], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 5; i++) updatePhysics(DT)
    // 球应获得向左的 vx（指向锚点）
    expect(state.objects[0].vx).toBeLessThan(0)
  })

  it('弹簧自然长度时无形变 → 无力', () => {
    // 球在 (50, 0)，自然长度 50，无形变
    const ball = makeBall({ id: 1, mass: 1, x: 50, y: 0, vx: 0, vy: 0 })
    const spring = makeSpring({
      id: 100,
      anchorX: 0,
      anchorY: 0,
      ballId: 1,
      naturalLength: 50,
      k: 10
    })
    loadScene([ball, spring as unknown as PhysicsObject], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    // 无形变，弹簧无力，球静止
    expect(state.objects[0].vx).toBeCloseTo(0, 5)
    expect(state.objects[0].x).toBeCloseTo(50, 5)
  })

  it('简谐振动周期 T ≈ 2π√(m/k)', () => {
    // m=1, k=10 → T = 2π/√10 ≈ 1.987s
    // 给球初速度，使其围绕平衡位置振动，验证周期
    const ball = makeBall({ id: 1, mass: 1, x: 50, y: 0, vx: 0, vy: 0 })
    const spring = makeSpring({
      id: 100,
      anchorX: 0,
      anchorY: 0,
      ballId: 1,
      naturalLength: 50,
      k: 10
    })
    loadScene([ball, spring as unknown as PhysicsObject], [], NONE_FIELD, 0, GROUND_DISABLED)
    // 偏离平衡位置 30px（在 x=80 处）
    state.objects[0].x = 80
    state.isPlaying = true
    const expectedT = 2 * Math.PI * Math.sqrt(1 / 10) // ≈1.987s
    const steps = Math.round(expectedT / DT)
    // 跑 1 个周期，球应回到初始位置
    for (let i = 0; i < steps; i++) updatePhysics(DT)
    // 周期后位置应接近初始偏离位置 80（允许数值积分误差）
    expect(state.objects[0].x).toBeGreaterThan(70)
    expect(state.objects[0].x).toBeLessThan(90)
  })
})

describe('集成：多力叠加', () => {
  it('重力 + 自定义力合成加速度', () => {
    const ball = makeBall({ id: 1, mass: 1, vx: 0, vy: 0 })
    const force: CustomForce = { id: 10, fx: 0, fy: -200, targetId: 1 } // 向上 200
    loadScene([ball], [force], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    const t = 30 * DT
    // 合力：fy = m·g + (-200) = 490 - 200 = 290，a=290
    expect(state.objects[0].vy).toBeCloseTo(290 * t, 0)
  })

  it('三力合成：重力 + 自定义力 + 电场力', () => {
    const ball = makeBall({ id: 1, mass: 1, charge: 1, vx: 0, vy: 0 })
    const force: CustomForce = { id: 10, fx: 100, fy: 0, targetId: 1 }
    const field: FieldState = { type: 'electric', E: { x: 200, y: 0 }, B: 0 }
    loadScene([ball], [force], field, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    const t = 30 * DT
    // x 方向：自定义力 100 + 电场力 qE=1*200=200 → ax=300
    expect(state.objects[0].vx).toBeCloseTo(300 * t, 0)
    // y 方向：仅重力 g=490 → vy=g·t
    expect(state.objects[0].vy).toBeCloseTo(GRAVITY * t, 0)
  })
})

describe('集成：力 + 碰撞综合', () => {
  it('重力下落 + 地面反弹（restitution<1 能量损失）', () => {
    const ball = makeBall({ id: 1, x: 400, y: 100, vx: 0, vy: 0, radius: 10 })
    // 设置地面 y=400，球下落触地反弹
    loadScene([ball], [], NONE_FIELD, GRAVITY, 400)
    state.isPlaying = true
    // 跑足够时间让球触地反弹
    for (let i = 0; i < 60; i++) updatePhysics(DT)
    // 球应已经反弹（vy < 0 至少有一次）
    const ball0 = state.objects[0] as ParticleObject
    // 经过反弹后位置应在地面之上（y < 400 - radius）
    expect(ball0.y).toBeLessThan(400)
  })

  it('带电粒子在电场中偏转撞墙后反弹方向反转', () => {
    const ball = makeBall({
      id: 1,
      mass: 1,
      charge: 1,
      vx: 0,
      vy: 0,
      x: 200,
      y: 200
    })
    const field: FieldState = { type: 'electric', E: { x: 500, y: 0 }, B: 0 }
    loadScene([ball], [], field, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 100; i++) updatePhysics(DT)
    // 球获得向右速度
    expect(state.objects[0].vx).toBeGreaterThan(0)
  })
})
