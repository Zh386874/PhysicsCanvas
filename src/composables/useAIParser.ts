/**
 * AI 物理题目解析器（接入 DeepSeek API）
 * 将自然语言题目转换为结构化场景参数
 */

import { ref, computed } from 'vue'
import { encrypt, decrypt } from '../utils/crypto'

/** AI 解析结果类型（增强版：多物体、多场、几何体）
 *  拆分为联合类型（ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring），
 *  遵循接口隔离原则（ISP）——每个类型只包含自己需要的字段
 */

/** 二维向量 */
export interface ParsedVec2 {
  x: number
  y: number
}

/** 物体基类：仅包含公共字段 */
export interface BaseParsedObject {
  id?: string
  type: 'ball' | 'platform' | 'arc' | 'spring' | 'plate'
}

/** 质点 / 刚体 */
export interface ParsedBall extends BaseParsedObject {
  type: 'ball'
  mass?: number
  charge?: number
  radius?: number
  initialPosition?: ParsedVec2
  initialVelocity?: ParsedVec2
  fixed?: boolean
  friction?: number
}

/** 线段平台 / 传送带 / 板块 */
export interface ParsedPlatform extends BaseParsedObject {
  type: 'platform'
  startPoint?: ParsedVec2
  endPoint?: ParsedVec2
  friction?: number
  beltVelocity?: ParsedVec2
  movable?: boolean
  mass?: number
}

/** 板块（带物理厚度的可移动长方形，独立类型）
 *  与 platform 区分：板块强制上下表面摩擦分离，带物理厚度与静态倾角 */
export interface ParsedPlate extends BaseParsedObject {
  type: 'plate'
  startPoint?: ParsedVec2
  endPoint?: ParsedVec2
  /** 物理厚度（米），参与碰撞；由用户按题目设定 */
  physicsThickness?: number
  /** 静态倾角（弧度），相对水平面；不动态旋转 */
  angle?: number
  /** 上表面摩擦系数（与物体接触） */
  frictionTop?: number
  /** 下表面摩擦系数（与地面/支撑面接触） */
  frictionBottom?: number
  mass?: number
}

/** 圆弧障碍物 */
export interface ParsedArc extends BaseParsedObject {
  type: 'arc'
  center?: ParsedVec2
  arcRadius?: number
  startAngle?: number
  endAngle?: number
  friction?: number
  /** 螺旋圆轨动态入口缺口（B点），运行时由状态机控制开关 */
  entryGap?: {
    centerAngle: number
    halfWidth: number
    initiallyOpen?: boolean
    triggerType?: 'angleCross' | 'enterRing' | 'spotOverlap'
    triggerAngle?: number
    triggerAction?: 'open' | 'close'
    /** 触发点在环上的弧度（场景 y-up 坐标系）。triggerType='spotOverlap' 时使用 */
    triggerSpotAngle?: number
    /** 触发点半径（米）。缺省运行时取球半径 1.5 倍 */
    triggerSpotRadius?: number
  }
  /** 螺旋圆轨动态出口缺口（E点），运行时由状态机控制开关 */
  exitGap?: {
    centerAngle: number
    halfWidth: number
    initiallyOpen?: boolean
    triggerType?: 'angleCross' | 'enterRing' | 'spotOverlap'
    triggerAngle?: number
    triggerAction?: 'open' | 'close'
    /** 触发点在环上的弧度（场景 y-up 坐标系）。triggerType='spotOverlap' 时使用 */
    triggerSpotAngle?: number
    /** 触发点半径（米）。缺省运行时取球半径 1.5 倍 */
    triggerSpotRadius?: number
  }
}

/** 弹簧 */
export interface ParsedSpring extends BaseParsedObject {
  type: 'spring'
  anchor?: ParsedVec2
  ballId?: string
  naturalLength?: number
  k?: number
}

/** 物体联合类型（判别联合：通过 type 字段收窄） */
export type ParsedObject = ParsedBall | ParsedPlatform | ParsedPlate | ParsedArc | ParsedSpring

export interface ParsedProblem {
  title?: string
  description?: string
  topic:
    | 'projectile'
    | 'slope'
    | 'elastic_collision'
    | 'magnetic_circle'
    | 'electric_deflection'
    | 'custom'
  objects: ParsedObject[]
  field: {
    type: 'none' | 'electric' | 'magnetic' | 'composite'
    E?: { x: number; y: number }
    B?: number
    /** 场区域（SI 单位，米）；undefined = 全场 */
    region?: { x: number; y: number; width: number; height: number }
  }
  gravity?: number
  groundY?: number | null
  worldWidth?: number
  simulationTime?: number
  question?: string
  /** 质点间碰撞恢复系数（0=完全非弹性，1=完全弹性），默认 1 */
  particleRestitution?: number
  /** 地面碰撞恢复系数，默认 0.6 */
  groundRestitution?: number
}

