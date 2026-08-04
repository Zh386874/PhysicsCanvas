<template>
  <div
    v-if="!rightCollapsed"
    class="panel-splitter right-splitter"
    :class="{ dragging: dragMoved && dragSide === 'right' }"
    @mousedown="$emit('splitter-mousedown', $event, 'right')"
  >
    <span class="splitter-arrow">›</span>
  </div>
  <aside
    class="side-panel right-panel"
    :class="{ collapsed: rightCollapsed }"
    :style="{ width: rightCollapsed ? '0px' : rightPanelWidth + 'px' }"
  >
    <QuestionBankPanel v-if="!rightCollapsed" @load-question="$emit('load-question', $event)" />
  </aside>
</template>

<script setup>
import QuestionBankPanel from './QuestionBankPanel.vue'

defineProps({
  rightPanelWidth: { type: Number, default: 330 },
  rightCollapsed: { type: Boolean, default: false },
  dragMoved: { type: Boolean, default: false },
  dragSide: { type: String, default: null }
})

defineEmits(['splitter-mousedown', 'load-question'])
</script>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  background: var(--vsd-panel);
  overflow: hidden;
  transition:
    width 0.2s ease,
    border-width 0.2s ease;
  min-height: 0;
  flex-shrink: 0;
}
.side-panel.collapsed {
  border-width: 0 !important;
}
.right-panel {
  border-left: 1px solid var(--vsd-border);
  overflow-y: auto;
  background: var(--vsd-panel);
}
.panel-splitter {
  width: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.panel-splitter::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  background: var(--vsd-border-light);
  transition: background 0.15s;
}
.panel-splitter:hover {
  background: rgba(var(--vsd-blue-rgb), 0.15);
}
.panel-splitter:hover::before {
  background: var(--vsd-blue);
}
.panel-splitter:hover .splitter-arrow {
  color: var(--vsd-info);
}
.panel-splitter.dragging {
  background: rgba(var(--vsd-blue-rgb), 0.25);
}
.panel-splitter.dragging::before {
  background: var(--vsd-blue);
}
.splitter-arrow {
  color: var(--vsd-text-dim);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  background: var(--vsd-panel-light);
  width: 14px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid var(--vsd-border-light);
  transition: all 0.15s;
  z-index: 1;
  pointer-events: none;
}
</style>
