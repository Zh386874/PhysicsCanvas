<template>
  <div v-if="visible" class="api-key-overlay" @click.self="onClose">
    <div class="api-key-dialog">
      <div class="dialog-header">
        <span class="dialog-title">🔑 AI 模型配置</span>
        <button class="close-btn" @click="onClose">✕</button>
      </div>

      <div class="dialog-body">
        <!-- 模型选择 -->
        <div class="form-group">
          <label class="form-label">选择大模型</label>
          <div class="model-options">
            <button
              v-for="model in models"
              :key="model.id"
              class="model-btn"
              :class="{ active: selectedModel === model.id }"
              @click="selectedModel = model.id"
            >
              <span class="model-icon">{{ model.icon }}</span>
              <span class="model-name">{{ model.name }}</span>
            </button>
          </div>
        </div>

        <!-- API Key 输入 -->
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            class="key-input"
            :placeholder="currentModel.placeholder"
          />
          <button class="toggle-key" @click="showKey = !showKey">
            {{ showKey ? '🙈 隐藏' : '👁 显示' }}
          </button>
        </div>

        <!-- 获取 Key 提示 -->
        <div class="key-hint">
          获取 API Key：<a :href="currentModel.docUrl" target="_blank">{{ currentModel.docUrl }}</a>
        </div>

        <!-- 当前状态 -->
        <div class="status-info">
          <div v-if="savedConfig" class="status-active">
            ✅ 已配置 {{ savedConfig.modelName }}（Key: {{ savedConfig.maskedKey }}）
          </div>
          <div v-else class="status-inactive">
            ⚠️ 未配置，当前使用本地关键词解析
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="dialog-actions">
          <button v-if="savedConfig" class="btn-clear" @click="onClear">
            清除配置
          </button>
          <button class="btn-save" :disabled="!apiKey.trim()" @click="onSave">
            保存配置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'saved', 'cleared'])

// 支持的模型列表
const models = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🧠',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.deepseek.com/api_keys',
    apiBase: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat'
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    icon: '✨',
    placeholder: 'xxxxxxxx.xxxxxxxx',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4-flash'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🌍',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/api-keys',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o-mini'
  }
]

const STORAGE_KEY = 'ai_api_config'

const selectedModel = ref('deepseek')
const apiKey = ref('')
const showKey = ref(false)

const currentModel = computed(() =>
  models.find(m => m.id === selectedModel.value) || models[0]
)

// 已保存的配置（从 localStorage 读取）
const savedConfig = computed(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const config = JSON.parse(raw)
    const model = models.find(m => m.id === config.modelId)
    if (!model) return null
    // 掩码显示 Key
    const key = config.apiKey || ''
    const maskedKey = key.length > 8
      ? key.slice(0, 4) + '****' + key.slice(-4)
      : '****'
    return {
      ...config,
      modelName: model.name,
      maskedKey
    }
  } catch {
    return null
  }
})

function onSave() {
  if (!apiKey.value.trim()) return
  const config = {
    modelId: selectedModel.value,
    apiKey: apiKey.value.trim()
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  apiKey.value = ''
  showKey.value = false
  emit('saved', config)
  emit('close')
}

function onClear() {
  localStorage.removeItem(STORAGE_KEY)
  apiKey.value = ''
  emit('cleared')
  emit('close')
}

function onClose() {
  apiKey.value = ''
  showKey.value = false
  emit('close')
}
</script>

<style scoped>
.api-key-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.api-key-dialog {
  width: 440px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: #93c5fd;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.dialog-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
}

.model-options {
  display: flex;
  gap: 0.5rem;
}

.model-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.7rem 0.4rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.model-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
}

.model-btn.active {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.7);
  color: #93c5fd;
}

.model-icon {
  font-size: 1.3rem;
}

.model-name {
  font-size: 0.75rem;
  font-weight: 500;
}

.key-input {
  width: 100%;
  padding: 0.6rem 2.5rem 0.6rem 0.7rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 6px;
  color: #e0e6ff;
  font-size: 0.85rem;
  font-family: monospace;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.key-input:focus {
  border-color: rgba(59, 130, 246, 0.6);
}

.toggle-key {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.form-group:nth-child(2) {
  position: relative;
}

.key-hint {
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.5;
}

.key-hint a {
  color: #60a5fa;
  text-decoration: none;
}

.key-hint a:hover {
  text-decoration: underline;
}

.status-info {
  padding: 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
}

.status-active {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.status-inactive {
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fcd34d;
}

.dialog-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.btn-clear {
  padding: 0.55rem 1rem;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear:hover {
  background: rgba(239, 68, 68, 0.15);
}

.btn-save {
  padding: 0.55rem 1.2rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
