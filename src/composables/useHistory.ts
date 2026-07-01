import { ref } from 'vue'
import type { PhysicsObject, FieldState } from './usePhysics'

/** 历史快照：完整场景状态 */
interface HistorySnapshot {
  objects: PhysicsObject[]
  gravity: number
  groundY: number | null
  field: FieldState
}

const MAX_HISTORY = 50 // 历史上限，防止内存膨胀

const undoStack = ref<HistorySnapshot[]>([])
const redoStack = ref<HistorySnapshot[]>([])

/**
 * 深拷贝物体数组，剥离运行时字段
 */
function snapshotFromState(objects: PhysicsObject[], gravity: number, groundY: number, field: FieldState): HistorySnapshot {
  return {
    objects: JSON.parse(JSON.stringify(objects.map(o => {
      if (o.type === 'line_segment') {
        const { ...rest } = o
        return rest
      }
      const { trail, prevX, prevY, ...rest } = o as any
      return rest
    }))),
    gravity,
    // 内部 groundY >= 100000 表示禁用，存 null 还原语义
    groundY: groundY >= 100000 ? null : groundY,
    field: JSON.parse(JSON.stringify(field))
  }
}

/**
 * 推入历史记录（在编辑操作执行前调用，保存"操作前"状态）
 * 推入新历史时清空 redo 栈
 */
function pushHistory(objects: PhysicsObject[], gravity: number, groundY: number, field: FieldState): void {
  undoStack.value.push(snapshotFromState(objects, gravity, groundY, field))
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
  redoStack.value = []
}

/**
 * 撤销：弹出 undo 栈顶，将当前状态推入 redo 栈，返回要恢复的状态
 */
function undo(objects: PhysicsObject[], gravity: number, groundY: number, field: FieldState): HistorySnapshot | null {
  if (undoStack.value.length === 0) return null
  // 当前状态推入 redo
  redoStack.value.push(snapshotFromState(objects, gravity, groundY, field))
  return undoStack.value.pop()!
}

/**
 * 重做：弹出 redo 栈顶，将当前状态推入 undo 栈，返回要恢复的状态
 */
function redo(objects: PhysicsObject[], gravity: number, groundY: number, field: FieldState): HistorySnapshot | null {
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

export {
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  undoStack,
  redoStack
}
export type { HistorySnapshot }
