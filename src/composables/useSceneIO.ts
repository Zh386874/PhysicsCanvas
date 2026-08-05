/**
 * 场景 IO 层：导出/导入场景 + 物体校验 + 深拷贝
 * 从 App.vue 拆分，遵循 SRP（单一职责原则）
 * 纯函数部分（deepCopyObjects / validateObject）直接导出；
 * 有状态部分（handleExportScene / handleImportScene）通过 useSceneIO 工厂接收 context
 */
import { ref, toRaw, type Ref } from 'vue'
import type { PhysicsState, PhysicsObject } from './usePhysics'
import { isFieldState } from './usePhysics'
import { pushHistory } from './useHistory'
import {
  GROUND_DISABLED,
  GROUND_BASELINE,
  SCENE_VERSION,
  URL_CLEANUP_DELAY,
  TOAST_DURATION
} from '../constants'
import { SceneDataSchema, LegacySceneSchema } from '../schemas/sceneSchema'
import { z } from 'zod'
import { ElMessageBox } from 'element-plus'

/** 合法物体类型字面量 */
const VALID_OBJECT_TYPES = ['质点', '刚体', 'line_segment', 'spring'] as const

/**
 * 深拷贝物体数组，剥离运行时字段（trail/prevX/prevY/arcGateState/constrainedArcGroupId）
 */
export function deepCopyObjects(objs: PhysicsObject[]): PhysicsObject[] {
  // 用 JSON 序列化而非 structuredClone：state.objects 元素为 Vue reactive 代理，
  // structuredClone 无法处理 reactive 代理对象（同 usePhysics.ts capturePlayStart 的处理方式）
  return JSON.parse(
    JSON.stringify(
      objs.map((o) => {
        const { trail, prevX, prevY, arcGateState, constrainedArcGroupId, ...rest } =
          o as unknown as Record<string, unknown>
        return rest
      })
    )
  ) as unknown as PhysicsObject[]
}

/**
 * 校验并规范化单个物体对象
 * @returns 合法物体返回规范化对象，非法返回 null
 */
export function validateObject(o: unknown): PhysicsObject | null {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const obj = { ...(o as Record<string, unknown>) } as Record<string, unknown>
  // 公共字段
  if (typeof obj.id !== 'number' || !isFinite(obj.id)) return null
  if (typeof obj.type !== 'string') return null
  if (!VALID_OBJECT_TYPES.includes(obj.type as (typeof VALID_OBJECT_TYPES)[number])) return null
  if (typeof obj.name !== 'string') obj.name = '未命名'

  if (obj.type === 'line_segment') {
    for (const k of ['x1', 'y1', 'x2', 'y2']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k] as number)) return null
    }
    if (typeof obj.restitution !== 'number' || !isFinite(obj.restitution as number))
      obj.restitution = 0.3
    if (typeof obj.normalX !== 'number') obj.normalX = 0
    if (typeof obj.normalY !== 'number') obj.normalY = -1
  } else if (obj.type === 'spring') {
    for (const k of ['anchorX', 'anchorY', 'naturalLength', 'k']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k] as number)) return null
    }
    if (typeof obj.ballId !== 'number' || !isFinite(obj.ballId as number)) return null
  } else {
    // 质点 / 刚体
    for (const k of ['x', 'y', 'vx', 'vy']) {
      if (typeof obj[k] !== 'number' || !isFinite(obj[k] as number)) return null
    }
    if (typeof obj.mass !== 'number' || obj.mass <= 0 || !isFinite(obj.mass as number)) obj.mass = 1
    if (typeof obj.radius !== 'number' || obj.radius <= 0 || !isFinite(obj.radius as number))
      obj.radius = 15
    if (typeof obj.charge !== 'number' || !isFinite(obj.charge as number)) obj.charge = 0
  }
  obj.trail = []
  return obj as unknown as PhysicsObject
}

/** 场景 IO 上下文：由 App.vue 组装并注入 */
export interface SceneIOContext {
  state: PhysicsState
  aiToast: Ref<string>
  selectedId: Ref<number | null>
  activeScene: Ref<string>
  saveCustomScene: () => void
}

/**
 * 创建场景 IO 操作（导出/导入）
 */
