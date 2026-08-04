<template>
  <div class="scene-settings">
    <div class="section-header">
      <span class="panel-title">场景设置</span>
      <button
        type="button"
        class="collapse-btn"
        @click="collapsed = !collapsed"
        :title="collapsed ? '展开' : '收起'"
      >
        {{ collapsed ? '▶' : '▼' }}
      </button>
    </div>
    <div v-show="!collapsed" class="settings-body">
      <div class="field">
        <label>重力加速度 (m/s²)</label>
        <input
          type="number"
          step="0.1"
          :value="(state.gravity / PIXELS_PER_METER).toFixed(2)"
          @input="state.gravity = parseFloat($event.target.value) * PIXELS_PER_METER"
        />
        <div class="hint">内部: {{ state.gravity.toFixed(0) }} 像素/s²</div>
      </div>

      <div class="field">
        <label>场类型</label>
        <select :value="state.field.type" @change="onFieldTypeChange($event.target.value)">
          <option value="none">无场</option>
          <option value="electric">匀强电场</option>
          <option value="magnetic">匀强磁场</option>
          <option value="composite">复合场（电+磁）</option>
        </select>
      </div>
      <div
        v-if="state.field.type === 'electric' || state.field.type === 'composite'"
        class="field-group"
      >
        <div class="field">
          <label>Ex (N/C)</label>
          <input
            type="number"
            step="1"
            :value="state.field.E.x"
            @input="state.field.E.x = parseFloat($event.target.value)"
          />
        </div>
        <div class="field">
          <label>Ey (N/C)</label>
          <input
            type="number"
            step="1"
            :value="state.field.E.y"
            @input="state.field.E.y = parseFloat($event.target.value)"
          />
        </div>
      </div>
      <div
        v-if="state.field.type === 'magnetic' || state.field.type === 'composite'"
        class="field-group"
      >
        <div class="field">
          <label>B (T)</label>
          <input
            type="number"
            step="0.1"
            :value="state.field.B"
            @input="state.field.B = parseFloat($event.target.value)"
          />
        </div>
        <div class="hint">
          {{ state.field.B >= 0 ? '⊙ 垂直纸面向里' : '⊗ 垂直纸面向外' }}
        </div>
      </div>

      <!-- 场区域限制 -->
      <div v-if="state.field.type !== 'none'" class="field-section">
        <div class="section-header">
          <span class="panel-title">场区域</span>
          <label class="toggle-label">
            <input
              type="checkbox"
              :checked="!!state.field.region"
              @change="onRegionToggle($event.target.checked)"
            />
            <span class="toggle-text">启用区域限制</span>
          </label>
        </div>
        <template v-if="state.field.region">
          <div class="field-group">
            <div class="field">
              <label>中心 X (m)</label>
              <input
                type="number"
                step="0.1"
                :value="regionCenterX.toFixed(2)"
                @input="updateRegionCenter('x', parseFloat($event.target.value))"
              />
            </div>
            <div class="field">
              <label>中心 Y (m)</label>
              <input
                type="number"
                step="0.1"
                :value="regionCenterY.toFixed(2)"
                @input="updateRegionCenter('y', parseFloat($event.target.value))"
              />
            </div>
          </div>
          <div class="field-group">
            <div class="field">
              <label>宽度 (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                :value="regionWidth.toFixed(2)"
                @input="updateRegionSize('width', parseFloat($event.target.value))"
              />
            </div>
            <div class="field">
              <label>高度 (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                :value="regionHeight.toFixed(2)"
                @input="updateRegionSize('height', parseFloat($event.target.value))"
              />
            </div>
          </div>
          <div class="hint">区域以画布左上角为原点，y 向下为正</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { state, PIXELS_PER_METER } from '../composables/usePhysics'
import { tool } from '../composables/useEditTools'

/** 场景设置面板折叠状态 */
const collapsed = ref(false)

/** 场区域中心 X（SI 单位，米） */
const regionCenterX = computed(() => {
  if (!state.field.region) return 0
  return (state.field.region.x + state.field.region.width / 2) / PIXELS_PER_METER
})

/** 场区域中心 Y（SI 单位，米） */
const regionCenterY = computed(() => {
  if (!state.field.region) return 0
  return (state.field.region.y + state.field.region.height / 2) / PIXELS_PER_METER
})

/** 场区域宽度（SI 单位，米） */
const regionWidth = computed(() => {
  if (!state.field.region) return 0
  return state.field.region.width / PIXELS_PER_METER
})

/** 场区域高度（SI 单位，米） */
const regionHeight = computed(() => {
  if (!state.field.region) return 0
  return state.field.region.height / PIXELS_PER_METER
})

function onFieldTypeChange(type) {
  state.field.type = type
  // 切换类型时，清零非当前类型的场数值，避免残留误判
  if (type === 'electric') {
    state.field.B = 0
  } else if (type === 'magnetic') {
    state.field.E.x = 0
    state.field.E.y = 0
  } else if (type === 'none') {
    state.field.E.x = 0
    state.field.E.y = 0
    state.field.B = 0
  }
  // composite 不清零任何一个，保留之前设置的 E/B 供用户直接使用
}

function onRegionToggle(enabled) {
  if (enabled) {
    // 默认区域：画布中心 10m × 10m
    const cx = 200
    const cy = 200
    const halfW = 5 * PIXELS_PER_METER
    const halfH = 5 * PIXELS_PER_METER
    state.field.region = {
      x: cx - halfW,
      y: cy - halfH,
      width: halfW * 2,
      height: halfH * 2
    }
  } else {
    delete state.field.region
    // 关闭区域限制时，如果当前是场区域工具，切回选择工具
    if (tool.value === 'field') {
      tool.value = 'select'
    }
  }
}

function updateRegionCenter(axis, valueMeters) {
  if (!state.field.region) return
  const halfW = state.field.region.width / 2
  const halfH = state.field.region.height / 2
  const centerPx = valueMeters * PIXELS_PER_METER
  if (axis === 'x') {
    state.field.region.x = centerPx - halfW
  } else {
    state.field.region.y = centerPx - halfH
  }
}

function updateRegionSize(dim, valueMeters) {
  if (!state.field.region) return
  const sizePx = valueMeters * PIXELS_PER_METER
  // 保持中心不变，调整宽高
  const cx = state.field.region.x + state.field.region.width / 2
  const cy = state.field.region.y + state.field.region.height / 2
  if (dim === 'width') {
    state.field.region.x = cx - sizePx / 2
    state.field.region.width = sizePx
  } else {
    state.field.region.y = cy - sizePx / 2
    state.field.region.height = sizePx
  }
}

// 场类型变为"无场"时，自动取消场区域工具
watch(
  () => state.field.type,
  (type) => {
    if (type === 'none' && tool.value === 'field') {
      tool.value = 'select'
    }
  }
)
</script>

<style scoped>
.scene-settings {
  padding: 1rem;
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.15);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.panel-title {
  font-size: 0.8rem;
  color: var(--vsd-info);
  letter-spacing: 0.05em;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: var(--vsd-text-dim);
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  transition: all 0.15s;
}

.collapse-btn:hover {
  color: var(--vsd-info);
  background: rgba(var(--vsd-blue-rgb), 0.15);
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-section {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.15);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-group {
  display: flex;
  gap: 0.5rem;
  min-width: 0;
}

.field-group .field {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

label {
  font-size: 0.75rem;
  color: var(--vsd-text-muted);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--vsd-text);
}

.toggle-label input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--vsd-info);
}

.toggle-text {
  font-size: 0.75rem;
  color: var(--vsd-text-muted);
}

input,
select {
  padding: 0.45rem 0.6rem;
  background: rgba(var(--vsd-panel-rgb), 0.8);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus,
select:focus {
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
}

select {
  cursor: pointer;
}

.hint {
  font-size: 0.75rem;
  color: var(--vsd-text-dim);
  margin-top: 0.25rem;
}
</style>
