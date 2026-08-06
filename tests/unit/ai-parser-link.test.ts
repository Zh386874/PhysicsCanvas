/**
 * 单元测试：useAIParser — 真实 AI 网络调用链路
 *
 * 覆盖 parsePhysicsProblem 的 fetch 调用路径：成功解析、HTTP 失败、网络异常、未配置。
 * 仅 mock 外部边界（WebCrypto decrypt、global fetch），验证真实请求头与解析逻辑。
 * 制造合法 ParsedProblem 响应，断言返回对象与请求参数。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Mock 加密模块：initConfig 读取 localStorage 时用 decrypt 解出明文。
// 这里 mock 的是外部依赖（WebCrypto），非被测逻辑。
vi.mock('../../src/utils/crypto', () => ({
  encrypt: async (s: string) => s,
  decrypt: async (s: string) => s
}))

import { initConfig, parsePhysicsProblem } from '../../src/composables/useAIParser'

/** 简易 localStorage 桩（node 环境无 localStorage） */
const fakeStorage = (() => {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear()
  }
})()

const STORAGE_KEY = 'ai_api_config'
const mockFetch = vi.fn()

/** 构造一个合法 AI 响应的 ParsedProblem */
function validProblem() {
  return {
    title: '斜面滑块',
    topic: 'slope',
    objects: [{ id: 'A', type: 'ball', mass: 2, initialPosition: { x: 0, y: 5 } }],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    gravity: 9.8,
    groundY: 0
  }
}

/** 写入 deepseek 配置并重新初始化缓存 */
async function configureDeepseek() {
  fakeStorage.setItem(STORAGE_KEY, JSON.stringify({ modelId: 'deepseek', apiKey: 'test-key' }))
  await initConfig()
}

beforeAll(() => {
  vi.stubGlobal('localStorage', fakeStorage)
  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('parsePhysicsProblem — 真实链路', () => {
  it('成功：fetch 返回合法 JSON → 解析出 ParsedProblem，并携带授权头', async () => {
    await configureDeepseek()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(validProblem()) } }] })
    })

    const parsed = await parsePhysicsProblem('测试题目')

    expect(parsed.topic).toBe('slope')
    expect(parsed.objects[0].type).toBe('ball')
    expect(parsed.objects[0].mass).toBe(2)

    // 校验请求地址与授权头
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' })
      })
    )
  })

  it('HTTP 失败：response.ok=false → 抛出 API 错误信息', async () => {
    await configureDeepseek()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'invalid api key' } })
    })

    await expect(parsePhysicsProblem('测试题目')).rejects.toThrow('invalid api key')
  })

  it('网络异常：fetch reject → 抛出底层错误', async () => {
    await configureDeepseek()
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(parsePhysicsProblem('测试题目')).rejects.toThrow('Failed to fetch')
  })

  it('未配置：缓存为空 → 抛出引导配置错误', async () => {
    fakeStorage.clear()
    await initConfig()

    await expect(parsePhysicsProblem('测试题目')).rejects.toThrow('未配置 AI API Key')
  })

  it('AI 返回空 content → 抛出无有效内容错误', async () => {
    await configureDeepseek()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] })
    })

    await expect(parsePhysicsProblem('测试题目')).rejects.toThrow('AI 未返回有效内容')
  })
})
