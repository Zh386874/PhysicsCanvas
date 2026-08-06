/**
 * usePanelLayout 面板布局测试
 *
 * 环境为 node（无 jsdom），故 mock document 捕获 mousemove/mouseup 监听器、
 * mock localStorage 验证宽度持久化、将 vue 的 onUnmounted 置空以保留监听器便于派发。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return { ...actual, onUnmounted: () => {} }
})

import { usePanelLayout } from '../../src/composables/usePanelLayout'

const docListeners = new Map<string, (e: Record<string, unknown>) => void>()
/** 模拟 localStorage 存储（beforeEach 重置） */
const store = new Map<string, string>()

beforeEach(() => {
  docListeners.clear()
  store.clear()
  ;(globalThis as Record<string, unknown>).document = {
    addEventListener: (type: string, cb: (e: Record<string, unknown>) => void) =>
      docListeners.set(type, cb),
    removeEventListener: (type: string) => docListeners.delete(type)
  }
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v))
  }
})

function mousedown(clientX: number, side: 'left' | 'right') {
  const p = usePanelLayout()
  p.onSplitterMouseDown({ clientX, preventDefault: vi.fn() } as unknown as MouseEvent, side)
  return p
}

describe('usePanelLayout 默认值', () => {
  it('默认左 280 / 右 330，未折叠', () => {
    const p = usePanelLayout()
    expect(p.leftPanelWidth.value).toBe(280)
    expect(p.rightPanelWidth.value).toBe(330)
    expect(p.leftCollapsed.value).toBe(false)
    expect(p.rightCollapsed.value).toBe(false)
  })

  it('localStorage 保存的合法宽度被加载', () => {
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => (k === 'panel_left_width' ? '360' : null),
      setItem: () => {}
    }
    const p = usePanelLayout()
    expect(p.leftPanelWidth.value).toBe(360)
  })
})

describe('usePanelLayout 拖拽调整宽度', () => {
  it('左侧拖拽：宽度随 delta 变化并 clamp 到 [80,500]', () => {
    const p = mousedown(100, 'left')
    const move = docListeners.get('mousemove')!
    move({ clientX: 1000 }) // delta=900 → 280+900 → clamp 500
    expect(p.leftPanelWidth.value).toBe(500)
    move({ clientX: 80 }) // delta=-20 → 260
    expect(p.leftPanelWidth.value).toBe(260)
  })

  it('右侧拖拽：宽度为 dragStart - delta', () => {
    const p = mousedown(100, 'right')
    const move = docListeners.get('mousemove')!
    move({ clientX: 200 }) // delta=100 → 330-100=230
    expect(p.rightPanelWidth.value).toBe(230)
  })

  it('拖拽后宽度写入 localStorage', () => {
    const p = mousedown(100, 'left')
    const move = docListeners.get('mousemove')!
    move({ clientX: 140 }) // delta=40 → 320
    expect(p.leftPanelWidth.value).toBe(320)
    expect(store.get('panel_left_width')).toBe('320')
  })
})

describe('usePanelLayout 折叠切换', () => {
  it('未移动即 mouseup → 切换折叠', () => {
    const p = mousedown(100, 'left')
    const up = docListeners.get('mouseup')!
    up()
    expect(p.leftCollapsed.value).toBe(true)
    expect(p.rightCollapsed.value).toBe(false)
  })

  it('移动超 3px 后 mouseup → 不切换折叠', () => {
    const p = mousedown(100, 'left')
    docListeners.get('mousemove')!({ clientX: 110 }) // delta=10 > 3
    const up = docListeners.get('mouseup')!
    up()
    expect(p.leftCollapsed.value).toBe(false)
    expect(p.leftPanelWidth.value).toBe(290)
  })
})
