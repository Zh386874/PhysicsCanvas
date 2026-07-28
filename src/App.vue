<template>
  <div class="app">
    <header class="app-header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">物理解模</span>
      </div>
      <SceneTabs :activeScene="activeScene" @switch="onSceneSwitch" />
      <button class="api-config-btn" :class="{ configured: isAIConfigured }" @click="showApiKeyDialog = true">
        <span class="api-icon">🔑</span>
        <span class="api-text">{{ isAIConfigured ? configuredModelName : 'AI 配置' }}</span>
      </button>
    </header>

    <ApiKeyDialog
      :visible="showApiKeyDialog"
      @close="showApiKeyDialog = false"
      @saved="onApiKeySaved"
      @cleared="onApiKeyCleared"
    />

    <div class="main">
      <div class="left-panel">
        <AIInput @load-preset="handleLoadPreset" @update-params="handleUpdateParams" @scene-built="handleSceneBuilt" />
        <ObjectList
          :objects="state.objects"
          :selectedId="selectedId"
          :selectedIds="selectedIds"
          :removable="activeScene === '自定义'"
          @select="onSelectObject"
          @select-group="onSelectGroup"
          @remove="handleRemoveObject"
        />
        <PropertyPanel
          :object="selectedObject"
          @update:object="onObjectUpdate"
        />
      </div>

      <div class="right-area">
        <div v-if="currentQuestionDesc" class="question-desc-bar">
          <span class="desc-icon">📝</span>
          <span class="desc-text">{{ currentQuestionDesc }}</span>
        </div>
        <PhysicsCanvas
          :mode="mode"
          :aiToast="aiToast"
          :editMode="editMode"
          :selectedIds="selectedIds"
          @add-object="handleAddObject"
          @update-object="handleUpdateObject"
          @remove-object="handleRemoveObject"
          @export-scene="handleExportScene"
          @import-scene="handleImportScene"
          @update-selected="selectedIds = $event"
          @batch-update="handleBatchUpdate"
          @undo="onUndo"
          @redo="onRedo"
        />
        <Timeline
          v-if="mode === 'replay'"
          :snapshots="snapshots"
          :currentFrame="currentFrame"
          :keyframeIndices="keyframeIndices"
          @update:currentFrame="currentFrame = $event"
        />
        <ControlBar
          :isPlaying="isPlaying"
          :showForce="showForce"
          :showGateColors="showGateColors"
          :mode="mode"
          @toggle-play="onTogglePlay"
          @reset="onReset"
          @toggle-force="state.showForce = !state.showForce"
          @toggle-gate-colors="state.showGateColors = !state.showGateColors"
          @toggle-replay="onToggleReplay"
        />
      </div>

      <div class="right-panel">
        <QuestionBankPanel @load-question="handleLoadQuestion" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SceneTabs from './components/SceneTabs.vue'
import ObjectList from './components/ObjectList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import ControlBar from './components/ControlBar.vue'
import PhysicsCanvas from './components/PhysicsCanvas.vue'
import Timeline from './components/Timeline.vue'
import AIInput from './components/AIInput.vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import QuestionBankPanel from './components/QuestionBankPanel.vue'
import { state, snapshots, currentFrame, keyframeIndices } from './composables/usePhysics'
import { isAIConfigured, configuredModelName } from './composables/useAIParser'
import { useSceneManager } from './composables/useSceneManager'
import { useObjectOperations } from './composables/useObjectOperations'
import { useSceneIO } from './composables/useSceneIO'
import { useKeyboard } from './composables/useKeyboard'

// ===== 场景管理（拥有 activeScene/mode/aiToast/selectedId/selectedIds） =====
const {
  activeScene,
  selectedId,
  selectedIds,
  mode,
  aiToast,
  currentQuestionDesc,
  editMode,
  saveCustomScene,
  refreshCustomSnapshot,
  onSceneSwitch,
  onTogglePlay,
  onReset,
  onToggleReplay,
  handleLoadPreset,
  handleSceneBuilt,
  handleLoadQuestion
} = useSceneManager()

// ===== 物体操作（增删改 + 选中 + 撤销重做 + Delete 键） =====
const {
  selectedObject,
  onObjectUpdate,
  onSelectObject,
  onSelectGroup,
  handleBatchUpdate,
  handleAddObject,
  handleUpdateObject,
  handleRemoveObject,
  handleUpdateParams,
  onDeleteKey,
  onUndo,
  onRedo
} = useObjectOperations({
  activeScene,
  mode,
  aiToast,
  selectedId,
  selectedIds,
  saveCustomScene,
  refreshCustomSnapshot
})

// ===== 场景 IO（导出/导入） =====
const { handleExportScene, handleImportScene } = useSceneIO({
  state,
  aiToast,
  selectedId,
  activeScene,
  saveCustomScene
})

// ===== 键盘快捷键 =====
useKeyboard({ onDeleteKey, onUndo, onRedo })

// ===== API Key 对话框（本地 UI 状态） =====
const showApiKeyDialog = ref(false)

function onApiKeySaved() {
  aiToast.value = '✅ AI 配置已保存'
  setTimeout(() => aiToast.value = '', 2000)
}
function onApiKeyCleared() {
  aiToast.value = '⚠️ AI 配置已清除，已切换为本地解析'
  setTimeout(() => aiToast.value = '', 2000)
}

// ===== 计算属性（绑定到 usePhysics 的 state） =====
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)
const showGateColors = computed(() => state.showGateColors)
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #0a0e27 0%, #0f172a 100%);
  color: #e0e6ff;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.25rem;
  height: 56px;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(59, 130, 246, 0.25);
  backdrop-filter: blur(10px);
}

.api-config-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  color: #fcd34d;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.api-config-btn:hover {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.5);
}

.api-config-btn.configured {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.api-config-btn.configured:hover {
  background: rgba(34, 197, 94, 0.2);
}

.api-icon {
  font-size: 0.9rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.logo-icon {
  font-size: 1.3rem;
  filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.6));
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.08em;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.5);
  border-right: 1px solid rgba(59, 130, 246, 0.2);
  overflow-y: auto;
}

.right-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 500px;
  min-width: 0;
}

.question-desc-bar {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  background: rgba(15, 23, 42, 0.85);
  border-bottom: 1px solid rgba(167, 139, 250, 0.3);
  backdrop-filter: blur(8px);
  max-height: 120px;
  overflow-y: auto;
}

.desc-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.desc-text {
  font-size: 0.78rem;
  line-height: 1.5;
  color: #e0e6ff;
  white-space: pre-wrap;
  word-break: break-word;
}

.right-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.5);
  border-left: 1px solid rgba(59, 130, 246, 0.2);
  overflow-y: auto;
}
</style>
