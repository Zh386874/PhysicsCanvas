/**
 * 单元测试：getFieldRegionTheme —— 场区域类型标签/颜色纯函数
 * 用例对应 Bug 复现路径 + 正常路径
 */
import { describe, it, expect } from 'vitest'
import { getFieldRegionTheme } from '../../src/composables/useCanvasRenderer'
import type { FieldState } from '../../src/composables/usePhysics'

function makeField(overrides: Partial<FieldState> = {}): FieldState {
  return {
    type: 'none',
    E: { x: 0, y: 0 },
    B: 0,
    ...overrides
  }
}

describe('getFieldRegionTheme —— 场区域主题按 field.type 判断', () => {
  it('CASE A: type=magnetic, E=B=0（刚切换完未设置数值）→ 磁场区域', () => {
    const field = makeField({ type: 'magnetic' })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('磁场区域')
    expect(theme.borderColor).toContain('78, 201, 176') // 青绿色
  })

  it('CASE B: type=magnetic, 但 E 残留有值（从 electric 切过来未清零）→ 仍应为磁场区域', () => {
    const field = makeField({
      type: 'magnetic',
      E: { x: 0, y: 100 },
      B: 2
    })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('磁场区域')
    expect(theme.borderColor).toContain('78, 201, 176')
  })

  it('CASE C: type=electric, E=B=0（刚切换完未设置数值）→ 电场区域', () => {
    const field = makeField({ type: 'electric' })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('电场区域')
    expect(theme.borderColor).toContain('86, 156, 214') // 蓝色
  })

  it('CASE D: type=electric, 但 B 残留有值（从 magnetic 切过来未清零）→ 仍应为电场区域', () => {
    const field = makeField({
      type: 'electric',
      E: { x: 0, y: 100 },
      B: 2
    })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('电场区域')
    expect(theme.borderColor).toContain('86, 156, 214')
  })

  it('CASE E: type=composite, E=B=0（刚切换完未设置数值）→ 复合场区域', () => {
    const field = makeField({ type: 'composite' })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('复合场区域')
    expect(theme.borderColor).toContain('197, 134, 192') // 紫色
  })

  it('CASE F: type=composite, E 和 B 都有值 → 复合场区域', () => {
    const field = makeField({
      type: 'composite',
      E: { x: 0, y: 100 },
      B: 2
    })
    const theme = getFieldRegionTheme(field)
    expect(theme.label).toBe('复合场区域')
  })
})

describe('onFieldTypeChange 等价行为 —— 切换类型清除残留数值', () => {
  /** 纯函数版本，和组件内逻辑等价，便于测试 */
  function simulateTypeChange(prev: FieldState, nextType: FieldState['type']): FieldState {
    const next: FieldState = structuredClone({ ...prev, type: nextType })
    if (nextType === 'electric') {
      next.B = 0
    } else if (nextType === 'magnetic') {
      next.E.x = 0
      next.E.y = 0
    } else if (nextType === 'none') {
      next.E.x = 0
      next.E.y = 0
      next.B = 0
    }
    return next
  }

  it('electric → magnetic: E 被清零，B 保留', () => {
    const prev = makeField({ type: 'electric', E: { x: 0, y: 100 }, B: 2 })
    const next = simulateTypeChange(prev, 'magnetic')
    expect(next.E).toEqual({ x: 0, y: 0 })
    expect(next.B).toBe(2)
  })

  it('magnetic → electric: B 被清零，E 保留', () => {
    const prev = makeField({ type: 'magnetic', E: { x: 0, y: 100 }, B: 2 })
    const next = simulateTypeChange(prev, 'electric')
    expect(next.B).toBe(0)
    expect(next.E).toEqual({ x: 0, y: 100 })
  })

  it('any → none: E 和 B 全部清零', () => {
    const prev = makeField({ type: 'composite', E: { x: 0, y: 100 }, B: 2 })
    const next = simulateTypeChange(prev, 'none')
    expect(next.E).toEqual({ x: 0, y: 0 })
    expect(next.B).toBe(0)
  })

  it('electric → composite: 任何数值不清零（用户友好）', () => {
    const prev = makeField({ type: 'electric', E: { x: 0, y: 100 }, B: 0 })
    const next = simulateTypeChange(prev, 'composite')
    expect(next.E).toEqual({ x: 0, y: 100 })
    expect(next.B).toBe(0)
  })
})
