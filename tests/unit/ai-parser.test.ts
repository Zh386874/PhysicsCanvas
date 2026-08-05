/**
 * 单元测试：useAIParser — convertToSceneParams（AI 解析结果 → 场景参数）
 *
 * 仅测纯函数 convertToSceneParams，不触网络/API。
 * import 该模块会执行模块级 initConfig()（内部 try/catch，node 无 localStorage 时安全置空）。
 */
import { describe, it, expect } from 'vitest'
import { convertToSceneParams } from '../../src/composables/useAIParser'
import type { ParsedProblem } from '../../src/composables/useAIParser'

describe('convertToSceneParams — topic 映射', () => {
  it('projectile → 抛体运动，ball 参数提取', () => {
    const parsed: ParsedProblem = {
      topic: 'projectile',
      objects: [
        {
          type: 'ball',
          id: 'A',
          mass: 2,
          charge: 1,
          radius: 0.2,
          initialPosition: { x: 1, y: 2 },
          initialVelocity: { x: 3, y: 4 }
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 9.8,
      groundY: 5
    }
    const { sceneName, params } = convertToSceneParams(parsed)
    expect(sceneName).toBe('抛体运动')
    expect(params.mass).toBe(2)
    expect(params.charge).toBe(1)
    expect(params.radius).toBe(0.2)
    expect(params.vx).toBe(3)
    expect(params.vy).toBe(4)
    expect(params.x).toBe(1)
    expect(params.y).toBe(2)
    expect(params.gravity).toBe(9.8)
    expect(params.groundY).toBe(5)
  })

  it('未知 topic（custom）→ sceneName 为 null', () => {
    const parsed: ParsedProblem = {
      topic: 'custom',
      objects: [{ type: 'ball', mass: 1 }],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    }
    expect(convertToSceneParams(parsed).sceneName).toBeNull()
  })

  it('objects 为空 → params 为空对象', () => {
    const parsed: ParsedProblem = {
      topic: 'projectile',
      objects: [],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
    }
    expect(convertToSceneParams(parsed).params).toEqual({})
  })
})

describe('convertToSceneParams — 场参数', () => {
  it('electric 场 → Ex/Ey', () => {
    const parsed: ParsedProblem = {
      topic: 'electric_deflection',
      objects: [{ type: 'ball', mass: 1 }],
      field: { type: 'electric', E: { x: 10, y: -500 }, B: 0 }
    }
    const { params } = convertToSceneParams(parsed)
    expect(params.Ex).toBe(10)
    expect(params.Ey).toBe(-500)
    expect(params.B).toBeUndefined()
  })

  it('magnetic 场 → B', () => {
    const parsed: ParsedProblem = {
      topic: 'magnetic_circle',
      objects: [{ type: 'ball', mass: 1 }],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.5 }
    }
    const { params } = convertToSceneParams(parsed)
    expect(params.B).toBe(0.5)
    expect(params.Ex).toBeUndefined()
  })
})
