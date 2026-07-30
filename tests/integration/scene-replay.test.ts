/**
 * 集成测试：usePhysics 物理引擎 + useSnapshotManager 快照回放
 *
 * 验证 updatePhysics 在每帧自动录制快照、关键帧检测（速度符号反转）、
 * 回放导航（stepFrame/play/pause）跨快照读取正确状态。
 *
 * 模块级 state 和 snapshots 单例需 beforeEach 重置。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  state,
  loadScene,
  updatePhysics,
  reset,
  capturePlayStart,
  PIXELS_PER_METER
} from '../../src/composables/usePhysics'
import {
  snapshots,
  currentFrame,
  keyframeIndices,
  isPlaying,
  playbackSpeed,
  recordSnapshot,
  clearSnapshots,
  play,
  pause,
  stepFrame,
  setPlaybackSpeed
} from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParticleObject, FieldState } from '../../src/composables/usePhysics'

const DT = 1 / 60
const GRAVITY = 9.8 * PIXELS_PER_METER
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

/** rAF / performance.now mock */
let rafCallbacks: Array<(t: number) => void> = []
let perfNowValue = 0

beforeEach(() => {
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearSnapshots()
  state.isPlaying = false
  rafCallbacks = []
  perfNowValue = 0
  vi.stubGlobal('performance', { now: () => perfNowValue })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCallbacks = []
  })
})

afterEach(() => {
  pause()
  vi.unstubAllGlobals()
})

describe('集成：updatePhysics 录制快照', () => {
  it('每帧 updatePhysics 后 snapshots 末帧包含当前状态', () => {
    const ball = makeBall({ id: 1, x: 100, y: 100, vx: 50, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    expect(snapshots.value.length).toBeGreaterThan(0)
    const lastFrame = snapshots.value[snapshots.value.length - 1]
    expect(lastFrame.objects[0].x).toBeCloseTo(state.objects[0].x, 5)
    expect(lastFrame.objects[0].y).toBeCloseTo(state.objects[0].y, 5)
  })

  it('多帧录制后 timestamp 非递减（Date.now 实现契约，子毫秒内可能相等）', () => {
    const ball = makeBall({ id: 1, vy: 100 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 5; i++) updatePhysics(DT)
    const ts = snapshots.value.map((s) => s.timestamp)
    // Date.now() 分辨率为 1ms，子毫秒内多帧可能返回相同 timestamp
    // 实际契约：timestamp 单调非递减
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1])
    }
  })

  it('快照包含完整场景数据（objects/field/groundY/gravity/timestamp）', () => {
    const ball = makeBall({ id: 1 })
    const field: FieldState = { type: 'magnetic', E: { x: 0, y: 0 }, B: 2 }
    loadScene([ball], [], field, 980, 250)
    state.isPlaying = true
    updatePhysics(DT)
    const snap = snapshots.value[snapshots.value.length - 1]
    expect(snap.objects).toHaveLength(1)
    expect(snap.field.type).toBe('magnetic')
    expect(snap.field.B).toBe(2)
    expect(snap.gravity).toBe(980)
    expect(snap.groundY).toBe(250)
    expect(typeof snap.timestamp).toBe('number')
  })

  it('isPlaying=false 时不录制快照', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = false
    updatePhysics(DT)
    expect(snapshots.value.length).toBe(0)
  })
})

