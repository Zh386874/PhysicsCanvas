<template>
  <div class="question-bank-panel">
    <div class="panel-header" @click="collapsed = !collapsed">
      <span class="header-title">📚 真题库</span>
      <span class="header-count">{{ difficultyStats.total }} 道</span>
      <span class="toggle-icon">{{ collapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-show="!collapsed" class="panel-body">
      <!-- 搜索框 -->
      <input
        v-model="searchKeyword"
        class="search-input"
        placeholder="🔍 搜索题目..."
      />

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
          <div class="question-title">{{ q.title }}</div>
          <div class="question-desc">{{ q.description.substring(0, 60) }}...</div>
          <div class="question-meta">
            <span class="difficulty-badge" :class="'diff-' + q.difficulty">
              {{ q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难' }}
            </span>
            <span v-for="tag in q.tags" :key="tag" class="tag-badge">{{ tag }}</span>
          </div>
        </div>
        <div v-if="filteredQuestions.length === 0" class="empty-hint">
          没有匹配的题目
        </div>
      </div>

      <!-- 加载按钮 -->
      <button
        class="apply-btn"
        :disabled="!selectedQuestion"
        @click="handleApply"
      >
        {{ selectedQuestion ? '▶ 加载场景并播放' : '请选择题目' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuestionBank } from '../composables/useQuestionBank'

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
</script>

<style scoped>
.question-bank-panel {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  background: rgba(30, 41, 59, 0.5);
  transition: background 0.2s;
}

.panel-header:hover {
  background: rgba(30, 41, 59, 0.8);
}

.header-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e0e6ff;
}

.header-count {
  font-size: 0.7rem;
  color: #64748b;
  background: rgba(100, 116, 139, 0.2);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.toggle-icon {
  margin-left: auto;
  font-size: 0.7rem;
  color: #64748b;
}

.panel-body {
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-input {
  padding: 0.4rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px;
  color: #e0e6ff;
  font-size: 0.78rem;
  outline: none;
}

.search-input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.search-input::placeholder {
  color: #475569;
}

.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.filter-select {
  padding: 0.3rem 0.4rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  color: #e0e6ff;
  font-size: 0.72rem;
  outline: none;
  cursor: pointer;
}

.filter-select option {
  background: #1e293b;
}

.question-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.question-list::-webkit-scrollbar {
  width: 4px;
}

.question-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 2px;
}

.question-item {
  padding: 0.5rem 0.55rem;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.question-item:hover {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(59, 130, 246, 0.2);
}

.question-item.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
}

.question-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #e0e6ff;
  margin-bottom: 0.2rem;
}

.question-desc {
  font-size: 0.68rem;
  color: #64748b;
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
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.diff-medium {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.diff-hard {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.tag-badge {
  font-size: 0.62rem;
  padding: 0.05rem 0.3rem;
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border-radius: 3px;
}

.empty-hint {
  text-align: center;
  color: #475569;
  font-size: 0.75rem;
  padding: 1rem;
}

.apply-btn {
  margin-top: 0.3rem;
  padding: 0.5rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.apply-btn:hover:not(:disabled) {
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.apply-btn:disabled {
  background: rgba(71, 85, 105, 0.5);
  color: #64748b;
  cursor: not-allowed;
}
</style>
