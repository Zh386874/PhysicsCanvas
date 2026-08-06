<template>
  <div class="app">
    <header class="app-header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">物理解模</span>
      </div>

      <div class="panel-toggle-group">
        <button
          class="panel-toggle-btn"
          :class="{ pressed: leftCollapsed }"
          title="切换左侧栏"
          @click="leftCollapsed = !leftCollapsed"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <line x1="8" y1="5" x2="8" y2="19" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </button>
        <button
          class="panel-toggle-btn"
          :class="{ pressed: rightCollapsed }"
          title="切换右侧栏"
          @click="rightCollapsed = !rightCollapsed"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <line x1="16" y1="5" x2="16" y2="19" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </button>
      </div>

      <button
        class="api-config-btn"
        :class="{ configured: isAIConfigured }"
        @click="showApiKeyDialog = true"
      >
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
    <InputDialog
      :visible="showNameDialog"
      :title="nameDialogTitle"
      :initialValue="nameDialogInitialValue"
      :placeholder="nameDialogPlaceholder"
      :errorMessage="nameDialogError"
      @confirm="onNameDialogConfirm"
      @cancel="onNameDialogCancel"
    />
    <InputDialog
      :visible="showDeleteConfirm"
      title="删除场景"
      :message="'确定删除场景「' + pendingDeleteName + '」？此操作不可撤销。'"
      @confirm="confirmDeleteScene"
      @cancel="cancelDeleteScene"
    />

    <div class="main">
      <LeftPanel
        :leftPanelWidth="leftPanelWidth"
        :leftCollapsed="leftCollapsed"
        :objects="state.objects"
        :selectedId="selectedId"
        :selectedIds="selectedIds"
        :removable="editMode"
        :selectedObject="selectedObject"
        :dragMoved="dragMoved"
        :dragSide="dragSide"
        @splitter-mousedown="onSplitterMouseDown"
        @select="onSelectObject"
        @select-group="onSelectGroup"
        @remove="handleRemoveObject"
        @update:object="onObjectUpdate"
        @load-preset="handleLoadPreset"
        @update-params="handleUpdateParams"
        @scene-built="handleSceneBuilt"
      />

      <main class="center-editor">
        <EditorToolbar
          :activeScene="activeScene"
          :savedSceneNames="savedSceneNames"
          :isSavedSceneActive="isSavedSceneActive"
          :savedSceneEditing="savedSceneEditing"
          @switch="onSceneSwitch"
          @delete="deleteSavedScene"
          @rename="onRenameScene"
          @toggle-saved-scene-edit="toggleSavedSceneEdit"
          @export="handleExportScene"
          @import="triggerImport"
          @save-scene="saveCurrentScene"
        />
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="onImportFileSelected"
        />

        <div v-if="currentQuestionDesc" class="question-desc-bar">
          <span class="desc-icon">📝</span>
          <span class="desc-text">{{ currentQuestionDesc }}</span>
        </div>

        <PhysicsCanvas
          class="canvas-editor"
          :mode="mode"
          :aiToast="aiToast"
          :editMode="editMode"
          :selectedIds="selectedIds"
          @add-object="handleAddObject"
          @update-object="handleUpdateObject"
          @remove-object="handleRemoveObject"
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
      </main>

      <RightPanel
        :rightPanelWidth="rightPanelWidth"
        :rightCollapsed="rightCollapsed"
        :dragMoved="dragMoved"
        :dragSide="dragSide"
        @splitter-mousedown="onSplitterMouseDown"
        @load-question="onLoadQuestion"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SceneTabs from './components/SceneTabs.vue'
import ObjectList from './components/ObjectList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import SceneSettings from './components/SceneSettings.vue'
import ControlBar from './components/ControlBar.vue'
import PhysicsCanvas from './components/PhysicsCanvas.vue'
import Timeline from './components/Timeline.vue'
import AIInput from './components/AIInput.vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import InputDialog from './components/InputDialog.vue'
import QuestionBankPanel from './components/QuestionBankPanel.vue'
import LeftPanel from './components/LeftPanel.vue'
import RightPanel from './components/RightPanel.vue'
import EditorToolbar from './components/EditorToolbar.vue'
import { state, snapshots, currentFrame, keyframeIndices } from './composables/usePhysics'
import {
  isAIConfigured,
  configuredModelName,
  showApiKeyDialog,
  onApiKeySaved,
  onApiKeyCleared
} from './composables/useAIParser'
import { useSceneManager } from './composables/useSceneManager'
import { useObjectOperations } from './composables/useObjectOperations'
import { useSceneIO } from './composables/useSceneIO'
import { useKeyboard } from './composables/useKeyboard'
import { usePanelLayout } from './composables/usePanelLayout'
import { resetGroundInitialized } from './composables/useCanvasInteraction'