export function useSceneIO(ctx: SceneIOContext) {
  const { state, aiToast, selectedId, activeScene, saveCustomScene } = ctx

  /**
   * 导出场景为 JSON 文件下载
   * 包含 objects + gravity + groundY + field 全局参数，保证导入后状态完整
   */
  function handleExportScene(): void {
    const sceneData = {
      version: SCENE_VERSION,
      objects: deepCopyObjects(state.objects),
      gravity: state.gravity,
      // groundY >= GROUND_DISABLED 是 usePhysics 内部"禁用地面"的标记，导出为 null 还原语义
      groundY: state.groundY >= GROUND_DISABLED ? null : state.groundY,
      field: structuredClone(toRaw(state).field)
    }
    const data = JSON.stringify(sceneData, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scene_export_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 延迟释放 URL 对象，确保浏览器有足够时间启动下载
    setTimeout(() => URL.revokeObjectURL(url), URL_CLEANUP_DELAY)
    aiToast.value = '场景已导出为文件'
    setTimeout(() => {
      aiToast.value = ''
    }, TOAST_DURATION)
  }

  /**
   * 解析 JSON 文本并加载场景（导入核心逻辑）
   * 兼容两种格式：
   *   - 旧格式：纯对象数组（仅 objects）
   *   - 新格式：{ objects, gravity, groundY, field }（完整状态）
   * 导入时校验每个物体属性，跳过非法物体
   * @returns 成功返回 true，失败返回 false
   */
  function parseAndLoadScene(text: string): boolean {
    try {
      const parsed = JSON.parse(text)

      // Zod schema 校验（增强安全性，防止恶意 JSON）
      let sceneData: z.infer<typeof SceneDataSchema>
      if (Array.isArray(parsed)) {
        const result = LegacySceneSchema.safeParse(parsed)
        if (!result.success) {
          const issues = result.error.issues.map((i) => i.message).join('; ')
          throw new Error('场景格式校验失败: ' + issues)
        }
        sceneData = {
          objects: result.data,
          gravity: 490,
          groundY: GROUND_BASELINE,
          field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
        }
      } else {
        const result = SceneDataSchema.safeParse(parsed)
        if (!result.success) {
          const issues = result.error.issues.map((i) => i.message).join('; ')
          throw new Error('场景格式校验失败: ' + issues)
        }
        sceneData = result.data
      }

      let rawObjs: unknown[]
      let gravity: unknown
      let groundY: unknown
      let field: unknown
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
      const validObjs = rawObjs.map(validateObject).filter(Boolean) as PhysicsObject[]
      if (validObjs.length === 0) throw new Error('无有效物体')
      const skipped = rawObjs.length - validObjs.length
      // 导入前推入历史
      if (activeScene.value === '自定义')
        pushHistory(state.objects, state.gravity, state.groundY, state.field)
      // 清空当前物体，加载导入的
      state.objects.splice(0, state.objects.length)
      for (const o of validObjs) {
        state.objects.push(o)
      }
      // 应用全局参数（groundY=null 表示禁用地面，用 GROUND_DISABLED 占位）
      if (typeof gravity === 'number' && isFinite(gravity)) state.gravity = gravity
      if (groundY === null) state.groundY = GROUND_DISABLED
      else if (typeof groundY === 'number' && isFinite(groundY)) state.groundY = groundY
      if (isFieldState(field)) state.field = structuredClone(field)
      selectedId.value = validObjs[0]?.id ?? null
      aiToast.value =
        '场景已导入（' +
        validObjs.length +
        ' 个物体' +
        (skipped > 0 ? '，已忽略 ' + skipped + ' 个非法' : '') +
        '）'
      saveCustomScene()
      setTimeout(() => {
        aiToast.value = ''
      }, 3000)
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      aiToast.value = '导入失败：' + message
      setTimeout(() => {
        aiToast.value = ''
      }, 3000)
      return false
    }
  }

  /**
   * 导入场景（从剪贴板读取 JSON，降级 prompt 粘贴）
   * 通过 parseAndLoadScene 处理解析，保持与文件导入一致的逻辑
   */
  async function handleImportScene(): Promise<boolean> {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // 降级：使用 Element Plus 对话框让用户粘贴
      try {
        const { value } = await ElMessageBox.prompt('粘贴场景 JSON：', '导入场景', {
          inputType: 'textarea',
          inputPlaceholder: '请粘贴场景 JSON 内容...',
          confirmButtonText: '导入',
          cancelButtonText: '取消'
        })
        text = value || ''
      } catch {
        return false
      }
    }
    if (!text) return false
    return parseAndLoadScene(text)
  }

  /**
   * 从文件导入场景
   * 读取文件内容后通过 parseAndLoadScene 处理解析
   */
  function handleImportSceneFromFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        if (!text) {
          aiToast.value = '导入失败：文件为空'
          setTimeout(() => {
            aiToast.value = ''
          }, 3000)
          resolve(false)
          return
        }
        resolve(parseAndLoadScene(text))
      }
      reader.onerror = () => {
        const errMsg = reader.error?.message || '文件读取错误'
        aiToast.value = '导入失败：' + errMsg
        setTimeout(() => {
          aiToast.value = ''
        }, 3000)
        resolve(false)
      }
      reader.readAsText(file)
    })
  }

  /**
   * 文件导入控件状态
   * 提供 fileInputRef 和 triggerImport 供模板使用
   */
  const fileInputRef = ref<HTMLInputElement | null>(null)

  function triggerImport(): void {
    fileInputRef.value?.click()
  }

  function onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    handleImportSceneFromFile(file).then((success) => {
      if (success) {
        saveCustomScene()
      }
    })
    // 重置 input 以便再次选择同一文件
    input.value = ''
  }

  return {
    handleExportScene,
    handleImportScene,
    handleImportSceneFromFile,
    fileInputRef,
    triggerImport,
    onImportFileSelected
  }
}
