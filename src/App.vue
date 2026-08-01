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
      @confirm="handleNameDialogConfirm"
      @cancel="handleNameDialogConfirm(null)"
    />
    <InputDialog
      :visible="showDeleteConfirm"
      title="删除场景"
      :message="'确定删除场景「' + pendingDeleteName + '」？此操作不可撤销。'"
      @confirm="confirmDeleteScene"
      @cancel="cancelDeleteScene"
    />

    <div class="main">
      <!-- 左侧栏 -->
      <aside
        class="side-panel left-panel"
        :class="{ collapsed: leftCollapsed }"
        :style="{ width: leftCollapsed ? '0px' : leftPanelWidth + 'px' }"
      >
        <template v-if="!leftCollapsed">
          <AIInput
            @load-preset="handleLoadPreset"
            @update-params="handleUpdateParams"
            @scene-built="handleSceneBuilt"
          />
          <ObjectList
            :objects="state.objects"
            :selectedId="selectedId"
            :selectedIds="selectedIds"
            :removable="activeScene === '自定义'"
            @select="onSelectObject"
            @select-group="onSelectGroup"
            @remove="handleRemoveObject"
          />
          <PropertyPanel :object="selectedObject" @update:object="onObjectUpdate" />
        </template>
      </aside>

      <!-- 左侧 Splitter：仅左栏未折叠时渲染 -->
      <div
        v-if="!leftCollapsed"
        class="panel-splitter left-splitter"
        :class="{ dragging: dragSide === 'left' && dragMoved }"
        @mousedown="onSplitterMouseDown($event, 'left')"
      >
        <span class="splitter-arrow">‹</span>
      </div>

      <!-- 中部编辑器区 -->
      <main class="center-editor">
        <div class="editor-tabs">
          <SceneTabs
            :activeScene="activeScene"
            :savedSceneNames="savedSceneNames"
            @switch="onSceneSwitch"
            @delete="deleteSavedScene"
            @rename="onRenameScene"
          />
          <div class="tabs-spacer">
            <button v-if="isSavedSceneActive" class="edit-scene-btn" @click="toggleSavedSceneEdit">
              {{ savedSceneEditing ? '🔒 退出编辑' : '✏️ 编辑' }}
            </button>
            <button class="io-btn" @click="handleExportScene">💾 导出</button>
            <button class="io-btn" @click="triggerImport">📂 导入</button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".json"
              style="display: none"
              @change="onImportFileSelected"
            />
            <button class="save-scene-btn" @click="saveCurrentScene">💾 保存</button>
          </div>
        </div>

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

        <div v-if="mode === 'replay' && !showChart" class="chart-toggle-bar">
          <button class="chart-toggle-btn" @click="showChart = true">📊 显示数据图表</button>
        </div>
        <DataChart
          v-if="mode === 'replay' && showChart"
          :snapshots="snapshots"
          :objects="state.objects"
          :currentFrame="currentFrame"
          @collapse="showChart = false"
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

      <!-- 右侧 Splitter：仅右栏未折叠时渲染 -->
      <div
        v-if="!rightCollapsed"
        class="panel-splitter right-splitter"
        :class="{ dragging: dragSide === 'right' && dragMoved }"
        @mousedown="onSplitterMouseDown($event, 'right')"
      >
        <span class="splitter-arrow">›</span>
      </div>

      <!-- 右侧栏（真题库） -->
      <aside
        class="side-panel right-panel"
        :class="{ collapsed: rightCollapsed }"
        :style="{ width: rightCollapsed ? '0px' : rightPanelWidth + 'px' }"
      >
        <QuestionBankPanel v-if="!rightCollapsed" @load-question="onLoadQuestion" />
      </aside>
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
import DataChart from './components/DataChart.vue'
import AIInput from './components/AIInput.vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import InputDialog from './components/InputDialog.vue'
import QuestionBankPanel from './components/QuestionBankPanel.vue'
import { state, snapshots, currentFrame, keyframeIndices } from './composables/usePhysics'
import { isAIConfigured, configuredModelName } from './composables/useAIParser'
import { useSceneManager } from './composables/useSceneManager'
import { useObjectOperations } from './composables/useObjectOperations'
import { useSceneIO } from './composables/useSceneIO'
import { useKeyboard } from './composables/useKeyboard'
import { resetGroundInitialized } from './composables/useCanvasInteraction'

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
  handleSaveNameConfirm,
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
  showDeleteConfirm,
  pendingDeleteName
} = sceneManager

// ── 名称输入对话框（保存/重命名共用） ──
const nameDialogMode = ref('save') // 'save' | 'rename'
const renameOldName = ref('')

function onSceneSwitch(sceneName) {
  resetGroundInitialized()
  _rawSceneSwitch(sceneName)
}

function onRenameScene(oldName) {
  nameDialogMode.value = 'rename'
  renameOldName.value = oldName
  nameDialogTitle.value = '重命名场景'
  nameDialogInitialValue.value = oldName
  nameDialogPlaceholder.value = '请输入新名称'
  showNameDialog.value = true
}