/** 解析状态 */
const loading = ref(false)
const errorMsg = ref('')
const result = ref<ParsedProblem | null>(null)

/** System Prompt：高考物理题解析引擎（增强版，含 few-shot 示例） */
const SYSTEM_PROMPT = `你是一个高考物理题解析引擎。从题目中提取物理情景，输出严格 JSON。

规则：
- 所有物理量使用 SI 单位（米、千克、秒、库仑、特斯拉、牛顿/库仑）
- 缺失量用合理默认值（重力加速度 9.8，质量 1kg，半径 0.2m）
- 坐标系：地面 y=0，向上为正，x 轴向右
- 物体类型：ball（质点）、platform（线段障碍物）、arc（圆弧障碍物）
- platform 用 startPoint/endPoint 表示线段
- arc 用 center/arcRadius/startAngle/endAngle 表示弧线（角度为弧度）
- 场支持复合：E 和 B 可同时非零
- 多物体场景需完整描述所有物体

输出格式：
{
  "title": "题目标题",
  "description": "完整题目文本",
  "topic": "projectile|slope|elastic_collision|magnetic_circle|electric_deflection|custom",
  "objects": [
    {
      "id": "A",
      "type": "ball",
      "mass": 1.0,
      "charge": 0.0,
      "radius": 0.2,
      "initialPosition": { "x": 0, "y": 5 },
      "initialVelocity": { "x": 3, "y": 0 },
      "fixed": false
    },
    {
      "id": "platform1",
      "type": "platform",
      "startPoint": { "x": 2, "y": 0 },
      "endPoint": { "x": 6, "y": 0 },
      "friction": 0.3
    }
  ],
  "field": {
    "type": "none|electric|magnetic|composite",
    "E": { "x": 0, "y": -500 },
    "B": 0.5
  },
  "gravity": 9.8,
  "groundY": 0,
  "worldWidth": 20,
  "simulationTime": 5
}

示例1（斜面滑块）：
题目："质量2kg滑块从倾角30°光滑斜面顶端由静止释放，斜面高5m"
输出：
{"title":"斜面滑块","topic":"slope","objects":[{"id":"A","type":"ball","mass":2,"radius":0.2,"initialPosition":{"x":0,"y":5},"initialVelocity":{"x":0,"y":0}},{"id":"slope","type":"platform","startPoint":{"x":0,"y":5},"endPoint":{"x":8.66,"y":0},"friction":0}],"field":{"type":"none","E":{"x":0,"y":0},"B":0},"gravity":9.8,"groundY":0,"worldWidth":12}

示例2（带电粒子在磁场中）：
题目："带正电粒子质量1e-10kg电荷1e-5C以100m/s水平进入B=0.5T垂直纸面向里的磁场"
输出：
{"title":"磁场圆周","topic":"magnetic_circle","objects":[{"id":"A","type":"ball","mass":1e-10,"charge":1e-5,"radius":0.1,"initialPosition":{"x":0,"y":5},"initialVelocity":{"x":100,"y":0}}],"field":{"type":"magnetic","E":{"x":0,"y":0},"B":0.5},"gravity":0,"groundY":null,"worldWidth":10}

示例3（复合场）：
题目："带电粒子在E=1000N/C向下电场和B=0.2T磁场中运动"
输出：
{"title":"复合场运动","topic":"custom","objects":[{"id":"A","type":"ball","mass":1e-10,"charge":1e-5,"radius":0.1,"initialPosition":{"x":0,"y":5},"initialVelocity":{"x":50,"y":0}}],"field":{"type":"composite","E":{"x":0,"y":-1000},"B":0.2},"gravity":0,"groundY":null,"worldWidth":10}

示例4（弹簧振子/简谐运动）：
题目："质量0.5kg物体挂在劲度系数50N/m弹簧下端，静止平衡后向下拉0.1m释放"
输出：
{"title":"弹簧振子","topic":"custom","objects":[{"id":"A","type":"ball","mass":0.5,"radius":0.15,"initialPosition":{"x":0,"y":0.1},"initialVelocity":{"x":0,"y":0}},{"id":"spring_base","type":"platform","startPoint":{"x":-0.3,"y":0},"endPoint":{"x":0.3,"y":0},"friction":0}],"field":{"type":"none","E":{"x":0,"y":0},"B":0},"gravity":9.8,"groundY":0,"worldWidth":2}
注意：弹簧用高恢复系数地面近似，真实弹簧需后续扩展

示例5（传送带问题）：
题目："质量2kg物体轻放在水平传送带上，传送带速度3m/s，物体与传送带动摩擦因数0.2"
输出：
{"title":"传送带问题","topic":"custom","objects":[{"id":"A","type":"ball","mass":2,"radius":0.2,"initialPosition":{"x":0,"y":0.2},"initialVelocity":{"x":0,"y":0}},{"id":"belt","type":"platform","startPoint":{"x":-2,"y":0},"endPoint":{"x":8,"y":0},"friction":0.2}],"field":{"type":"none","E":{"x":0,"y":0},"B":0},"gravity":9.8,"groundY":0,"worldWidth":10}

示例6（板块模型，type='plate'，带物理厚度与上下表面摩擦分离）：
题目："质量1kg滑块以4m/s滑上静止在光滑地面的质量3kg木板长2m，滑块与木板动摩擦因数0.3"
输出：
{"title":"板块模型","topic":"custom","objects":[{"id":"block","type":"ball","mass":1,"radius":0.2,"initialPosition":{"x":0,"y":0.4},"initialVelocity":{"x":4,"y":0}},{"id":"board","type":"plate","startPoint":{"x":-1,"y":0.2},"endPoint":{"x":1,"y":0.2},"physicsThickness":0.1,"angle":0,"frictionTop":0.3,"frictionBottom":0,"mass":3},{"id":"ground","type":"platform","startPoint":{"x":-5,"y":0},"endPoint":{"x":5,"y":0},"friction":0}],"field":{"type":"none","E":{"x":0,"y":0},"B":0},"gravity":9.8,"groundY":0,"worldWidth":10}
注意：板块用 type='plate'，physicsThickness 为物理厚度(米)，frictionTop 为上表面摩擦(与滑块)，frictionBottom 为下表面摩擦(与地面，光滑地面为0)，angle 为静态倾角(弧度)

请仅返回 JSON，不要添加任何解释文字。`

