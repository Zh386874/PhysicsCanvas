/**
 * 单元测试：aiClient — 双 API 格式（OpenAI Chat Completions / Anthropic Messages）
 *
 * 覆盖 callChatCompletion 的两种格式分支：
 *  - anthropic-messages：x-api-key 头、anthropic-version 头、顶层 system、无 response_format、content[0].text 解析
 *  - openai-chat：Bearer 头、response_format、choices[0].message.content 解析（回归保护）
 * 仅 mock 外部边界（global fetch）。
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { callChatCompletion } from '../../src/utils/aiClient'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockClear()
})

beforeAll(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('callChatCompletion — anthropic-messages 格式', () => {
  const messages = [
    { role: 'system' as const, content: '你是物理老师' },
    { role: 'user' as const, content: '解析题目' }
  ]

  it('发送 x-api-key / anthropic-version 头，body 含顶层 system 且无 response_format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"topic":"slope"}' }] })
    })

    const text = await callChatCompletion({
      apiBase: 'https://api.anthropic.com/v1/messages',
      apiKey: 'sk-ant-secret',
      model: 'claude-sonnet-4-20250514',
      messages,
      format: 'anthropic-messages'
    })

    expect(text).toBe('{"topic":"slope"}')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
    const headers = init.headers
    expect(headers['x-api-key']).toBe('sk-ant-secret')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['Authorization']).toBeUndefined()

    const body = JSON.parse(init.body)
    expect(body.model).toBe('claude-sonnet-4-20250514')
    expect(body.system).toBe('你是物理老师')
    // system 消息不应进入 messages 数组
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
    // Anthropic 不支持 response_format
    expect(body.response_format).toBeUndefined()
  })

  it('无 system 消息时不发送顶层 system 字段', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] })
    })

    await callChatCompletion({
      apiBase: 'https://api.anthropic.com/v1/messages',
      apiKey: 'sk-ant-secret',
      model: 'claude',
      messages: [{ role: 'user' as const, content: 'hi' }],
      format: 'anthropic-messages'
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toBeUndefined()
    expect(body.messages).toHaveLength(1)
  })

  it('HTTP 失败 → 抛出 API 错误信息', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'invalid api key' } })
    })

    await expect(
      callChatCompletion({
        apiBase: 'https://api.anthropic.com/v1/messages',
        apiKey: 'bad',
        model: 'claude',
        messages: [{ role: 'user' as const, content: 'hi' }],
        format: 'anthropic-messages'
      })
    ).rejects.toThrow('invalid api key')
  })

  it('content 为空 → 抛出无有效内容错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] })
    })

    await expect(
      callChatCompletion({
        apiBase: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-secret',
        model: 'claude',
        messages: [{ role: 'user' as const, content: 'hi' }],
        format: 'anthropic-messages'
      })
    ).rejects.toThrow('AI 未返回有效内容')
  })
})

describe('callChatCompletion — openai-chat 格式（回归保护）', () => {
  it('发送 Bearer 头与 response_format，解析 choices[0].message.content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"topic":"slope"}' } }] })
    })

    const text = await callChatCompletion({
      apiBase: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user' as const, content: 'hi' }],
      responseFormat: { type: 'json_object' }
    })

    expect(text).toBe('{"topic":"slope"}')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['Authorization']).toBe('Bearer sk-test')
    expect(init.headers['x-api-key']).toBeUndefined()
    expect(JSON.parse(init.body).response_format).toEqual({ type: 'json_object' })
  })
})
