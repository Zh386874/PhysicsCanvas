/**
 * 单元测试：useForces 力计算策略层
 *
 * 覆盖 4 个默认力（重力 / 自定义力 / 电场 qE / 洛伦兹 qvB / 弹簧 F=-kx）
 * 及 registerForce 策略注册。calculateTotalForce 接收 plain object（非 reactive）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { calculateTotalForce, registerForce } from '../../src/composables/useForces'
import type {
  PhysicsState,
  ParticleObject,
  PhysicsObject,
  SpringObject,
  CustomForce,
  FieldState
} from '../../src/composables/usePhysics'

const GRAVITY = 9.8 * 50 // 490 px/s²

/** 构造最小合法 ParticleObject */
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
    radius: 10,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

/** 构造最小合法 PhysicsState（plain object） */
function makeState(over: Partial<PhysicsState> = {}): PhysicsState {
  return {
    objects: [],
    forces: [],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    time: 0,
    isPlaying: false,
    showForce: true,
    showGateColors: true,
    groundY: 400,
    groundRestitution: 0.6,
    particleRestitution: 1.0,
    gravity: GRAVITY,
    ...over
  }
}

describe('useForces — 重力', () => {
  it('fy = m·g，fx = 0', () => {
    const state = makeState({ gravity: GRAVITY })
    const ball = makeBall({ mass: 2 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBeCloseTo(2 * GRAVITY, 6)
  })

  it('质量为 0 时不产生重力', () => {
    const state = makeState()
    const ball = makeBall({ mass: 0 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })

  it('gravity=0 时无重力（磁场圆周场景）', () => {
    const state = makeState({ gravity: 0 })
    const ball = makeBall({ mass: 5 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })
})

describe('useForces — 自定义力', () => {
  it('targetId 匹配的力被累加', () => {
    const forces: CustomForce[] = [
      { id: 10, fx: 100, fy: 50, targetId: 1 },
      { id: 11, fx: -30, fy: 20, targetId: 1 }
    ]
    const state = makeState({ gravity: 0, forces })
    const ball = makeBall({ id: 1, mass: 1 })
    const { fx, fy } = calculateTotalForce(state, ball)
    // 100 + (-30) = 70；50 + 20 = 70（无重力因 gravity=0）
    expect(fx).toBeCloseTo(70, 6)
    expect(fy).toBeCloseTo(70, 6)
  })

  it('targetId 不匹配的力不作用', () => {
    const forces: CustomForce[] = [{ id: 10, fx: 100, fy: 50, targetId: 999 }]
    const state = makeState({ gravity: 0, forces })
    const ball = makeBall({ id: 1 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })
})

describe('useForces — 电场力 qE', () => {
  it('charge=0 时无场力', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'electric', E: { x: 500, y: -1000 }, B: 0 }
    })
    const ball = makeBall({ charge: 0 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })

  it('正电荷：fx = q·Ex，fy = q·Ey', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'electric', E: { x: 500, y: -1000 }, B: 0 }
    })
    const ball = makeBall({ charge: 2 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBeCloseTo(2 * 500, 6)
    expect(fy).toBeCloseTo(2 * -1000, 6)
  })

  it('负电荷方向反向', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'electric', E: { x: 500, y: 0 }, B: 0 }
    })
    const ball = makeBall({ charge: -1 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBeCloseTo(-500, 6)
  })
})

describe('useForces — 洛伦兹力 qv×B', () => {
  it('fx = q·vy·B，fy = -q·vx·B', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 2 }
    })
    const ball = makeBall({ charge: 1, vx: 100, vy: 50 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBeCloseTo(1 * 50 * 2, 6) // q·vy·B = 100
    expect(fy).toBeCloseTo(-1 * 100 * 2, 6) // -q·vx·B = -200
  })

  it('B=0 时无洛伦兹力', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    })
    const ball = makeBall({ charge: 1, vx: 100, vy: 50 })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })

  it('方向验证：vx>0, B>0, q>0 → fy<0（向下偏转）', () => {
    const state = makeState({
      gravity: 0,
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 1 }
    })
    const ball = makeBall({ charge: 1, vx: 200, vy: 0 })
    const { fy } = calculateTotalForce(state, ball)
    expect(fy).toBeLessThan(0)
  })
})

