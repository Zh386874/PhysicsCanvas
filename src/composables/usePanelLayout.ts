/**
 * 面板布局层：侧栏折叠/展开/拖拽调整宽度
 * 从 App.vue 拆分，遵循 SRP（单一职责原则）
 * 纯 UI 状态，与业务逻辑无关
 */
import { ref, onUnmounted } from 'vue'

/** 面板宽度 localStorage 键名 */
const LEFT_WIDTH_KEY = 'panel_left_width'
const RIGHT_WIDTH_KEY = 'panel_right_width'
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 330
const MIN_WIDTH = 80
const MAX_WIDTH = 500

/** 从 localStorage 加载面板宽度 */
function loadPanelWidth(key: string, defaultVal: number): number {
  try {
    const saved = localStorage.getItem(key)
    if (saved !== null) {
      const n = parseInt(saved, 10)
      if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n
    }
  } catch {
    /* ignore */
  }
  return defaultVal
}

/**
 * 面板布局管理器
 * 提供左右面板的折叠/展开/拖拽调整宽度功能
 * 单例模式：每个使用方只需调用 usePanelLayout() 获取同一组状态
 */
export function usePanelLayout() {
  const leftPanelWidth = ref(loadPanelWidth(LEFT_WIDTH_KEY, DEFAULT_LEFT))
  const rightPanelWidth = ref(loadPanelWidth(RIGHT_WIDTH_KEY, DEFAULT_RIGHT))
  const leftCollapsed = ref(false)
  const rightCollapsed = ref(false)

  // ===== Splitter 拖拽状态 =====
  const dragSide = ref<'left' | 'right' | null>(null)
  const dragStartX = ref(0)
  const dragStartWidth = ref(0)
  const dragMoved = ref(false)

  function onSplitterMouseDown(e: MouseEvent, side: 'left' | 'right'): void {
    e.preventDefault()
    dragSide.value = side
    dragStartX.value = e.clientX
    dragStartWidth.value = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value
    dragMoved.value = false
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e: MouseEvent): void {
    const delta = e.clientX - dragStartX.value
    if (Math.abs(delta) > 3) dragMoved.value = true
    if (!dragMoved.value) return

    if (dragSide.value === 'left') {
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.value + delta))
      leftPanelWidth.value = newWidth
      localStorage.setItem(LEFT_WIDTH_KEY, String(newWidth))
    } else {
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.value - delta))
      rightPanelWidth.value = newWidth
      localStorage.setItem(RIGHT_WIDTH_KEY, String(newWidth))
    }
  }

  function onMouseUp(): void {
    // 未移动 → Splitter 点击也切换折叠
    if (!dragMoved.value && dragSide.value) {
      if (dragSide.value === 'left') leftCollapsed.value = !leftCollapsed.value
      else rightCollapsed.value = !rightCollapsed.value
    }
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    dragSide.value = null
  }

  // 组件卸载时清理事件监听器
  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    leftPanelWidth,
    rightPanelWidth,
    leftCollapsed,
    rightCollapsed,
    dragSide,
    dragMoved,
    onSplitterMouseDown
  }
}
