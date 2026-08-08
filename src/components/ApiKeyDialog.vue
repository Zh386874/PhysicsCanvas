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

        <!-- 安全说明（如实披露加密强度） -->
        <div class="security-note">
          🔒 API Key 以加密形式仅保存在
          <strong>本机浏览器</strong>
          （localStorage）， 用于本次会话直接调用你选择的模型服务商 API。该加密用于
          <strong>防止误读/明文暴露</strong>
          ， 但因加解密密钥派生自应用内固定参数，
          <strong>不构成强加密防护</strong>
          。 请勿在不可信设备上使用，也不要将本页面/浏览器分享给他人，以免他人读取你的 Key。
        </div>

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

          <!-- 服务商信息（选中非自定义时展示） -->
          <div v-if="selectedModel !== 'custom'" class="provider-info">
            <div class="provider-info-row">
              <span class="provider-info-label">API 地址</span>
              <code class="provider-info-code">{{ currentProviderModel.apiBase }}</code>
            </div>
            <div class="provider-info-row">
              <span class="provider-info-label">默认模型</span>
              <code class="provider-info-code">{{ currentProviderModel.modelName }}</code>
            </div>
            <div v-if="currentProviderModel.docUrl" class="provider-info-row">
              <span class="provider-info-label">文档</span>
              <a
                :href="currentProviderModel.docUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="provider-info-link"
              >
                获取 API Key →
              </a>
            </div>
          </div>

          <!-- API Key 输入（服务商下） -->
          <div class="form-group api-key-group">
            <label class="form-label required">API Key</label>
            <div class="key-input-wrapper">
              <input
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="key-input"
                :placeholder="currentProviderModel.placeholder"
              />
              <button
                type="button"
                class="toggle-visibility-btn"
                @click="showApiKey = !showApiKey"
                :title="showApiKey ? '隐藏密钥' : '显示密钥'"
              >
                <svg
                  v-if="showApiKey"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                  />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 自定义配置 Tab -->
        <div v-if="activeTab === 'custom'" class="tab-panel custom-panel">
          <!-- API 格式 -->
          <div class="form-group">
            <label class="form-label required">API 格式</label>
            <select v-model="apiFormat" class="custom-select">
              <option value="openai-chat">OpenAI Chat Completions 格式</option>
              <option value="anthropic-messages">Anthropic Messages 格式（Claude）</option>
            </select>
          </div>

          <!-- 自定义请求地址 -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label required">自定义请求地址</label>
              <label v-if="!isAnthropicFormat" class="switch-wrap">
                <input type="checkbox" v-model="isFullUrl" class="switch-input" />
                <span class="switch-slider"></span>
                <span class="switch-label">完整 URL</span>
              </label>
            </div>
            <input
              v-model="customApiBase"
              class="custom-input"
              :placeholder="
                isAnthropicFormat
                  ? 'e.g. https://api.anthropic.com/v1/messages'
                  : 'e.g. https://api.openai.com/v1'
              "
            />
          </div>

          <!-- 蓝色提示框 -->
          <div class="info-tip">
            <span class="info-icon">ⓘ</span>
            <span v-if="isAnthropicFormat" class="info-text">
              请填写 Anthropic Messages 完整端点地址（以
              <code>/v1/messages</code>
              结尾），无需再拼接。
            </span>
            <span v-else class="info-text">
              请填写兼容 OpenAI API 的服务端点地址，不要以斜杠结尾。
              <code>/chat/completions</code>
              将会被补充到你填写的地址末尾。
            </span>
          </div>

          <!-- 模型 ID -->
          <div class="form-group">
            <div class="label-row">
              <label class="form-label required">模型 ID</label>
              <label v-if="!isAnthropicFormat" class="switch-wrap">
                <input type="checkbox" v-model="isMultimodal" class="switch-input" />
                <span class="switch-slider"></span>
                <span class="switch-label">多模态</span>
              </label>
            </div>
            <input v-model="customModelName" class="custom-input" placeholder="输入模型 ID" />
            <span v-if="!isAnthropicFormat" class="field-hint">
              多模态模型可上传题图进行解析（如 glm-4v-plus）
            </span>
          </div>

          <!-- API 密钥 -->
          <div class="form-group api-key-group">
            <label class="form-label required">API 密钥</label>
            <div class="key-input-wrapper">
              <input
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="key-input"
                placeholder="输入 API 密钥"
              />
              <button
                type="button"
                class="toggle-visibility-btn"
                @click="showApiKey = !showApiKey"
                :title="showApiKey ? '隐藏密钥' : '显示密钥'"
              >
                <svg
                  v-if="showApiKey"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                  />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 高级配置（折叠） -->
          <div class="advanced-section">
            <button class="advanced-toggle" @click="isAdvancedOpen = !isAdvancedOpen">
              <span class="advanced-arrow" :class="{ open: isAdvancedOpen }">〉</span>
              <div class="advanced-text">
                <span class="advanced-title">高级配置</span>
                <span class="advanced-hint">包含展示名称、上下文窗口等配置。</span>
              </div>
            </button>
            <div v-show="isAdvancedOpen" class="advanced-body">
              <div class="form-group">
                <label class="form-label">展示名称</label>
                <input v-model="customName" class="custom-input" placeholder="如：我的 Claude" />
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
import { encrypt } from '../utils/crypto'
import { initConfig, savedConfigDisplay } from '../composables/useAIParser'

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
    id: 'glm-vl',
    name: '智谱 GLM-4V（多模态）',
    icon: '🖼️',
    placeholder: 'xxxxxxxx.xxxxxxxx',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4v-plus'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🌍',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/api-keys',
    apiBase: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o-mini'
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '🤖',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://console.anthropic.com/settings/keys',
    apiBase: 'https://api.anthropic.com/v1/messages',
    modelName: 'claude-sonnet-4-20250514',
    format: 'anthropic-messages'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '🔮',
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://aistudio.google.com/apikey',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelName: 'gemini-1.5-flash'
  },
  {
    id: 'custom',
    name: '自定义',
    icon: '🔧',
    placeholder: '在此粘贴你的 API Key',
    docUrl: '',
    apiBase: '',
    modelName: ''
  }
]

