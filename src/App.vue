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
          :mode="mode"
          @toggle-play="onTogglePlay"
          @reset="onReset"
          @toggle-force="state.showForce = !state.showForce"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import SceneTabs from './components/SceneTabs.vue'
import ObjectList from './components/ObjectList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import ControlBar from './components/ControlBar.vue'
import PhysicsCanvas from './components/PhysicsCanvas.vue'
import Timeline from './components/Timeline.vue'
import AIInput from './components/AIInput.vue'
import ApiKeyDialog from './components/ApiKeyDialog.vue'
import QuestionBankPanel from './components/QuestionBankPanel.vue'
import { buildScene } from './composables/useSceneBuilder'
import { state, reset, loadScene, updateObjectProperty, addObject, removeObject, snapshots, currentFrame, keyframeIndices, PIXELS_PER_METER } from './composables/usePhysics'
import { getPreset } from './composables/usePresets'
import { pushHistory, undo as historyUndo, redo as historyRedo, clearHistory } from './composables/useHistory'
import { isAIConfigured, configuredModelName } from './composables/useAIParser'

const activeScene = ref('抛体运动')
const selectedId = ref(1)
const selectedIds = ref([])  // 多选（框选）
const mode = ref('live')
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)
const aiToast = ref('')
const showApiKeyDialog = ref(false)
// 编辑模式：自定义场景下未播放时为 true，允许编辑画布
const editMode = computed(() => activeScene.value === '自定义' && mode.value === 'live' && !state.isPlaying)

// API Key 保存/清除后的回调（触发 isAIConfigured 重新计算）
function onApiKeySaved() {
  aiToast.value = '✅ AI 配置已保存'
  setTimeout(() => aiToast.value = '', 2000)
}
function onApiKeyCleared() {
  aiToast.value = '⚠️ AI 配置已清除，已切换为本地解析'
  setTimeout(() => aiToast.value = '', 2000)
}

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
  // 从自定义场景切出时二次确认（编辑内容已自动保存，确认避免误操作）
  if (activeScene.value === '自定义' && sceneName !== '自定义' && state.objects.length > 0) {
    if (!window.confirm('确定切换到「' + sceneName + '」场景？自定义场景内容已自动保存，可随时切回恢复。')) {
      return
    }
  }
  // 场景切换清空撤销/重做历史，避免跨场景撤销
  clearHistory()
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
    // 初始化重置基线：未播放过时重置应回到进入场景时的状态，而非空白
    customSnapshot = deepCopyObjects(state.objects)
  }
}

/**
 * 深拷贝物体数组，剥离运行时字段（trail/prevX/prevY）
 */
function deepCopyObjects(objs) {
  return JSON.parse(JSON.stringify(objs.map(o => {
    const { trail, prevX, prevY, ...rest } = o
    return rest
  })))
}

/**
 * 播放/暂停切换：播放开始时保存自定义场景快照
 */
function onTogglePlay() {
  if (activeScene.value === '自定义' && !state.isPlaying) {
    // 即将播放：保存当前 objects 作为重置恢复点
    customSnapshot = deepCopyObjects(state.objects)
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
 * 包含 objects + gravity + groundY + field，保证场设置等全局参数持久化
 */
function saveCustomScene() {
  if (activeScene.value !== '自定义') return
  try {
    const sceneData = {
      objects: deepCopyObjects(state.objects),
      gravity: state.gravity,
      groundY: state.groundY >= 100000 ? null : state.groundY,
      field: JSON.parse(JSON.stringify(state.field))
    }
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(sceneData))
  } catch (e) {
    // P1-7: 配额超限等异常处理
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      aiToast.value = '场景数据过大，已超出本地存储限制'
      setTimeout(() => { aiToast.value = '' }, 3000)
    }
  }
}

/**
 * 从 localStorage 恢复自定义场景
 * 兼容旧格式（纯数组）和新格式（含全局参数的对象）
 */
