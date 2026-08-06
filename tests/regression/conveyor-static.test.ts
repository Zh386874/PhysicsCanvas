/**
 * 回归测试：传送带不自身移动
 *
 * 问题描述：传送带（velocity && !movable）在播放时出现"自身平移"的异常。
 * 根因：usePhysics 曾把 velocity 当作传送带自身位移速度，逐子平移两端点。
 * 设定：传送带 velocity 仅表示皮带表面速度（用于摩擦力相对速度计算），
 *       传送带本身是固定静止的线段平台，位置不应改变。
 *
 * 本回归测试守护：
 * - 传送带（velocity && !movable）播放后两端点坐标保持不变
 * - 传送带 velocity（表面速度）仍保留，供摩擦力使用
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { state, loadScene, updatePhysics, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearSnapshots } from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED } from '../../src/constants'
import type { FieldState, SegmentObject } from '../../src/composables/usePhysics'

const GRAVITY = 9.8 * PIXELS_PER_METER // 490
const DT = 1 / 60
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

/** 构造水平传送带（velocity && !movable） */
function makeBelt(over: Partial<SegmentObject> = {}): SegmentObject {
  return {
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
    velocity: { x: 50, y: 0 }, // 皮带表面速度 50px/s，非 movable
    ...over
  }
}

describe('回归：传送带不自身移动', () => {
  beforeEach(() => {
    loadScene([], [], NONE_FIELD, GRAVITY, null) // 清空场景
    clearSnapshots()
  })

  it('传送带播放后两端点坐标保持不变', () => {
    const belt = makeBelt()
    loadScene([belt], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    const seg = state.objects[0] as SegmentObject
    const x1Before = seg.x1
    const x2Before = seg.x2
    const y1Before = seg.y1
    const y2Before = seg.y2
    // 播放多个子步（多次 updatePhysics）
    for (let i = 0; i < 60; i++) updatePhysics(DT)
    const after = state.objects[0] as SegmentObject
    expect(after.x1).toBeCloseTo(x1Before, 5)
    expect(after.x2).toBeCloseTo(x2Before, 5)
    expect(after.y1).toBeCloseTo(y1Before, 5)
    expect(after.y2).toBeCloseTo(y2Before, 5)
  })

  it('传送带 velocity（表面速度）仍保留，供摩擦力使用', () => {
    const belt = makeBelt()
    loadScene([belt], [], NONE_FIELD, 0, GROUND_DISABLED)
    state.isPlaying = true
    updatePhysics(DT)
    const seg = state.objects[0] as SegmentObject
    expect(seg.velocity).toEqual({ x: 50, y: 0 })
  })
})
