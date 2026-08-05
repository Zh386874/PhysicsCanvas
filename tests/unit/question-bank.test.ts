/**
 * 单元测试：useQuestionBank（题库筛选/搜索/统计/选中）
 *
 * questions 为模块级 ref 单例，测试中注入自定义数据，避免依赖真实题库具体条目。
 * 断言 filteredQuestions / allTags / difficultyStats / selectedQuestion。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useQuestionBank } from '../../src/composables/useQuestionBank'
import type { QuestionItem } from '../../src/data/questionBank'
import type { ParsedProblem } from '../../src/composables/useAIParser'

const NONE_SCENE: ParsedProblem = {
  topic: 'custom',
  objects: [],
  field: { type: 'none', E: { x: 0, y: 0 }, B: 0 }
}

function makeItem(
  id: string,
  title: string,
  difficulty: 'easy' | 'medium' | 'hard',
  tags: string[]
): QuestionItem {
  return { id, title, description: `desc-${title}`, difficulty, tags, sceneJson: NONE_SCENE }
}

let qb: ReturnType<typeof useQuestionBank>

beforeEach(() => {
  qb = useQuestionBank()
  qb.questions.value = [
    makeItem('1', 'Alpha', 'easy', ['alpha', 'beta']),
    makeItem('2', 'Beta', 'medium', ['beta']),
    makeItem('3', 'Gamma', 'hard', ['gamma'])
  ]
  qb.filterDifficulty.value = 'all'
  qb.filterTag.value = null
  qb.searchKeyword.value = ''
  qb.selectedId.value = null
})

describe('filteredQuestions — 筛选', () => {
  it('按难度筛选', () => {
    qb.filterDifficulty.value = 'easy'
    expect(qb.filteredQuestions.value.map((q) => q.id)).toEqual(['1'])
  })

  it('按标签筛选', () => {
    qb.filterTag.value = 'beta'
    expect(qb.filteredQuestions.value.map((q) => q.id).sort()).toEqual(['1', '2'])
  })

  it('按关键词（大小写不敏感，匹配 title/description）', () => {
    qb.searchKeyword.value = 'BETA'
    expect(qb.filteredQuestions.value.map((q) => q.id)).toEqual(['2'])
    qb.searchKeyword.value = 'desc'
    expect(qb.filteredQuestions.value).toHaveLength(3)
  })

  it('空关键词返回全部', () => {
    expect(qb.filteredQuestions.value).toHaveLength(3)
  })
})

describe('allTags / difficultyStats', () => {
  it('allTags 去重且排序', () => {
    expect(qb.allTags.value).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('difficultyStats 统计各难度数量', () => {
    expect(qb.difficultyStats.value).toEqual({ total: 3, easy: 1, medium: 1, hard: 1 })
  })
})

describe('selectQuestion / selectedQuestion / clearSelection', () => {
  it('选中后 selectedQuestion 返回对应题目', () => {
    qb.selectQuestion('2')
    expect(qb.selectedQuestion.value?.id).toBe('2')
    expect(qb.selectedQuestion.value?.title).toBe('Beta')
  })

  it('clearSelection 后 selectedQuestion 为 null', () => {
    qb.selectQuestion('2')
    qb.clearSelection()
    expect(qb.selectedQuestion.value).toBeNull()
  })
})
