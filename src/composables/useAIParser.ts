/**
 * AI 物理题目解析器（接入 DeepSeek / GLM / OpenAI 等 Chat Completions API）
 * 将自然语言题目(支持题图多模态)转换为结构化场景参数
 * 链路：LLM 调用 → zod 校验(自纠错重试) → 边界兜底 → 供 buildScene 构建场景
 */
import { ref, computed } from 'vue'
import { decrypt } from '../utils/crypto'
import { buildSystemPrompt } from '../data/aiPrompts'
import { callChatCompletion, type ChatMessage } from '../utils/aiClient'
import { parseAIProblem, sanitizeParsedProblem } from '../utils/aiSchema'
import type { ParsedProblem } from '../types/aiProblem'

// 对外兼容：类型统一从 types/aiProblem 导出
export type {
  ParsedVec2,
  BaseParsedObject,
  ParsedBall,
  ParsedPlatform,
  ParsedPlate,
  ParsedArc,
  ParsedSpring,
  ParsedObject,
  ParsedProblem
} from '../types/aiProblem'

/** 解析状态 */
const loading = ref(false)
const errorMsg = ref('')
const result = ref<ParsedProblem | null>(null)

/** 模型配置定义 */
interface ModelConfig {
  id: string
  name: string
  apiBase: string
  modelName: string
  isMultimodal?: boolean
  contextWindow?: number
  format?: 'openai-chat' | 'anthropic-messages'
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
    id: 'glm-vl',
    name: '智谱 GLM-4V（多模态）',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4v-plus',
    isMultimodal: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o-mini'
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    apiBase: 'https://api.anthropic.com/v1/messages',
    modelName: 'claude-sonnet-4-20250514',
    format: 'anthropic-messages'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelName: 'gemini-1.5-flash'
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

      // 地址拼接逻辑（按 API 格式感知）：
      // - anthropic-messages：用户填写的是完整端点（/v1/messages），不拼接
      // - openai-chat：
      //   1. 若显式 isFullUrl=true → 用户填写的是完整地址
      //   2. 若 isFullUrl=false → baseUrl + /chat/completions
      //   3. 若 isFullUrl 缺失（旧配置兼容）：
      //      - 若 customApiBase 已以 /chat/completions 结尾 → 视为完整 URL
      //      - 否则 → 视为完整 URL（旧版自定义填写的就是完整路径）
      const apiFormat =
        config.apiFormat === 'anthropic-messages' ? 'anthropic-messages' : 'openai-chat'
      let resolvedBase: string
      if (apiFormat === 'anthropic-messages') {
        resolvedBase = config.customApiBase
      } else {
        const isFullUrl = typeof config.isFullUrl === 'boolean' ? config.isFullUrl : true
        resolvedBase = isFullUrl
          ? config.customApiBase
          : stripTrailingSlash(config.customApiBase) + '/chat/completions'
      }

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
          format: apiFormat
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

/** 已配置模型是否支持多模态（用于 UI 决定是否显示上传题图入口） */
const configuredModelIsMultimodal = computed(() => {
  return savedConfigCache.value?.model.isMultimodal ?? false
})

/** 供 ApiKeyDialog 展示（单一状态来源）：已配置时返回模型名与占位 Key 标记，否则 null */
const savedConfigDisplay = computed(() =>
  savedConfigCache.value
    ? { modelName: savedConfigCache.value.model.name, maskedKey: '已配置' }
    : null
)

// 模块加载时初始化配置缓存
initConfig()

/** 解析选项：题图(data URL) + 阶段状态回调 */
export interface ParseOptions {
  imageDataUrl?: string
  onStatus?: (msg: string) => void
}

/**
 * 调用 AI API 解析题目（支持文本 / 题图多模态；失败自动自纠错重试）
 */
export async function parsePhysicsProblem(
  text: string,
  options: ParseOptions = {}
): Promise<ParsedProblem> {
  loading.value = true
  errorMsg.value = ''
  result.value = null

  try {
    const savedConfig = getSavedConfig()
    if (!savedConfig) {
      throw new Error('未配置 AI API Key，请点击右上角"AI 配置"按钮添加')
    }

    const { model, apiKey } = savedConfig
    const imageDataUrl = options.imageDataUrl
    if (imageDataUrl && !model.isMultimodal) {
      throw new Error('当前模型不支持图片解析，请更换多模态模型（如 智谱 GLM-4V）')
    }

    options.onStatus?.('生成中…')
    const systemPrompt = buildSystemPrompt()
    const userMessage: ChatMessage = imageDataUrl
      ? {
          role: 'user',
          content: [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      : { role: 'user', content: text }

    let messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, userMessage]

    // 首次尝试 + 最多 2 次自纠错重试（仅针对"拿到输出但格式/校验失败"，HTTP/网络错误直接抛出）
    for (let attempt = 0; attempt <= 2; attempt++) {
      // 调用阶段：HTTP/网络错误直接抛出，不重试
      const content = await callChatCompletion({
        apiBase: model.apiBase,
        apiKey,
        model: model.modelName,
        messages,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
        format: model.format,
        onStatus: attempt === 0 ? options.onStatus : undefined
      })

      // 解析阶段：格式/校验失败时自纠错重试
      try {
        options.onStatus?.('校验中…')
        let raw: unknown
        try {
          raw = JSON.parse(content)
        } catch {
          throw new Error('AI 输出不是有效 JSON')
        }
        // zod 强类型校验，失败抛出带可读原因
        const parsed = parseAIProblem(raw)
        // 边界兜底：非有限值钳制
        const sanitized = sanitizeParsedProblem(parsed)

        options.onStatus?.('生成场景…')
        result.value = sanitized
        return sanitized
      } catch (err: unknown) {
        if (attempt < 2) {
          const reason = err instanceof Error ? err.message : String(err)
          messages = [
            ...messages,
            { role: 'assistant', content },
            {
              role: 'user',
              content: `上次输出无效原因：${reason}。请根据原题重新输出严格 JSON（仅 JSON，不要解释文字）。原题：${text}`
            }
          ]
        } else {
          throw err
        }
      }
    }

    // 循环结束后若仍失败（理论上不可达，因最后一次会 throw）
    throw new Error('AI 解析多次尝试后仍失败')
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
 * @deprecated 遗留函数，仅测试使用；实际场景构建走 buildScene()
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

export {
  loading,
  errorMsg,
  result,
  isAIConfigured,
  configuredModelName,
  configuredModelIsMultimodal,
  savedConfigDisplay,
  initConfig
}

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
