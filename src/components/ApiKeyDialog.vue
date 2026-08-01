<template>
  <div v-if="visible" class="api-key-overlay" @click.self="onClose">
    <div class="api-key-dialog">
      <div class="dialog-header">
        <span class="dialog-title">添加模型</span>
        <button class="close-btn" @click="onClose">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Tab 切换 -->
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'provider' }"
            @click="activeTab = 'provider'"
          >
            模型服务商
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'custom' }"
            @click="activeTab = 'custom'"
          >
            自定义配置
          </button>
        </div>

        <!-- 已保存配置状态 -->
        <div v-if="savedConfig" class="status-info status-active">
          ✅ 已配置 {{ savedConfig.modelName }}（Key: {{ savedConfig.maskedKey }}）
        </div>
        <div v-else class="status-info status-inactive">⚠️ 未配置，当前使用本地关键词解析</div>

        <!-- 模型服务商 Tab -->
        <div v-if="activeTab === 'provider'" class="tab-panel">
          <div class="model-options">
            <button
              v-for="model in providerModels"
              :key="model.id"
              class="model-btn"
              :class="{ active: selectedModel === model.id }"
              @click="selectedModel = model.id"
            >
              <span class="model-icon">{{ model.icon }}</span>
              <span class="model-name">{{ model.name }}</span>
            </button>
          </div>

          <!-- API Key 输入（服务商下） -->
          <div class="form-group api-key-group">
            <label class="form-label required">API Key</label>
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              class="key-input"
              :placeholder="currentProviderModel.placeholder"
            />
            <button class="toggle-key" @click="showKey = !showKey">
              {{ showKey ? '🙈 隐藏' : '👁 显示' }}
            </button>
          </div>
        </div>

        <!-- 自定义配置 Tab -->
        <div v-if="activeTab === 'custom'" class="tab-panel custom-panel">
          <!-- API 格式 -->
          <div class="form-group">
            <label class="form-label required">API 格式</label>
            <select v-model="apiFormat" class="custom-select">
              <option value="openai-chat">OpenAI Chat Completions 格式</option>
            </select>
          </div>

          <!-- 自定义请求地址 -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label required">自定义请求地址</label>
              <label class="switch-wrap">
                <input type="checkbox" v-model="isFullUrl" class="switch-input" />
                <span class="switch-slider"></span>
                <span class="switch-label">完整 URL</span>
              </label>
            </div>
            <input
              v-model="customApiBase"
              class="custom-input"
              placeholder="e.g. https://api.openai.com/v1"
            />
          </div>

          <!-- 蓝色提示框 -->
          <div class="info-tip">
            <span class="info-icon">ⓘ</span>
            <span class="info-text">
              请填写兼容 OpenAI API 的服务端点地址，不要以斜杠结尾。
              <code>/chat/completions</code>
              将会被补充到你填写的地址末尾。
            </span>
          </div>

          <!-- 模型 ID -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label required">模型 ID</label>
              <label class="switch-wrap">
                <input type="checkbox" v-model="isMultimodal" class="switch-input" />
                <span class="switch-slider"></span>
                <span class="switch-label">多模态</span>
              </label>
            </div>
            <input v-model="customModelName" class="custom-input" placeholder="输入模型 ID" />
          </div>

          <!-- API 密钥 -->
          <div class="form-group api-key-group">
            <label class="form-label required">API 密钥</label>
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              class="key-input"
              placeholder="输入 API 密钥"
            />
            <button class="toggle-key" @click="showKey = !showKey">
              {{ showKey ? '🙈 隐藏' : '👁 显示' }}
            </button>
          </div>

          <!-- 高级配置（折叠） -->
          <div class="advanced-section">
            <button class="advanced-toggle" @click="isAdvancedOpen = !isAdvancedOpen">
              <span class="advanced-arrow" :class="{ open: isAdvancedOpen }">〉</span>
              <span class="advanced-title">高级配置</span>
              <span class="advanced-hint">
                包含模型系列（优化的 Prompt 和超参）、展示名称、上下文窗口等配置。
              </span>
            </button>
            <div v-show="isAdvancedOpen" class="advanced-body">
              <div class="form-group">
                <label class="form-label">展示名称</label>
                <input v-model="customName" class="custom-input" placeholder="如：我的 Claude" />
              </div>
              <div class="form-group">
                <label class="form-label">模型系列</label>
                <select v-model="modelFamily" class="custom-select">
                  <option value="general">通用</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="gpt">GPT</option>
                  <option value="claude">Claude</option>
                  <option value="glm">GLM</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">上下文窗口 (tokens)</label>
                <input
                  v-model.number="contextWindow"
                  type="number"
                  min="0"
                  class="custom-input"
                  placeholder="如 128000"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="dialog-actions">
          <button class="btn-reset" @click="onReset">重置</button>
          <button class="btn-save" :disabled="!canSave" @click="onSave">添加模型</button>
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