const STORAGE_KEY = 'ai_api_config'

// Tab 与选中状态
const activeTab = ref('provider')
const selectedModel = ref('deepseek')

// 服务商下 API Key
const apiKey = ref('')
const showApiKey = ref(false)
const customName = ref('')
const customApiBase = ref('')
const customModelName = ref('')

// 自定义配置表单
const apiFormat = ref('openai-chat')
const isFullUrl = ref(false)
const isMultimodal = ref(false)
const contextWindow = ref(null)

// 高级配置折叠
const isAdvancedOpen = ref(false)

const currentProviderModel = computed(
  () => providerModels.find((m) => m.id === selectedModel.value) || providerModels[0]
)

// 自定义配置是否为 Anthropic Messages 格式（控制 URL/开关/提示联动）
const isAnthropicFormat = computed(() => apiFormat.value === 'anthropic-messages')

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

// 已保存的配置（单一状态来源：与 AIInput/App 共用 useAIParser 的缓存）
const savedConfig = computed(() => savedConfigDisplay.value)

function resetFormFields() {
  apiKey.value = ''
  showApiKey.value = false
  customName.value = ''
  customApiBase.value = ''
  customModelName.value = ''
  customApiBase.value = ''
  isFullUrl.value = false
  customModelName.value = ''
  isMultimodal.value = false
  customName.value = ''
  contextWindow.value = null
  isAdvancedOpen.value = false
  apiFormat.value = 'openai-chat'
}

function onReset() {
  resetFormFields()
  selectedModel.value = 'deepseek'
  activeTab.value = 'provider'
}