/** 模型配置定义 */
interface ModelConfig {
  id: string
  name: string
  apiBase: string
  modelName: string
  isMultimodal?: boolean
  contextWindow?: number
  modelFamily?: 'general' | 'deepseek' | 'gpt' | 'claude' | 'glm' | 'other'
}

const MODELS: ModelConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiBase: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat'
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4-flash'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o-mini'
  }
]

const STORAGE_KEY = 'ai_api_config'

/** 移除字符串末尾斜杠 */
function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/** 解密后的配置缓存（由 initConfig 异步填充） */
const savedConfigCache = ref<{ model: ModelConfig; apiKey: string } | null>(null)

/** 从 localStorage 读取并解密 AI 配置，填充缓存 */
async function initConfig(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      savedConfigCache.value = null
      return
    }
    const config = JSON.parse(raw)
    // 解密 API Key
    if (config.apiKey) {
      const decrypted = await decrypt(config.apiKey)
      if (decrypted === null) {
        savedConfigCache.value = null
        return
      }
      config.apiKey = decrypted
    }
    if (!config.apiKey) {
      savedConfigCache.value = null
      return
    }
    // 自定义模型：从保存字段构造 ModelConfig
    if (config.modelId === 'custom') {
      if (!config.customApiBase || !config.customModelName) {
        savedConfigCache.value = null
        return
      }

      // 地址拼接逻辑：
      // 1. 若显式 isFullUrl=true → 用户填写的是完整地址
      // 2. 若 isFullUrl=false → baseUrl + /chat/completions
      // 3. 若 isFullUrl 缺失（旧配置兼容）：
      //    - 若 customApiBase 已以 /chat/completions 结尾 → 视为完整 URL
      //    - 否则 → 视为完整 URL（旧版自定义填写的就是完整路径）
      const isFullUrl = typeof config.isFullUrl === 'boolean' ? config.isFullUrl : true
      const resolvedBase = isFullUrl
        ? config.customApiBase
        : stripTrailingSlash(config.customApiBase) + '/chat/completions'

      const displayName =
        (config.customName && config.customName.trim()) || config.customModelName.trim() || '自定义'

      savedConfigCache.value = {
        model: {
          id: 'custom',
          name: displayName,
          apiBase: resolvedBase,
          modelName: config.customModelName,
          isMultimodal: config.isMultimodal,
          contextWindow: config.contextWindow,
          modelFamily: config.modelFamily
        },
        apiKey: config.apiKey
      }
      return
    }
    const model = MODELS.find((m) => m.id === config.modelId)
    if (!model) {
      savedConfigCache.value = null
      return
    }
    savedConfigCache.value = { model, apiKey: config.apiKey }
  } catch {
    savedConfigCache.value = null
  }
}

