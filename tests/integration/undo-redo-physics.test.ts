/**
 * 集成测试：useHistory 历史 + useObjectOperations 物体操作 + usePhysics 状态
 *
 * 验证编辑操作（增删改）的撤销/重做循环，确认 applyHistorySnapshot 正确恢复
 * state.objects / gravity / groundY / field，且 selectedId 跟随快照首物体。
 *
 * 模块级 state 和 undoStack/redoStack 单例需 beforeEach 重置。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { useObjectOperations } from '../../src/composables/useObjectOperations'
import { clearHistory, undoStack, redoStack } from '../../src/composables/useHistory'
import { clearSnapshots } from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParticleObject, SegmentObject, FieldState } from '../../src/composables/usePhysics'

const GRAVITY = 9.8 * PIXELS_PER_METER
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
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

function makeSegment(over: Partial<SegmentObject> = {}): SegmentObject {
  return {
    id: 2,
    name: 'seg',
    type: 'line_segment',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    normalX: 0,
    normalY: -1,
    color: '#94a3b8',
    ...over
  }
}

function makeContext(activeScene = '自定义', mode: 'live' | 'replay' = 'live') {
  return {
    activeScene: ref(activeScene),
    mode: ref<'live' | 'replay'>(mode),
    aiToast: ref(''),
    selectedId: ref<number | null>(null),
    selectedIds: ref<number[]>([]),
    saveCustomScene: vi.fn(),
    editMode: ref(activeScene === '自定义' && mode === 'live')
  }
}

beforeEach(() => {
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearHistory()
  clearSnapshots()
  state.isPlaying = false
})

describe('集成：handleAddObject + onUndo/onRedo', () => {
  it('添加 → undo → 物体消失，再 redo → 物体恢复', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2, name: 'newBall' }))
    expect(state.objects).toHaveLength(2)

    ops.onUndo()
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(1)

    ops.onRedo()
    expect(state.objects).toHaveLength(2)
    expect(state.objects[1].id).toBe(2)
  })

  it('连续添加 → undo 多次 → 逐步回退', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    ops.handleAddObject(makeBall({ id: 3 }))
    ops.handleAddObject(makeBall({ id: 4 }))
    expect(state.objects).toHaveLength(4)

    ops.onUndo() // 撤销添加 4
    expect(state.objects).toHaveLength(3)
    expect(state.objects.map((o) => o.id)).toEqual([1, 2, 3])

    ops.onUndo() // 撤销添加 3
    expect(state.objects).toHaveLength(2)
    expect(state.objects.map((o) => o.id)).toEqual([1, 2])

    ops.onUndo() // 撤销添加 2
    expect(state.objects).toHaveLength(1)
  })

  it('undo 后再添加 → redo 栈清空', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    ops.onUndo()
    expect(state.objects).toHaveLength(1)
    expect(redoStack.value).toHaveLength(1)

    // 新操作应清空 redo 栈
    ops.handleAddObject(makeBall({ id: 3 }))
    expect(redoStack.value).toHaveLength(0)
    ops.onRedo() // 应无操作
    expect(state.objects).toHaveLength(2)
  })
})

describe('集成：handleRemoveObject + onUndo', () => {
  it('删除 → undo → 物体恢复', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleRemoveObject(2)
    expect(state.objects).toHaveLength(1)

    ops.onUndo()
    expect(state.objects).toHaveLength(2)
    expect(state.objects.map((o) => o.id)).toContain(2)
  })

  it('删除弧线段 → undo → 整组恢复', () => {
    const seg1: SegmentObject = {
      id: 10,
      name: 'arc-1',
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 50,
      y2: 0,
      normalX: 0,
      normalY: -1,
      groupId: 500,
      color: '#a78bfa'
    }
    const seg2: SegmentObject = {
      id: 11,
      name: 'arc-2',
      type: 'line_segment',
      x1: 50,
      y1: 0,
      x2: 100,
      y2: 0,
      normalX: 0,
      normalY: -1,
      groupId: 500,
      color: '#a78bfa'
    }
    loadScene([seg1, seg2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleRemoveObject(10) // 删除组内一段，整组删除
    expect(state.objects).toHaveLength(0)

    ops.onUndo()
    expect(state.objects).toHaveLength(2)
    expect(state.objects.map((o) => o.id)).toEqual(expect.arrayContaining([10, 11]))
  })

  it('删除质点 → undo → 弹簧级联恢复', () => {
    const ball = makeBall({ id: 1 })
    const spring = {
      id: 100,
      name: 'spring',
      type: 'spring',
      anchorX: 0,
      anchorY: 0,
      ballId: 1,
      naturalLength: 50,
      k: 10
    }
    loadScene([ball, spring as any], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleRemoveObject(1) // 级联删除弹簧
    expect(state.objects).toHaveLength(0)

    ops.onUndo()
    expect(state.objects).toHaveLength(2)
    expect(state.objects.map((o) => o.id)).toEqual(expect.arrayContaining([1, 100]))
  })
})

describe('集成：handleBatchUpdate + onUndo', () => {
  it('批量移动 → undo → 位置恢复', () => {
    const ball1 = makeBall({ id: 1, x: 100, y: 100 })
    const ball2 = makeBall({ id: 2, x: 200, y: 200 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleBatchUpdate([
      { id: 1, props: { x: 500, y: 500 } },
      { id: 2, props: { x: 600, y: 600 } }
    ])
    expect(state.objects[0].x).toBe(500)
    expect(state.objects[1].x).toBe(600)

    ops.onUndo()
    expect(state.objects[0].x).toBe(100)
    expect(state.objects[1].x).toBe(200)
  })
})

describe('集成：applyHistorySnapshot 恢复完整状态', () => {
  it('undo 恢复 gravity / groundY / field', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, 500, 300)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    // 添加物体（push 当前 gravity=500, groundY=300 进历史）
    ops.handleAddObject(makeBall({ id: 2 }))
    // 修改 gravity/groundY/field 后再 undo
    state.gravity = 980
    state.groundY = GROUND_DISABLED
    state.field = { type: 'magnetic', E: { x: 0, y: 0 }, B: 5 }
    // 直接 push 历史（模拟编辑操作前的状态保存）
    // 注意：handleAddObject 内部 push 时存的是当时 state.gravity=500
    ops.onUndo() // 应恢复 gravity=500, groundY=300, field=none
    expect(state.gravity).toBe(500)
    expect(state.groundY).toBe(300)
    expect(state.field.type).toBe('none')
  })

  it('undo 后 selectedId 跟随快照首物体', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 3 }))
    ops.onUndo()
    // selectedId 应设为快照首物体（id=1 或 2）
    expect([1, 2]).toContain(ctx.selectedId.value)
  })

  it('undo 后 groundY=null 在 state 中转为 GROUND_DISABLED', () => {
    // useHistory.snapshotFromState 将 GROUND_DISABLED (100000) 存为 null
    // applyHistorySnapshot 应转回 GROUND_DISABLED
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    ops.onUndo()
    expect(state.groundY).toBe(GROUND_DISABLED)
  })
})

describe('集成：场景切换 + 历史清空', () => {
  it('loadScene 不应清空历史（由 clearHistory 显式调用）', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    expect(undoStack.value).toHaveLength(1)

    // loadScene 不调用 clearHistory，历史保留
    loadScene([makeBall({ id: 1 })], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    expect(undoStack.value).toHaveLength(1) // 未被清空
  })

  it('clearHistory 显式清空后 undo 无效', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    clearHistory()
    ops.onUndo()
    expect(state.objects).toHaveLength(2) // 未恢复（无历史）
  })
})

describe('集成：replay 模式禁用历史', () => {
  it('replay 模式下 onUndo/onRedo 不操作', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义', 'replay')
    const ops = useObjectOperations(ctx)

    // replay 下 handleAddObject 仍可调用（pushHistory 在自定义场景下执行）
    // 但 onUndo 在 replay 模式直接 return
    ops.handleAddObject(makeBall({ id: 2 }))
    expect(state.objects).toHaveLength(2)

    ops.onUndo()
    expect(state.objects).toHaveLength(2) // replay 模式未撤销
    expect(ctx.aiToast.value).toBe('')
  })
})

describe('集成：非自定义场景禁用历史', () => {
  it('斜面场景下 onUndo 不操作', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('斜面')
    const ops = useObjectOperations(ctx)

    // 非自定义场景，handleAddObject 不 pushHistory
    ops.handleAddObject(makeBall({ id: 2 }))
    expect(undoStack.value).toHaveLength(0)

    ops.onUndo() // 应直接 return
    expect(state.objects).toHaveLength(2) // 未恢复
    expect(ctx.aiToast.value).toBe('')
  })
})

describe('集成：toast 反馈', () => {
  it('onUndo 设置 aiToast="已撤销" 后 1.5s 清空', () => {
    vi.useFakeTimers()
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    ops.onUndo()
    expect(ctx.aiToast.value).toBe('已撤销')
    vi.advanceTimersByTime(1500)
    expect(ctx.aiToast.value).toBe('')
    vi.useRealTimers()
  })

  it('onRedo 设置 aiToast="已重做"', () => {
    vi.useFakeTimers()
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)

    ops.handleAddObject(makeBall({ id: 2 }))
    ops.onUndo()
    ops.onRedo()
    expect(ctx.aiToast.value).toBe('已重做')
    vi.advanceTimersByTime(1500)
    expect(ctx.aiToast.value).toBe('')
    vi.useRealTimers()
  })
})
