/**
 * AI 解析历史：localStorage 持久化最近 N 条解析结果
 */
import { ref } from 'vue'
import type { ParsedProblem } from '../types/aiProblem'

export interface ParseHistoryItem {
  question: string
  title: string
  topic: string
  timestamp: number
  parsed: ParsedProblem
}

const HISTORY_KEY = 'ai_parse_history'
const MAX_ITEMS = 20

function loadHistory(): ParseHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const history = ref<ParseHistoryItem[]>(loadHistory())

function persist() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch {
    /* localStorage 不可用时静默失败 */
  }
}

/** 新增一条历史（去重：同题覆盖，保留最新） */
function addHistory(item: Omit<ParseHistoryItem, 'timestamp'>) {
  const ts = Date.now()
  history.value = [
    { ...item, timestamp: ts },
    ...history.value.filter((h) => h.question !== item.question)
  ]
  if (history.value.length > MAX_ITEMS) {
    history.value = history.value.slice(0, MAX_ITEMS)
  }
  persist()
}

/** 清空历史 */
function clearHistory() {
  history.value = []
  persist()
}

export function useParseHistory() {
  return { history, addHistory, clearHistory }
}
