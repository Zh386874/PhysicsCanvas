/**
 * 单元测试：useSceneIO（场景导入/导出 + 物体校验 + 深拷贝）
 *
 * 覆盖：
 * 1. deepCopyObjects：剥离运行时字段，且不改原数组
 * 2. validateObject：非法/缺省字段的规范化规则
 * 3. parseAndLoadScene：新/旧格式、非法 JSON、空物体、groundY=null 语义
 *
 * 环境：vitest node 环境，无 DOM/FileReader，需 stub FileReader 以触达 parseAndLoadScene。
 * state 为模块级单例，beforeEach 用 loadScene 复位。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { deepCopyObjects, validateObject, useSceneIO } from '../../src/composables/useSceneIO'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { clearHistory } from '../../src/composables/useHistory'
import { GROUND_DISABLED } from '../../src/constants'
import type { PhysicsObject, ParticleObject, FieldState } from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }
const GRAVITY = 9.8 * PIXELS_PER_METER

/** 构造一个含运行时字段的质点，用于 deepCopyObjects 剥离测试 */
function makeDirtyBall(): PhysicsObject {
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
    trail: [{ x: 90, y: 90 }],
    prevX: 90,
    prevY: 90,
    arcGateState: { entryOpen: true, exitOpen: false },
    constrainedArcGroupId: 999
  } as unknown as PhysicsObject
}

/** 模拟 FileReader（node 无此 API），用于触达 handleImportSceneFromFile → parseAndLoadScene */
let mockFileText = ''
class MockFileReader {
  onload: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  result: string | ArrayBuffer | null = null
  readAsText(): void {
    this.result = mockFileText
    if (this.onload) this.onload({})
  }
}

beforeEach(() => {
  vi.stubGlobal('FileReader', MockFileReader)
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearHistory()
})

function createIO() {
  const ctx = {
    state,
    aiToast: ref(''),
    selectedId: ref<number | null>(null),
    activeScene: ref('自定义'),
    saveCustomScene: vi.fn()
  }
  const io = useSceneIO(ctx)
  return { ctx, io }
}

describe('deepCopyObjects — 剥离运行时字段', () => {
  it('剥离 trail/prevX/prevY/arcGateState/constrainedArcGroupId', () => {
    const result = deepCopyObjects([makeDirtyBall()])
    const copied = result[0] as Record<string, unknown>
    expect(copied.trail).toBeUndefined()
    expect(copied.prevX).toBeUndefined()
    expect(copied.prevY).toBeUndefined()
    expect(copied.arcGateState).toBeUndefined()
    expect(copied.constrainedArcGroupId).toBeUndefined()
    // 保留持久字段
    expect(copied.id).toBe(1)
    expect(copied.type).toBe('质点')
    expect(copied.mass).toBe(1)
  })

  it('不修改原数组及原对象', () => {
    const original = makeDirtyBall()
    const arr = [original]
    deepCopyObjects(arr)
    expect((original as unknown as Record<string, unknown>).trail).toBeDefined()
    expect(arr[0]).toBe(original)
  })
})

