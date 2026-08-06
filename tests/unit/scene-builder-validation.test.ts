/**
 * 单元测试：buildScene 前置物理量校验（非法输入不进入 loadScene，维持 state 不变）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildScene } from '../../src/composables/useSceneBuilder'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearHistory } from '../../src/composables/useHistory'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParsedProblem } from '../../src/types/aiProblem'
import type { FieldState } from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

beforeEach(() => {
  loadScene([], [], NONE_FIELD, 9.8 * PIXELS_PER_METER, GROUND_DISABLED)
  clearHistory()
})

function baseProblem(): ParsedProblem {
  return {
    topic: 'projectile',
    objects: [{ id: 'A', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 1 } }],
    field: NONE_FIELD
  }
}

describe('buildScene — 非法物理量被拦截', () => {
  it('质量 0 → success:false 且不污染 state', () => {
    const p = baseProblem()
    p.objects[0] = { ...p.objects[0], type: 'ball', mass: 0 }
    const result = buildScene(p)
    expect(result.success).toBe(false)
    expect(result.message).toContain('质量非法')
    // 校验失败不应调用 loadScene，state.objects 仍为空
    expect(state.objects).toHaveLength(0)
  })

  it('负质量 → success:false', () => {
    const p = baseProblem()
    p.objects[0] = { ...p.objects[0], type: 'ball', mass: -2 }
    expect(buildScene(p).success).toBe(false)
  })

  it('半径 0 → success:false', () => {
    const p = baseProblem()
    p.objects[0] = { ...p.objects[0], type: 'ball', radius: 0 }
    expect(buildScene(p).success).toBe(false)
  })

  it('非有限重力 → success:false', () => {
    const p = baseProblem()
    p.gravity = Infinity
    expect(buildScene(p).success).toBe(false)
  })

  it('合法输入 → success:true 且写入 state', () => {
    const result = buildScene(baseProblem())
    expect(result.success).toBe(true)
    expect(state.objects).toHaveLength(1)
  })
})