describe('useForces — 弹簧力 F=-k·x', () => {
  /** 构造弹簧物体 */
  function makeSpring(over: Partial<SpringObject>): SpringObject {
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

  it('形变为 0（当前长度=自然长度）时无力', () => {
    const spring = makeSpring({ anchorX: 0, anchorY: 0, naturalLength: 50, ballId: 1 })
    const ball = makeBall({ id: 1, x: 50, y: 0, mass: 1 }) // 距锚点 50 = 自然长度
    const state = makeState({ gravity: 0, objects: [spring] })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })

  it('拉伸时力指向锚点（恢复力）', () => {
    const spring = makeSpring({ anchorX: 0, anchorY: 0, naturalLength: 50, k: 10, ballId: 1 })
    // 球在 (100, 0)，拉伸 50px，力应指向锚点（-x 方向）
    const ball = makeBall({ id: 1, x: 100, y: 0, mass: 1 })
    const state = makeState({ gravity: 0, objects: [spring] })
    const { fx, fy } = calculateTotalForce(state, ball)
    // 形变 = 50，F = -k·形变 = -500，方向单位向量 (1,0) → fx = -500
    expect(fx).toBeCloseTo(-500, 6)
    expect(fy).toBeCloseTo(0, 6)
  })

  it('|F| = k·|形变|', () => {
    const spring = makeSpring({ anchorX: 0, anchorY: 0, naturalLength: 0, k: 20, ballId: 1 })
    const ball = makeBall({ id: 1, x: 3, y: 4, mass: 1 }) // 距离 5
    const state = makeState({ gravity: 0, objects: [spring] })
    const { fx, fy } = calculateTotalForce(state, ball)
    const mag = Math.hypot(fx, fy)
    expect(mag).toBeCloseTo(20 * 5, 6) // k·|形变| = 100
  })

  it('currentLen < 1e-6 时跳过（防除零）', () => {
    const spring = makeSpring({ anchorX: 0, anchorY: 0, naturalLength: 0, k: 10, ballId: 1 })
    const ball = makeBall({ id: 1, x: 0, y: 0, mass: 1 }) // 与锚点重合
    const state = makeState({ gravity: 0, objects: [spring] })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })

  it('ballId 不匹配的弹簧不作用', () => {
    const spring = makeSpring({ ballId: 999, naturalLength: 0, k: 10 })
    const ball = makeBall({ id: 1, x: 100, y: 0, mass: 1 })
    const state = makeState({ gravity: 0, objects: [spring] })
    const { fx, fy } = calculateTotalForce(state, ball)
    expect(fx).toBe(0)
    expect(fy).toBe(0)
  })
})

describe('useForces — 合力累加', () => {
  it('重力 + 电场力 + 洛伦兹力 + 自定义力 同时作用', () => {
    const forces: CustomForce[] = [{ id: 1, fx: 30, fy: 40, targetId: 1 }]
    const state = makeState({
      gravity: GRAVITY,
      forces,
      field: { type: 'composite', E: { x: 100, y: 0 }, B: 1 }
    })
    const ball = makeBall({ id: 1, mass: 2, charge: 1, vx: 50, vy: 0 })
    const { fx, fy } = calculateTotalForce(state, ball)
    // fx: 电场 q·Ex=100 + 洛伦兹 q·vy·B=0 + 自定义 30 = 130
    expect(fx).toBeCloseTo(130, 6)
    // fy: 重力 m·g=2·490=980 + 电场 q·Ey=0 + 洛伦兹 -q·vx·B=-50 + 自定义 40 = 970
    expect(fy).toBeCloseTo(980 - 50 + 40, 6)
  })
})

describe('useForces — registerForce 策略注册', () => {
  // 注意：useForces 模块加载时自动注册 4 个默认力，不可清空（会移除重力）。
  // 此测试注册第 5 个力，用 sentinel id 隔离，避免污染其他测试文件的 calculateTotalForce 调用。
  const SENTINEL_ID = 88888

  it('registerForce 后新策略被纳入合力计算（仅对 sentinel 生效）', () => {
    registerForce(({ particle }) =>
      particle.id === SENTINEL_ID ? { fx: 999, fy: 0 } : { fx: 0, fy: 0 }
    )
    const state = makeState({ gravity: 0 })
    const normal = makeBall({ id: 1, mass: 1 })
    const sentinel = makeBall({ id: SENTINEL_ID, mass: 1 })
    // 普通球不受新力影响
    expect(calculateTotalForce(state, normal).fx).toBe(0)
    // sentinel 球受新力影响
    expect(calculateTotalForce(state, sentinel).fx).toBe(999)
  })
})
