/**
 * useCanvasInteraction 交互层测试
 *
 * 覆盖无 DOM 依赖的导出状态与只读判定：
 * 默认 getter、worldOffset/worldScale 可写、resetView 重置。
 * （事件处理路径需真实 canvas，超出 node 环境单测范围，不作为本文件目标）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  worldOffset,
  worldScale,
  getDpr,
  getCssW,
  getCssH,
  getSelectionState,
  isPanning,
  isDragging,
  isBatchDragging,
  isDrawing,
  isSelectionActive,
  resetView
} from '../../src/composables/useCanvasInteraction'

const REF = { x: 0, y: 0 }

beforeEach(() => {
  worldOffset.value = { x: 0, y: 0 }
  worldScale.value = 1
})

describe('useCanvasInteraction 默认状态', () => {
  it('默认 getter 均为未激活', () => {
    expect(isPanning()).toBe(false)
    expect(isDragging()).toBe(false)
    expect(isBatchDragging()).toBe(false)
    expect(isDrawing()).toBe(false)
    expect(isSelectionActive()).toBe(false)
  })

  it('默认选择框为空', () => {
    expect(getSelectionState()).toEqual({ active: false, start: null, end: null })
  })

  it('默认高 DPI 与尺寸为 1/0', () => {
    expect(getDpr()).toBe(1)
    expect(getCssW()).toBe(0)
    expect(getCssH()).toBe(0)
  })
})

describe('useCanvasInteraction 世界坐标与缩放', () => {
  it('worldOffset/worldScale 可读写', () => {
    worldOffset.value = { x: 120, y: -40 }
    worldScale.value = 2
    expect(worldOffset.value).toEqual({ x: 120, y: -40 })
    expect(worldScale.value).toBe(2)
  })

  it('resetView 重置偏移与缩放', () => {
    worldOffset.value = { x: 120, y: -40 }
    worldScale.value = 2
    resetView()
    expect(worldOffset.value).toEqual(REF)
    expect(worldScale.value).toBe(1)
  })
})
