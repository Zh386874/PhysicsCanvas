/**
 * 场景管理层：场景切换 + 播放/重置 + 自定义场景持久化 + AI/题库加载
 * 从 App.vue 拆分，遵循 SRP
 * 拥有共享状态：activeScene / mode / aiToast / selectedId / selectedIds
 * 通过 watch 监听 field/gravity 变化自动持久化
 */
import { ref, computed, watch, toRaw } from 'vue'
import {
  state,
  loadScene,
  reset,
  capturePlayStart,
  snapshots,
  currentFrame,
  keyframeIndices
} from './usePhysics'
import type { PhysicsObject, FieldState } from './usePhysics'
import type { ParsedProblem } from '../types/aiProblem'
import { getPreset } from './usePresets'
import { buildScene } from './useSceneBuilder'
import { fitViewToObjects } from './useCanvasInteraction'
import { clearHistory } from './useHistory'
import { deepCopyObjects } from './useSceneIO'
import { viewingQuestionScene } from './questionView'
import { GROUND_DISABLED, TOAST_DURATION } from '../constants'

/** 已保存场景数据类型 */
export interface SavedSceneData {
  name: string
  objects: PhysicsObject[]
  gravity: number
  groundY: number | null
  field: FieldState
}

/** 自定义场景 localStorage 键名 */
const CUSTOM_STORAGE_KEY = 'custom_scene_objects'

/** 已保存场景列表 localStorage 键名 */
const SAVED_SCENES_KEY = 'saved_custom_scenes'

/** AI 解析出的物体信息（由 useSceneBuilder 构建后回传） */
export interface SceneBuiltInfo {
  title: string
  objectCount: number
}

/** 题库题目结构（最小契约） */
export interface QuestionPayload {
  title: string
  description?: string
  sceneJson: ParsedProblem
}

/**
 * 场景管理器
 * 拥有场景相关 UI 状态，并提供场景切换/播放/重置/持久化/AI加载/题库加载等操作
 */