const providerModels = [
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

// Tab 与选中状态
const activeTab = ref('custom')
const selectedModel = ref('deepseek')

// 服务商下 API Key
const apiKey = ref('')
const showKey = ref(false)

// 自定义配置表单
const apiFormat = ref('openai-chat')
const customApiBase = ref('')
const isFullUrl = ref(false)
const customModelName = ref('')
const isMultimodal = ref(false)
const customName = ref('')
const modelFamily = ref('general')
const contextWindow = ref(null)

// 高级配置折叠
const isAdvancedOpen = ref(false)

const currentProviderModel = computed(
  () => providerModels.find((m) => m.id === selectedModel.value) || providerModels[0]
)

// 保存按钮可用性
const canSave = computed(() => {
  if (!apiKey.value.trim()) return false
  if (activeTab.value === 'provider') return true
  // 自定义 tab 下校验
  return (
    apiFormat.value.trim() !== '' &&
    customApiBase.value.trim() !== '' &&
    customModelName.value.trim() !== ''
  )
})

// 已保存的配置（从 localStorage 读取）
const savedConfig = computed(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const config = JSON.parse(raw)
    const key = config.apiKey || ''
    const maskedKey = key.length > 8 ? key.slice(0, 4) + '****' + key.slice(-4) : '****'
    if (config.modelId === 'custom') {
      const displayName = config.customName?.trim() || config.customModelName?.trim() || '自定义'
      return { ...config, modelName: displayName, maskedKey }
    }
    const model = providerModels.find((m) => m.id === config.modelId)
    if (!model) return null
    return {
      ...config,
      modelName: model.name,
      maskedKey
    }
  } catch {
    return null
  }
})

function resetFormFields() {
  apiKey.value = ''
  showKey.value = false
  customApiBase.value = ''
  isFullUrl.value = false
  customModelName.value = ''
  isMultimodal.value = false
  customName.value = ''
  modelFamily.value = 'general'
  contextWindow.value = null
  isAdvancedOpen.value = false
  apiFormat.value = 'openai-chat'
}

function onReset() {
  resetFormFields()
  selectedModel.value = 'deepseek'
  activeTab.value = 'custom'
}

function onSave() {
  if (!canSave.value) return

  if (activeTab.value === 'provider') {
    const config = {
      modelId: selectedModel.value,
      apiKey: apiKey.value.trim()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    resetFormFields()
    emit('saved', config)
    emit('close')
    return
  }

  // 自定义配置 tab
  const config = {
    modelId: 'custom',
    apiKey: apiKey.value.trim(),
    apiFormat: apiFormat.value,
    customApiBase: customApiBase.value.trim(),
    isFullUrl: isFullUrl.value,
    customModelName: customModelName.value.trim(),
    isMultimodal: isMultimodal.value,
    customName: customName.value.trim() || undefined,
    modelFamily: modelFamily.value,
    contextWindow: contextWindow.value || undefined
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  resetFormFields()
  emit('saved', config)
  emit('close')
}

function onClose() {
  resetFormFields()
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.api-key-dialog {
  width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  background: rgba(var(--vsd-panel-rgb), 0.98);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.4);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vsd-info);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--vsd-text-dim);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(var(--vsd-red-rgb), 0.15);
  color: var(--vsd-red-muted);
}

