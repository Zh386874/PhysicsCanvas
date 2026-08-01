<template>
  <div class="scene-tabs" ref="tabsRef">
    <!-- 自定义标签始终可见 -->
    <button
      class="tab"
      :class="{ active: activeScene === '自定义' }"
      @click="$emit('switch', '自定义')"
    >
      <span class="tab-icon">📄</span>
      <span class="tab-label">自定义</span>
    </button>

    <!-- 前 N 个保存场景标签 -->
    <button
      v-for="scene in visibleScenes"
      :key="scene"
      class="tab"
      :class="{ active: activeScene === scene }"
      @click="$emit('switch', scene)"
    >
      <span class="tab-icon">📄</span>
      <span class="tab-label">{{ scene }}</span>
      <span class="tab-rename" @click.stop="$emit('rename', scene)" title="重命名">✏️</span>
      <span class="tab-close" @click.stop.prevent="$emit('delete', scene)" title="删除此场景">
        ✕
      </span>
    </button>

    <!-- 更多按钮：仅在溢出场景 > 0 时显示 -->
    <div v-if="overflowScenes.length > 0" class="more-wrap">
      <button
        class="tab more-btn"
        :class="{ active: overflowScenes.includes(activeScene) }"
        @click.stop="toggleDropdown"
      >
        <span>更多</span>
        <span class="more-arrow">▼</span>
      </button>
      <div v-show="showMoreDropdown" class="more-dropdown" @click.stop>
        <div
          v-for="scene in overflowScenes"
          :key="scene"
          class="more-dropdown-item"
          :class="{ active: activeScene === scene }"
          @click="onMoreSwitch(scene)"
        >
          <span class="more-item-icon">📄</span>
          <span class="more-item-label">{{ scene }}</span>
          <span class="more-item-rename" @click.stop="onMoreRename(scene)" title="重命名">✏️</span>
          <span class="more-item-close" @click.stop="onMoreDelete(scene)" title="删除此场景">
            ✕
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const MAX_VISIBLE_SAVED = 2

const props = defineProps({
  activeScene: { type: String, required: true },
  savedSceneNames: { type: Array, default: () => [] }
})

const emit = defineEmits(['switch', 'delete', 'rename'])

// 可见的保存场景（前 N 个）
const visibleScenes = computed(() => props.savedSceneNames.slice(0, MAX_VISIBLE_SAVED))

// 溢出场景（第 N 个之后）
const overflowScenes = computed(() => props.savedSceneNames.slice(MAX_VISIBLE_SAVED))

// 下拉菜单状态
const showMoreDropdown = ref(false)
const tabsRef = ref(null)

function toggleDropdown() {
  showMoreDropdown.value = !showMoreDropdown.value
}

function closeDropdown() {
  showMoreDropdown.value = false
}

function onMoreSwitch(name) {
  emit('switch', name)
  closeDropdown()
}

function onMoreRename(name) {
  emit('rename', name)
  closeDropdown()
}

function onMoreDelete(name) {
  emit('delete', name)
  closeDropdown()
}

// 点击外部关闭下拉
function onDocumentClick(e) {
  if (tabsRef.value && !tabsRef.value.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<style scoped>
.scene-tabs {
  display: flex;
  align-items: stretch;
  height: 100%;
  position: relative;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 1rem;
  min-height: 36px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--vsd-border);
  color: var(--vsd-text-muted);
  cursor: pointer;
  font-size: 0.78rem;
  transition:
    color 0.15s,
    background 0.15s;
  position: relative;
  white-space: nowrap;
}

.tab:hover:not(.active) {
  background: var(--vsd-hover);
  color: var(--vsd-text);
}

.tab.active {
  background: var(--vsd-bg);
  color: var(--vsd-text);
}

.tab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--vsd-blue);
}

.tab-icon {
  font-size: 0.82rem;
  opacity: 0.85;
}

.tab-label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  margin-left: 0.2rem;
  border-radius: 3px;
  font-size: 0.65rem;
  line-height: 1;
  color: var(--vsd-text-dim);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
  user-select: none;
}

.tab-close:hover {
  color: var(--vsd-red-muted);
  background: rgba(var(--vsd-red-rgb), 0.12);
}

.tab-rename {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  margin-left: 0.2rem;
  border-radius: 3px;
  font-size: 0.65rem;
  line-height: 1;
  color: var(--vsd-text-dim);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
  user-select: none;
  text-decoration: none;
}

.tab-rename:hover {
  color: var(--vsd-info);
  background: rgba(var(--vsd-blue-rgb), 0.12);
}

/* ── 更多按钮 ── */
.more-wrap {
  position: relative;
  display: flex;
  align-items: stretch;
}

.more-btn {
  gap: 0.2rem;
}

.more-arrow {
  font-size: 0.6rem;
  opacity: 0.7;
}

/* ── 下拉菜单 ── */
.more-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  min-width: 180px;
  background: var(--vsd-panel);
  border: 1px solid var(--vsd-border-light);
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  padding: 0.25rem 0;
  overflow: hidden;
}

.more-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  font-size: 0.78rem;
  color: var(--vsd-text);
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}

.more-dropdown-item:hover {
  background: var(--vsd-hover);
}

.more-dropdown-item.active {
  background: var(--vsd-selection);
  color: var(--vsd-text);
}

.more-item-icon {
  font-size: 0.82rem;
  opacity: 0.85;
}

.more-item-label {
  flex: 1;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.more-item-rename {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 3px;
  font-size: 0.65rem;
  line-height: 1;
  color: var(--vsd-text-dim);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
  user-select: none;
}

.more-item-rename:hover {
  color: var(--vsd-info);
  background: rgba(var(--vsd-blue-rgb), 0.12);
}

.more-item-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 3px;
  font-size: 0.65rem;
  line-height: 1;
  color: var(--vsd-text-dim);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
  user-select: none;
}

.more-item-close:hover {
  color: var(--vsd-red-muted);
  background: rgba(var(--vsd-red-rgb), 0.12);
}
</style>
