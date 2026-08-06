/**
 * 单元测试：aiSchema — zod 校验（parseAIProblem / sanitizeParsedProblem / validateParsedProblem）
 */
import { describe, it, expect } from 'vitest'
import {
  parseAIProblem,
  sanitizeParsedProblem,
  validateParsedProblem
} from '../../src/utils/aiSchema'
import type { ParsedProblem } from '../../src/types/aiProblem'

const VALID_PROBLEM = {
  title: '测试题',
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
  field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
  gravity: 9.8,
  groundY: 0
}

describe('parseAIProblem — 合法输入', () => {
  it('合法 ball 样本通过并返回强类型', () => {
    const p = parseAIProblem(VALID_PROBLEM)
    expect(p.topic).toBe('projectile')
    expect(p.objects[0].type).toBe('ball')
    expect((p.objects[0] as { mass?: number }).mass).toBe(2)
    expect(p.gravity).toBe(9.8)
  })

  it('判别联合：arc / spring / plate 类型正确收窄解析', () => {
    const p = parseAIProblem({
      topic: 'custom',
      objects: [
        { type: 'arc', center: { x: 0, y: 0 }, arcRadius: 1, startAngle: 0, endAngle: Math.PI },
        { type: 'spring', anchor: { x: 0, y: 0 }, ballId: 'A', naturalLength: 1, k: 50 },
        { type: 'plate', startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    })
    expect(p.objects.map((o) => o.type)).toEqual(['arc', 'spring', 'plate'])
  })
})

describe('parseAIProblem — 非法输入拒绝', () => {
  it('缺少 topic → 抛错', () => {
    const rest = JSON.parse(JSON.stringify(VALID_PROBLEM))
    delete rest.topic
    expect(() => parseAIProblem(rest)).toThrow(/topic|校验失败/)
  })

  it('负质量 → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(VALID_PROBLEM))
    bad.objects[0].mass = -1
    expect(() => parseAIProblem(bad)).toThrow(/校验失败/)
  })

  it('半径 0 → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(VALID_PROBLEM))
    bad.objects[0].radius = 0
    expect(() => parseAIProblem(bad)).toThrow(/校验失败/)
  })

  it('非有限初速度 vx → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(VALID_PROBLEM))
    bad.objects[0].initialVelocity.x = Infinity
    expect(() => parseAIProblem(bad)).toThrow(/校验失败/)
  })

  it('未知物体 type → 抛错', () => {
    const bad = JSON.parse(JSON.stringify(VALID_PROBLEM))
    bad.objects[0].type = 'unknown'
    expect(() => parseAIProblem(bad)).toThrow(/校验失败/)
  })
})

describe('sanitizeParsedProblem — 边界兜底', () => {
  it('非有限质量/重力被钳制为默认值', () => {
    const p = parseAIProblem(JSON.parse(JSON.stringify(VALID_PROBLEM)))
    p.objects[0] = { ...p.objects[0], type: 'ball', mass: NaN }
    p.gravity = Infinity
    const s = sanitizeParsedProblem(p)
    expect(s.objects[0].type).toBe('ball')
    expect((s.objects[0] as { mass?: number }).mass).toBe(1)
    expect(s.gravity).toBe(9.8)
  })

  it('负半径取绝对值兜底', () => {
    const p = parseAIProblem(JSON.parse(JSON.stringify(VALID_PROBLEM)))
    p.objects[0] = { ...p.objects[0], type: 'ball', radius: -0.5 }
    const s = sanitizeParsedProblem(p)
    expect((s.objects[0] as { radius?: number }).radius).toBe(0.5)
  })
})

describe('validateParsedProblem — bool 语义', () => {
  it('空 objects → ok:false', () => {
    const p = parseAIProblem({
      topic: 'custom',
      objects: [],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    })
    expect(validateParsedProblem(p).ok).toBe(false)
  })

  it('质量 0 → ok:false', () => {
    const p: ParsedProblem = parseAIProblem(JSON.parse(JSON.stringify(VALID_PROBLEM)))
    p.objects[0] = { ...p.objects[0], type: 'ball', mass: 0 }
    expect(validateParsedProblem(p).ok).toBe(false)
  })

  it('合法输入 → ok:true', () => {
    const p = parseAIProblem(JSON.parse(JSON.stringify(VALID_PROBLEM)))
    expect(validateParsedProblem(p).ok).toBe(true)
  })
})