function restoreCustomScene() {
  try {
    const data = localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!data) return
    const parsed = JSON.parse(data)
    let objs, gravity, groundY, field
    if (Array.isArray(parsed)) {
      // 旧格式兼容：仅 objects
      objs = parsed
    } else if (parsed && Array.isArray(parsed.objects)) {
      objs = parsed.objects
      gravity = parsed.gravity
      groundY = parsed.groundY
      field = parsed.field
    } else {
      return
    }
    if (!Array.isArray(objs) || objs.length === 0) return
    state.objects.splice(0, state.objects.length)
    for (const o of objs) {
      state.objects.push({ ...o, trail: [] })
    }
    if (gravity !== undefined) state.gravity = gravity
    if (groundY !== undefined) state.groundY = groundY === null ? 100000 : groundY
    if (field) state.field = JSON.parse(JSON.stringify(field))
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
 * AI 通过 buildScene 直接构建场景完成
 * 需切换到"自定义"场景并同步状态（选中、快照、播放）
 */
function handleSceneBuilt(info) {
  // 切换到"自定义"场景（editMode 依赖此判断）
  activeScene.value = '自定义'
  // 同步选中第一个物体
  selectedId.value = state.objects.length > 0 ? state.objects[0].id : null
  selectedIds.value = []
  mode.value = 'live'
  // 保存自定义场景快照（供 reset 恢复）
  customSnapshot = deepCopyObjects(state.objects)
  // 自动开始播放
  state.isPlaying = true
  // 画布提示
  aiToast.value = `AI 已生成：${info.title}（${info.objectCount} 个物体）`
  setTimeout(() => { aiToast.value = '' }, 3000)
}

/**
 * 从题库加载题目：调用 buildScene 构建场景
 */
function handleLoadQuestion(question) {
  const buildResult = buildScene(question.sceneJson)
  if (!buildResult.success) {
    aiToast.value = `加载失败：${buildResult.message}`
    setTimeout(() => { aiToast.value = '' }, 3000)
    return
  }
  // 切换到"自定义"场景
  activeScene.value = '自定义'
  selectedId.value = state.objects.length > 0 ? state.objects[0].id : null
  selectedIds.value = []
  mode.value = 'live'
  customSnapshot = deepCopyObjects(state.objects)
  state.isPlaying = true
  aiToast.value = `已加载：${question.title}`
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
  if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
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
  if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
  addObject(obj)
  selectedId.value = obj.id
  saveCustomScene()
}

/**
 * 更新物体属性（拖拽时实时调用）
 * 注：拖拽过程中频繁调用，不推入历史，由调用方在拖拽结束时推入
 */
function handleUpdateObject({ id, props: newProps }) {
  const obj = state.objects.find(o => o.id === id)
  if (obj) Object.assign(obj, newProps)
  saveCustomScene()
}

/**
 * 删除物体
 * 弧线由多条线段共享 groupId 组成，删除其中一条时整组删除，避免弧线断裂
 */
function handleRemoveObject(id) {
  if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
  const target = state.objects.find(o => o.id === id)
  if (target && target.groupId) {
    // 弧线组：删除同 groupId 的所有线段
    const groupIds = [id]
    for (const o of [...state.objects]) {
      if (o.groupId === target.groupId && o.id !== id) groupIds.push(o.id)
    }
    for (const gid of groupIds) removeObject(gid)
    // 清理多选中已删除的 id
    selectedIds.value = selectedIds.value.filter(sid => !groupIds.includes(sid))
  } else {
    removeObject(id)
    selectedIds.value = selectedIds.value.filter(sid => sid !== id)
  }
  if (selectedId.value === id) selectedId.value = null
  saveCustomScene()
}

/**
 * 导出场景为 JSON 文本（复制到剪贴板，降级 prompt）
 * 包含 objects + gravity + groundY + field 全局参数，保证导入后状态完整
 */
async function handleExportScene() {
  const sceneData = {
    version: 2,
    objects: deepCopyObjects(state.objects),
    gravity: state.gravity,
    // groundY >= 100000 是 usePhysics 内部"禁用地面"的标记，导出为 null 还原语义
    groundY: state.groundY >= 100000 ? null : state.groundY,
    field: JSON.parse(JSON.stringify(state.field))
  }
  const data = JSON.stringify(sceneData, null, 2)
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
 * 校验并规范化单个物体对象
 * @returns {Object|null} 合法物体返回规范化对象，非法返回 null
 */
function validateObject(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const obj = { ...o }
  // 公共字段
  if (typeof obj.id !== 'number' || !isFinite(obj.id)) return null
  if (typeof obj.type !== 'string') return null
  if (!['质点', '刚体', 'line_segment', 'spring'].includes(obj.type)) return null
  if (typeof obj.name !== 'string') obj.name = '未命名'

  if (obj.type === 'line_segment') {
    for (const k of ['x1', 'y1', 'x2', 'y2']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k])) return null
    }
    if (typeof obj.restitution !== 'number' || !isFinite(obj.restitution)) obj.restitution = 0.3
    if (typeof obj.normalX !== 'number') obj.normalX = 0
    if (typeof obj.normalY !== 'number') obj.normalY = -1
  } else if (obj.type === 'spring') {
    for (const k of ['anchorX', 'anchorY', 'naturalLength', 'k']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k])) return null
    }
    if (typeof obj.ballId !== 'number' || !isFinite(obj.ballId)) return null
  } else {
    // 质点 / 刚体
    for (const k of ['x', 'y', 'vx', 'vy']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k])) return null
    }
    if (typeof obj.mass !== 'number' || obj.mass <= 0 || !isFinite(obj.mass)) obj.mass = 1
    if (typeof obj.radius !== 'number' || obj.radius <= 0 || !isFinite(obj.radius)) obj.radius = 15
    if (typeof obj.charge !== 'number' || !isFinite(obj.charge)) obj.charge = 0
  }
  obj.trail = []
  return obj
}