describe('validateObject — 非法/缺省字段规范化', () => {
  it('合法质点通过，name 缺省为 未命名，含 trail:[]', () => {
    const v = validateObject({ id: 1, type: '质点', x: 0, y: 0, vx: 1, vy: 2 })
    expect(v).not.toBeNull()
    const o = v as ParticleObject
    expect(o.name).toBe('未命名')
    expect(Array.isArray(o.trail)).toBe(true)
  })

  it('null / undefined / 数组 → null', () => {
    expect(validateObject(null)).toBeNull()
    expect(validateObject(undefined)).toBeNull()
    expect(validateObject([])).toBeNull()
  })

  it('id 非 number 或 NaN → null', () => {
    expect(validateObject({ id: '1', type: '质点', x: 0, y: 0 })).toBeNull()
    expect(validateObject({ id: NaN, type: '质点', x: 0, y: 0 })).toBeNull()
  })

  it('type 非法 → null', () => {
    expect(validateObject({ id: 1, type: 'foo', x: 0, y: 0 })).toBeNull()
  })

  it('质点缺 x / 非有限 → null', () => {
    expect(validateObject({ id: 1, type: '质点', y: 0, vx: 0, vy: 0 })).toBeNull()
    expect(validateObject({ id: 1, type: '质点', x: Infinity, y: 0, vx: 0, vy: 0 })).toBeNull()
  })

  it('mass<=0 / radius<=0 重置为默认', () => {
    const v = validateObject({ id: 1, type: '质点', x: 0, y: 0, vx: 0, vy: 0, mass: 0, radius: 0 })
    const o = v as ParticleObject
    expect(o.mass).toBe(1)
    expect(o.radius).toBe(15)
  })

  it('合法线段通过，restitution/normal 使用默认值', () => {
    const v = validateObject({ id: 1, type: 'line_segment', x1: 0, y1: 0, x2: 10, y2: 0 })
    const o = v as Record<string, unknown>
    expect(o.restitution).toBe(0.3)
    expect(o.normalX).toBe(0)
    expect(o.normalY).toBe(-1)
  })

  it('线段缺 y2 / restitution 非有限 → 规范化或拒绝', () => {
    expect(validateObject({ id: 1, type: 'line_segment', x1: 0, y1: 0, x2: 10 })).toBeNull()
    const v = validateObject({
      id: 1,
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0,
      restitution: NaN
    })
    expect((v as Record<string, unknown>).restitution).toBe(0.3)
  })

  it('合法弹簧通过；k 非有限 / 缺 ballId → 拒绝', () => {
    expect(
      validateObject({
        id: 1,
        type: 'spring',
        anchorX: 0,
        anchorY: 0,
        naturalLength: 10,
        k: 50,
        ballId: 2
      })
    ).not.toBeNull()
    expect(
      validateObject({
        id: 1,
        type: 'spring',
        anchorX: 0,
        anchorY: 0,
        naturalLength: 10,
        k: NaN,
        ballId: 2
      })
    ).toBeNull()
    expect(
      validateObject({ id: 1, type: 'spring', anchorX: 0, anchorY: 0, naturalLength: 10, k: 50 })
    ).toBeNull()
  })

  it('质点/线段/弹簧之外的公共字段不受影响（line_segment 不强制 mass）', () => {
    const v = validateObject({ id: 1, type: 'line_segment', x1: 0, y1: 0, x2: 10, y2: 0 })
    const o = v as Record<string, unknown>
    expect(o.mass).toBeUndefined()
  })
})

describe('parseAndLoadScene — 导入解析（经 handleImportSceneFromFile）', () => {
  it('合法新格式导入成功，state.objects 加载，且调用 saveCustomScene', async () => {
    const { ctx, io } = createIO()
    mockFileText = JSON.stringify({
      version: 1,
      objects: [
        { id: 1, type: '质点', name: 'ball', x: 100, y: 100, vx: 0, vy: 0, mass: 2, radius: 10 }
      ],
      gravity: 490,
      groundY: 200,
      field: NONE_FIELD
    })
    const ok = await io.handleImportSceneFromFile({} as File)
    expect(ok).toBe(true)
    expect(state.objects).toHaveLength(1)
    expect((state.objects[0] as ParticleObject).mass).toBe(2)
    expect(ctx.saveCustomScene).toHaveBeenCalled()
    expect(ctx.aiToast.value).toContain('场景已导入')
  })

  it('旧格式（纯数组）导入成功', async () => {
    const { io } = createIO()
    mockFileText = JSON.stringify([{ id: 1, type: '质点', name: 'a', x: 0, y: 0, vx: 0, vy: 0 }])
    const ok = await io.handleImportSceneFromFile({} as File)
    expect(ok).toBe(true)
    expect(state.objects).toHaveLength(1)
  })

  it('非法 JSON 文本 → 失败，toast 含 导入失败', async () => {
    const { ctx, io } = createIO()
    mockFileText = 'not-valid-json{{{'
    const ok = await io.handleImportSceneFromFile({} as File)
    expect(ok).toBe(false)
    expect(ctx.aiToast.value).toContain('导入失败')
    expect(state.objects).toHaveLength(0)
  })

  it('空 objects → 失败，toast 含 场景格式校验失败', async () => {
    const { ctx, io } = createIO()
    mockFileText = JSON.stringify({ version: 1, objects: [], field: NONE_FIELD })
    const ok = await io.handleImportSceneFromFile({} as File)
    expect(ok).toBe(false)
    expect(ctx.aiToast.value).toContain('场景格式校验失败')
  })

  it('groundY=null → state.groundY === GROUND_DISABLED', async () => {
    const { io } = createIO()
    mockFileText = JSON.stringify({
      version: 1,
      objects: [{ id: 1, type: '质点', name: 'a', x: 0, y: 0, vx: 0, vy: 0 }],
      groundY: null
    })
    const ok = await io.handleImportSceneFromFile({} as File)
    expect(ok).toBe(true)
    expect(state.groundY).toBe(GROUND_DISABLED)
  })
})