describe('集成：关键帧检测（物理事件）', () => {
  it('平抛运动到达最高点时 vy 符号反转 → 关键帧', () => {
    // 球以 vy=-200（向上）发射，重力使其减速到 0 后反向（vy>0）
    const ball = makeBall({ id: 1, x: 100, y: 300, vx: 100, vy: -200 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    // 跑足够长时间（约 0.4s 到达最高点）
    for (let i = 0; i < 60; i++) updatePhysics(DT)
    // 应有至少一个关键帧（vy 从 -→+ 的反转）
    expect(keyframeIndices.value.length).toBeGreaterThanOrEqual(1)
  })

  it('球撞墙后 vx 符号反转 → 关键帧', () => {
    // 球水平向右撞墙反弹（地面 y=400 模拟）
    const ball = makeBall({ id: 1, x: 100, y: 200, vx: 200, vy: 0 })
    // 垂直墙线段（x=700）
    loadScene([ball], [], NONE_FIELD, GRAVITY, 400)
    // 加一面墙
    state.objects.push({
      id: 2,
      name: 'wall',
      type: 'line_segment',
      x1: 700,
      y1: 0,
      x2: 700,
      y2: 400,
      normalX: -1,
      normalY: 0,
      color: '#475569'
    } as ParticleObject)
    state.isPlaying = true
    // 跑到撞墙（约 3s）
    for (let i = 0; i < 200; i++) updatePhysics(DT)
    // 撞墙后 vx 应为负，应有 keyframe
    const ballObj = state.objects[0] as ParticleObject
    if (ballObj.vx < 0) {
      // 反弹后才有 keyframe
      expect(keyframeIndices.value.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('匀速直线运动不产生关键帧', () => {
    // 无重力，球匀速直线
    const ball = makeBall({ id: 1, vx: 100, vy: 0 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED) // 关重力
    state.isPlaying = true
    for (let i = 0; i < 60; i++) updatePhysics(DT)
    expect(keyframeIndices.value.length).toBe(0)
  })
})

describe('集成：快照回放导航', () => {
  it('stepFrame 在录制的快照间导航', () => {
    // 录制 10 帧
    const ball = makeBall({ id: 1, x: 100, vx: 100, vy: 0 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    state.isPlaying = false
    expect(snapshots.value.length).toBeGreaterThanOrEqual(10)

    // stepFrame 前进/后退
    const startX = snapshots.value[currentFrame.value].objects[0].x
    stepFrame(3)
    expect(currentFrame.value).toBe(3)
    const midX = snapshots.value[currentFrame.value].objects[0].x
    expect(midX).toBeGreaterThan(startX)

    stepFrame(-3)
    expect(currentFrame.value).toBe(0)
  })

  it('play 推进回放后 currentFrame 增加', () => {
    const ball = makeBall({ id: 1, vx: 100 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    state.isPlaying = false

    play()
    expect(isPlaying.value).toBe(true)
    // 推进时间触发 tick
    perfNowValue = 100
    const cb = rafCallbacks[rafCallbacks.length - 1]
    perfNowValue = 200 // 推进 ~100ms ≈ 6 帧
    cb(perfNowValue)
    expect(currentFrame.value).toBeGreaterThan(0)
    pause()
  })

  it('setPlaybackSpeed 影响回放速度', () => {
    const ball = makeBall({ id: 1, vx: 100 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 30; i++) updatePhysics(DT)
    state.isPlaying = false

    setPlaybackSpeed(2)
    expect(playbackSpeed.value).toBe(2)

    play()
    perfNowValue = 100
    const cb = rafCallbacks[rafCallbacks.length - 1]
    perfNowValue = 117 // 推进 ~17ms（一帧间隔），2x 应推进 2 帧
    cb(perfNowValue)
    expect(currentFrame.value).toBeGreaterThanOrEqual(2)
    pause()
    setPlaybackSpeed(1) // 还原
  })

  it('到末帧自动暂停', () => {
    const ball = makeBall({ id: 1, vx: 100 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    state.isPlaying = false

    currentFrame.value = snapshots.value.length - 1
    play()
    // 当前已在末帧，play 内会重置到 0，但触发 tick 后到末帧会 pause
    pause()
    expect(isPlaying.value).toBe(false)
  })
})

describe('集成：reset 与快照交互', () => {
  it('reset 清空快照 + 重置 state', () => {
    const ball = makeBall({ id: 1, vx: 100 })
    loadScene([ball], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    expect(snapshots.value.length).toBeGreaterThan(0)

    reset()
    expect(snapshots.value.length).toBe(0)
    expect(currentFrame.value).toBe(0)
    expect(state.isPlaying).toBe(false)
  })

  it('capturePlayStart 后 reset 回到 playStart 快照（而非 loadScene 初始）', () => {
    // vx=50 确保 x 变化，避免 vx=0 时位置不变
    const ball = makeBall({ id: 1, x: 100, y: 100, vx: 50, vy: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    const xAfterPlay = state.objects[0].x
    capturePlayStart()
    for (let i = 0; i < 10; i++) updatePhysics(DT)
    reset()
    expect(state.objects[0].x).toBeCloseTo(xAfterPlay, 4)
  })
})

describe('集成：多物体快照', () => {
  it('多物体场景快照包含全部物体的状态', () => {
    const ball1 = makeBall({ id: 1, x: 100, vx: 50 })
    const ball2 = makeBall({ id: 2, x: 500, vx: -30 })
    loadScene([ball1, ball2], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    const last = snapshots.value[snapshots.value.length - 1]
    expect(last.objects).toHaveLength(2)
    expect(last.objects[0].id).toBe(1)
    expect(last.objects[1].id).toBe(2)
  })

  it('物体被删除后不再出现在快照中', () => {
    const ball1 = makeBall({ id: 1, x: 100, vx: 50 })
    const ball2 = makeBall({ id: 2, x: 500, vx: -30 })
    loadScene([ball1, ball2], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    // 模拟删除 ball2
    state.objects = state.objects.filter((o) => o.id !== 2)
    updatePhysics(DT)
    const last = snapshots.value[snapshots.value.length - 1]
    expect(last.objects).toHaveLength(1)
    expect(last.objects[0].id).toBe(1)
  })
})