/**
 * 导入场景（从剪贴板读取 JSON，降级 prompt 粘贴）
 * 兼容两种格式：
 *   - 旧格式：纯对象数组（仅 objects）
 *   - 新格式：{ objects, gravity, groundY, field }（完整状态）
 * 导入时校验每个物体属性，跳过非法物体
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
    const parsed = JSON.parse(text)
    let rawObjs, gravity, groundY, field
    if (Array.isArray(parsed)) {
      // 旧格式兼容：仅 objects
      rawObjs = parsed
    } else if (parsed && Array.isArray(parsed.objects)) {
      rawObjs = parsed.objects
      gravity = parsed.gravity
      groundY = parsed.groundY
      field = parsed.field
    } else {
      throw new Error('格式错误：应为数组或含 objects 的对象')
    }
    // 校验每个物体，过滤非法
    const validObjs = rawObjs.map(validateObject).filter(Boolean)
    if (validObjs.length === 0) throw new Error('无有效物体')
    const skipped = rawObjs.length - validObjs.length
    // 导入前推入历史
    if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
    // 清空当前物体，加载导入的
    state.objects.splice(0, state.objects.length)
    for (const o of validObjs) {
      state.objects.push(o)
    }
    // 应用全局参数（groundY=null 表示禁用地面，用 100000 占位）
    if (typeof gravity === 'number' && isFinite(gravity)) state.gravity = gravity
    if (groundY !== undefined) state.groundY = groundY === null ? 100000 : groundY
    if (field && typeof field === 'object') state.field = JSON.parse(JSON.stringify(field))
    selectedId.value = validObjs[0]?.id ?? null
    aiToast.value = '场景已导入（' + validObjs.length + ' 个物体' + (skipped > 0 ? '，已忽略 ' + skipped + ' 个非法' : '') + '）'
    saveCustomScene()
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
  // 回放模式下禁止编辑操作（删除）
  if (mode.value === 'replay') return
  // 优先批量删除多选（弧线组整组删除，避免断裂）
  if (selectedIds.value.length > 0) {
    // 删除前推入历史
    pushHistory(state.objects, state.gravity, state.groundY, state.field)
    // 收集所有需删除的 id（扩展弧线组同组线段）
    const toDelete = new Set()
    for (const id of selectedIds.value) {
      const target = state.objects.find(o => o.id === id)
      if (target && target.groupId) {
        for (const o of state.objects) {
          if (o.groupId === target.groupId) toDelete.add(o.id)
        }
      } else {
        toDelete.add(id)
      }
    }
    for (const id of toDelete) removeObject(id)
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

/**
 * 撤销：从历史栈弹出上一状态并恢复
 */
function onUndo() {
  if (activeScene.value !== '自定义') return
  if (mode.value === 'replay') return
  const prev = historyUndo(state.objects, state.gravity, state.groundY, state.field)
  if (!prev) return
  applyHistorySnapshot(prev)
  aiToast.value = '已撤销'
  setTimeout(() => { aiToast.value = '' }, 1500)
}

/**
 * 重做：从重做栈弹出下一状态并恢复
 */
function onRedo() {
  if (activeScene.value !== '自定义') return
  if (mode.value === 'replay') return
  const next = historyRedo(state.objects, state.gravity, state.groundY, state.field)
  if (!next) return
  applyHistorySnapshot(next)
  aiToast.value = '已重做'
  setTimeout(() => { aiToast.value = '' }, 1500)
}

/**
 * 应用历史快照到 state
 */
function applyHistorySnapshot(snap) {
  state.objects.splice(0, state.objects.length)
  for (const o of snap.objects) state.objects.push({ ...o, trail: [] })
  state.gravity = snap.gravity
  state.groundY = snap.groundY === null ? 100000 : snap.groundY
  state.field = JSON.parse(JSON.stringify(snap.field))
  selectedId.value = snap.objects[0]?.id ?? null
  selectedIds.value = []
  saveCustomScene()
}

function onKeydown(e) {
  // 避免在输入框中触发
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    onDeleteKey()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    onUndo()
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault()
    onRedo()
  }
}

// 监听场设置与重力变化：自定义场景下自动保存到 localStorage
watch(() => state.field, () => saveCustomScene(), { deep: true })
watch(() => state.gravity, () => saveCustomScene())

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onUnmounted(() => { window.removeEventListener('keydown', onKeydown) })
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

.right-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.5);
  border-left: 1px solid rgba(59, 130, 246, 0.2);
  overflow-y: auto;
}
</style>
