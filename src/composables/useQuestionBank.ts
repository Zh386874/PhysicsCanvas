/**
 * 题库组合式函数：筛选、选中、加载题目
 * 内置题库 + 用户自定义题库（localStorage 持久化）
 */

import { ref, computed } from 'vue'
import { questionBank, type QuestionItem } from '../data/questionBank'

/** localStorage 键：自定义题目 */
const CUSTOM_KEY = 'custom_questions'

/** 从 localStorage 读取自定义题目 */
function loadCustomQuestions(): QuestionItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 全部题目（内置 + 自定义） */
const questions = ref<QuestionItem[]>([...questionBank, ...loadCustomQuestions()])

/** 当前选中的题目 ID */
const selectedId = ref<string | null>(null)

/** 筛选条件 */
const filterDifficulty = ref<'all' | 'easy' | 'medium' | 'hard'>('all')
const filterTag = ref<string | null>(null)
const searchKeyword = ref('')

/** 所有可用标签 */
const allTags = computed(() => {
  const tags = new Set<string>()
  questions.value.forEach((q) => q.tags.forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
})

/** 筛选后的题目列表 */
const filteredQuestions = computed(() => {
  return questions.value.filter((q) => {
    if (filterDifficulty.value !== 'all' && q.difficulty !== filterDifficulty.value) return false
    if (filterTag.value && !q.tags.includes(filterTag.value)) return false
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      if (!q.title.toLowerCase().includes(kw) && !q.description.toLowerCase().includes(kw))
        return false
    }
    return true
  })
})

/** 当前选中的题目 */
const selectedQuestion = computed(() => {
  return questions.value.find((q) => q.id === selectedId.value) || null
})

/** 难度统计 */
const difficultyStats = computed(() => ({
  total: questions.value.length,
  easy: questions.value.filter((q) => q.difficulty === 'easy').length,
  medium: questions.value.filter((q) => q.difficulty === 'medium').length,
  hard: questions.value.filter((q) => q.difficulty === 'hard').length
}))

/** 选中题目 */
function selectQuestion(id: string) {
  selectedId.value = id
}

/** 清除选择 */
function clearSelection() {
  selectedId.value = null
}

/** 自定义题目在内存中的集合（不含内置） */
const customQuestionsList = ref<QuestionItem[]>(loadCustomQuestions())

/** 持久化自定义题目到 localStorage */
function persistCustom() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customQuestionsList.value))
  } catch {
    /* localStorage 不可用时静默失败 */
  }
}

/** 新增题目（写入自定义题库并持久化） */
function addQuestion(item: QuestionItem) {
  customQuestionsList.value = [item, ...customQuestionsList.value]
  persistCustom()
  // 重建合并列表，保证题库面板即时可见
  questions.value = [...questionBank, ...customQuestionsList.value]
}

/** 删除自定义题目 */
function removeCustomQuestion(id: string) {
  customQuestionsList.value = customQuestionsList.value.filter((q) => q.id !== id)
  persistCustom()
  questions.value = [...questionBank, ...customQuestionsList.value]
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
    clearSelection,
    addQuestion,
    removeCustomQuestion
  }
}
