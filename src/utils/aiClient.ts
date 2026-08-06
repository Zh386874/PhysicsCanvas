/**
 * 通用 LLM Chat Completions 客户端
 * 统一 fetch / 错误处理 / 状态回调，供 AI 解析器（含多模态/重试）复用。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** 文本内容，或用于多模态的 content 数组 */
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export interface CallChatCompletionOptions {
  apiBase: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  responseFormat?: { type: 'json_object' }
  /** 阶段状态回调（仅用于 UI 进度展示，非流式） */
  onStatus?: (msg: string) => void
}

/** 调用 /chat/completions，返回 message.content 字符串 */
export async function callChatCompletion(opts: CallChatCompletionOptions): Promise<string> {
  const { apiBase, apiKey, model, messages, temperature = 0.1, responseFormat, onStatus } = opts

  onStatus?.('连接模型…')
  const response = await fetch(apiBase, {
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
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 未返回有效内容')
  }
  return content
}
