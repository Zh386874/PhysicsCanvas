<template>
  <div class="ai-input" :class="{ collapsed }">
    <div class="ai-header">
      <span class="ai-title">🤖 AI 题目解析</span>
      <button class="collapse-btn" @click="collapsed = !collapsed">
        {{ collapsed ? '展开' : '收起' }}
      </button>
    </div>

    <div v-show="!collapsed" class="ai-body">
      <textarea
        v-model="question"
        class="question-input"
        rows="4"
        placeholder="请输入物理题目描述，例如：一个质量为2kg的滑块从倾角30°的光滑斜面顶端由静止释放..."
        :disabled="loading"
      ></textarea>

      <button
        class="parse-btn"
        :disabled="loading || !question.trim()"
        @click="onParse"
      >
        <span v-if="loading" class="spinner"></span>
        <span v-if="loading">AI 解析中...</span>
        <span v-else>🔍 AI 解析并生成模拟</span>
      </button>

      <div v-if="result" class="result-card">
        <div class="result-title">📋 解析结果</div>
        <div class="result-items">
          <div v-for="(item, i) in result.items" :key="i" class="result-item">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-value">{{ item.value }}</span>
          </div>
        </div>
        <div class="result-status">✅ 已生成模拟场景，请查看画布</div>
      </div>

      <div v-else-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div class="ai-hint">🤖 当前为演示版，接入真实 AI 后可解析任意题目</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { state, loadScene } from '../composables/usePhysics'
import { getPreset } from '../composables/usePresets'

const emit = defineEmits(['parsed'])

const question = ref('')
const loading = ref(false)
const result = ref(null)
const errorMsg = ref('')
const collapsed = ref(false)

/**
 * AI 解析（Mock 版）
 * 用关键词匹配 + 数字提取模拟 AI 解析过程
 */
function onParse() {
  if (!question.value.trim()) return
  loading.value = true
  result.value = null
  errorMsg.value = ''

  // 模拟 AI 思考时间
  setTimeout(() => {
    const text = question.value
    const items = []
    let sceneName = null

    // 1. 关键词匹配场景
    if (/平抛|水平抛出|抛体/.test(text)) {
      sceneName = '抛体运动'
    } else if (/斜面|倾角|滑下|下滑/.test(text)) {
      sceneName = '斜面滑块'
    } else if (/磁场|洛伦兹|圆周/.test(text)) {
      sceneName = '磁场圆周'
    } else if (/碰撞|相撞/.test(text)) {
      sceneName = '弹性碰撞'
    } else if (/电场|偏转/.test(text)) {
      sceneName = '电场偏转'
    }

    // 2. 提取数字参数
    const massMatch = text.match(/(\d+(?:\.\d+)?)\s*kg/)
    if (massMatch) items.push({ label: '物体质量', value: massMatch[1] + ' kg' })

    const velMatch = text.match(/(\d+(?:\.\d+)?)\s*m\/s/)
    if (velMatch) items.push({ label: '初始速度', value: velMatch[1] + ' m/s' })

    const angleMatch = text.match(/(\d+(?:\.\d+)?)\s*[°度]/)
    if (angleMatch) items.push({ label: '倾角', value: angleMatch[1] + '°' })

    const chargeMatch = text.match(/(\d+(?:\.\d+)?)\s*[cq]/)
    if (chargeMatch && /电|磁/.test(text)) {
      items.push({ label: '电荷量', value: chargeMatch[1] + ' C' })
    }

    loading.value = false

    if (!sceneName) {
      errorMsg.value = '正在理解中，请尝试经典场景（平抛、斜面、磁场、碰撞、电场）'
      return
    }

    items.unshift({ label: '识别场景', value: sceneName })

    // 3. 加载对应预设
    const preset = getPreset(sceneName)
    loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)

    // 4. 自动应用提取的参数到第一个物体
    applyExtractedParams(preset.objects[0], text)

    result.value = { items }

    // 5. 通知父组件：解析完成 + 场景名
    emit('parsed', sceneName)
  }, 1500)
}

/**
 * 将提取的数字参数应用到物体上
 */
function applyExtractedParams(firstObj, text) {
  if (!firstObj) return
  const massMatch = text.match(/(\d+(?:\.\d+)?)\s*kg/)
  if (massMatch) firstObj.mass = parseFloat(massMatch[1])

  const velMatch = text.match(/(\d+(?:\.\d+)?)\s*m\/s/)
  if (velMatch) firstObj.vx = parseFloat(velMatch[1])

  const chargeMatch = text.match(/(\d+(?:\.\d+)?)\s*[cq]/)
  if (chargeMatch && /电|磁/.test(text)) {
    firstObj.charge = parseFloat(chargeMatch[1])
  }
}
</script>

<style scoped>
.ai-input {
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  background: rgba(59, 130, 246, 0.05);
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1rem;
}

.ai-title {
  font-size: 0.85rem;
  color: #93c5fd;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.collapse-btn {
  background: transparent;
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #94a3b8;
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.ai-body {
  padding: 0 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.question-input {
  width: 100%;
  padding: 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 8px;
  color: #e0e6ff;
  font-size: 0.8rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.question-input:focus {
  border-color: rgba(59, 130, 246, 0.6);
}

.question-input::placeholder {
  color: #475569;
}

.parse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.parse-btn:hover:not(:disabled) {
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

.parse-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-card {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  padding: 0.6rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-title {
  font-size: 0.8rem;
  color: #86efac;
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.result-items {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.4rem;
}

.result-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.item-label {
  color: #94a3b8;
}

.item-value {
  color: #e0e6ff;
  font-weight: 500;
}

.result-status {
  font-size: 0.75rem;
  color: #86efac;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(34, 197, 94, 0.2);
}

.error-msg {
  padding: 0.5rem;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  color: #fcd34d;
  font-size: 0.75rem;
}

.ai-hint {
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
  padding: 0.2rem 0;
}
</style>
