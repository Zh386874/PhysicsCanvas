/**
 * 键盘事件层：Delete 删除 + Ctrl+Z 撤销 + Ctrl+Y/Ctrl+Shift+Z 重做
 * 从 App.vue 拆分，遵循 SRP
 * 通过 useKeyboard 工厂接收删除/撤销/重做回调
 */
import { onMounted, onUnmounted } from 'vue'

/** 键盘操作上下文 */
export interface KeyboardContext {
  onDeleteKey: () => void
  onUndo: () => void
  onRedo: () => void
}

/**
 * 注册全局键盘快捷键
 * 必须在组件 setup 中调用以正确绑定生命周期
 */
export function useKeyboard(ctx: KeyboardContext) {
  function onKeydown(e: KeyboardEvent): void {
    // 避免在输入框中触发
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      ctx.onDeleteKey()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      ctx.onUndo()
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault()
      ctx.onRedo()
    }
  }

  onMounted(() => { window.addEventListener('keydown', onKeydown) })
  onUnmounted(() => { window.removeEventListener('keydown', onKeydown) })
}
