/**
 * useKeyboard 键盘快捷键测试
 *
 * 环境为 node（无 jsdom），故通过 vi.mock('vue') 触发 onMounted/onUnmounted，
 * 并 mock window/document 捕获事件监听器，从而验证快捷键映射与输入框防护。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  listeners: new Map<string, (e: Record<string, unknown>) => void>(),
  cleanup: null as (() => void) | null
}))

vi.mock('vue', () => ({
  onMounted: (cb: () => void) => cb(),
  onUnmounted: (cb: () => void) => {
    h.cleanup = cb
  }
}))

import { useKeyboard } from '../../src/composables/useKeyboard'

beforeEach(() => {
  h.listeners.clear()
  h.cleanup = null
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: (type: string, cb: (e: Record<string, unknown>) => void) =>
      h.listeners.set(type, cb),
    removeEventListener: (type: string) => h.listeners.delete(type)
  }
  ;(globalThis as Record<string, unknown>).document = { activeElement: null }
})

/** 派发 keydown 事件到已注册的监听器 */
function dispatchKeydown(init: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}): () => void {
  const preventDefault = vi.fn()
  const handler = h.listeners.get('keydown')
  handler?.({ ...init, preventDefault })
  return preventDefault
}

function makeCtx() {
  return { onDeleteKey: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn() }
}

describe('useKeyboard 删除键', () => {
  it('Delete 触发 onDeleteKey', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    dispatchKeydown({ key: 'Delete' })
    expect(ctx.onDeleteKey).toHaveBeenCalledTimes(1)
  })

  it('Backspace 也触发 onDeleteKey', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    dispatchKeydown({ key: 'Backspace' })
    expect(ctx.onDeleteKey).toHaveBeenCalledTimes(1)
  })
})

describe('useKeyboard 撤销/重做', () => {
  it('Ctrl+Z 触发 onUndo 并 preventDefault', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    const pd = dispatchKeydown({ key: 'z', ctrlKey: true })
    expect(ctx.onUndo).toHaveBeenCalledTimes(1)
    expect(ctx.onRedo).not.toHaveBeenCalled()
    expect(pd).toHaveBeenCalled()
  })

  it('Ctrl+Shift+Z 触发 onRedo', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    dispatchKeydown({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(ctx.onRedo).toHaveBeenCalledTimes(1)
    expect(ctx.onUndo).not.toHaveBeenCalled()
  })

  it('Ctrl+Y 触发 onRedo', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    dispatchKeydown({ key: 'y', ctrlKey: true })
    expect(ctx.onRedo).toHaveBeenCalledTimes(1)
  })

  it('无修饰键的 z 不触发撤销/重做', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    dispatchKeydown({ key: 'z' })
    expect(ctx.onUndo).not.toHaveBeenCalled()
    expect(ctx.onRedo).not.toHaveBeenCalled()
  })
})

describe('useKeyboard 输入框防护与生命周期', () => {
  it('输入框激活时不触发快捷键', () => {
    const ctx = makeCtx()
    useKeyboard(ctx)
    ;(globalThis as Record<string, unknown>).document = { activeElement: { tagName: 'INPUT' } }
    dispatchKeydown({ key: 'Delete' })
    expect(ctx.onDeleteKey).not.toHaveBeenCalled()
  })

  it('卸载时移除 window 监听器', () => {
    useKeyboard(makeCtx())
    expect(h.listeners.has('keydown')).toBe(true)
    h.cleanup?.()
    expect(h.listeners.has('keydown')).toBe(false)
  })
})
