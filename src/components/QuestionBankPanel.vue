<template>
  <div class="question-bank-panel">
    <div v-if="!embedded" class="panel-header" @click="collapsed = !collapsed">
      <span class="header-title">📚 真题库</span>
      <span class="header-count">{{ difficultyStats.total }} 道</span>
      <span class="toggle-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-show="embedded || !collapsed" class="panel-body">
      <!-- 搜索框 -->
      <input v-model="searchKeyword" class="search-input" placeholder="🔍 搜索题目..." />

      <!-- 筛选栏 -->
      <div class="filters">
        <select v-model="filterDifficulty" class="filter-select">
          <option value="all">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <select v-model="filterTag" class="filter-select">
          <option :value="null">全部标签</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>

      <!-- 题目列表 -->
      <div class="question-list">
        <div
          v-for="q in filteredQuestions"
          :key="q.id"
          class="question-item"
          :class="{ active: selectedId === q.id }"
          @click="selectQuestion(q.id)"
        >
          <div class="question-header">
            <div class="question-title">{{ q.title }}</div>
            <button class="load-btn" @click.stop="handleLoad(q)" title="加载此题目">▶</button>
          </div>
          <div class="question-desc">{{ q.description.substring(0, 60) }}...</div>
          <div class="question-meta">
            <span class="difficulty-badge" :class="'diff-' + q.difficulty">
              {{ q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难' }}
            </span>
            <span v-for="tag in q.tags" :key="tag" class="tag-badge">{{ tag }}</span>
          </div>
        </div>
        <div v-if="filteredQuestions.length === 0" class="empty-hint">没有匹配的题目</div>
      </div>

      <!-- 加载按钮 -->
      <button class="apply-btn" :disabled="!selectedQuestion" @click="handleApply">
        {{ selectedQuestion ? '▶ 加载场景并播放' : '请选择题目' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuestionBank } from '../composables/useQuestionBank'

defineProps({
  embedded: { type: Boolean, default: false }
})

const emit = defineEmits(['load-question'])

const {
  filteredQuestions,
  selectedId,
  selectedQuestion,
  filterDifficulty,
  filterTag,
  searchKeyword,
  allTags,
  difficultyStats,
  selectQuestion
} = useQuestionBank()

const collapsed = ref(false)

function handleApply() {
  if (!selectedQuestion.value) return
  emit('load-question', selectedQuestion.value)
}

function handleLoad(q) {
  if (!q) return
  selectQuestion(q.id)
  emit('load-question', q)
}
</script>

<style scoped>
.question-bank-panel {
  background: transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  background: rgba(var(--vsd-panel-light-rgb), 0.5);
  transition: background 0.2s;
}

.panel-header:hover {
  background: rgba(var(--vsd-panel-light-rgb), 0.8);
}

.header-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vsd-text);
}

.header-count {
  font-size: 0.7rem;
  color: var(--vsd-text-dim);
  background: rgba(var(--vsd-border-light-rgb), 0.2);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.toggle-icon {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--vsd-text-dim);
}

.panel-body {
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.search-input {
  padding: 0.4rem 0.6rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(157, 157, 157, 0.2);
  border-radius: 5px;
  color: var(--vsd-text);
  font-size: 0.78rem;
  outline: none;
}

.search-input:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
}

.search-input::placeholder {
  color: var(--vsd-text-dim);
}

.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.filter-select {
  padding: 0.3rem 0.4rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(157, 157, 157, 0.2);
  border-radius: 4px;
  color: var(--vsd-text);
  font-size: 0.72rem;
  outline: none;
  cursor: pointer;
}

.filter-select option {
  background: var(--vsd-panel-light);
}

.question-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.question-list::-webkit-scrollbar {
  width: 4px;
}

.question-list::-webkit-scrollbar-thumb {
  background: rgba(157, 157, 157, 0.3);
  border-radius: 2px;
}

.question-item {
  padding: 0.5rem 0.55rem;
  background: rgba(var(--vsd-panel-light-rgb), 0.4);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.question-item:hover {
  background: var(--vsd-hover);
  border-color: rgba(var(--vsd-blue-rgb), 0.2);
}

.question-item.active {
  background: var(--vsd-selection);
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
}

.question-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--vsd-text);
  flex: 1;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.load-btn {
  padding: 0.2rem 0.5rem;
  background: rgba(var(--vsd-cyan-rgb), 0.2);
  border: 1px solid rgba(var(--vsd-cyan-rgb), 0.4);
  border-radius: 4px;
  color: var(--vsd-cyan);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}

.load-btn:hover {
  background: rgba(var(--vsd-cyan-rgb), 0.4);
  border-color: rgba(var(--vsd-cyan-rgb), 0.7);
}

.question-desc {
  font-size: 0.68rem;
  color: var(--vsd-text-dim);
  line-height: 1.4;
  margin-bottom: 0.3rem;
}

.question-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.difficulty-badge {
  font-size: 0.62rem;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
}

.diff-easy {
  background: rgba(var(--vsd-green-rgb), 0.2);
  color: var(--vsd-green);
}

.diff-medium {
  background: rgba(var(--vsd-yellow-rgb), 0.2);
  color: var(--vsd-yellow);
}

.diff-hard {
  background: rgba(var(--vsd-red-rgb), 0.2);
  color: var(--vsd-red-muted);
}

.tag-badge {
  font-size: 0.62rem;
  padding: 0.05rem 0.3rem;
  background: rgba(157, 157, 157, 0.15);
  color: var(--vsd-text-muted);
  border-radius: 3px;
}

.empty-hint {
  text-align: center;
  color: var(--vsd-text-dim);
  font-size: 0.75rem;
  padding: 1rem;
}

.apply-btn {
  margin-top: 0.3rem;
  padding: 0.5rem;
  background: linear-gradient(135deg, var(--vsd-blue), var(--vsd-blue-hover));
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.apply-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.apply-btn:disabled {
  background: rgba(var(--vsd-border-light-rgb), 0.5);
  color: var(--vsd-text-dim);
  cursor: not-allowed;
}
</style>
