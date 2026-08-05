/**
 * 单元测试：useSceneManager 场景切换（自定义场景恢复）
 *
 * 复现 Bug：查看题库/AI 场景后点击「自定义」，场景仍停留在特定（题目/AI）场景，
 * 而未回到用户之前设定的自定义场景。
 *
 * 根因：onSceneSwitch 同标签分支直接调用 restoreCustomScene()，
 * 当 localStorage['custom_scene_objects'] 为空/缺失时 restoreCustomScene 直接 return，
 * 不清空画布上的题目/AI 场景物体，导致题目场景残留。
 *
 * 修复：同标签分支先重置为空白自定义场景（loadScene(getPreset('自定义'))），
 * 再尝试恢复已保存的自定义场景。
 *
 * 环境：vitest 为 node 环境，无 localStorage，需 vi.stubGlobal 提供 polyfill；
 * state / viewingQuestionScene 为模块级单例，beforeEach 需重置。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { state, loadScene, PIXELS_PER_METER } from '../../src/composables/usePhysics'
import { useSceneManager } from '../../src/composables/useSceneManager'
import { clearHistory } from '../../src/composables/useHistory'
import { viewingQuestionScene } from '../../src/composables/questionView'
import { GROUND_DISABLED } from '../../src/constants'
import { getPreset } from '../../src/composables/usePresets'
import type { ParticleObject, FieldState } from '../../src/composables/usePhysics'

const NONE_FIELD: FieldState = { type: 'none', E: { x: 0, y: 0 }, B: 0 }
const GRAVITY = 9.8 * PIXELS_PER_METER
const CUSTOM_STORAGE_KEY = 'custom_scene_objects'

/** 构造最小合法质点 */
function makeBall(id: number, name: string): ParticleObject {
  return {
    id,
    name,
    type: '质点',
    mass: 1,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 10,
    color: '#60a5fa',
    trail: []
  }
}

/** localStorage polyfill（node 环境无 localStorage） */
function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: () => null,
    length: 0
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
  viewingQuestionScene.value = false
  loadScene([], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
  clearHistory()
})

describe('useSceneManager — 查看题目后点击「自定义」', () => {
  it('无保存自定义场景时，清空题目场景回到空白自定义画布（复现 Bug）', () => {
    const sm = useSceneManager()
    // 模拟查看题目：置 viewingQuestionScene，加载题目物体
    viewingQuestionScene.value = true
    loadScene([makeBall(99, 'question-ball')], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    expect(state.objects).toHaveLength(1)

    // 点击「自定义」（activeScene 本就是 '自定义'，走同标签分支）
    sm.onSceneSwitch('自定义')

    // 题目场景必须被清空，回到空白自定义画布
    expect(state.objects).toHaveLength(0)
    expect(viewingQuestionScene.value).toBe(false)
  })

  it('有保存自定义场景时，恢复用户自定义场景（防回归）', () => {
    const customBall = makeBall(1, 'custom-ball')
    localStorage.setItem(
      CUSTOM_STORAGE_KEY,
      JSON.stringify({ objects: [customBall], gravity: GRAVITY, groundY: null, field: NONE_FIELD })
    )
    const sm = useSceneManager()
    // 初始化时已恢复自定义场景
    expect(state.objects.map((o) => o.id)).toContain(1)

    // 模拟查看题目
    viewingQuestionScene.value = true
    loadScene([makeBall(99, 'question-ball')], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    expect(state.objects[0].name).toBe('question-ball')

    // 点击「自定义」→ 恢复用户自定义场景
    sm.onSceneSwitch('自定义')

    expect(viewingQuestionScene.value).toBe(false)
    expect(state.objects.map((o) => o.id)).toContain(1)
    expect(state.objects.map((o) => o.name)).not.toContain('question-ball')
  })
})

describe('useSceneManager — 保存/重命名/删除/切换', () => {
  it('空场景保存被拒绝，toast 示警', () => {
    const sm = useSceneManager()
    sm.saveCurrentScene()
    expect(sm.aiToast.value).toBe('场景为空，无法保存')
    expect(sm.savedScenes.value).toHaveLength(0)
  })

  it('handleSaveNameConfirm(null) 取消返回 true', () => {
    const sm = useSceneManager()
    expect(sm.handleSaveNameConfirm(null)).toBe(true)
  })

  it('保存重名 → false 且提示名称已存在', () => {
    const sm = useSceneManager()
    loadScene([makeBall(1, 'b')], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    sm.savedScenes.value = [
      { name: '已存', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD }
    ]
    expect(sm.handleSaveNameConfirm('已存')).toBe(false)
    expect(sm.nameDialogError.value).toBe('名称已存在，请重新命名')
  })

  it('合法保存的具体状态写入（保存当前场景）因 reactive 代理克隆 bug 受阻，此处仅验证重复名校验', () => {
    // 注：handleSaveNameConfirm 内部对 state.field（Vue reactive 代理）调用 structuredClone，
    //     structuredClone 无法克隆 reactive 代理（见 usePhysics 中 capturePlayStart 注释），
    //     会抛出 DataCloneError。此为真实生产缺陷，超出本「仅测试」会话范围，另行报告。
    const sm = useSceneManager()
    loadScene([makeBall(1, 'b')], [], NONE_FIELD, GRAVITY, GROUND_DISABLED)
    sm.savedScenes.value = [
      { name: '占位', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD }
    ]
    expect(sm.handleSaveNameConfirm('占位')).toBe(false)
  })

  it('renameSavedScene 成功时同步 activeScene', () => {
    const sm = useSceneManager()
    sm.savedScenes.value = [
      { name: '旧', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD }
    ]
    sm.activeScene.value = '旧'
    expect(sm.renameSavedScene('旧', '新')).toBe(true)
    expect(sm.activeScene.value).toBe('新')
  })

  it('renameSavedScene 重名返回 false', () => {
    const sm = useSceneManager()
    sm.savedScenes.value = [
      { name: '旧', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD },
      { name: '新', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD }
    ]
    expect(sm.renameSavedScene('旧', '新')).toBe(false)
  })

  it('删除当前活动场景后切回自定义', () => {
    const sm = useSceneManager()
    sm.savedScenes.value = [
      { name: '已存', objects: [], gravity: GRAVITY, groundY: null, field: NONE_FIELD }
    ]
    sm.activeScene.value = '已存'
    sm.deleteSavedScene('已存')
    sm.confirmDeleteScene()
    expect(sm.savedScenes.value).toHaveLength(0)
    expect(sm.activeScene.value).toBe('自定义')
  })

  it('onSceneSwitch 切换到预设场景时加载其物体', () => {
    const sm = useSceneManager()
    const preset = getPreset('抛体运动')
    expect(preset.objects.length).toBeGreaterThan(0)
    sm.onSceneSwitch('抛体运动')
    expect(state.objects).toHaveLength(preset.objects.length)
  })
})
