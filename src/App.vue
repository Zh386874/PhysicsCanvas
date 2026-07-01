<template>
  <div class="app">
    <header class="app-header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">物理解模</span>
      </div>
      <SceneTabs :activeScene="activeScene" @switch="onSceneSwitch" />
    </header>

    <div class="main">
      <div class="left-panel">
        <AIInput @load-preset="handleLoadPreset" @update-params="handleUpdateParams" />
        <ObjectList
          :objects="state.objects"
          :selectedId="selectedId"
          :selectedIds="selectedIds"
          :removable="activeScene === '自定义'"
          @select="onSelectObject"
          @remove="handleRemoveObject"
        />
        <PropertyPanel
          :object="selectedObject"
          @update:object="onObjectUpdate"
        />
      </div>

      <div class="right-area">
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
          :mode="mode"
          @toggle-play="onTogglePlay"
          @reset="onReset"
          @toggle-force="state.showForce = !state.showForce"
          @toggle-replay="onToggleReplay"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SceneTabs from './components/SceneTabs.vue'
import ObjectList from './components/ObjectList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import ControlBar from './components/ControlBar.vue'
import PhysicsCanvas from './components/PhysicsCanvas.vue'
import Timeline from './components/Timeline.vue'
import AIInput from './components/AIInput.vue'
import { state, reset, loadScene, updateObjectProperty, addObject, removeObject, snapshots, currentFrame, keyframeIndices, PIXELS_PER_METER } from './composables/usePhysics'
import { getPreset } from './composables/usePresets'

const activeScene = ref('抛体运动')
const selectedId = ref(1)
const selectedIds = ref([])  // 多选（框选）
const mode = ref('live')
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)
const aiToast = ref('')
// 编辑模式：自定义场景下未播放时为 true，允许编辑画布
const editMode = computed(() => activeScene.value === '自定义' && mode.value === 'live' && !state.isPlaying)

// 自定义场景：播放前快照（重置时恢复到此状态，而非空白）
let customSnapshot = null
const CUSTOM_STORAGE_KEY = 'custom_scene_objects'

// 初始化默认场景
{
  const preset = getPreset('抛体运动')
  loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
}

const selectedObject = computed(() =>
  state.objects.find(o => o.id === selectedId.value)
)

function onObjectUpdate(updated) {
  const idx = state.objects.findIndex(o => o.id === updated.id)
  if (idx !== -1) Object.assign(state.objects[idx], updated)
}

function onSceneSwitch(sceneName) {
  activeScene.value = sceneName
  const preset = getPreset(sceneName)
  loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
  selectedId.value = preset.objects[0]?.id ?? null
  // 切换场景时退出回放模式
  mode.value = 'live'
  // 自定义场景：确保暂停，进入编辑模式；尝试从 localStorage 恢复
  if (sceneName === '自定义') {
    state.isPlaying = false
    restoreCustomScene()
  }
}

/**
 * 播放/暂停切换：播放开始时保存自定义场景快照
 */
function onTogglePlay() {
  if (activeScene.value === '自定义' && !state.isPlaying) {
    // 即将播放：保存当前 objects 作为重置恢复点
    customSnapshot = JSON.parse(JSON.stringify(state.objects.map(o => {
      const { trail, prevX, prevY, ...rest } = o
      return rest
    })))
  }
  state.isPlaying = !state.isPlaying
}

function onReset() {
  // 自定义场景：恢复到播放前快照，而非空白
  if (activeScene.value === '自定义' && customSnapshot) {
    state.objects.splice(0, state.objects.length)
    for (const o of customSnapshot) {
      state.objects.push({ ...o, trail: [] })
    }
    state.time = 0
    state.isPlaying = false
    snapshots.value.splice(0, snapshots.value.length)
    currentFrame.value = 0
    selectedId.value = state.objects[0]?.id ?? null
    mode.value = 'live'
    return
  }
  reset()
  mode.value = 'live'
}

/**
 * 保存自定义场景到 localStorage
 */
function saveCustomScene() {
  if (activeScene.value !== '自定义') return
  try {
    const data = JSON.stringify(state.objects.map(o => {
      const { trail, prevX, prevY, ...rest } = o
      return rest
    }))
    localStorage.setItem(CUSTOM_STORAGE_KEY, data)
  } catch {}
}

/**
 * 从 localStorage 恢复自定义场景
 */
function restoreCustomScene() {
  try {
    const data = localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!data) return
    const objs = JSON.parse(data)
    if (!Array.isArray(objs) || objs.length === 0) return
    state.objects.splice(0, state.objects.length)
    for (const o of objs) {
      state.objects.push({ ...o, trail: [] })
    }
    selectedId.value = objs[0]?.id ?? null
    aiToast.value = '已恢复上次自定义场景'
    setTimeout(() => { aiToast.value = '' }, 2500)
  } catch {}
}

