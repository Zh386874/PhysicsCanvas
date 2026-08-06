/**
 * 单元测试：aiPrompts — buildSystemPrompt 结构完整性
 */
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, FEW_SHOT_EXAMPLES } from '../../src/data/aiPrompts'

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt()

  it('包含基础规则（单位/坐标系）', () => {
    expect(prompt).toContain('SI 单位')
    expect(prompt).toContain('地面 y=0')
    expect(prompt).toContain('ball')
    expect(prompt).toContain('arc')
    expect(prompt).toContain('plate')
  })

  it('包含 few-shot 示例（6 个）', () => {
    expect(prompt).toContain('示例1（斜面滑块）')
    expect(prompt).toContain('示例6（板块模型')
    expect(prompt).toContain('板块模型')
  })

  it('包含新增 reasoning / answer 输出要求', () => {
    expect(prompt).toContain('reasoning')
    expect(prompt).toContain('answer')
    expect(prompt).toContain('分步解题过程')
  })

  it('示例数组数量与标题一致', () => {
    expect(FEW_SHOT_EXAMPLES).toHaveLength(6)
    expect(FEW_SHOT_EXAMPLES[0].title).toContain('斜面滑块')
    expect(FEW_SHOT_EXAMPLES[5].title).toContain('板块模型')
  })
})
