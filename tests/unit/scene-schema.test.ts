/**
 * 单元测试：sceneSchema（Zod 场景导入校验）
 *
 * 覆盖 SceneDataSchema / LegacySceneSchema / SceneObjectSchema：
 * 1. 合法新/旧格式通过
 * 2. min(1)：空 objects 拒绝
 * 3. finite()：NaN / Infinity 拒绝
 * 4. positive()：mass/radius 为 0 或负拒绝
 * 5. default 值（name/mass/radius/vx/vy/restitution/normal）
 * 6. discriminatedUnion 类型分支
 */
import { describe, it, expect } from 'vitest'
import {
  SceneDataSchema,
  LegacySceneSchema,
  SceneObjectSchema
} from '../../src/schemas/sceneSchema'

const validParticle = { id: 1, type: '质点', x: 0, y: 0 }

describe('SceneDataSchema — 新格式', () => {
  it('合法场景通过', () => {
    const r = SceneDataSchema.safeParse({
      version: 1,
      objects: [validParticle],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    })
    expect(r.success).toBe(true)
  })

  it('空 objects 拒绝（min(1)）', () => {
    const r = SceneDataSchema.safeParse({ version: 1, objects: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('至少包含一个物体'))).toBe(true)
    }
  })

  it('坐标含 NaN / Infinity 拒绝（finite()）', () => {
    expect(
      SceneDataSchema.safeParse({ objects: [{ id: 1, type: '质点', x: NaN, y: 0 }] }).success
    ).toBe(false)
    expect(
      SceneDataSchema.safeParse({ objects: [{ id: 1, type: '质点', x: Infinity, y: 0 }] }).success
    ).toBe(false)
  })

  it('mass / radius 为 0 或负数拒绝', () => {
    expect(
      SceneDataSchema.safeParse({ objects: [{ id: 1, type: '质点', x: 0, y: 0, mass: 0 }] }).success
    ).toBe(false)
    expect(
      SceneDataSchema.safeParse({ objects: [{ id: 1, type: '质点', x: 0, y: 0, radius: -1 }] })
        .success
    ).toBe(false)
  })

  it('缺省字段应用默认值', () => {
    const r = SceneDataSchema.safeParse({ objects: [validParticle] })
    expect(r.success).toBe(true)
    if (r.success) {
      const o = r.data.objects[0]
      expect(o.name).toBe('未命名')
      expect(o.mass).toBe(1)
      expect(o.radius).toBe(15)
      expect(o.vx).toBe(0)
      expect(o.vy).toBe(0)
    }
  })
})

describe('SceneObjectSchema — discriminatedUnion 类型分支', () => {
  it('质点 / 线段 / 弹簧 各自合法', () => {
    expect(SceneObjectSchema.safeParse(validParticle).success).toBe(true)
    expect(
      SceneObjectSchema.safeParse({ id: 1, type: 'line_segment', x1: 0, y1: 0, x2: 10, y2: 0 })
        .success
    ).toBe(true)
    expect(
      SceneObjectSchema.safeParse({
        id: 1,
        type: 'spring',
        anchorX: 0,
        anchorY: 0,
        naturalLength: 10,
        k: 50,
        ballId: 2.0
      }).success
    ).toBe(true)
  })

  it('非法 type 拒绝', () => {
    expect(SceneObjectSchema.safeParse({ id: 1, type: 'foo', x: 0, y: 0 }).success).toBe(false)
  })

  it('线段缺 y2 拒绝', () => {
    expect(
      SceneObjectSchema.safeParse({ id: 1, type: 'line_segment', x1: 0, y1: 0, x2: 10 }).success
    ).toBe(false)
  })

  it('线段缺省字段应用默认值（restitution/normal）', () => {
    const r = SceneObjectSchema.safeParse({
      id: 1,
      type: 'line_segment',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.restitution).toBe(0.3)
      expect(r.data.normalX).toBe(0)
      expect(r.data.normalY).toBe(-1)
    }
  })
})

describe('LegacySceneSchema — 旧格式（纯数组）', () => {
  it('合法数组通过', () => {
    expect(LegacySceneSchema.safeParse([validParticle]).success).toBe(true)
  })

  it('空数组拒绝', () => {
    expect(LegacySceneSchema.safeParse([]).success).toBe(false)
  })

  it('含非法物体拒绝', () => {
    expect(LegacySceneSchema.safeParse([validParticle, { id: 'x', type: '质点' }]).success).toBe(
      false
    )
  })
})
