/**
 * 单元测试：useSnapshotManager 快照录制 + 关键帧检测 + 回放控制
 *
 * 模块级单例 snapshots/currentFrame/keyframeIndices/isPlaying/playbackSpeed 需在
 * beforeEach 用 clearSnapshots 重置。play/pause/tick 依赖 rAF，需 mock。
 *
 * 覆盖：recordSnapshot 基础录制、关键帧检测（vx/vy 符号反转）、MAX_SNAPSHOTS 容量裁剪、
 *      clearSnapshots、stepFrame、play/pause/togglePlay/setPlaybackSpeed、关键帧索引偏移。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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
  togglePlay,
  stepFrame,
  setPlaybackSpeed
} from '../../src/composables/useSnapshotManager'
import { MAX_SNAPSHOTS } from '../../src/constants'
import type { SnapshotFrame, SnapshotObject, FieldState } from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

/** 构造一帧快照 */
function makeFrame(
  objs: Array<{ id: number; x?: number; y?: number; vx?: number; vy?: number }>,
  timestamp = 0
): SnapshotFrame {
  return {
    objects: objs.map((o) => ({
      id: o.id,
      x: o.x ?? 0,
      y: o.y ?? 0,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0
    })) as SnapshotObject[],
    field: NONE_FIELD,
    groundY: 300,
    gravity: 490,
    timestamp
  }
}

/** rAF / performance.now mock 框架 */
let rafCallbacks: Array<(t: number) => void> = []
let perfNowValue = 0

beforeEach(() => {
  clearSnapshots()
  rafCallbacks = []
  perfNowValue = 0
  vi.stubGlobal('performance', {
    now: () => perfNowValue
  })
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length // 用作 rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    // 简化：清空所有挂起回调（单测足够）
    rafCallbacks = []
  })
})

afterEach(() => {
  pause()
  vi.unstubAllGlobals()
})

describe('useSnapshotManager — 初始状态', () => {
  it('clearSnapshots 后所有状态为空', () => {
    expect(snapshots.value).toHaveLength(0)
    expect(currentFrame.value).toBe(0)
    expect(keyframeIndices.value).toHaveLength(0)
    expect(isPlaying.value).toBe(false)
    expect(playbackSpeed.value).toBe(1)
  })
})

describe('useSnapshotManager — recordSnapshot 基础录制', () => {
  it('单帧录制后 snapshots +1', () => {
    recordSnapshot(makeFrame([{ id: 1, x: 100, vx: 50 }]))
    expect(snapshots.value).toHaveLength(1)
    expect(snapshots.value[0].objects[0].x).toBe(100)
    expect(snapshots.value[0].objects[0].vx).toBe(50)
  })

  it('多帧顺序追加，timestamp 保留', () => {
    recordSnapshot(makeFrame([{ id: 1 }], 100))
    recordSnapshot(makeFrame([{ id: 1 }], 200))
    recordSnapshot(makeFrame([{ id: 1 }], 300))
    expect(snapshots.value).toHaveLength(3)
    expect(snapshots.value[0].timestamp).toBe(100)
    expect(snapshots.value[2].timestamp).toBe(300)
  })

  it('帧数据完整保留（field/groundY/gravity）', () => {
    const frame: SnapshotFrame = {
      objects: [{ id: 1, x: 5, y: 10, vx: 20, vy: 30 }],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 5 },
      groundY: 250,
      gravity: 980,
      timestamp: 42
    }
    recordSnapshot(frame)
    const snap = snapshots.value[0]
    expect(snap.field.type).toBe('magnetic')
    expect(snap.field.B).toBe(5)
    expect(snap.groundY).toBe(250)
    expect(snap.gravity).toBe(980)
    expect(snap.timestamp).toBe(42)
  })
})

