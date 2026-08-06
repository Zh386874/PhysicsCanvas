/**
 * 单元测试：usePhysics 核心积分引擎
 *
 * 通过模块级 reactive state 驱动 updatePhysics / loadScene / reset / capturePlayStart / CRUD。
 * beforeEach 用 loadScene 重置 state + clearSnapshots 清理快照，保证测试间隔离。
 *
 * 覆盖：loadScene 参数解析、半隐式欧拉速度定律、子步循环防隧穿、轨迹录制与上限、
 *      快照录制、传送带平移、板块支撑/摩擦、reset/capturePlayStart、物体 CRUD。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  state,
  loadScene,
  updatePhysics,
  reset,
  capturePlayStart,
  addForce,
  removeForce,
  clearForces,
  updateObjectProperty,
  addObject,
  removeObject,
  PIXELS_PER_METER
} from '../../src/composables/usePhysics'
import { clearSnapshots, snapshots } from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED, MAX_SUBSTEPS, TRAIL_LENGTH } from '../../src/constants'
import type {
  PhysicsObject,
  ParticleObject,
  SegmentObject,
  CustomForce,
  FieldState
} from '../../src/composables/usePhysics'

const GRAVITY = 9.8 * PIXELS_PER_METER // 490
const DT = 1 / 60
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

/** 构造最小合法质点 */
function makeBall(over: Partial<ParticleObject>): ParticleObject {
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

/** 重置 state 到干净状态（空场景、禁用地面） */
function resetState(): void {
  loadScene([], [], NONE_FIELD, GRAVITY, null) // groundY=null → GROUND_DISABLED
  clearSnapshots()
  state.isPlaying = false
}

beforeEach(() => {
  resetState()
})

describe('usePhysics — loadScene 参数解析', () => {
  it('设置 objects / forces / field / gravity', () => {
    const ball = makeBall({ id: 1, mass: 2 })
    const forces: CustomForce[] = [{ id: 10, fx: 5, fy: 0, targetId: 1 }]
    const field: FieldState = { type: 'electric', E: { x: 100, y: 0 }, B: 0 }
    loadScene([ball], forces, field, 200, 300)
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(1)
    expect(state.forces).toEqual(forces)
    expect(state.field).toEqual(field)
    expect(state.gravity).toBe(200)
    expect(state.groundY).toBe(300)
    expect(state.time).toBe(0)
    expect(state.isPlaying).toBe(false)
  })

  it('groundY=null → GROUND_DISABLED（禁用水平地面）', () => {
    loadScene([], [], NONE_FIELD, GRAVITY, null)
    expect(state.groundY).toBe(GROUND_DISABLED)
  })

  it('groundY=undefined → 保持当前 groundY（不覆盖）', () => {
    // 先设已知 groundY，再用 undefined 调 loadScene 验证不覆盖
    loadScene([], [], NONE_FIELD, GRAVITY, 250)
    expect(state.groundY).toBe(250)
    loadScene([], [], NONE_FIELD, GRAVITY, undefined)
    expect(state.groundY).toBe(250) // 未被 undefined 覆盖
  })

  it('field 为空时回退 none', () => {
    loadScene([], [], NONE_FIELD, GRAVITY, null)
    expect(state.field).toEqual({ type: 'none', E: { x: 0, y: 0 }, B: 0 })
  })

  it('加载新场景时 trail 被清空', () => {
    const ball = makeBall({
      id: 1,
      trail: [
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ]
    })
    loadScene([ball], [], NONE_FIELD, GRAVITY, null)
    expect((state.objects[0] as ParticleObject).trail).toEqual([])
  })
})

describe('usePhysics — updatePhysics 半隐式欧拉（速度定律）', () => {
  it('isPlaying=false 时 updatePhysics 不更新', () => {
    const ball = makeBall({ id: 1, x: 100, y: 100, vx: 0, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = false
    updatePhysics(DT)
    expect(state.objects[0].x).toBe(100)
    expect(state.objects[0].y).toBe(100)
    expect(state.objects[0].vx).toBe(0)
  })

  it('纯重力 N 步后 vy ≈ g·t（速度定律，对齐 contracts 契约）', () => {
    const ball = makeBall({ id: 1, x: 0, y: 0, vx: 0, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    const steps = 60
    for (let i = 0; i < steps; i++) updatePhysics(DT)
    const t = steps * DT // 1 秒
    expect(state.objects[0].vy).toBeCloseTo(GRAVITY * t, 5)
    // 水平无外力 → vx 不变
    expect(state.objects[0].vx).toBeCloseTo(0, 6)
  })

  it('水平初速度保持不变（无水平力）', () => {
    const ball = makeBall({ id: 1, vx: 100, vy: 0 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED) // gravity=0 匀速
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    expect(state.objects[0].vx).toBeCloseTo(100, 6)
    expect(state.objects[0].vy).toBeCloseTo(0, 6)
  })
})

describe('usePhysics — 子步循环防隧穿', () => {
  it('高速小球不隧穿（位置更新合理，不爆炸）', () => {
    // 高速：v*dt = 100000/60 ≈ 1666px >> MAX_STEP_DIST=10 → 多子步
    const ball = makeBall({ id: 1, x: 0, y: 0, vx: 100000, vy: 0, radius: 10 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    // 子步循环保证位移 = v*dt（不会因单步过大出错）
    expect(state.objects[0].x).toBeCloseTo(100000 * DT, 2)
  })

  it('MAX_SUBSTEPS 上限不会导致死循环', () => {
    // 极端高速：触发子步上限，updatePhysics 应在合理时间内返回
    const ball = makeBall({ id: 1, x: 0, y: 0, vx: 1e9, vy: 0, radius: 10 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    // 不断言精确位置（受 MAX_SUBSTEPS 截断），只验证不抛错、不死循环
    expect(() => updatePhysics(DT)).not.toThrow()
  })
})

describe('usePhysics — 轨迹录制与上限', () => {
  it('updatePhysics 后 trail push 当前位置', () => {
    const ball = makeBall({ id: 1, x: 100, y: 100, trail: [] })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    expect((state.objects[0] as ParticleObject).trail.length).toBe(1)
  })

  it(`trail 超过 TRAIL_LENGTH(${TRAIL_LENGTH}) 时 shift 最早点`, () => {
    const ball = makeBall({ id: 1, x: 0, y: 0, vx: 10, vy: 0, trail: [] })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    // 跑超过 TRAIL_LENGTH 步
    for (let i = 0; i < TRAIL_LENGTH + 10; i++) updatePhysics(DT)
    expect((state.objects[0] as ParticleObject).trail.length).toBe(TRAIL_LENGTH)
  })
})

describe('usePhysics — 快照录制', () => {
  it('updatePhysics 后 snapshots 末帧含正确数据', () => {
    const ball = makeBall({ id: 1, x: 50, y: 60, vx: 10, vy: 20 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, 300)
    state.isPlaying = true
    updatePhysics(DT)
    expect(snapshots.value.length).toBe(1)
    const frame = snapshots.value[0]
    expect(frame.objects).toHaveLength(1)
    expect(frame.objects[0].id).toBe(1)
    expect(frame.groundY).toBe(300)
    expect(frame.gravity).toBe(GRAVITY)
    expect(frame.field).toEqual(NONE_FIELD)
  })

  it('多次 updatePhysics 时间戳递增', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    const t1 = snapshots.value[0].timestamp
    updatePhysics(DT)
    const t2 = snapshots.value[1].timestamp
    expect(t2).toBeGreaterThanOrEqual(t1)
  })
})

describe('usePhysics — 传送带（velocity && !movable）保持静止', () => {
  it('传送带不随带速平移，两端点保持静止', () => {
    const belt: SegmentObject = {
      id: 2,
      name: 'belt',
      type: 'line_segment',
      x1: 0,
      y1: 200,
      x2: 100,
      y2: 200,
      normalX: 0,
      normalY: -1,
      friction: 0.2,
      velocity: { x: 50, y: 0 } // 传送带表面速度 50px/s，非 movable；仅用于摩擦，不移动自身
    }
    loadScene([belt], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    const x1Before = (state.objects[0] as SegmentObject).x1
    const x2Before = (state.objects[0] as SegmentObject).x2
    updatePhysics(DT)
    const seg = state.objects[0] as SegmentObject
    expect(seg.x1).toBeCloseTo(x1Before, 5)
    expect(seg.x2).toBeCloseTo(x2Before, 5)
  })
})

describe('usePhysics — 板块（movable）支撑与摩擦', () => {
  /** 构造水平板块位于地面之上 */
  function makePlateOnGround(over: Partial<SegmentObject>): SegmentObject {
    return {
      id: 5,
      name: 'plate',
      type: 'line_segment',
      subtype: 'plate',
      x1: 100,
      y1: 395,
      x2: 200,
      y2: 395,
      normalX: 0,
      normalY: -1,
      movable: true,
      mass: 1,
      velocity: { x: 0, y: 0 },
      physicsThickness: 10, // 下表面 y = 395 + 5 = 400 = groundY
      frictionTop: 0.3,
      frictionBottom: 0.1,
      restitution: 0.5,
      color: '#dc2626',
      ...over
    }
  }

  it('板块下表面触地 → vy 归零、y 归位到支撑面', () => {
    const plate = makePlateOnGround({ velocity: { x: 0, y: 10 } })
    loadScene([plate], [], NONE_FIELD, GRAVITY, 400)
    state.isPlaying = true
    updatePhysics(DT)
    const seg = state.objects[0] as SegmentObject
    // 下表面应归位到 groundY=400：segMidY + physicsThickness/2 = 400 → segMidY=395 → y1=395
    expect((seg.y1 + seg.y2) / 2).toBeCloseTo(395, 1)
    expect(seg.velocity!.y).toBe(0)
  })

  it('板块有水平速度时受地面摩擦减速', () => {
    const plate = makePlateOnGround({ velocity: { x: 100, y: 0 } })
    loadScene([plate], [], NONE_FIELD, GRAVITY, 400)
    state.isPlaying = true
    updatePhysics(DT)
    const seg = state.objects[0] as SegmentObject
    // 摩擦使 vx 减小（摩擦系数 frictionBottom=0.1）
    expect(Math.abs(seg.velocity!.x)).toBeLessThan(100)
    expect(seg.velocity!.x).toBeGreaterThan(0) // 未减到 0
  })
})

describe('usePhysics — reset / capturePlayStart', () => {
  it('reset 从 loadScene 快照恢复位置（物理状态重置）', () => {
    const ball = makeBall({ id: 1, x: 100, y: 100, vx: 50, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const x0 = state.objects[0].x
    // 播放改变位置
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    expect(state.objects[0].x).not.toBe(x0)
    // reset 恢复
    reset()
    expect(state.objects[0].x).toBeCloseTo(x0, 5)
    expect(state.objects[0].vx).toBeCloseTo(50, 5)
    expect(state.isPlaying).toBe(false)
  })

  it('capturePlayStart 后 reset 优先用 playStart 快照', () => {
    // 用 vx=50 确保播放期间 x 位置发生变化（vx=0 时仅 y 方向变，无法验证 x 快照恢复）
    const ball = makeBall({ id: 1, x: 100, y: 100, vx: 50, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    // 播放一段后捕获
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    const xAfterPlay = state.objects[0].x
    capturePlayStart()
    // 继续播放改变位置
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    expect(state.objects[0].x).not.toBeCloseTo(xAfterPlay, 4)
    // reset 应回到 capturePlayStart 时的位置
    reset()
    expect(state.objects[0].x).toBeCloseTo(xAfterPlay, 4)
  })

  it('reset 清空快照', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 5; i++) updatePhysics(DT)
    expect(snapshots.value.length).toBeGreaterThan(0)
    reset()
    expect(snapshots.value.length).toBe(0)
  })
})

describe('usePhysics — 物体 CRUD', () => {
  it('addObject 加入 state.objects', () => {
    resetState()
    const ball = makeBall({ id: 99 })
    addObject(ball)
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(99)
  })

  it('removeObject 按 id 删除', () => {
    resetState()
    addObject(makeBall({ id: 1 }))
    addObject(makeBall({ id: 2 }))
    removeObject(1)
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(2)
  })

  it('removeObject 不存在的 id 不报错', () => {
    resetState()
    expect(() => removeObject(999)).not.toThrow()
    expect(state.objects).toHaveLength(0)
  })

  it('updateObjectProperty 设置单个属性', () => {
    resetState()
    addObject(makeBall({ id: 1, mass: 1 }))
    updateObjectProperty(1, 'mass', 5)
    expect((state.objects[0] as ParticleObject).mass).toBe(5)
  })

  it('updateObjectProperty 不存在 id 时 no-op', () => {
    resetState()
    expect(() => updateObjectProperty(999, 'mass', 5)).not.toThrow()
  })
})

describe('usePhysics — 力 CRUD', () => {
  it('addForce / removeForce / clearForces', () => {
    resetState()
    addForce({ id: 1, fx: 10, fy: 0, targetId: 1 })
    addForce({ id: 2, fx: 20, fy: 0, targetId: 1 })
    expect(state.forces).toHaveLength(2)
    removeForce(1)
    expect(state.forces).toHaveLength(1)
    expect(state.forces[0].id).toBe(2)
    clearForces()
    expect(state.forces).toHaveLength(0)
  })

  it('removeForce 不存在的 id 不报错', () => {
    resetState()
    expect(() => removeForce(999)).not.toThrow()
  })
})