export function useSceneManager() {
  // ===== 共享 UI 状态 =====
  const activeScene = ref('自定义')
  const selectedId = ref<number | null>(null)
  const selectedIds = ref<number[]>([]) // 多选（框选）
  const mode = ref<'live' | 'replay'>('live')
  const aiToast = ref('')
  const currentQuestionDesc = ref('')

  // ===== 已保存场景列表 =====
  const savedScenes = ref<SavedSceneData[]>(loadSavedScenesFromStorage())

  /** 从 localStorage 读取已保存场景列表 */
  function loadSavedScenesFromStorage(): SavedSceneData[] {
    try {
      const data = localStorage.getItem(SAVED_SCENES_KEY)
      if (!data) return []
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed
      return []
    } catch {
      return []
    }
  }

  /** 将已保存场景列表持久化到 localStorage */
  function persistSavedScenes(): void {
    try {
      localStorage.setItem(SAVED_SCENES_KEY, JSON.stringify(savedScenes.value))
    } catch {
      // 静默失败
    }
  }

  /** 已保存场景名称列表（供 SceneTabs 展示） */
  const savedSceneNames = computed(() => savedScenes.value.map((s) => s.name))

  /** 自动生成序号名称（"保存1"、"保存2"……） */
  function autoGenerateSceneName(): string {
    let maxNum = 0
    for (const s of savedScenes.value) {
      const m = s.name.match(/^保存(\d+)$/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > maxNum) maxNum = n
      }
    }
    return '保存' + (maxNum + 1)
  }

  // ── 名称输入对话框状态 ──
  const showNameDialog = ref(false)
  const nameDialogTitle = ref('')
  const nameDialogInitialValue = ref('')
  const nameDialogPlaceholder = ref('')
  const nameDialogError = ref('')
  /** 对话框模式：'save' 保存新场景 / 'rename' 重命名已有场景 */
  const nameDialogMode = ref<'save' | 'rename'>('save')
  /** 重命名时记录旧名称 */
  const renameOldName = ref('')

  // ── 删除确认对话框状态 ──
  const showDeleteConfirm = ref(false)
  const pendingDeleteName = ref('')

  /**
   * 保存当前场景为已保存场景
   * 打开名称输入对话框，用户确认后由 handleSaveNameConfirm 执行实际保存
   */
  function saveCurrentScene(): void {
    if (state.objects.length === 0) {
      aiToast.value = '场景为空，无法保存'
      setTimeout(() => {
        aiToast.value = ''
      }, 2000)
      return
    }
    nameDialogError.value = ''
    nameDialogMode.value = 'save' // 确保保存进入保存分支，避免重命名模式残留
    renameOldName.value = '' // 清空重命名残留的旧名
    nameDialogTitle.value = '保存场景'
    nameDialogInitialValue.value = ''
    nameDialogPlaceholder.value = '请输入场景名称'
    showNameDialog.value = true
  }

  /**
   * 处理名称对话框确认（保存或取消）
   * @param name 用户输入的名称；null 表示取消，空字符串表示使用自动生成名称
   * @returns true 表示保存成功（可关闭对话框），false 表示需要保持对话框打开
   */
  function handleSaveNameConfirm(name: string | null): boolean {
    if (name === null) return true // 取消，由调用方关闭对话框
    nameDialogError.value = ''
    const finalName = name.trim() || autoGenerateSceneName()
    // 检查重名
    if (savedScenes.value.some((s) => s.name === finalName)) {
      nameDialogError.value = '名称已存在，请重新命名'
      return false
    }
    const sceneData: SavedSceneData = {
      name: finalName,
      objects: deepCopyObjects(state.objects),
      gravity: state.gravity,
      groundY: state.groundY >= GROUND_DISABLED ? null : state.groundY,
      field: structuredClone(toRaw(state).field)
    }
    savedScenes.value.push(sceneData)
    persistSavedScenes()
    activeScene.value = finalName
    currentQuestionDesc.value = ''
    selectedId.value = state.objects[0]?.id ?? null
    mode.value = 'live'
    aiToast.value = '已保存场景：' + finalName
    setTimeout(() => {
      aiToast.value = ''
    }, 2000)
    return true
  }

  /**
   * 加载已保存场景
   */
  function loadSavedScene(name: string): void {
    const found = savedScenes.value.find((s) => s.name === name)
    if (!found) return
    clearHistory()
    activeScene.value = name
    currentQuestionDesc.value = ''
    loadScene(found.objects, [], found.field, found.gravity, found.groundY ?? undefined)
    selectedId.value = found.objects[0]?.id ?? null
    mode.value = 'live'
  }

  /**
   * 删除已保存场景（弹出确认对话框）
   */
  function deleteSavedScene(name: string): void {
    pendingDeleteName.value = name
    showDeleteConfirm.value = true
  }

  /** 确认删除已保存场景 */
  function confirmDeleteScene(): void {
    showDeleteConfirm.value = false
    const name = pendingDeleteName.value
    pendingDeleteName.value = ''
    const idx = savedScenes.value.findIndex((s) => s.name === name)
    if (idx === -1) return
    savedScenes.value.splice(idx, 1)
    persistSavedScenes()
    // 如果当前正在查看被删除的场景，切回自定义
    if (activeScene.value === name) {
      viewingQuestionScene.value = false
      savedSceneEditing.value = false
      activeScene.value = '自定义'
      const preset = getPreset('自定义')
      loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
      state.isPlaying = false
      capturePlayStart()
    }
  }

  /** 取消删除已保存场景 */
  function cancelDeleteScene(): void {
    showDeleteConfirm.value = false
    pendingDeleteName.value = ''
  }

  /**
   * 重命名已保存场景
   */
  function renameSavedScene(oldName: string, newName: string): boolean {
    const found = savedScenes.value.find((s) => s.name === oldName)
    if (!found) return false
    // 检查新名称是否已存在
    if (savedScenes.value.some((s) => s.name === newName)) return false
    found.name = newName
    persistSavedScenes()
    if (activeScene.value === oldName) {
      activeScene.value = newName
    }
    return true
  }

  /** 是否正在编辑已保存场景 */
  const savedSceneEditing = ref(false)

  /** 切换已保存场景的编辑模式 */
  function toggleSavedSceneEdit(): void {
    savedSceneEditing.value = !savedSceneEditing.value
    if (savedSceneEditing.value) {
      capturePlayStart()
    }
  }

  // 编辑模式：自定义场景下或已保存场景+编辑模式时，未播放且为 live 模式允许编辑
  const editMode = computed(
    () =>
      (activeScene.value === '自定义' ||
        (savedSceneNames.value.includes(activeScene.value) && savedSceneEditing.value)) &&
      mode.value === 'live' &&
      !state.isPlaying
  )

  // 初始化默认场景：自定义（首屏即自定义页面，显示空白画布）
  const initialPreset = getPreset('自定义')
  loadScene(
    initialPreset.objects,
    initialPreset.forces,
    initialPreset.field,
    initialPreset.gravity,
    initialPreset.groundY
  )
  state.isPlaying = false
  capturePlayStart()

  /**
   * 保存自定义场景到 localStorage
   * 包含 objects + gravity + groundY + field，保证场设置等全局参数持久化
   */
  function saveCustomScene(): void {
    if (activeScene.value !== '自定义') return
    if (viewingQuestionScene.value) return // 正在查看题目/AI 场景，不覆盖用户自定义场景
    try {
      const sceneData = {
        objects: deepCopyObjects(state.objects),
        gravity: state.gravity,
        groundY: state.groundY >= GROUND_DISABLED ? null : state.groundY,
        field: structuredClone(toRaw(state).field)
      }
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(sceneData))
    } catch (e: unknown) {
      // 配额超限等异常处理（DOMException 也是 Error 子类，instanceof 可安全收窄）
      if (
        e instanceof Error &&
        (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)
      ) {
        aiToast.value = '场景数据过大，已超出本地存储限制'
        setTimeout(() => {
          aiToast.value = ''
        }, TOAST_DURATION)
      }
    }
  }

  /**
   * 场景切换：加载预设或自定义场景
   */
  function onSceneSwitch(sceneName: string): void {
    // 点击当前已激活的场景标签
    if (sceneName === activeScene.value) {
      // 正在查看题库/AI 场景时，点击「自定义」清除题目并重置为空白自定义画布
      if (sceneName === '自定义' && viewingQuestionScene.value) {
        viewingQuestionScene.value = false
        currentQuestionDesc.value = ''
        state.isPlaying = false
        // 重置为空白自定义场景，避免残留题目/AI 场景物体
        const preset = getPreset('自定义')
        loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
        capturePlayStart()
      }
      return
    }
    // 切到其它场景：复位题目查看状态
    viewingQuestionScene.value = false
    // 切换场景时退出编辑模式
    savedSceneEditing.value = false
    // 场景切换清空撤销/重做历史，避免跨场景撤销
    clearHistory()
    activeScene.value = sceneName
    currentQuestionDesc.value = ''
    mode.value = 'live'
    // 判断是否已保存场景
    const isSaved = savedScenes.value.some((s) => s.name === sceneName)
    if (isSaved) {
      loadSavedScene(sceneName)
      return
    }
    const preset = getPreset(sceneName)
    loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
    selectedId.value = preset.objects[0]?.id ?? null
    // 自定义场景：确保暂停，进入编辑模式（显示空白画布）
    if (sceneName === '自定义') {
      state.isPlaying = false
      capturePlayStart()
    }
  }

  /**
   * 播放/暂停切换：播放开始时捕获重置基线（所有场景）
   */
  function onTogglePlay(): void {
    if (!state.isPlaying) {
      // 即将播放：捕获当前物体作为重置的位置恢复点
      capturePlayStart()
    }
    state.isPlaying = !state.isPlaying
  }

  /**
   * 重置：统一调用 usePhysics.reset()（合并重置——保留用户配置，物理状态恢复到播放起始）
   */
  function onReset(): void {
    reset()
    selectedId.value = state.objects[0]?.id ?? null
    mode.value = 'live'
  }

  /** 切换回放模式 */
  function onToggleReplay(): void {
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
  function handleLoadPreset(sceneName: string): void {
    viewingQuestionScene.value = false
    activeScene.value = sceneName
    const preset = getPreset(sceneName)
    loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
    selectedId.value = preset.objects[0]?.id ?? null
    mode.value = 'live'
    capturePlayStart() // 自动播放前捕获重置基线
    state.isPlaying = true
    aiToast.value = 'AI 已解析：' + sceneName + '场景'
    setTimeout(() => {
      aiToast.value = ''
    }, 3000)
  }

  /**
   * AI 通过 buildScene 直接构建场景完成
   * 需切换到"自定义"场景并同步状态（选中、快照、播放）
   */
  function handleSceneBuilt(info: SceneBuiltInfo): void {
    viewingQuestionScene.value = true
    activeScene.value = '自定义'
    selectedId.value = state.objects.length > 0 ? state.objects[0].id : null
    selectedIds.value = []
    mode.value = 'live'
    capturePlayStart() // 自动播放前捕获重置基线
    state.isPlaying = true
    aiToast.value = `AI 已生成：${info.title}（${info.objectCount} 个物体）`
    setTimeout(() => {
      aiToast.value = ''
    }, 3000)
  }

  /**
   * 从题库加载题目：调用 buildScene 构建场景
   */
  function handleLoadQuestion(question: QuestionPayload): void {
    viewingQuestionScene.value = true
    const buildResult = buildScene(question.sceneJson)
    if (!buildResult.success) {
      viewingQuestionScene.value = false
      aiToast.value = `加载失败：${buildResult.message}`
      setTimeout(() => {
        aiToast.value = ''
      }, 3000)
      return
    }
    activeScene.value = '自定义'
    selectedId.value = state.objects.length > 0 ? state.objects[0].id : null
    selectedIds.value = []
    fitViewToObjects(state.objects) // 加载后自动居中完整显示场景
    mode.value = 'live'
    capturePlayStart() // 自动播放前捕获重置基线
    state.isPlaying = true
    currentQuestionDesc.value = question.description || ''
    aiToast.value = `已加载：${question.title}`
    setTimeout(() => {
      aiToast.value = ''
    }, 3000)
  }

  // 监听场设置与重力变化：自定义场景下自动保存到 localStorage
  watch(
    () => state.field,
    () => saveCustomScene(),
    { deep: true }
  )
  watch(
    () => state.gravity,
    () => saveCustomScene()
  )

  /** 当前场景是否为已保存的场景 */
  const isSavedSceneActive = computed(() => savedSceneNames.value.includes(activeScene.value))

  /**
   * 打开命名对话框（保存/重命名共用）
   */
  function openNameDialog(mode: 'save' | 'rename', options?: { oldName?: string }): void {
    nameDialogMode.value = mode
    nameDialogError.value = ''
    if (mode === 'save') {
      nameDialogTitle.value = '保存场景'
      nameDialogInitialValue.value = ''
      nameDialogPlaceholder.value = '请输入场景名称'
    } else {
      nameDialogTitle.value = '重命名场景'
      nameDialogInitialValue.value = options?.oldName ?? ''
      nameDialogPlaceholder.value = '请输入新名称'
      renameOldName.value = options?.oldName ?? ''
    }
    showNameDialog.value = true
  }

  /**
   * 处理名称对话框确认（保存/重命名共用）
   * @param value 用户输入的名称；null 表示取消
   * @returns true 表示操作成功（可关闭对话框），false 表示需要保持对话框打开
   */
  function handleNameDialogConfirm(value: string | null): boolean {
    nameDialogError.value = ''
    if (value === null) return true // 取消，由调用方关闭对话框

    if (nameDialogMode.value === 'save') {
      return handleSaveNameConfirm(value)
    }

    // rename 模式
    const newName = value.trim()
    if (newName && newName !== renameOldName.value) {
      const success = renameSavedScene(renameOldName.value, newName)
      if (!success) {
        nameDialogError.value = '名称已存在或无效'
        return false
      }
    }
    return true
  }

  // 编辑已保存场景时，自动保存更改到 SavedSceneData
  watch(
    () => state.objects,
    () => {
      if (savedSceneEditing.value && savedSceneNames.value.includes(activeScene.value)) {
        const found = savedScenes.value.find((s) => s.name === activeScene.value)
        if (found) {
          found.objects = deepCopyObjects(state.objects)
          found.gravity = state.gravity
          found.groundY = state.groundY >= GROUND_DISABLED ? null : state.groundY
          found.field = structuredClone(state.field)
          persistSavedScenes()
        }
      }
    },
    { deep: true }
  )

  return {
    // 状态
    activeScene,
    selectedId,
    selectedIds,
    mode,
    aiToast,
    currentQuestionDesc,
    editMode,
    // 操作
    saveCustomScene,
    onSceneSwitch,
    onTogglePlay,
    onReset,
    onToggleReplay,
    handleLoadPreset,
    handleSceneBuilt,
    handleLoadQuestion,
    // 已保存场景
    savedScenes,
    savedSceneNames,
    saveCurrentScene,
    handleSaveNameConfirm,
    deleteSavedScene,
    confirmDeleteScene,
    cancelDeleteScene,
    renameSavedScene,
    savedSceneEditing,
    toggleSavedSceneEdit,
    // 名称输入对话框状态
    showNameDialog,
    nameDialogTitle,
    nameDialogInitialValue,
    nameDialogPlaceholder,
    nameDialogError,
    nameDialogMode,
    renameOldName,
    isSavedSceneActive,
    openNameDialog,
    handleNameDialogConfirm,
    // 删除确认对话框状态
    showDeleteConfirm,
    pendingDeleteName
  }
}
