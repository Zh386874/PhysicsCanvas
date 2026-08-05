/**
 * 快照管理层：录制回放快照 + 关键帧检测
 * 从 usePhysics.ts 拆分，遵循 SRP（单一职责原则）
 * 物理引擎（usePhysics）只负责状态和积分，快照系统独立管理
 */
import { ref } from 'vue'
import type { SnapshotFrame, SnapshotObject } from './usePhysics'
import { MAX_SNAPSHOTS } from '../constants'

// ===== 快照状态 =====

/** 回放快照序列 */
export const snapshots = ref<SnapshotFrame[]>([])
/** 当前回放帧索引 */
export const currentFrame = ref<number>(0)
/** 关键帧索引（速度方向突变点，用于回放导航） */
export const keyframeIndices = ref<number[]>([])

// ===== 回放播放控制 =====

/** 是否正在播放回放 */
export const isPlaying = ref<boolean>(false)
/** 回放速度倍率（0.25 / 0.5 / 1 / 2） */
export const playbackSpeed = ref<number>(1)

/** rAF 句柄与上次时间戳（模块级，暂停时清理） */
let rafId: number | null = null
let lastTimestamp = 0

/** 每次推进的基准：60fps，即每 1000/60 ms 推进 playbackSpeed 帧 */
const BASE_FRAME_INTERVAL_MS = 1000 / 60

function tick(now: number): void {
  if (!isPlaying.value) return
  const elapsed = now - lastTimestamp
  const framesToAdvance = Math.floor((elapsed / BASE_FRAME_INTERVAL_MS) * playbackSpeed.value)
  if (framesToAdvance > 0) {
    currentFrame.value += framesToAdvance
    lastTimestamp = now
    // 到末帧自动暂停
    if (currentFrame.value >= snapshots.value.length - 1) {
      currentFrame.value = snapshots.value.length - 1
      pause()
      return
    }
  }
  rafId = requestAnimationFrame(tick)
}

/** 播放回放：从当前帧继续，若已在末帧则从头开始 */
export function play(): void {
  if (isPlaying.value) return
  if (snapshots.value.length === 0) return
  if (currentFrame.value >= snapshots.value.length - 1) {
    currentFrame.value = 0
  }
  isPlaying.value = true
  lastTimestamp = performance.now()
  rafId = requestAnimationFrame(tick)
}

/** 暂停回放 */
export function pause(): void {
  isPlaying.value = false
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

/** 切换播放/暂停 */
export function togglePlay(): void {
  if (isPlaying.value) pause()
  else play()
}

/** 逐帧步进：delta 正为前进，负为后退 */
export function stepFrame(delta: number): void {
  pause()
  const next = currentFrame.value + delta
  const maxIdx = snapshots.value.length - 1
  currentFrame.value = Math.max(0, Math.min(maxIdx, next))
}

/** 设置回放速度 */
export function setPlaybackSpeed(speed: number): void {
  playbackSpeed.value = speed
}

// ===== 核心函数 =====

/**
 * 检测关键帧：速度分量符号变化
 */
function detectKeyframe(prevFrame: SnapshotObject[], curFrame: SnapshotObject[]): boolean {
  for (let i = 0; i < curFrame.length; i++) {
    const prev = prevFrame[i]
    const cur = curFrame[i]
    if (!prev) continue
    if (prev.vx * cur.vx < 0 || prev.vy * cur.vy < 0) return true
  }
  return false
}

/**
 * 录制一帧快照（含关键帧检测和容量上限裁剪）
 * @param frame 当前帧数据
 */
export function recordSnapshot(frame: SnapshotFrame): void {
  const prevFrame = snapshots.value[snapshots.value.length - 1]
  if (prevFrame && detectKeyframe(prevFrame.objects, frame.objects)) {
    keyframeIndices.value.push(snapshots.value.length)
  }
  snapshots.value.push(frame)
  // 超出容量时移除最早帧，并同步偏移关键帧索引
  if (snapshots.value.length > MAX_SNAPSHOTS) {
    snapshots.value.shift()
    keyframeIndices.value = keyframeIndices.value.map((i) => i - 1).filter((i) => i >= 0)
  }
}

/**
 * 清空所有快照（场景切换/重置时调用）
 */
export function clearSnapshots(): void {
  pause()
  snapshots.value = []
  currentFrame.value = 0
  keyframeIndices.value = []
}
