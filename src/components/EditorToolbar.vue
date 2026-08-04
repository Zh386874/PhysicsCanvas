<template>
  <div class="editor-tabs">
    <SceneTabs
      :activeScene="activeScene"
      :savedSceneNames="savedSceneNames"
      @switch="$emit('switch', $event)"
      @delete="$emit('delete', $event)"
      @rename="$emit('rename', $event)"
    />
    <div class="tabs-spacer">
      <button
        v-if="isSavedSceneActive"
        class="edit-scene-btn"
        @click="$emit('toggle-saved-scene-edit')"
      >
        {{ savedSceneEditing ? '🔒 退出编辑' : '✏️ 编辑' }}
      </button>
      <button class="io-btn" @click="$emit('export')">💾 导出</button>
      <button class="io-btn" @click="$emit('import')">📂 导入</button>
      <button class="save-scene-btn" @click="$emit('save-scene')">💾 保存</button>
    </div>
  </div>
</template>

<script setup>
import SceneTabs from './SceneTabs.vue'

defineProps({
  activeScene: { type: String, required: true },
  savedSceneNames: { type: Array, default: () => [] },
  isSavedSceneActive: { type: Boolean, default: false },
  savedSceneEditing: { type: Boolean, default: false }
})

defineEmits([
  'switch',
  'delete',
  'rename',
  'toggle-saved-scene-edit',
  'export',
  'import',
  'save-scene'
])
</script>

<style scoped>
.editor-tabs {
  display: flex;
  align-items: stretch;
  background: var(--vsd-panel);
  border-bottom: 1px solid var(--vsd-border);
  min-height: 36px;
  flex-shrink: 0;
}
.tabs-spacer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.5rem;
}
.save-scene-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--vsd-green);
  border-radius: 4px;
  background: var(--vsd-button);
  color: var(--vsd-green);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.save-scene-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-green);
  color: var(--vsd-green);
}
.edit-scene-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  margin-right: 0.3rem;
  border: 1px solid var(--vsd-blue);
  border-radius: 4px;
  background: var(--vsd-button);
  color: var(--vsd-info);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.edit-scene-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-blue);
  color: var(--vsd-blue);
}
.io-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  margin-right: 0.3rem;
  border: 1px solid var(--vsd-border-light);
  border-radius: 4px;
  background: var(--vsd-button);
  color: var(--vsd-cyan);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.io-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-cyan);
  color: var(--vsd-cyan);
}
</style>