function onToggleReplay() {
  if (mode.value === 'live') {
    // 进入回放：暂停物理，跳到最后一帧
    state.isPlaying = false
    mode.value = 'replay'
    if (snapshots.value.length > 0) {
      currentFrame.value = snapshots.value.length - 1
    }
  } else {
    mode.value = 'live'
  }
}

/**
 * AI 解析完成：加载对应预设 + 自动播放 + 画布提示
 */
function handleLoadPreset(sceneName) {
  activeScene.value = sceneName
  const preset = getPreset(sceneName)
  loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
  selectedId.value = preset.objects[0]?.id ?? null
  mode.value = 'live'
  // 自动开始播放
  state.isPlaying = true
  // 显示画布左上角提示
  aiToast.value = 'AI 已解析：' + sceneName + '场景'
  setTimeout(() => { aiToast.value = '' }, 3000)
}

/**
 * AI 解析出的参数应用到第一个质点物体
 * params 中速度为 m/s，需 ×PIXELS_PER_METER 转像素
 */
function handleUpdateParams(params) {
  const obj = state.objects.find(o => o.type === '质点')
  if (!obj) return
  if (params.mass !== undefined) updateObjectProperty(obj.id, 'mass', params.mass)
  if (params.vx !== undefined) updateObjectProperty(obj.id, 'vx', params.vx * PIXELS_PER_METER)
  if (params.charge !== undefined) updateObjectProperty(obj.id, 'charge', params.charge)
}

/**
 * 选中物体：单击时清空多选，仅选中单个
 */
function onSelectObject(id) {
  selectedId.value = id
  selectedIds.value = []
}

/**
 * 批量更新（框选拖拽时整体平移）
 * updates: [{ id, props }]
 */
function handleBatchUpdate(updates) {
  for (const { id, props } of updates) {
    const obj = state.objects.find(o => o.id === id)
    if (obj) Object.assign(obj, props)
  }
  saveCustomScene()
}

/**
 * 添加物体（自定义场景编辑）
 */
function handleAddObject(obj) {
  addObject(obj)
  selectedId.value = obj.id
  saveCustomScene()
}

/**
 * 更新物体属性（拖拽时实时调用）
 */
function handleUpdateObject({ id, props: newProps }) {
  const obj = state.objects.find(o => o.id === id)
  if (obj) Object.assign(obj, newProps)
  saveCustomScene()
}

/**
 * 删除物体
 */
function handleRemoveObject(id) {
  removeObject(id)
  if (selectedId.value === id) selectedId.value = null
  saveCustomScene()
}

/**
 * 导出场景为 JSON 文本（复制到剪贴板，降级 prompt）
 */
async function handleExportScene() {
  const data = JSON.stringify(state.objects.map(o => {
    const { trail, prevX, prevY, ...rest } = o
    return rest
  }), null, 2)
  try {
    await navigator.clipboard.writeText(data)
    aiToast.value = '场景已导出到剪贴板'
  } catch {
    // 降级：用 prompt 显示文本供用户复制
    prompt('复制下方 JSON 文本（剪贴板不可用）：', data)
    aiToast.value = ''
    return
  }
  setTimeout(() => { aiToast.value = '' }, 3000)
}

/**
 * 导入场景（从剪贴板读取 JSON，降级 prompt 粘贴）
 */
async function handleImportScene() {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    // 降级：用 prompt 让用户粘贴
    text = prompt('粘贴场景 JSON：', '') || ''
  }
  if (!text) return
  try {
    const objs = JSON.parse(text)
    if (!Array.isArray(objs)) throw new Error('格式错误：应为数组')
    // 清空当前物体，加载导入的
    state.objects.splice(0, state.objects.length)
    for (const o of objs) {
      state.objects.push({ ...o, trail: [] })
    }
    selectedId.value = objs[0]?.id ?? null
    aiToast.value = '场景已导入（' + objs.length + ' 个物体）'
  } catch (err) {
    aiToast.value = '导入失败：' + err.message
  }
  setTimeout(() => { aiToast.value = '' }, 3000)
}

/**
 * 删除选中物体（Delete 键）
 */
function onDeleteKey() {
  if (activeScene.value !== '自定义') return
  // 优先批量删除多选
  if (selectedIds.value.length > 0) {
    for (const id of [...selectedIds.value]) {
      removeObject(id)
    }
    selectedIds.value = []
    if (selectedId.value !== null && !state.objects.find(o => o.id === selectedId.value)) {
      selectedId.value = null
    }
    saveCustomScene()
    return
  }
  if (selectedId.value !== null) {
    handleRemoveObject(selectedId.value)
  }
}

function onKeydown(e) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // 避免在输入框中触发
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    onDeleteKey()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
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
</style>
