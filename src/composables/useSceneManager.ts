/**
 * 场景管理层：场景切换 + 播放/重置 + 自定义场景持久化 + AI/题库加载
 * 从 App.vue 拆分，遵循 SRP
 * 拥有共享状态：activeScene / mode / aiToast / selectedId / selectedIds
 * 通过 watch 监听 field/gravity 变化自动持久化
 */
import { ref, computed, watch } from 'vue'
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
import type { ParsedProblem } from './useAIParser'
import { getPreset } from './usePresets'
import { buildScene } from './useSceneBuilder'
import { clearHistory } from './useHistory'
import { deepCopyObjects } from './useSceneIO'
import { GROUND_DISABLED } from '../constants'

/** 自定义场景 localStorage 键名 */
const CUSTOM_STORAGE_KEY = 'custom_scene_objects'

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

  // 编辑模式：自定义场景下未播放时为 true，允许编辑画布
  const editMode = computed(
    () => activeScene.value === '自定义' && mode.value === 'live' && !state.isPlaying
  )

  // 初始化默认场景：自定义（首屏即自定义页面，尝试恢复上次保存的自定义场景）
  const initialPreset = getPreset('自定义')
  loadScene(
    initialPreset.objects,
    initialPreset.forces,
    initialPreset.field,
    initialPreset.gravity,
    initialPreset.groundY
  )
  state.isPlaying = false
  restoreCustomScene()
  capturePlayStart()

  /**
   * 保存自定义场景到 localStorage
   * 包含 objects + gravity + groundY + field，保证场设置等全局参数持久化
   */
  function saveCustomScene(): void {
    if (activeScene.value !== '自定义') return
    try {
      const sceneData = {
        objects: deepCopyObjects(state.objects),
        gravity: state.gravity,
        groundY: state.groundY >= GROUND_DISABLED ? null : state.groundY,
        field: JSON.parse(JSON.stringify(state.field))
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
        }, 3000)
      }
    }
  }

  /**
   * 从 localStorage 恢复自定义场景
   * 兼容旧格式（纯数组）和新格式（含全局参数的对象）
   */
  function restoreCustomScene(): void {
    try {
      const data = localStorage.getItem(CUSTOM_STORAGE_KEY)
      if (!data) return
      const parsed = JSON.parse(data)
      let objs: unknown[]
      let gravity: unknown
      let groundY: unknown
      let field: unknown
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
      const validObjs = objs.filter((o) => o && typeof o === 'object') as PhysicsObject[]
      if (validObjs.length === 0) return
      state.objects.splice(0, state.objects.length)
      for (const o of validObjs) {
        state.objects.push({ ...o, trail: [] } as PhysicsObject)
      }
      if (gravity !== undefined && typeof gravity === 'number') state.gravity = gravity
      if (groundY !== undefined)
        state.groundY = groundY === null ? GROUND_DISABLED : (groundY as number)
      if (field && typeof field === 'object')
        state.field = JSON.parse(JSON.stringify(field)) as FieldState
      selectedId.value = validObjs[0]?.id ?? null
      aiToast.value = '已恢复上次自定义场景'
      setTimeout(() => {
        aiToast.value = ''
      }, 2500)
    } catch {
      // 静默失败：恢复失败不影响主流程
    }
  }

  /**
   * 场景切换：加载预设或自定义场景
   */
  function onSceneSwitch(sceneName: string): void {
    // 从自定义场景切出时二次确认（编辑内容已自动保存，确认避免误操作）
    if (activeScene.value === '自定义' && sceneName !== '自定义' && state.objects.length > 0) {
      if (
        !window.confirm(
          '确定切换到「' + sceneName + '」场景？自定义场景内容已自动保存，可随时切回恢复。'
        )
      ) {
        return
      }
    }
    // 场景切换清空撤销/重做历史，避免跨场景撤销
    clearHistory()
    activeScene.value = sceneName
    currentQuestionDesc.value = ''
    const preset = getPreset(sceneName)
    loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
    selectedId.value = preset.objects[0]?.id ?? null
    // 切换场景时退出回放模式
    mode.value = 'live'
    // 自定义场景：确保暂停，进入编辑模式；尝试从 localStorage 恢复
    if (sceneName === '自定义') {
      state.isPlaying = false
      restoreCustomScene()
      // restoreCustomScene 绕过 loadScene，须显式捕获重置基线
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
    const buildResult = buildScene(question.sceneJson)
    if (!buildResult.success) {
      aiToast.value = `加载失败：${buildResult.message}`
      setTimeout(() => {
        aiToast.value = ''
      }, 3000)
      return
    }
    activeScene.value = '自定义'
    selectedId.value = state.objects.length > 0 ? state.objects[0].id : null
    selectedIds.value = []
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
    handleLoadQuestion
  }
}
