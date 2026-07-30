/**
 * 单元测试：useHistory 撤销/重做栈管理
 *
 * 模块级单例 undoStack/redoStack 需在 beforeEach 用 clearHistory 清理。
 * 覆盖：pushHistory、undo/redo、canUndo/canRedo、clearHistory、MAX_HISTORY 上限、
 *      运行时字段剥离（trail/prevX/prevY）、groundY 禁用值转 null 语义还原。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  undoStack,
  redoStack
} from '../../src/composables/useHistory'
import { GROUND_DISABLED } from '../../src/constants'
import type {
  PhysicsObject,
  ParticleObject,
  SegmentObject,
  FieldState
} from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

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

/** 构造最小合法线段 */
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

beforeEach(() => {
  clearHistory()
})

describe('useHistory — 初始状态', () => {
  it('清空后 undoStack 与 redoStack 均为空', () => {
    expect(undoStack.value).toHaveLength(0)
    expect(redoStack.value).toHaveLength(0)
    expect(canUndo()).toBe(false)
    expect(canRedo()).toBe(false)
  })

  it('空栈时 undo / redo 返回 null 且不报错', () => {
    const ball = makeBall()
    expect(undo([ball], 490, GROUND_DISABLED, NONE_FIELD)).toBeNull()
    expect(redo([ball], 490, GROUND_DISABLED, NONE_FIELD)).toBeNull()
  })
})

describe('useHistory — pushHistory', () => {
  it('pushHistory 后 undoStack +1，redoStack 清空', () => {
    const ball = makeBall()
    // 模拟一次 redoStack 有内容（来自历史 undo），新 push 应清空 redo
    pushHistory([ball], 490, GROUND_DISABLED, NONE_FIELD)
    pushHistory([ball], 490, GROUND_DISABLED, NONE_FIELD)
    expect(undoStack.value).toHaveLength(2)
    // 手动塞 redoStack 验证 pushHistory 清空行为
    ;(redoStack.value as any).push({ objects: [], gravity: 0, groundY: 0, field: NONE_FIELD })
    pushHistory([ball], 490, GROUND_DISABLED, NONE_FIELD)
    expect(redoStack.value).toHaveLength(0)
    expect(undoStack.value).toHaveLength(3)
  })

  it('快照剥离运行时字段（trail / prevX / prevY）', () => {
    const ball = makeBall({
      trail: [
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ],
      prevX: 50,
      prevY: 60
    })
    pushHistory([ball], 490, GROUND_DISABLED, NONE_FIELD)
    const snap = undoStack.value[0]
    const restored = snap.objects[0] as ParticleObject
    // snapshotFromState 通过解构剥离 trail/prevX/prevY（非赋空数组，而是字段消失）
    expect(restored.trail).toBeUndefined()
    expect(restored.prevX).toBeUndefined()
    expect(restored.prevY).toBeUndefined()
    // 业务字段保留
    expect(restored.x).toBe(100)
    expect(restored.mass).toBe(1)
  })

  it('线段对象保留所有字段（不剥离 prevX 等，因 line_segment 无此字段）', () => {
    const seg = makeSegment({ friction: 0.2, restitution: 0.5 })
    pushHistory([seg], 490, GROUND_DISABLED, NONE_FIELD)
    const snap = undoStack.value[0]
    const restored = snap.objects[0] as SegmentObject
    expect(restored.friction).toBe(0.2)
    expect(restored.restitution).toBe(0.5)
    expect(restored.x1).toBe(0)
  })

  it('groundY >= 100000 (GROUND_DISABLED) 快照存为 null（语义还原）', () => {
    const ball = makeBall()
    pushHistory([ball], 490, GROUND_DISABLED, NONE_FIELD)
    expect(undoStack.value[0].groundY).toBeNull()
  })

  it('groundY < 100000 保留原值', () => {
    const ball = makeBall()
    pushHistory([ball], 490, 300, NONE_FIELD)
    expect(undoStack.value[0].groundY).toBe(300)
  })

  it('field 字段被深拷贝（修改原 field 不影响快照）', () => {
    const ball = makeBall()
    const field: FieldState = { type: 'electric', E: { x: 100, y: 0 }, B: 0 }
    pushHistory([ball], 490, 300, field)
    // 修改原 field
    field.E.x = 999
    const snap = undoStack.value[0]
    expect(snap.field.E?.x).toBe(100) // 快照未被污染
  })

  it('objects 数组被深拷贝（修改原 objects 不影响快照）', () => {
    const ball = makeBall({ x: 100 })
    pushHistory([ball], 490, 300, NONE_FIELD)
    ball.x = 999 // 修改原对象
    const snap = undoStack.value[0]
    expect((snap.objects[0] as ParticleObject).x).toBe(100) // 快照未被污染
  })
})

