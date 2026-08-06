/**
 * 回归测试：小球可滚离线段/传送带边缘（不被端点卡住）
 *
 * 问题描述：小球在传送带（线段）上运动至边缘时，被线段端点"卡住"，
 *           无法脱离传送带边界。
 * 根因：detectSegmentCollision 距离命中分支把最近点钳制在线段内（t∈[0,1]），
 *       当球心投影越过端点后仍 dist<=radius 判定碰撞，把球回拉到端点表面。
 * 设定：线段支撑范围仅在球心投影落在线段本体（t∈[0,1]）；越过端点应脱离。
 *
 * 本回归测试守护：
 * - 球投影越过右/左端点（t>1 / t<0）→ 不碰撞，可脱离
 * - 球投影在线段内部（t∈[0,1]）→ 仍被支撑（防过度修正）
 * - 球投影恰在端点（t=1，停靠角落）→ 仍被支撑
 * - 传送带（带 velocity）上球滚至边缘 → 可脱离
 * - 播放时序：传送带上球最终滚出右端边界
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { detectSegmentCollision } from '../../src/composables/useCollision'
import { state, loadScene, updatePhysics, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearSnapshots } from '../../src/composables/useSnapshotManager'
import { GROUND_DISABLED } from '../../src/constants'
import type { FieldState, ParticleObject, SegmentObject } from '../../src/composables/usePhysics'

const GRAVITY = 9.8 * PIXELS_PER_METER // 490
const DT = 1 / 60
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 50,
    y: -3,
    vx: 0,
    vy: 0,
    radius: 5,
    color: '#60a5fa',
    trail: [],
    prevX: 50,
    prevY: -3,
    ...over
  }
}

function makeSegment(over: Partial<SegmentObject> = {}): SegmentObject {
  return {
    id: 2,
    name: 'belt',
    type: 'line_segment',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    normalX: 0,
    normalY: -1,
    friction: 0.2,
    ...over
  }
}

describe('回归：线段边缘不卡住小球，可自由滚离', () => {
  beforeEach(() => {
    loadScene([], [], NONE_FIELD, GRAVITY, null) // 清空场景
    clearSnapshots()
  })

  it('球投影越过右端点（t>1）→ 不碰撞，不被端点拉回', () => {
    const ball = makeBall({ x: 101, y: -4 }) // 距右端点 dist≈4.12<=5，但投影已越界
    const seg = makeSegment()
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(false)
    expect(ball.x).toBe(101) // 未被拉回端点
  })

  it('球投影越过左端点（t<0）→ 不碰撞', () => {
    const ball = makeBall({ x: -1, y: -4 })
    const seg = makeSegment()
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(false)
    expect(ball.x).toBe(-1)
  })

  it('球投影在线段内部（t∈[0,1]）→ 仍被支撑', () => {
    const ball = makeBall({ x: 50, y: -3 })
    const seg = makeSegment()
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(true)
    expect(ball.y).toBeCloseTo(-5, 5) // 修正到 y - radius*ny = 5*(-1) = -5
  })

  it('球投影恰在端点（t=1，停靠角落）→ 仍被支撑', () => {
    const ball = makeBall({ x: 100, y: -3 })
    const seg = makeSegment()
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(true)
  })

  it('传送带（带速度）上球滚至边缘 → 可脱离', () => {
    const ball = makeBall({ x: 101, y: -4, vx: 50 })
    const seg = makeSegment({ velocity: { x: 50, y: 0 } })
    const hit = detectSegmentCollision(ball, seg, 0.016, 490)
    expect(hit).toBe(false)
    expect(ball.x).toBe(101)
  })

  it('播放时序：传送带上球最终滚出右端边界', () => {
    const belt: SegmentObject = {
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
      restitution: 0.3,
      velocity: { x: 50, y: 0 } // 传送带表面速度向右
    }
    const ball = makeBall({ x: 95, y: 195, vx: 100, vy: 0, radius: 5 })
    loadScene([ball, belt], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    state.isPlaying = true
    for (let i = 0; i < 120; i++) updatePhysics(DT)
    const b = state.objects.find((o) => o.id === 1) as ParticleObject
    expect(b.x).toBeGreaterThan(100) // 已滚出右端边界
  })
})