// ===== 面板布局 =====
const {
  leftPanelWidth,
  rightPanelWidth,
  leftCollapsed,
  rightCollapsed,
  dragSide,
  dragMoved,
  onSplitterMouseDown
} = usePanelLayout()

// ===== 场景管理 =====
const sceneManager = useSceneManager()
const {
  activeScene,
  selectedId,
  selectedIds,
  mode,
  aiToast,
  currentQuestionDesc,
  editMode,
  saveCustomScene,
  onSceneSwitch: _rawSceneSwitch,
  onTogglePlay,
  onReset,
  onToggleReplay,
  handleLoadPreset,
  handleSceneBuilt,
  handleLoadQuestion,
  savedSceneNames,
  saveCurrentScene,
  deleteSavedScene,
  confirmDeleteScene,
  cancelDeleteScene,
  renameSavedScene,
  savedSceneEditing,
  toggleSavedSceneEdit,
  showNameDialog,
  nameDialogTitle,
  nameDialogInitialValue,
  nameDialogPlaceholder,
  nameDialogError,
  isSavedSceneActive,
  openNameDialog,
  handleNameDialogConfirm,
  showDeleteConfirm,
  pendingDeleteName
} = sceneManager

function onSceneSwitch(sceneName) {
  resetGroundInitialized()
  _rawSceneSwitch(sceneName)
}

function onRenameScene(oldName) {
  openNameDialog('rename', { oldName })
}

function onNameDialogConfirm(value) {
  if (handleNameDialogConfirm(value)) {
    showNameDialog.value = false
  }
}

function onNameDialogCancel() {
  showNameDialog.value = false
}

// ===== 物体操作 =====
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
  editMode
})

// ===== 场景 IO =====
const {
  handleExportScene,
  handleImportSceneFromFile,
  fileInputRef,
  triggerImport,
  onImportFileSelected
} = useSceneIO({
  state,
  aiToast,
  selectedId,
  activeScene,
  saveCustomScene
})

// ===== 键盘快捷键 =====
useKeyboard({ onDeleteKey, onUndo, onRedo })

// ===== 加载题目 =====
function onLoadQuestion(question) {
  handleLoadQuestion(question)
}

// ===== 计算属性 =====
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)
const showGateColors = computed(() => state.showGateColors)
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vsd-bg);
  color: var(--vsd-text);
}
.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.25rem;
  height: 44px;
  background: var(--vsd-panel-light);
  border-bottom: 1px solid var(--vsd-border);
  z-index: 20;
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}
.logo-icon {
  font-size: 1.1rem;
}
.logo-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--vsd-text-muted);
  letter-spacing: 0.08em;
}
.panel-toggle-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.panel-toggle-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--vsd-button);
  border: 1px solid var(--vsd-border-light);
  border-radius: 4px;
  color: var(--vsd-text-muted);
  cursor: pointer;
  transition: all 0.1s;
  line-height: 0;
}
.panel-toggle-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-blue);
  color: var(--vsd-text);
}
.panel-toggle-btn.pressed {
  background: var(--vsd-selection);
  border-color: var(--vsd-blue);
  color: var(--vsd-text);
}
.api-config-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.8rem;
  background: var(--vsd-button);
  border: 1px solid var(--vsd-border-light);
  border-radius: 5px;
  color: var(--vsd-yellow);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.api-config-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-yellow);
}
.api-config-btn.configured {
  background: var(--vsd-button);
  border-color: var(--vsd-green);
  color: var(--vsd-green);
}
.api-config-btn.configured:hover {
  background: var(--vsd-button-hover);
}
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--vsd-bg);
}
.center-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--vsd-bg);
}
.question-desc-bar {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.9rem;
  background: var(--vsd-panel-light);
  border-bottom: 1px solid var(--vsd-border);
  max-height: 110px;
  overflow-y: auto;
  flex-shrink: 0;
}
.desc-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
}
.desc-text {
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--vsd-text);
  white-space: pre-wrap;
  word-break: break-word;
}
.canvas-editor {
  flex: 1;
  min-height: 0;
  background: var(--vsd-bg);
  position: relative;
  overflow: hidden;
}
</style>
