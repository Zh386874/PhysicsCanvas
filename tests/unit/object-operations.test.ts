/**
 * 单元测试：useObjectOperations 物体操作工厂
 *
 * 工厂函数接受 ObjectOpsContext（含 ref），测试需 mock saveCustomScene。
 * state 为 usePhysics 模块级单例，需在 beforeEach 用 loadScene 重置 + clearHistory 清理。
 *
 * 覆盖：onSelectObject/onSelectGroup、handleBatchUpdate、handleAddObject、
 *      handleUpdateObject、handleRemoveObject（含弧线整组删除/弹簧级联删除）、
 *      handleUpdateParams（m/s→像素转换）、onDeleteKey、onObjectUpdate、
 *      onUndo/onRedo、selectedObject 计算属性。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { useObjectOperations } from '../../src/composables/useObjectOperations'
import { clearHistory } from '../../src/composables/useHistory'
import { GROUND_DISABLED } from '../../src/constants'
import type {
  PhysicsObject,
  ParticleObject,
  SegmentObject,
  SpringObject,
  FieldState
} from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }
const GRAVITY = 9.8 * PIXELS_PER_METER

/** 构造最小合法质点 */
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

/** 构造弧线段（共享 groupId） */
function makeArcSegment(
  id: number,
  groupId: number,
  over: Partial<SegmentObject> = {}
): SegmentObject {
  return {
    id,
    name: `arc-${id}`,
    type: 'line_segment',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    normalX: 0,
    normalY: -1,
    groupId,
    color: '#a78bfa',
    ...over
  }
}

/** 构造弹簧 */
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

/** 构造上下文（含 mock saveCustomScene） */
function makeContext(activeScene = '自定义', mode: 'live' | 'replay' = 'live') {
  return {
    activeScene: ref(activeScene),
    mode: ref(mode),
    aiToast: ref(''),
    selectedId: ref<number | null>(null),
    selectedIds: ref<number[]>([]),
    saveCustomScene: vi.fn()
  }
}

beforeEach(() => {
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearHistory()
})

describe('useObjectOperations — selectedObject 计算属性', () => {
  it('根据 selectedId 返回对应物体', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2, name: 'ball2' })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedId.value = 2
    const ops = useObjectOperations(ctx)
    expect(ops.selectedObject.value?.id).toBe(2)
    expect(ops.selectedObject.value?.name).toBe('ball2')
  })

  it('selectedId 为 null 时返回 undefined', () => {
    const ctx = makeContext()
    ctx.selectedId.value = null
    const ops = useObjectOperations(ctx)
    expect(ops.selectedObject.value).toBeUndefined()
  })

  it('selectedId 不匹配任何物体时返回 undefined', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedId.value = 999
    const ops = useObjectOperations(ctx)
    expect(ops.selectedObject.value).toBeUndefined()
  })
})

