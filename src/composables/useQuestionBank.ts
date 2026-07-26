/**
 * 题库组合式函数：筛选、选中、加载题目
 */

import { ref, computed } from 'vue'
import { questionBank, type QuestionItem } from '../data/questionBank'

/** 全部题目 */
const questions = ref<QuestionItem[]>(questionBank)

/** 当前选中的题目 ID */
const selectedId = ref<string | null>(null)

/** 筛选条件 */
const filterDifficulty = ref<'all' | 'easy' | 'medium' | 'hard'>('all')
const filterTag = ref<string | null>(null)
const searchKeyword = ref('')

/** 所有可用标签 */
const allTags = computed(() => {
  const tags = new Set<string>()
  questions.value.forEach(q => q.tags.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
})

/** 筛选后的题目列表 */
const filteredQuestions = computed(() => {
  return questions.value.filter(q => {
    if (filterDifficulty.value !== 'all' && q.difficulty !== filterDifficulty.value) return false
    if (filterTag.value && !q.tags.includes(filterTag.value)) return false
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      if (!q.title.toLowerCase().includes(kw) && !q.description.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

/** 当前选中的题目 */
const selectedQuestion = computed(() => {
  return questions.value.find(q => q.id === selectedId.value) || null
})

/** 难度统计 */
const difficultyStats = computed(() => ({
  total: questions.value.length,
  easy: questions.value.filter(q => q.difficulty === 'easy').length,
  medium: questions.value.filter(q => q.difficulty === 'medium').length,
  hard: questions.value.filter(q => q.difficulty === 'hard').length
}))

/** 选中题目 */
function selectQuestion(id: string) {
  selectedId.value = id
}

/** 清除选择 */
function clearSelection() {
  selectedId.value = null
}

export function useQuestionBank() {
  return {
    questions,
    filteredQuestions,
    selectedId,
    selectedQuestion,
    filterDifficulty,
    filterTag,
    searchKeyword,
    allTags,
    difficultyStats,
    selectQuestion,
    clearSelection
  }
}
