/**
 * 单元测试：useSceneBuilder（AI 场景 → 内部物理状态）
 *
 * 覆盖 buildScene 各分支：
 * 1. ball 坐标/半径/速度换算（米→像素、y 翻转）
 * 2. platform 法线朝向、传送带/可移动线段颜色与 velocity
 * 3. arc 展开为 20 段、groupId 一致、缺口角度取反、仅首段带 arcGateState
 * 4. spring 引用解析、naturalLength 下限、未知 ballId 丢弃
 * 5. 空 objects 失败
 * 6. field/gravity/groundY 换算
 *
 * convertObject/expandArcToSegments/convertSpring 为模块私有，统一经 buildScene + 检查
 * 模块级单例 state 断言（沿用 plate-definition.test 模式）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildScene } from '../../src/composables/useSceneBuilder'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearHistory } from '../../src/composables/useHistory'
import { GROUND_DISABLED } from '../../src/constants'
import type { ParsedProblem } from '../../src/composables/useAIParser'
import type {
  PhysicsObject,
  ParticleObject,
  SegmentObject,
  SpringObject,
  FieldState
} from '../../src/composables/usePhysics'

const SCALE = PIXELS_PER_METER
const CANVAS_MARGIN = 60
const GROUND_BASELINE = 400
const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }

beforeEach(() => {
  loadScene([], [], NONE_FIELD, 9.8 * SCALE, GROUND_DISABLED)
  clearHistory()
})

function findByName(name: string): PhysicsObject | undefined {
  return state.objects.find((o) => o.name === name)
}

describe('buildScene — ball 质点转换', () => {
  it('坐标/半径/速度按 PIXELS_PER_METER 换算，y 翻转', () => {
    const problem: ParsedProblem = {
      topic: 'projectile',
      objects: [
        {
          id: 'A',
          type: 'ball',
          mass: 2,
          radius: 0.2,
          initialPosition: { x: 0, y: 5 },
          initialVelocity: { x: 3, y: 0 }
        }
      ],
      field: NONE_FIELD
    }
    const result = buildScene(problem)
    expect(result.success).toBe(true)
    const ball = findByName('A') as ParticleObject
    expect(ball).toBeDefined()
    expect(ball.radius).toBe(Math.max(0.2 * SCALE, 4))
    expect(ball.x).toBeCloseTo(0 * SCALE + CANVAS_MARGIN, 1)
    expect(ball.y).toBeCloseTo(GROUND_BASELINE - (5 + 0.2) * SCALE, 1)
    expect(ball.vx).toBeCloseTo(3 * SCALE, 1)
    expect(ball.vy).toBeCloseTo(0, 1)
    expect(ball.mass).toBe(2)
  })
})

describe('buildScene — platform 线段转换', () => {
  it('普通平台法线指向上方（normalY < 0），默认灰色', () => {
    const problem: ParsedProblem = {
      topic: 'slope',
      objects: [
        {
          id: 'p',
          type: 'platform',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 2, y: 0 },
          friction: 0.3
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const seg = findByName('p') as SegmentObject
    expect(seg).toBeDefined()
    expect(seg.normalY).toBeLessThan(0)
    expect(seg.color).toBe('#94a3b8')
    expect(seg.friction).toBe(0.3)
    expect(seg.velocity).toBeUndefined()
  })

  it('传送带（beltVelocity）：青色 + velocity 已换算（y 翻转）', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        {
          id: 'belt',
          type: 'platform',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 2, y: 0 },
          beltVelocity: { x: 1, y: 0 }
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const seg = findByName('belt') as SegmentObject
    expect(seg.color).toBe('#0891b2')
    expect(seg.velocity!.x).toBeCloseTo(1 * SCALE, 6)
    expect(seg.velocity!.y).toBeCloseTo(0, 6)
  })

  it('可移动线段（movable）：红色 + velocity 初始静止 + mass', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        {
          id: 'mv',
          type: 'platform',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 2, y: 0 },
          movable: true,
          mass: 3
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const seg = findByName('mv') as SegmentObject
    expect(seg.color).toBe('#dc2626')
    expect(seg.movable).toBe(true)
    expect(seg.mass).toBe(3)
    expect(seg.velocity).toEqual({ x: 0, y: 0 })
  })
})

describe('buildScene — arc 圆弧展开', () => {
  it('展开为 20 段，groupId 一致，每段带 arc，角度取反', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        {
          id: 'arc',
          type: 'arc',
          center: { x: 0, y: 0 },
          arcRadius: 1,
          startAngle: 0.5,
          endAngle: Math.PI,
          friction: 0
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const segs = state.objects.filter((o) => o.name.startsWith('arc-')) as SegmentObject[]
    expect(segs).toHaveLength(20)
    const firstGroupId = segs[0].groupId
    expect(segs.every((s) => s.groupId === firstGroupId)).toBe(true)
    expect(segs.every((s) => s.arc !== undefined)).toBe(true)
    expect(segs[0].arc!.startAngle).toBeCloseTo(-0.5, 6)
    expect(segs[0].arc!.endAngle).toBeCloseTo(-Math.PI, 6)
  })

  it('带出入口缺口时，仅首段携带 arcGateState 与 constraintEnabled', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        {
          id: 'ring',
          type: 'arc',
          center: { x: 0, y: 0 },
          arcRadius: 1,
          startAngle: 0,
          endAngle: 2 * Math.PI,
          entryGap: { centerAngle: 0, halfWidth: 0.3, initiallyOpen: true },
          exitGap: { centerAngle: Math.PI, halfWidth: 0.3, initiallyOpen: false }
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const segs = state.objects.filter((o) => o.name.startsWith('ring-')) as SegmentObject[]
    expect(segs).toHaveLength(20)
    expect(segs[0].arcGateState).toBeDefined()
    expect(segs[0].arcGateState!.entryOpen).toBe(true)
    expect(segs[0].arcGateState!.exitOpen).toBe(false)
    expect(segs[0].constraintEnabled).toBe(true)
    // 角度取反：entryGap.centerAngle 0→0，exitGap.centerAngle PI→-PI
    expect(segs[0].arc!.exitGap!.centerAngle).toBeCloseTo(-Math.PI, 6)
    // 非首段不携带运行时状态与约束开关
    expect(segs[1].arcGateState).toBeUndefined()
    expect(segs[1].constraintEnabled).toBeUndefined()
  })
})

describe('buildScene — spring 弹簧转换', () => {
  it('引用已存在 ballId：ballId 映射为内部 id，naturalLength 有下限', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        { id: 'A', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 1 } },
        {
          id: 's',
          type: 'spring',
          anchor: { x: 0, y: 0 },
          ballId: 'A',
          naturalLength: 1,
          k: 50
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    const ball = findByName('A') as ParticleObject
    const spring = findByName('s') as SpringObject
    expect(spring).toBeDefined()
    expect(spring.ballId).toBe(ball.id)
    expect(spring.naturalLength).toBeCloseTo(Math.max(1 * SCALE, 10), 1)
    expect(spring.k).toBe(50)
  })

  it('引用不存在的 ballId：弹簧被丢弃', () => {
    const problem: ParsedProblem = {
      topic: 'custom',
      objects: [
        { id: 'A', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 1 } },
        {
          id: 's',
          type: 'spring',
          anchor: { x: 0, y: 0 },
          ballId: 'ZZZ',
          naturalLength: 1,
          k: 50
        }
      ],
      field: NONE_FIELD
    }
    buildScene(problem)
    // 弹簧未创建，仅 ball 存在
    expect(state.objects.some((o) => o.name === 's')).toBe(false)
    expect(state.objects).toHaveLength(1)
  })
})

describe('buildScene — 失败与全局参数', () => {
  it('空 objects → success:false', () => {
    const problem: ParsedProblem = { topic: 'custom', objects: [], field: NONE_FIELD }
    const result = buildScene(problem)
    expect(result.success).toBe(false)
    expect(result.message).toContain('AI 未识别到任何物体')
  })

  it('field/gravity/groundY 换算（E 缩放、y 翻转；g 缩放；groundY 翻转）', () => {
    const problem: ParsedProblem = {
      topic: 'electric_deflection',
      objects: [{ id: 'A', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 1 } }],
      field: { type: 'electric', E: { x: 1, y: 2 }, B: 0 },
      gravity: 9.8,
      groundY: 0
    }
    buildScene(problem)
    expect(state.field.E.x).toBeCloseTo(1 * SCALE, 1)
    expect(state.field.E.y).toBeCloseTo(-2 * SCALE, 1)
    expect(state.gravity).toBeCloseTo(9.8 * SCALE, 1)
    expect(state.groundY).toBeCloseTo(GROUND_BASELINE - 0 * SCALE, 1)
  })

  it('groundY=null → 地面被禁用（state.groundY 为 GROUND_DISABLED）', () => {
    const problem: ParsedProblem = {
      topic: 'magnetic_circle',
      objects: [{ id: 'A', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 1 } }],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.5 },
      groundY: null
    }
    buildScene(problem)
    expect(state.groundY).toBe(GROUND_DISABLED)
  })
})
