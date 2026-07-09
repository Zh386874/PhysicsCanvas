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
        :disabled="aiLoading"
      ></textarea>

      <button
        class="parse-btn"
        :disabled="aiLoading || !question.trim()"
        @click="onParse"
      >
        <span v-if="aiLoading" class="spinner"></span>
        <span v-if="aiLoading">AI 解析中...</span>
        <span v-else-if="isAIConfigured">🔍 AI 解析并生成模拟</span>
        <span v-else>🔍 本地解析并生成模拟</span>
      </button>

      <div v-if="result" class="result-card">
        <div class="result-title">📋 解析结果</div>
        <div class="result-items">
          <div v-for="(item, i) in result.items" :key="i" class="result-item">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-value">{{ item.value }}</span>
          </div>
        </div>
        <div v-if="isAIConfigured" class="result-status">✅ AI 解析完成，已生成模拟场景</div>
        <div v-else class="result-status">✅ 本地解析完成，已生成模拟场景</div>

        <!-- 参数微调 UI -->
        <button v-if="lastParsed" class="edit-btn" @click="toggleEdit">
          {{ editMode ? '收起编辑' : '✏️ 编辑参数' }}
        </button>
        <div v-if="editMode && lastParsed" class="edit-panel">
          <div v-for="(obj, idx) in editableObjects" :key="idx" class="edit-object">
            <div class="edit-object-title">物体 {{ idx + 1 }}（{{ obj.type }}）</div>
            <div v-if="obj.type === 'ball'" class="edit-fields">
              <label>质量(kg)<input type="number" step="0.1" v-model.number="obj.mass" /></label>
              <label>电荷(C)<input type="number" step="0.0001" v-model.number="obj.charge" /></label>
              <label>半径(m)<input type="number" step="0.1" v-model.number="obj.radius" /></label>
              <label>初速 vx(m/s)<input type="number" step="0.1" v-model.number="obj.initialVelocity.x" /></label>
              <label>初速 vy(m/s)<input type="number" step="0.1" v-model.number="obj.initialVelocity.y" /></label>
            </div>
          </div>
          <div class="edit-global">
            <label>重力(m/s²)<input type="number" step="0.1" v-model.number="editableParsed.gravity" /></label>
            <label v-if="editableParsed.field.B !== undefined">磁场(T)<input type="number" step="0.1" v-model.number="editableParsed.field.B" /></label>
            <label v-if="editableParsed.field.E">Ex(N/C)<input type="number" step="1" v-model.number="editableParsed.field.E.x" /></label>
            <label v-if="editableParsed.field.E">Ey(N/C)<input type="number" step="1" v-model.number="editableParsed.field.E.y" /></label>
          </div>
          <button class="apply-btn" @click="applyEdit">应用修改</button>
        </div>
      </div>

      <div v-else-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

      <div v-if="isAIConfigured" class="ai-hint">🤖 已接入 DeepSeek AI，支持任意物理题目解析</div>
      <div v-else class="ai-hint">⚠️ 未配置 API Key，当前为本地关键词解析。配置方法：复制 .env.example 为 .env 并填入 VITE_AI_API_KEY</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { parsePhysicsProblem, convertToSceneParams, loading as aiLoading, errorMsg as aiErrorMsg, isAIConfigured } from '../composables/useAIParser'
import { buildScene } from '../composables/useSceneBuilder'

const emit = defineEmits(['load-preset', 'update-params', 'scene-built'])

const question = ref('')
const result = ref(null)
const errorMsg = ref('')
const collapsed = ref(false)

// 参数微调状态
const lastParsed = ref(null)  // 保存最近一次 AI 解析结果
const editMode = ref(false)
const editableParsed = ref(null)  // 可编辑的副本
const editableObjects = ref([])

/** 切换编辑模式 */
function toggleEdit() {
  if (!editMode.value && lastParsed.value) {
    // 进入编辑：深拷贝一份用于编辑
    editableParsed.value = JSON.parse(JSON.stringify(lastParsed.value))
    editableObjects.value = editableParsed.value.objects.filter(o => o.type === 'ball')
  }
  editMode.value = !editMode.value
}

/** 应用修改：用编辑后的数据重新调用 buildScene */
function applyEdit() {
  if (!editableParsed.value) return
  const buildResult = buildScene(editableParsed.value)
  if (buildResult.success) {
    // 通知 App.vue 场景已重新构建
    emit('scene-built', {
      title: editableParsed.value.title || 'AI 解析场景',
      objectCount: buildResult.objectCount
    })
    result.value = {
      items: [
        { label: '场景标题', value: editableParsed.value.title || 'AI 解析场景' },
        { label: '识别类型', value: topicToName(editableParsed.value.topic) },
        { label: '物体数量', value: buildResult.objectCount + ' 个' },
        { label: '状态', value: '✅ 参数已更新' }
      ]
    }
    lastParsed.value = editableParsed.value
    editMode.value = false
  }
}

/**
 * Mock 解析（降级方案，当 AI 调用失败时使用）
 */
