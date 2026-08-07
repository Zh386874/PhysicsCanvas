/**
 * 单元测试：useStaticLayer —— 离屏静态层脏检测纯函数
 * 静态层只应在尺寸/平移/缩放/地面变化时重绘，其余时间命中缓存（返回 false）
 */
import { describe, it, expect } from 'vitest'
import {
  createEmptyStaticLayerCache,
  isStaticLayerDirty,
  type StaticLayerCache
} from '../../src/composables/useStaticLayer'

/** 构造一份「已渲染过」的缓存，模拟 renderStaticLayer 之后的记录 */
function makeFilledCache(overrides: Partial<StaticLayerCache> = {}): StaticLayerCache {
  return {
    width: 1280,
    height: 720,
    offsetX: 40,
    offsetY: -60,
    scale: 1,
    groundY: 400,
    ...overrides
  }
}

describe('isStaticLayerDirty —— 静态层脏检测', () => {
  it('空缓存首次判定脏（需重绘）', () => {
    const cache = createEmptyStaticLayerCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 0, 0, 1, 400)).toBe(true)
  })

  it('所有输入与缓存一致 → 不脏（命中缓存）', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 40, -60, 1, 400)).toBe(false)
  })

  it('仅 offsetX 变化 → 脏', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 41, -60, 1, 400)).toBe(true)
  })

  it('仅 offsetY 变化 → 脏', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 40, -59, 1, 400)).toBe(true)
  })

  it('仅 scale 变化 → 脏', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 40, -60, 1.5, 400)).toBe(true)
  })

  it('仅画布尺寸变化 → 脏', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1920, 720, 40, -60, 1, 400)).toBe(true)
    expect(isStaticLayerDirty(cache, 1280, 1080, 40, -60, 1, 400)).toBe(true)
  })

  it('仅 groundY 变化 → 脏', () => {
    const cache = makeFilledCache()
    expect(isStaticLayerDirty(cache, 1280, 720, 40, -60, 1, 300)).toBe(true)
  })
})