describe('useObjectOperations — onObjectUpdate', () => {
  it('通过 id 查找并 Object.assign 更新属性', () => {
    const ball = makeBall({ id: 1, x: 100 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ops = useObjectOperations(makeContext())
    ops.onObjectUpdate({ id: 1, x: 200, y: 300 })
    expect(state.objects[0].x).toBe(200)
    expect((state.objects[0] as ParticleObject).y).toBe(300)
  })

  it('不存在的 id 不报错', () => {
    const ops = useObjectOperations(makeContext())
    expect(() => ops.onObjectUpdate({ id: 999, x: 100 })).not.toThrow()
  })
})

describe('useObjectOperations — onSelectObject / onSelectGroup', () => {
  it('onSelectObject 设置 selectedId 并清空多选', () => {
    const ctx = makeContext()
    ctx.selectedIds.value = [1, 2, 3]
    const ops = useObjectOperations(ctx)
    ops.onSelectObject(42)
    expect(ctx.selectedId.value).toBe(42)
    expect(ctx.selectedIds.value).toEqual([])
  })

  it('onSelectGroup 设置多选并把首项置 selectedId', () => {
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.onSelectGroup([10, 20, 30])
    expect(ctx.selectedIds.value).toEqual([10, 20, 30])
    expect(ctx.selectedId.value).toBe(10)
  })

  it('onSelectGroup 空数组清空所有选中', () => {
    const ctx = makeContext()
    ctx.selectedId.value = 5
    ctx.selectedIds.value = [1, 2]
    const ops = useObjectOperations(ctx)
    ops.onSelectGroup([])
    expect(ctx.selectedIds.value).toEqual([])
    expect(ctx.selectedId.value).toBeNull()
  })
})

describe('useObjectOperations — handleBatchUpdate', () => {
  it('批量更新多个物体的属性', () => {
    const ball1 = makeBall({ id: 1, x: 0 })
    const ball2 = makeBall({ id: 2, x: 0 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleBatchUpdate([
      { id: 1, props: { x: 100, y: 50 } },
      { id: 2, props: { x: 200 } }
    ])
    expect(state.objects[0].x).toBe(100)
    expect((state.objects[0] as ParticleObject).y).toBe(50)
    expect(state.objects[1].x).toBe(200)
  })

  it('自定义场景下推入历史', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.handleBatchUpdate([{ id: 1, props: { x: 100 } }])
    // 历史已推入（间接验证：undo 能恢复）
    ops.onUndo()
    expect(state.objects[0].x).toBe(100) // 历史里存的 x=100 (push 时的状态)
  })

  it('非自定义场景下不推入历史', () => {
    const ball = makeBall({ id: 1, x: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('斜面')
    const ops = useObjectOperations(ctx)
    ops.handleBatchUpdate([{ id: 1, props: { x: 100 } }])
    ops.onUndo() // 非自定义场景直接 return，不执行 undo
    expect(state.objects[0].x).toBe(100) // 未恢复
  })

  it('调用 saveCustomScene', () => {
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleBatchUpdate([])
    expect(ctx.saveCustomScene).toHaveBeenCalled()
  })
})

describe('useObjectOperations — handleAddObject', () => {
  it('添加物体到 state 并自动选中', () => {
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    const ball = makeBall({ id: 42 })
    ops.handleAddObject(ball)
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(42)
    expect(ctx.selectedId.value).toBe(42)
  })

  it('自定义场景下推入历史', () => {
    const ball1 = makeBall({ id: 1 })
    loadScene([ball1], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.handleAddObject(makeBall({ id: 2 }))
    expect(state.objects).toHaveLength(2)
    // undo 后回到 push 时的状态（仅 ball1）
    ops.onUndo()
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(1)
  })

  it('调用 saveCustomScene', () => {
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleAddObject(makeBall({ id: 1 }))
    expect(ctx.saveCustomScene).toHaveBeenCalled()
  })
})

describe('useObjectOperations — handleUpdateObject', () => {
  it('拖拽中实时更新不推入历史（由调用方在拖拽结束时推入）', () => {
    const ball = makeBall({ id: 1, x: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleUpdateObject({ id: 1, props: { x: 500 } })
    expect(state.objects[0].x).toBe(500)
    // 历史应为空（未推入）
    ops.onUndo()
    // undo 无历史可回退，state 不变
    expect(state.objects[0].x).toBe(500)
  })
})

describe('useObjectOperations — handleRemoveObject', () => {
  it('删除单个质点', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedId.value = 1
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(1)
    expect(state.objects).toHaveLength(0)
    expect(ctx.selectedId.value).toBeNull()
  })

  it('删除弧线段时整组删除（同 groupId 全删）', () => {
    const seg1 = makeArcSegment(10, 500)
    const seg2 = makeArcSegment(11, 500)
    const seg3 = makeArcSegment(12, 500)
    const other = makeArcSegment(13, 999)
    loadScene([seg1, seg2, seg3, other], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(10) // 删除 groupId=500 的弧线段
    expect(state.objects).toHaveLength(1) // 仅剩 groupId=999 的段
    expect(state.objects[0].id).toBe(13)
  })

  it('删除质点时级联删除连接的弹簧', () => {
    const ball = makeBall({ id: 1 })
    const spring = makeSpring({ id: 100, ballId: 1 })
    loadScene([ball, spring as unknown as PhysicsObject], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(1)
    expect(state.objects).toHaveLength(0) // 球和弹簧都删
  })

  it('删除其他质点时不影响连接别的球的弹簧', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    const spring = makeSpring({ id: 100, ballId: 2 })
    loadScene(
      [ball1, ball2, spring as unknown as PhysicsObject],
      [],
      NONE_FIELD,
      GRAVITY,
      GROUND_DISABLED
    )
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(1) // 删 ball1，不影响 ball2 的弹簧
    expect(state.objects).toHaveLength(2)
    expect(state.objects[0].id).toBe(2)
    expect(state.objects[1].id).toBe(100)
  })

  it('selectedIds 中包含被删物体 id 时同步移除', () => {
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedIds.value = [1, 2, 3]
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(1)
    expect(ctx.selectedIds.value).toEqual([2, 3])
  })

  it('自定义场景下推入历史', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.handleRemoveObject(2)
    expect(state.objects).toHaveLength(1)
    ops.onUndo()
    expect(state.objects).toHaveLength(2)
  })
})

describe('useObjectOperations — handleUpdateParams', () => {
  it('应用到第一个质点：mass / charge 原值，vx 转像素', () => {
    const ball1 = makeBall({ id: 1, type: '质点', mass: 1, vx: 0, charge: 0 })
    const ball2 = makeBall({ id: 2, type: '质点', mass: 5, vx: 0, charge: 0 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    const ops = useObjectOperations(ctx)
    ops.handleUpdateParams({ mass: 3, vx: 2, charge: -1 })
    // 仅应用到第一个质点（ball1）
    expect((state.objects[0] as ParticleObject).mass).toBe(3)
    expect((state.objects[0] as ParticleObject).vx).toBe(2 * PIXELS_PER_METER)
    expect((state.objects[0] as ParticleObject).charge).toBe(-1)
    // ball2 不变
    expect((state.objects[1] as ParticleObject).mass).toBe(5)
  })

  it('部分字段缺失时仅更新提供的字段', () => {
    const ball = makeBall({ id: 1, mass: 2, vx: 100, charge: 0.5 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ops = useObjectOperations(makeContext())
    ops.handleUpdateParams({ mass: 5 })
    expect((state.objects[0] as ParticleObject).mass).toBe(5)
    expect((state.objects[0] as ParticleObject).vx).toBe(100) // 不变
    expect((state.objects[0] as ParticleObject).charge).toBe(0.5) // 不变
  })

  it('无质点时不报错', () => {
    const seg = makeArcSegment(1, 1)
    loadScene([seg], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ops = useObjectOperations(makeContext())
    expect(() => ops.handleUpdateParams({ mass: 1, vx: 1, charge: 1 })).not.toThrow()
  })
})

describe('useObjectOperations — onDeleteKey', () => {
  it('非自定义场景直接返回', () => {
    const ctx = makeContext('斜面')
    ctx.selectedId.value = 1
    const ops = useObjectOperations(ctx)
    expect(() => ops.onDeleteKey()).not.toThrow()
  })

  it('replay 模式直接返回', () => {
    const ctx = makeContext('自定义', 'replay')
    ctx.selectedId.value = 1
    const ops = useObjectOperations(ctx)
    expect(() => ops.onDeleteKey()).not.toThrow()
  })

  it('selectedIds 多选时批量删除（含弧线整组）', () => {
    const ball = makeBall({ id: 1 })
    const seg1 = makeArcSegment(10, 500)
    const seg2 = makeArcSegment(11, 500)
    const otherSeg = makeArcSegment(20, 999)
    loadScene([ball, seg1, seg2, otherSeg], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedIds.value = [10] // 选中弧线组中一条
    const ops = useObjectOperations(ctx)
    ops.onDeleteKey()
    // 整组（10, 11）删除，其他保留
    const remaining = state.objects.map((o) => o.id)
    expect(remaining).toEqual(expect.arrayContaining([1, 20]))
    expect(remaining).not.toContain(10)
    expect(remaining).not.toContain(11)
    expect(ctx.selectedIds.value).toEqual([])
  })

  it('selectedId 单选时调用 handleRemoveObject', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedId.value = 1
    const ops = useObjectOperations(ctx)
    ops.onDeleteKey()
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(2)
    expect(ctx.selectedId.value).toBeNull()
  })

  it('无选中时不报错', () => {
    const ctx = makeContext()
    ctx.selectedId.value = null
    ctx.selectedIds.value = []
    const ops = useObjectOperations(ctx)
    expect(() => ops.onDeleteKey()).not.toThrow()
  })

  it('删除后若 selectedId 不再存在则清空', () => {
    const ball1 = makeBall({ id: 1 })
    const ball2 = makeBall({ id: 2 })
    loadScene([ball1, ball2], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext()
    ctx.selectedIds.value = [1]
    const ops = useObjectOperations(ctx)
    // selectedId 设为不存在的 id，删除后应被清空
    ctx.selectedId.value = 1
    ops.onDeleteKey()
    // selectedId 已不存在，应被清空
    expect(ctx.selectedId.value).toBeNull()
  })
})

describe('useObjectOperations — onUndo / onRedo', () => {
  it('onUndo 恢复到上一状态并显示 toast', () => {
    vi.useFakeTimers()
    const ball = makeBall({ id: 1, x: 0 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.handleAddObject(makeBall({ id: 2, x: 100 }))
    expect(state.objects).toHaveLength(2)
    ops.onUndo()
    expect(state.objects).toHaveLength(1)
    expect(state.objects[0].id).toBe(1)
    expect(ctx.aiToast.value).toBe('已撤销')
    vi.advanceTimersByTime(2000)
    expect(ctx.aiToast.value).toBe('')
    vi.useRealTimers()
  })

  it('onRedo 重做并显示 toast', () => {
    vi.useFakeTimers()
    const ball = makeBall({ id: 1 })
    loadScene([ball], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.handleAddObject(makeBall({ id: 2 }))
    ops.onUndo()
    expect(state.objects).toHaveLength(1)
    ops.onRedo()
    expect(state.objects).toHaveLength(2)
    expect(ctx.aiToast.value).toBe('已重做')
    vi.advanceTimersByTime(2000)
    expect(ctx.aiToast.value).toBe('')
    vi.useRealTimers()
  })

  it('非自定义场景 onUndo/onRedo 直接返回', () => {
    const ctx = makeContext('斜面')
    const ops = useObjectOperations(ctx)
    // 无 pushHistory，undo 应无操作
    expect(() => ops.onUndo()).not.toThrow()
    expect(() => ops.onRedo()).not.toThrow()
    expect(ctx.aiToast.value).toBe('')
  })

  it('replay 模式 onUndo/onRedo 直接返回', () => {
    const ctx = makeContext('自定义', 'replay')
    const ops = useObjectOperations(ctx)
    ops.handleAddObject(makeBall({ id: 2 })) // 推入历史
    expect(() => ops.onUndo()).not.toThrow() // replay 模式直接返回
    expect(state.objects).toHaveLength(1) // 未撤销
    expect(ctx.aiToast.value).toBe('')
  })

  it('无历史可撤销时 onUndo 无操作', () => {
    const ctx = makeContext('自定义')
    const ops = useObjectOperations(ctx)
    ops.onUndo()
    expect(ctx.aiToast.value).toBe('') // 未设置 toast
  })
})