describe('useHistory — undo / redo 协作', () => {
  it('undo 弹出 undoStack 顶，当前状态推入 redoStack', () => {
    const ball = makeBall({ x: 100 })
    pushHistory([ball], 490, 300, NONE_FIELD) // 保存"操作前"状态
    // 模拟编辑：球移动到 200
    ball.x = 200
    const restored = undo([ball], 490, 300, NONE_FIELD)
    expect(restored).not.toBeNull()
    expect((restored!.objects[0] as ParticleObject).x).toBe(100) // 恢复操作前
    expect(undoStack.value).toHaveLength(0) // undoStack 弹空
    expect(redoStack.value).toHaveLength(1) // 当前状态入 redo
    expect((redoStack.value[0].objects[0] as ParticleObject).x).toBe(200)
  })

  it('redo 弹出 redoStack 顶，当前状态推入 undoStack', () => {
    const ball = makeBall({ x: 100 })
    pushHistory([ball], 490, 300, NONE_FIELD)
    ball.x = 200
    undo([ball], 490, 300, NONE_FIELD) // undo 后球回到 100，redoStack 有 200
    ball.x = 100 // 模拟 undo 应用
    const restored = redo([ball], 490, 300, NONE_FIELD)
    expect(restored).not.toBeNull()
    expect((restored!.objects[0] as ParticleObject).x).toBe(200) // 恢复到 200
    expect(redoStack.value).toHaveLength(0)
    expect(undoStack.value).toHaveLength(1)
  })

  it('canUndo / canRedo 状态机正确切换', () => {
    const ball = makeBall()
    expect(canUndo()).toBe(false)
    expect(canRedo()).toBe(false)

    pushHistory([ball], 490, 300, NONE_FIELD)
    expect(canUndo()).toBe(true)
    expect(canRedo()).toBe(false) // push 后 redo 清空

    undo([ball], 490, 300, NONE_FIELD)
    expect(canUndo()).toBe(false) // undoStack 空
    expect(canRedo()).toBe(true)

    redo([ball], 490, 300, NONE_FIELD)
    expect(canUndo()).toBe(true)
    expect(canRedo()).toBe(false)
  })

  it('连续多次 undo/redo 维护栈一致性', () => {
    const ball = makeBall({ x: 0 })
    // 模拟 3 次编辑：每次 push 后修改 x
    for (let i = 1; i <= 3; i++) {
      pushHistory([ball], 490, 300, NONE_FIELD)
      ball.x = i * 100
    }
    expect(undoStack.value).toHaveLength(3)

    // undo 2 次：回到 x=100
    undo([ball], 490, 300, NONE_FIELD)
    ball.x = 200 // 应用 undo（回到 push 2 之前，即 x=200）
    undo([ball], 490, 300, NONE_FIELD)
    ball.x = 100 // 应用 undo（回到 push 1 之前，即 x=100）

    expect(undoStack.value).toHaveLength(1)
    expect(redoStack.value).toHaveLength(2)

    // redo 1 次：到 x=200
    const r = redo([ball], 490, 300, NONE_FIELD)
    expect((r!.objects[0] as ParticleObject).x).toBe(200)
  })
})

describe('useHistory — MAX_HISTORY 上限', () => {
  it('超过 50 条时丢弃最早（FIFO shift）', () => {
    const ball = makeBall()
    // 推入 51 条
    for (let i = 0; i < 51; i++) {
      pushHistory([ball], 490, 300, NONE_FIELD)
    }
    expect(undoStack.value).toHaveLength(50) // 上限 50
    // 第 51 条仍在栈顶
    expect(undoStack.value[49]).toBeDefined()
  })
})

describe('useHistory — clearHistory', () => {
  it('清空 undo/redo 双栈', () => {
    const ball = makeBall()
    pushHistory([ball], 490, 300, NONE_FIELD)
    pushHistory([ball], 490, 300, NONE_FIELD)
    undo([ball], 490, 300, NONE_FIELD) // 制造 redo
    expect(undoStack.value.length).toBeGreaterThan(0)
    expect(redoStack.value.length).toBeGreaterThan(0)

    clearHistory()
    expect(undoStack.value).toHaveLength(0)
    expect(redoStack.value).toHaveLength(0)
    expect(canUndo()).toBe(false)
    expect(canRedo()).toBe(false)
  })
})

describe('useHistory — 场景完整性', () => {
  it('快照包含 objects / gravity / groundY / field 完整字段', () => {
    const ball = makeBall()
    const field: FieldState = { type: 'magnetic', E: { x: 0, y: 0 }, B: 5 }
    pushHistory([ball], 980, 250, field)
    const snap = undoStack.value[0]
    expect(snap.objects).toHaveLength(1)
    expect(snap.gravity).toBe(980)
    expect(snap.groundY).toBe(250)
    expect(snap.field.type).toBe('magnetic')
    expect(snap.field.B).toBe(5)
  })

  it('混合物体类型快照可正确还原', () => {
    const ball = makeBall({ id: 1, x: 50 })
    const seg = makeSegment({ id: 2, x1: 0, y1: 0, x2: 200, y2: 0 })
    pushHistory([ball, seg], 490, 300, NONE_FIELD)
    const snap = undoStack.value[0]
    expect(snap.objects).toHaveLength(2)
    expect(snap.objects[0].type).toBe('质点')
    expect(snap.objects[1].type).toBe('line_segment')
  })
})
