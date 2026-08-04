<template>
  <aside
    class="side-panel left-panel"
    :class="{ collapsed: leftCollapsed }"
    :style="{ width: leftCollapsed ? '0px' : leftPanelWidth + 'px' }"
  >
    <template v-if="!leftCollapsed">
      <AIInput
        @load-preset="$emit('load-preset', $event)"
        @update-params="$emit('update-params', $event)"
        @scene-built="$emit('scene-built', $event)"
      />
      <ObjectList
        :objects="objects"
        :selectedId="selectedId"
        :selectedIds="selectedIds"
        :removable="removable"
        @select="$emit('select', $event)"
        @select-group="$emit('select-group', $event)"
        @remove="$emit('remove', $event)"
      />
      <PropertyPanel :object="selectedObject" @update:object="$emit('update:object', $event)" />
      <SceneSettings />
    </template>
  </aside>
  <div
    v-if="!leftCollapsed"
    class="panel-splitter left-splitter"
    :class="{ dragging: dragMoved && dragSide === 'left' }"
    @mousedown="$emit('splitter-mousedown', $event, 'left')"
  >
    <span class="splitter-arrow">‹</span>
  </div>
</template>

<script setup>
import AIInput from './AIInput.vue'
import ObjectList from './ObjectList.vue'
import PropertyPanel from './PropertyPanel.vue'
import SceneSettings from './SceneSettings.vue'

defineProps({
  leftPanelWidth: { type: Number, default: 280 },
  leftCollapsed: { type: Boolean, default: false },
  objects: { type: Array, default: () => [] },
  selectedId: { type: Number, default: null },
  selectedIds: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
  selectedObject: { type: Object, default: null },
  dragMoved: { type: Boolean, default: false },
  dragSide: { type: String, default: null }
})

defineEmits([
  'splitter-mousedown',
  'select',
  'select-group',
  'remove',
  'update:object',
  'load-preset',
  'update-params',
  'scene-built'
])
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
.left-panel {
  border-right: 1px solid var(--vsd-border);
  overflow-y: auto;
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
