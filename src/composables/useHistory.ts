import { ref, toRaw } from 'vue'
import type { PhysicsObject, FieldState } from './usePhysics'
import { GROUND_DISABLED } from '../constants'

/** 历史快照：完整场景状态 */
interface HistorySnapshot {
  objects: PhysicsObject[]
  gravity: number
  groundY: number | null
  field: FieldState
}

const MAX_HISTORY = 50 // 历史上限，防止内存膨胀

/**
 * 创建历史管理实例（封装 undoStack/redoStack 状态，防止模块级污染）
 */
function useHistory() {
  const undoStack = ref<HistorySnapshot[]>([])
  const redoStack = ref<HistorySnapshot[]>([])

  /**
   * 深拷贝物体数组，剥离运行时字段
   */
  function snapshotFromState(
    objects: PhysicsObject[],
    gravity: number,
    groundY: number,
    field: FieldState
  ): HistorySnapshot {
    return {
      objects: JSON.parse(
        JSON.stringify(
          objects.map((o) => {
            if (o.type === 'line_segment') {
              const { ...rest } = o
              return rest
            }
            const { trail, prevX, prevY, ...rest } = o as unknown as Record<string, unknown>
            return rest
          })
        )
      ) as PhysicsObject[],
      gravity,
      // 内部 groundY >= GROUND_DISABLED 表示禁用，存 null 还原语义
      groundY: groundY >= GROUND_DISABLED ? null : groundY,
      field: structuredClone(toRaw(field))
    }
  }

  /**
   * 推入历史记录（在编辑操作执行前调用，保存"操作前"状态）
   * 推入新历史时清空 redo 栈
   */
  function pushHistory(
    objects: PhysicsObject[],
    gravity: number,
    groundY: number,
    field: FieldState
  ): void {
    undoStack.value.push(snapshotFromState(objects, gravity, groundY, field))
    if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
    redoStack.value = []
  }

  /**
   * 撤销：弹出 undo 栈顶，将当前状态推入 redo 栈，返回要恢复的状态
   */
  function undo(
    objects: PhysicsObject[],
    gravity: number,
    groundY: number,
    field: FieldState
  ): HistorySnapshot | null {
    if (undoStack.value.length === 0) return null
    // 当前状态推入 redo
    redoStack.value.push(snapshotFromState(objects, gravity, groundY, field))
    return undoStack.value.pop()!
  }

  /**
   * 重做：弹出 redo 栈顶，将当前状态推入 undo 栈，返回要恢复的状态
   */
  function redo(
    objects: PhysicsObject[],
    gravity: number,
    groundY: number,
    field: FieldState
  ): HistorySnapshot | null {
    if (redoStack.value.length === 0) return null
    undoStack.value.push(snapshotFromState(objects, gravity, groundY, field))
    return redoStack.value.pop()!
  }

  function canUndo(): boolean {
    return undoStack.value.length > 0
  }

  function canRedo(): boolean {
    return redoStack.value.length > 0
  }

  /** 清空历史（场景切换时调用） */
  function clearHistory(): void {
    undoStack.value = []
    redoStack.value = []
  }

  return { pushHistory, undo, redo, canUndo, canRedo, clearHistory, undoStack, redoStack }
}

// 单例实例（模块级，确保所有调用方共享同一状态）
const history = useHistory()

export const { pushHistory, undo, redo, canUndo, canRedo, clearHistory, undoStack, redoStack } =
  history
export type { HistorySnapshot }