/** 从缓存读取已保存的 AI 配置（同步读取，供内部使用） */
function getSavedConfig(): { model: ModelConfig; apiKey: string } | null {
  return savedConfigCache.value
}

/** 是否已配置 AI API Key（从缓存读取，用于 UI 诚实显示） */
const isAIConfigured = computed(() => {
  return savedConfigCache.value !== null
})

/** 已配置的模型名称（用于 UI 显示） */
const configuredModelName = computed(() => {
  return savedConfigCache.value?.model.name ?? ''
})

// 模块加载时初始化配置缓存
initConfig()

/**
 * 调用 AI API 解析题目（支持 DeepSeek / GLM / OpenAI）
 */
export async function parsePhysicsProblem(text: string): Promise<ParsedProblem> {
  loading.value = true
  errorMsg.value = ''
  result.value = null

  try {
    const savedConfig = getSavedConfig()
    if (!savedConfig) {
      throw new Error('未配置 AI API Key，请点击右上角"AI 配置"按钮添加')
    }

    const { model, apiKey } = savedConfig

    const response = await fetch(model.apiBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model.modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.1, // 低温度保证稳定输出
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(`API 调用失败: ${errData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('AI 未返回有效内容')
    }

    // 解析 JSON
    const parsed: ParsedProblem = JSON.parse(content)

    // 基本校验
    if (!parsed.topic) {
      throw new Error('解析结果缺少 topic 字段')
    }

    result.value = parsed
    return parsed
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误'
    errorMsg.value = `解析失败: ${message}`
    throw err
  } finally {
    loading.value = false
  }
}

/**
 * 将 AI 解析结果转换为场景参数（供 AIInput.vue 使用）
 */
export function convertToSceneParams(parsed: ParsedProblem): {
  sceneName: string | null
  params: Record<string, number>
} {
  const topicToScene: Record<string, string> = {
    projectile: '抛体运动',
    slope: '斜面滑块',
    elastic_collision: '弹性碰撞',
    magnetic_circle: '磁场圆周',
    electric_deflection: '电场偏转'
  }

  const sceneName = topicToScene[parsed.topic] || null
  const params: Record<string, number> = {}

  // 提取物体参数（仅第一个物体，SI 单位）
  // 联合类型通过 type 判别收窄：mass/charge/radius/initialPosition/initialVelocity 仅在 ParsedBall 上
  if (parsed.objects.length > 0) {
    const obj = parsed.objects[0]
    if (obj.type === 'ball') {
      if (obj.mass) params.mass = obj.mass
      if (obj.charge) params.charge = obj.charge
      if (obj.radius) params.radius = obj.radius
      if (obj.initialVelocity?.x) params.vx = obj.initialVelocity.x
      if (obj.initialVelocity?.y) params.vy = obj.initialVelocity.y
      if (obj.initialPosition?.x) params.x = obj.initialPosition.x
      if (obj.initialPosition?.y) params.y = obj.initialPosition.y
    }
  }

  // 提取场参数（SI 单位）
  if (parsed.field?.type === 'electric' && parsed.field.E) {
    params.Ex = parsed.field.E.x
    params.Ey = parsed.field.E.y
  } else if (parsed.field?.type === 'magnetic' && parsed.field.B) {
    params.B = parsed.field.B
  }

  // 提取全局参数（SI 单位）
  if (parsed.gravity) params.gravity = parsed.gravity
  if (parsed.groundY) params.groundY = parsed.groundY

  return { sceneName, params }
}

export { loading, errorMsg, result, isAIConfigured, configuredModelName, initConfig }

// ===== API Key 对话框状态（从 App.vue 移入） =====

/** API Key 对话框可见性 */
const showApiKeyDialog = ref(false)

function onApiKeySaved(): void {
  // 重新初始化配置缓存
  initConfig()
}

function onApiKeyCleared(): void {
  savedConfigCache.value = null
}

export { showApiKeyDialog, onApiKeySaved, onApiKeyCleared }