function mockParse(text) {
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

  // 2. 提取数字参数（SI 单位，父组件负责转像素）
  const params = {}

  const massMatch = text.match(/(\d+(?:\.\d+)?)\s*kg/)
  if (massMatch) {
    items.push({ label: '物体质量', value: massMatch[1] + ' kg' })
    params.mass = parseFloat(massMatch[1])
  }

  const velMatch = text.match(/(\d+(?:\.\d+)?)\s*m\/s/)
  if (velMatch) {
    items.push({ label: '初始速度', value: velMatch[1] + ' m/s' })
    params.vx = parseFloat(velMatch[1])
  }

  const angleMatch = text.match(/(\d+(?:\.\d+)?)\s*[°度]/)
  if (angleMatch) items.push({ label: '倾角', value: angleMatch[1] + '°' })

  const chargeMatch = text.match(/(\d+(?:\.\d+)?)\s*[cq]/)
  if (chargeMatch && /电|磁/.test(text)) {
    items.push({ label: '电荷量', value: chargeMatch[1] + ' C' })
    params.charge = parseFloat(chargeMatch[1])
  }

  return { sceneName, params, items }
}

/**
 * AI 解析（已配置 API Key 时调用真实 AI，未配置时使用本地解析）
 * AI 成功后直接用 buildScene 构建完整场景（多物体/多场/几何体）
 */
async function onParse() {
  if (!question.value.trim()) return
  result.value = null
  errorMsg.value = ''

  // 未配置 API Key：使用本地关键词解析（降级模式）
  if (!isAIConfigured.value) {
    const { sceneName, params, items } = mockParse(question.value)
    if (!sceneName) {
      errorMsg.value = '本地解析未识别场景，请尝试经典场景（平抛、斜面、磁场、碰撞、电场）'
      return
    }
    emit('load-preset', sceneName)
    if (Object.keys(params).length > 0) {
      emit('update-params', params)
    }
    result.value = { items }
    return
  }

  // 已配置 API Key：调用真实 AI + buildScene 构建场景
  try {
    const parsed = await parsePhysicsProblem(question.value)

    // 直接用 buildScene 构建完整场景（支持多物体/多场/几何体/自动缩放）
    const buildResult = buildScene(parsed)

    if (!buildResult.success) {
      errorMsg.value = buildResult.message
      return
    }

    // 通知 App.vue：场景已构建，需切换到"自定义"并同步状态
    emit('scene-built', {
      title: parsed.title || 'AI 解析场景',
      objectCount: buildResult.objectCount
    })

    // 构建显示结果
    const items = []
    items.push({ label: '场景标题', value: parsed.title || 'AI 解析场景' })
    items.push({ label: '识别类型', value: topicToName(parsed.topic) })
    items.push({ label: '物体数量', value: buildResult.objectCount + ' 个' })
    if (parsed.field?.B) items.push({ label: '磁场强度', value: parsed.field.B + ' T' })
    if (parsed.field?.E?.x || parsed.field?.E?.y) {
      items.push({ label: '电场强度', value: `(${parsed.field.E.x}, ${parsed.field.E.y}) N/C` })
    }
    if (parsed.gravity !== undefined) items.push({ label: '重力加速度', value: parsed.gravity + ' m/s²' })

    result.value = { items }
    // 保存解析结果用于参数微调
    lastParsed.value = parsed
    editMode.value = false
  } catch (err) {
    // AI 调用失败，降级到本地解析
    console.warn('AI 解析失败，降级到本地解析:', err)
    const { sceneName, params, items } = mockParse(question.value)

    if (!sceneName) {
      errorMsg.value = 'AI 解析失败且本地未识别，请尝试经典场景（平抛、斜面、磁场、碰撞、电场）'
      return
    }

    emit('load-preset', sceneName)
    if (Object.keys(params).length > 0) {
      emit('update-params', params)
    }

    result.value = { items }
    errorMsg.value = '⚠️ AI 调用失败，已降级为本地解析'
  }
}

/** topic 转中文名称 */
function topicToName(topic) {
  const map = {
    projectile: '抛体运动',
    slope: '斜面滑块',
    elastic_collision: '弹性碰撞',
    magnetic_circle: '磁场圆周',
    electric_deflection: '电场偏转',
    custom: '自定义场景'
  }
  return map[topic] || '未知'
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

.edit-btn {
  margin-top: 0.5rem;
  padding: 0.3rem 0.7rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 5px;
  color: #93c5fd;
  font-size: 0.75rem;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.edit-btn:hover {
  background: rgba(59, 130, 246, 0.25);
}

.edit-panel {
  margin-top: 0.5rem;
  padding: 0.6rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-object {
  padding: 0.4rem;
  background: rgba(30, 41, 59, 0.5);
  border-radius: 4px;
}

.edit-object-title {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 0.3rem;
  font-weight: 600;
}

.edit-fields, .edit-global {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
}

.edit-fields label, .edit-global label {
  display: flex;
  flex-direction: column;
  font-size: 0.68rem;
  color: #64748b;
  gap: 0.15rem;
}

.edit-fields input, .edit-global input {
  padding: 0.25rem 0.35rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 4px;
  color: #e0e6ff;
  font-size: 0.75rem;
  outline: none;
}

.edit-fields input:focus, .edit-global input:focus {
  border-color: rgba(59, 130, 246, 0.6);
}

.apply-btn {
  margin-top: 0.3rem;
  padding: 0.4rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 5px;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.apply-btn:hover {
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
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