function handleNameDialogConfirm(value) {
  if (nameDialogMode.value === 'save') {
    if (value === null) {
      showNameDialog.value = false
      return
    }
    const ok = handleSaveNameConfirm(value)
    if (ok) {
      showNameDialog.value = false
    }
    // 保存失败（重名）时不关闭对话框，错误提示由 useSceneManager 设置
  } else if (nameDialogMode.value === 'rename') {
    showNameDialog.value = false
    if (value === null) return // 取消
    const newName = value.trim()
    if (newName && newName !== renameOldName.value) {
      const success = renameSavedScene(renameOldName.value, newName)
      if (!success) {
        alert('重命名失败：名称已存在或无效')
      }
    }
  }
}

const isSavedSceneActive = computed(() => savedSceneNames.value.includes(activeScene.value))

// ===== 文件导入 =====
const fileInputRef = ref(null)

function triggerImport() {
  fileInputRef.value?.click()
}

function onImportFileSelected(event) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  handleImportSceneFromFile(file).then((success) => {
    if (success) {
      saveCurrentScene()
    }
  })
  // 重置 input 以便再次选择同一文件
  input.value = ''
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
  saveCustomScene
})

// ===== 场景 IO =====
const { handleExportScene, handleImportSceneFromFile } = useSceneIO({
  state,
  aiToast,
  selectedId,
  activeScene,
  saveCustomScene
})

// ===== 键盘快捷键 =====
useKeyboard({ onDeleteKey, onUndo, onRedo })

// ===== API Key 对话框 =====
const showApiKeyDialog = ref(false)

function onApiKeySaved() {
  aiToast.value = '✅ AI 配置已保存'
  setTimeout(() => (aiToast.value = ''), 2000)
}
function onApiKeyCleared() {
  aiToast.value = '⚠️ AI 配置已清除，已切换为本地解析'
  setTimeout(() => (aiToast.value = ''), 2000)
}

// ===== 面板宽度与折叠状态 =====
const LEFT_WIDTH_KEY = 'panel_left_width'
const RIGHT_WIDTH_KEY = 'panel_right_width'
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 330
const MIN_WIDTH = 80
const MAX_WIDTH = 500

function loadPanelWidth(key, defaultVal) {
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

const leftPanelWidth = ref(loadPanelWidth(LEFT_WIDTH_KEY, DEFAULT_LEFT))
const rightPanelWidth = ref(loadPanelWidth(RIGHT_WIDTH_KEY, DEFAULT_RIGHT))
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)

// ===== Splitter 拖拽状态 =====
const dragSide = ref(null)
const dragStartX = ref(0)
const dragStartWidth = ref(0)
const dragMoved = ref(false)

function onSplitterMouseDown(e, side) {
  e.preventDefault()
  dragSide.value = side
  dragStartX.value = e.clientX
  dragStartWidth.value = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value
  dragMoved.value = false
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
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

function onMouseUp() {
  // 未移动 → Splitter 点击也切换折叠
  if (!dragMoved.value && dragSide.value) {
    if (dragSide.value === 'left') leftCollapsed.value = !leftCollapsed.value
    else rightCollapsed.value = !rightCollapsed.value
  }
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  dragSide.value = null
}

// ===== 加载题目 =====
function onLoadQuestion(question) {
  handleLoadQuestion(question)
}

// ===== 数据图表面板 =====
const showChart = ref(true)

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

/* ===== Header（精简版）===== */
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

/* ===== Header 侧栏切换按钮组 ===== */
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

/* ===== AI 配置按钮 ===== */
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

.api-icon {
  font-size: 0.85rem;
}

/* ===== Main 三栏 ===== */
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--vsd-bg);
}

/* ===== 共用侧栏 ===== */
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

.right-panel {
  border-left: 1px solid var(--vsd-border);
  overflow-y: auto;
  background: var(--vsd-panel);
}

/* ===== 折叠切换条 ===== */
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

/* ===== 中部编辑器区 ===== */
.center-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--vsd-bg);
}

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

/* VS 扁平按钮风格：保存（主绿） */
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

/* VS 扁平按钮风格：编辑（次蓝） */
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

/* VS 扁平按钮风格：导入导出（次青） */
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

/* 题目描述条 */
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

/* 画布（编辑器主体）- 保持渐变不变 */
.canvas-editor {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 23, 0.95) 100%);
  position: relative;
  overflow: hidden;
}

/* 图表切换条 */
.chart-toggle-bar {
  padding: 0.35rem 0.75rem;
  background: var(--vsd-panel);
  border-top: 1px solid var(--vsd-border);
  flex-shrink: 0;
}

.chart-toggle-btn {
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--vsd-border-light);
  border-radius: 5px;
  background: var(--vsd-button);
  color: var(--vsd-info);
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.chart-toggle-btn:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-blue);
  color: var(--vsd-blue);
}

.center-editor > :deep(.control-bar-wrap) {
  flex-shrink: 0;
}
</style>
