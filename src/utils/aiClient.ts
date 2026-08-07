/**
 * 通用 LLM Chat Completions 客户端
 * 统一 fetch / 错误处理 / 状态回调，供 AI 解析器（含多模态/重试）复用。
 * 支持两种 API 格式：
 *  - openai-chat：OpenAI Chat Completions（Bearer 头、/chat/completions、response_format）
 *  - anthropic-messages：Anthropic Messages 原生格式（x-api-key 头、/v1/messages、顶层 system）
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** 文本内容，或用于多模态的 content 数组 */
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export type ApiFormat = 'openai-chat' | 'anthropic-messages'

export interface CallChatCompletionOptions {
  apiBase: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  responseFormat?: { type: 'json_object' }
  /** API 格式，默认 openai-chat */
  format?: ApiFormat
  /** 阶段状态回调（仅用于 UI 进度展示，非流式） */
  onStatus?: (msg: string) => void
}

/** Anthropic Messages 最大输出 token（非流式单次生成上限） */
const MAX_TOKENS = 4096

/** 从消息中提取 Anthropic 顶层 system（仅取字符串内容，多模态 system 忽略） */
function extractSystemText(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => m.content as string)
    .join('\n\n')
}

/** 调用 /chat/completions（或 Anthropic /v1/messages），返回文本内容字符串 */
export async function callChatCompletion(opts: CallChatCompletionOptions): Promise<string> {
  const {
    apiBase,
    apiKey,
    model,
    messages,
    temperature = 0.1,
    responseFormat,
    format = 'openai-chat',
    onStatus
  } = opts

  onStatus?.('连接模型…')

  let response: Response
  if (format === 'anthropic-messages') {
    const system = extractSystemText(messages)
    const chatMessages = messages.filter((m) => m.role !== 'system')
    response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(system ? { system } : {}),
        messages: chatMessages
      })
    })
  } else {
    response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(responseFormat ? { response_format: responseFormat } : {})
      })
    })
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const errData = await response.json()
      detail = errData.error?.message || detail
    } catch {
      /* 忽略解析失败，保留状态文本 */
    }
    throw new Error(`API 调用失败: ${detail}`)
  }

  onStatus?.('生成中…')
  const data = await response.json()
  const content =
    format === 'anthropic-messages' ? data.content?.[0]?.text : data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 未返回有效内容')
  }
  return content
}