async function onSave() {
  if (!canSave.value) return

  const encryptedKey = await encrypt(apiKey.value.trim())

  if (activeTab.value === 'provider') {
    const config = {
      modelId: selectedModel.value,
      apiKey: encryptedKey
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    resetFormFields()
    emit('saved', config)
    emit('close')
    initConfig()
    return
  }

  // 自定义配置 tab
  const config = {
    modelId: 'custom',
    apiKey: encryptedKey,
    apiFormat: apiFormat.value,
    customApiBase: customApiBase.value.trim(),
    isFullUrl: isFullUrl.value,
    customModelName: customModelName.value.trim(),
    isMultimodal: isMultimodal.value,
    customName: customName.value.trim() || undefined,
    contextWindow: contextWindow.value || undefined
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  resetFormFields()
  emit('saved', config)
  emit('close')
  initConfig()
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
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vsd-text);
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
  gap: 0.5rem;
}

.tab-btn {
  flex: 1;
  padding: 0.65rem 1rem;
  background: transparent;
  border: 1px solid rgba(var(--vsd-border-light-rgb), 0.55);
  border-radius: 8px;
  color: var(--vsd-text-dim);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover:not(.active) {
  color: var(--vsd-text-muted);
  border-color: rgba(var(--vsd-border-light-rgb), 0.85);
}

.tab-btn.active {
  border-color: var(--vsd-blue);
  border-width: 1.5px;
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
  width: 26px;
  height: 14px;
  background: rgba(var(--vsd-border-light-rgb), 0.6);
  border-radius: 999px;
  transition: background 0.2s;
}

.switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  background: var(--vsd-text);
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch-input:checked + .switch-slider {
  background: var(--vsd-green);
}

.switch-input:checked + .switch-slider::after {
  transform: translateX(12px);
}

.switch-label {
  font-size: 0.75rem;
  color: var(--vsd-text-muted);
  font-weight: 500;
}

/* 服务商卡片按钮 */
.model-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.model-btn {
  flex: 1 1 calc(33% - 0.5rem);
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

/* 服务商信息卡片 */
.provider-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  background: rgba(var(--vsd-panel-light-rgb), 0.5);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 8px;
}

.provider-info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
}

.provider-info-label {
  color: var(--vsd-text-dim);
  flex-shrink: 0;
  min-width: 3.5rem;
}

.provider-info-code {
  color: var(--vsd-info);
  font-family: monospace;
  font-size: 0.74rem;
  word-break: break-all;
}

.provider-info-link {
  color: var(--vsd-info);
  text-decoration: none;
}

.provider-info-link:hover {
  text-decoration: underline;
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

/* API Key 输入框 */
.api-key-group {
}

.key-input-wrapper {
  position: relative;
  width: 100%;
}

.key-input {
  width: 100%;
  /* 右侧 44px 留给切换按钮 */
  padding: 0.7rem 44px 0.7rem 0.75rem;
  background: var(--vsd-panel-light);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 8px;
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

.toggle-visibility-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--vsd-text-dim);
  cursor: pointer;
  transition: all 0.18s ease;
  padding: 0;
}

.toggle-visibility-btn:hover {
  color: var(--vsd-info);
  background: rgba(var(--vsd-blue-rgb), 0.1);
}

.toggle-visibility-btn:active {
  transform: translateY(-50%) scale(0.92);
}

.toggle-visibility-btn svg {
  display: block;
}

/* 自定义输入框 & 下拉 */
.custom-input {
  width: 100%;
  padding: 0.7rem 0.75rem;
  background: var(--vsd-panel-light);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 8px;
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
  padding: 0.7rem 0.75rem;
  background: var(--vsd-panel-light);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 8px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1em;
}

.custom-select:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.6);
}

/* 蓝色提示框 */
.info-tip {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0.9rem;
  background: rgba(var(--vsd-blue-rgb), 0.1);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.35);
  border-radius: 8px;
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
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem 0.2rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: color 0.2s;
}

.advanced-toggle:hover {
  color: var(--vsd-info);
}

.advanced-arrow {
  color: var(--vsd-text-dim);
  font-size: 0.85rem;
  transition: transform 0.2s;
  display: inline-block;
  margin-top: 0.1rem;
}

.advanced-arrow.open {
  transform: rotate(90deg);
}

.advanced-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.advanced-title {
  color: var(--vsd-text);
  font-size: 0.85rem;
  font-weight: 600;
}

.advanced-hint {
  color: var(--vsd-text-muted);
  font-size: 0.78rem;
  display: block;
}

.field-hint {
  color: var(--vsd-text-muted);
  font-size: 0.72rem;
  display: block;
  margin-top: 0.2rem;
}

.advanced-body {
  padding: 0.3rem 0 0.3rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

/* 安全说明框 */
.security-note {
  padding: 0.7rem 0.9rem;
  background: rgba(var(--vsd-yellow-rgb), 0.06);
  border: 1px dashed rgba(var(--vsd-yellow-rgb), 0.5);
  border-radius: 8px;
  color: var(--vsd-text-muted);
  font-size: 0.76rem;
  line-height: 1.6;
}

.security-note strong {
  color: var(--vsd-text);
}

/* 底部按钮 */
.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  padding-top: 0.3rem;
}

.btn-reset {
  flex: 1;
  padding: 0.65rem 1.1rem;
  background: rgba(var(--vsd-selection-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 8px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(var(--vsd-selection-rgb), 0.85);
  border-color: rgba(var(--vsd-blue-rgb), 0.45);
}

.btn-save {
  flex: 1;
  padding: 0.65rem 1.3rem;
  background: var(--vsd-blue);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-save:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--vsd-border);
}
</style>