.dialog-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Tab 条 */
.tab-bar {
  display: flex;
  background: rgba(var(--vsd-panel-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.tab-btn {
  flex: 1;
  padding: 0.65rem 1rem;
  background: transparent;
  border: none;
  color: var(--vsd-text-dim);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover:not(.active) {
  color: var(--vsd-text-muted);
  background: rgba(var(--vsd-panel-light-rgb), 0.6);
}

.tab-btn.active {
  background: rgba(var(--vsd-panel-light-rgb), 0.9);
  color: var(--vsd-info);
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* 表单基础 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.8rem;
  color: var(--vsd-text-muted);
  font-weight: 500;
}

.form-label.required::before {
  content: '*';
  color: var(--vsd-red);
  margin-right: 0.2rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Switch 开关 */
.switch-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  user-select: none;
}

.switch-input {
  display: none;
}

.switch-slider {
  position: relative;
  width: 32px;
  height: 18px;
  background: rgba(var(--vsd-border-light-rgb), 0.6);
  border-radius: 999px;
  transition: background 0.2s;
}

.switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: var(--vsd-text);
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch-input:checked + .switch-slider {
  background: var(--vsd-blue);
}

.switch-input:checked + .switch-slider::after {
  transform: translateX(14px);
}

.switch-label {
  font-size: 0.75rem;
  color: var(--vsd-text-muted);
  font-weight: 500;
}

/* 服务商卡片按钮 */
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
  background: rgba(var(--vsd-panel-light-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 8px;
  color: var(--vsd-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.model-btn:hover {
  background: rgba(var(--vsd-blue-rgb), 0.15);
  border-color: rgba(var(--vsd-blue-rgb), 0.4);
}

.model-btn.active {
  background: var(--vsd-selection);
  border-color: rgba(var(--vsd-blue-rgb), 0.7);
  color: var(--vsd-info);
}

.model-icon {
  font-size: 1.3rem;
}

.model-name {
  font-size: 0.75rem;
  font-weight: 500;
}

/* API Key 输入框（带显示/隐藏按钮） */
.api-key-group {
  position: relative;
}

.key-input {
  width: 100%;
  padding: 0.6rem 2.5rem 0.6rem 0.7rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  font-family: monospace;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.key-input:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.6);
}

.toggle-key {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--vsd-text-dim);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

/* 自定义输入框 & 下拉 */
.custom-input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.custom-input:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.6);
}

.custom-input::placeholder {
  color: var(--vsd-text-dim);
}

.custom-select {
  width: 100%;
  padding: 0.6rem 0.7rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
  background-size: 1em;
}

.custom-select:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.6);
}

/* 蓝色提示框 */
.info-tip {
  display: flex;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  background: rgba(var(--vsd-blue-rgb), 0.1);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.35);
  border-radius: 6px;
  margin-top: -0.1rem;
}

.info-icon {
  color: var(--vsd-info);
  font-size: 0.9rem;
  line-height: 1.5;
  flex-shrink: 0;
}

.info-text {
  color: var(--vsd-info);
  font-size: 0.78rem;
  line-height: 1.5;
}

.info-text code {
  background: rgba(var(--vsd-blue-rgb), 0.2);
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.74rem;
  color: var(--vsd-info);
}

/* 高级配置折叠 */
.advanced-section {
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  background: rgba(var(--vsd-panel-rgb), 0.6);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.advanced-toggle:hover {
  background: var(--vsd-hover);
}

.advanced-arrow {
  color: var(--vsd-text-dim);
  font-size: 0.85rem;
  transition: transform 0.2s;
  display: inline-block;
}

.advanced-arrow.open {
  transform: rotate(90deg);
}

.advanced-title {
  color: var(--vsd-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.advanced-hint {
  color: var(--vsd-text-dim);
  font-size: 0.74rem;
  margin-left: auto;
  max-width: 72%;
}

.advanced-body {
  padding: 0.75rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(var(--vsd-panel-rgb), 0.4);
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.15);
}

/* 状态提示 */
.status-info {
  padding: 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
}

.status-active {
  background: rgba(var(--vsd-green-rgb), 0.1);
  border: 1px solid rgba(var(--vsd-green-rgb), 0.3);
  color: var(--vsd-green);
}

.status-inactive {
  background: rgba(var(--vsd-yellow-rgb), 0.08);
  border: 1px solid rgba(var(--vsd-yellow-rgb), 0.3);
  color: var(--vsd-yellow);
}

/* 底部按钮 */
.dialog-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
  padding-top: 0.3rem;
}

.btn-reset {
  flex: 1;
  padding: 0.6rem 1rem;
  background: rgba(var(--vsd-panel-light-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-border-light-rgb), 0.4);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(var(--vsd-border-rgb), 0.7);
  border-color: rgba(157, 157, 157, 0.5);
}

.btn-save {
  flex: 1;
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, var(--vsd-blue), var(--vsd-blue-hover));
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-save:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--vsd-border);
}
</style>