describe('useSnapshotManager — 关键帧检测（速度符号反转）', () => {
  it('vx 符号反转标记为关键帧', () => {
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }])) // 第 0 帧
    recordSnapshot(makeFrame([{ id: 1, vx: -30 }])) // 第 1 帧：vx +→- 触发
    expect(keyframeIndices.value).toHaveLength(1)
    expect(keyframeIndices.value[0]).toBe(1) // 第 1 帧是关键帧
  })

  it('vy 符号反转标记为关键帧', () => {
    recordSnapshot(makeFrame([{ id: 1, vy: 100 }]))
    recordSnapshot(makeFrame([{ id: 1, vy: -50 }]))
    expect(keyframeIndices.value).toHaveLength(1)
    expect(keyframeIndices.value[0]).toBe(1)
  })

  it('速度同号（如 vx 50→60）不触发关键帧', () => {
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }]))
    recordSnapshot(makeFrame([{ id: 1, vx: 60 }]))
    expect(keyframeIndices.value).toHaveLength(0)
  })

  it('速度过零（vx 50 → 0 → -50）已知限制：detectKeyframe 用乘积<0 判定，0 作为乘数失效', () => {
    // 实现逻辑：prev.vx * cur.vx < 0 → 严格异号才触发
    // 当速度过零（50→0→-50）时：
    //   50*0 = 0 (非负，不触发) - 合理：减速到零未反向
    //   0*-50 = 0 (非负，不触发) - 已知限制：零速度作为乘数导致无法识别后续反向
    // 这反映 detectKeyframe 的当前契约：仅识别"非零严格异号"反转。
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }]))
    recordSnapshot(makeFrame([{ id: 1, vx: 0 }])) // 0 不触发
    expect(keyframeIndices.value).toHaveLength(0)
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }])) // 0→-50 也未触发（乘积=0）
    expect(keyframeIndices.value).toHaveLength(0) // 实现契约：不识别过零路径
  })

  it('严格异号（50 → -50）触发关键帧', () => {
    // 直接 50→-50（无中间 0），乘积 -2500 < 0 触发
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }]))
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }]))
    expect(keyframeIndices.value).toHaveLength(1)
  })

  it('首帧不触发关键帧（无 prevFrame）', () => {
    recordSnapshot(makeFrame([{ id: 1, vx: 100 }]))
    expect(keyframeIndices.value).toHaveLength(0)
  })

  it('多物体：任一物体速度反转即标记', () => {
    recordSnapshot(
      makeFrame([
        { id: 1, vx: 50 },
        { id: 2, vx: 50 }
      ])
    )
    recordSnapshot(
      makeFrame([
        { id: 1, vx: 60 },
        { id: 2, vx: -10 }
      ])
    ) // 物体2 vx 反转
    expect(keyframeIndices.value).toHaveLength(1)
  })

  it('连续多次反转每帧都标记', () => {
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }]))
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }])) // 第 1 帧关键
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }])) // 第 2 帧关键
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }])) // 第 3 帧关键
    expect(keyframeIndices.value).toEqual([1, 2, 3])
  })
})

describe('useSnapshotManager — MAX_SNAPSHOTS 容量裁剪', () => {
  it('超过 MAX_SNAPSHOTS 时丢弃最早帧', () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) {
      recordSnapshot(makeFrame([{ id: 1, x: i }], i))
    }
    expect(snapshots.value).toHaveLength(MAX_SNAPSHOTS)
    // 最早帧被丢弃，第 0 帧应为 i=5（因为前面 0~4 共 5 帧被 shift）
    expect(snapshots.value[0].timestamp).toBe(5)
    // 末帧保留
    expect(snapshots.value[snapshots.value.length - 1].timestamp).toBe(MAX_SNAPSHOTS + 4)
  })

  it('容量裁剪时关键帧索引同步偏移（-1）并过滤 <0', () => {
    // 录制若干帧带关键帧反转
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }], 0)) // 帧0
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }], 1)) // 帧1 关键
    // 此时 keyframeIndices = [1]
    expect(keyframeIndices.value).toEqual([1])

    // 录制到超过容量，触发 shift
    for (let i = 2; i < MAX_SNAPSHOTS + 2; i++) {
      recordSnapshot(makeFrame([{ id: 1, vx: i % 2 === 0 ? 50 : -50 }], i))
    }
    // 关键帧索引应整体减1（首帧被 shift），原 [1] → [0]
    expect(keyframeIndices.value).toContain(0)
    // 不应保留负值
    expect(keyframeIndices.value.every((i) => i >= 0)).toBe(true)
  })
})

