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
    keyframeIndices.value = keyframeIndices.value
      .map(i => i - 1)
      .filter(i => i >= 0)
  }
}

/**
 * 清空所有快照（场景切换/重置时调用）
 */
export function clearSnapshots(): void {
  snapshots.value = []
  currentFrame.value = 0
  keyframeIndices.value = []
}