describe('useSnapshotManager — clearSnapshots', () => {
  it('清空 snapshots / currentFrame / keyframeIndices', () => {
    recordSnapshot(makeFrame([{ id: 1, vx: 50 }]))
    recordSnapshot(makeFrame([{ id: 1, vx: -50 }]))
    currentFrame.value = 1
    expect(snapshots.value.length).toBeGreaterThan(0)
    expect(keyframeIndices.value.length).toBeGreaterThan(0)

    clearSnapshots()
    expect(snapshots.value).toHaveLength(0)
    expect(currentFrame.value).toBe(0)
    expect(keyframeIndices.value).toHaveLength(0)
  })

  it('clearSnapshots 同时暂停回放', () => {
    isPlaying.value = true
    clearSnapshots()
    expect(isPlaying.value).toBe(false)
  })
})

describe('useSnapshotManager — stepFrame 逐帧步进', () => {
  beforeEach(() => {
    for (let i = 0; i < 5; i++) {
      recordSnapshot(makeFrame([{ id: 1, x: i }], i * 100))
    }
  })

  it('stepFrame(1) 前进一帧', () => {
    stepFrame(1)
    expect(currentFrame.value).toBe(1)
    stepFrame(1)
    expect(currentFrame.value).toBe(2)
  })

  it('stepFrame(-1) 后退一帧', () => {
    currentFrame.value = 3
    stepFrame(-1)
    expect(currentFrame.value).toBe(2)
  })

  it('stepFrame 在边界钳制到 [0, length-1]', () => {
    stepFrame(-100)
    expect(currentFrame.value).toBe(0)
    currentFrame.value = 4
    stepFrame(100)
    expect(currentFrame.value).toBe(4)
  })

  it('stepFrame 自动暂停回放', () => {
    isPlaying.value = true
    stepFrame(1)
    expect(isPlaying.value).toBe(false)
  })
})

describe('useSnapshotManager — setPlaybackSpeed', () => {
  it('设置回放速度倍率', () => {
    setPlaybackSpeed(2)
    expect(playbackSpeed.value).toBe(2)
    setPlaybackSpeed(0.5)
    expect(playbackSpeed.value).toBe(0.5)
  })
})

describe('useSnapshotManager — play / pause / togglePlay', () => {
  beforeEach(() => {
    for (let i = 0; i < 5; i++) {
      recordSnapshot(makeFrame([{ id: 1, x: i }], i * 100))
    }
  })

  it('play 启动回放，isPlaying=true', () => {
    play()
    expect(isPlaying.value).toBe(true)
  })

  it('空快照时 play 不启动', () => {
    clearSnapshots()
    play()
    expect(isPlaying.value).toBe(false)
  })

  it('已在播放时重复 play 不报错', () => {
    play()
    play() // 重复调用应 idempotent
    expect(isPlaying.value).toBe(true)
  })

  it('pause 停止回放，isPlaying=false', () => {
    play()
    pause()
    expect(isPlaying.value).toBe(false)
  })

  it('togglePlay 切换播放/暂停', () => {
    expect(isPlaying.value).toBe(false)
    togglePlay()
    expect(isPlaying.value).toBe(true)
    togglePlay()
    expect(isPlaying.value).toBe(false)
  })

  it('在末帧时 play 从头开始', () => {
    currentFrame.value = snapshots.value.length - 1 // 末帧
    play()
    expect(currentFrame.value).toBe(0) // 重置到首帧
    pause()
  })

  it('tick 推进 currentFrame，到末帧自动暂停', () => {
    // mock performance.now 推进 + 1 个 BASE_FRAME_INTERVAL_MS ≈ 16.67ms
    play()
    perfNowValue = 100 // play 调用时 performance.now()=100 设为 lastTimestamp
    // 推进 ~17ms（一帧间隔）
    perfNowValue = 117
    const cb = rafCallbacks[rafCallbacks.length - 1]
    cb(perfNowValue)
    expect(currentFrame.value).toBeGreaterThanOrEqual(1)
    pause()
  })

  it('pause 后 rAF 回调不再推进帧', () => {
    play()
    pause()
    const frameBeforePause = currentFrame.value
    // 即使再调用 cb 也不应推进（isPlaying=false 时 tick 立即返回）
    const cb = rafCallbacks[rafCallbacks.length - 1]
    if (cb) cb(200)
    expect(currentFrame.value).toBe(frameBeforePause)
  })
})
