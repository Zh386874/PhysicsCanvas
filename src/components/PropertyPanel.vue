<template>
  <div class="property-panel">
    <div class="panel-title">属性</div>
    <div v-if="!object" class="empty">未选中物体</div>
    <form v-else class="form">
      <div class="field">
        <label>名称</label>
        <input
          type="text"
          :value="object.name"
          @input="update('name', $event.target.value)"
        />
      </div>
      <div class="field">
        <label>类型</label>
        <input
          type="text"
          :value="object.type"
          @input="update('type', $event.target.value)"
        />
      </div>
      <div class="field">
        <label>质量 (kg)</label>
        <input
          type="number"
          step="0.1"
          :value="object.mass"
          @input="update('mass', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>位置 X (m)</label>
        <input
          type="number"
          step="0.1"
          :value="object.x"
          @input="update('x', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>位置 Y (m)</label>
        <input
          type="number"
          step="0.1"
          :value="object.y"
          @input="update('y', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>速度 Vx (m/s)</label>
        <input
          type="number"
          step="0.1"
          :value="object.vx"
          @input="update('vx', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>速度 Vy (m/s)</label>
        <input
          type="number"
          step="0.1"
          :value="object.vy"
          @input="update('vy', parseFloat($event.target.value))"
        />
      </div>
      <div v-if="object.type === '质点'" class="field">
        <label>电荷 (q)</label>
        <input
          type="number"
          step="0.1"
          :value="object.charge || 0"
          @input="update('charge', parseFloat($event.target.value))"
        />
      </div>

      <!-- 线段物体属性 -->
      <template v-if="object.type === 'line_segment'">
        <div class="field-group">
          <div class="field">
            <label>端点1 X</label>
            <input
              type="number"
              step="1"
              :value="object.x1"
              @input="update('x1', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>端点1 Y</label>
            <input
              type="number"
              step="1"
              :value="object.y1"
              @input="update('y1', parseFloat($event.target.value))"
            />
          </div>
        </div>
        <div class="field-group">
          <div class="field">
            <label>端点2 X</label>
            <input
              type="number"
              step="1"
              :value="object.x2"
              @input="update('x2', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>端点2 Y</label>
            <input
              type="number"
              step="1"
              :value="object.y2"
              @input="update('y2', parseFloat($event.target.value))"
            />
          </div>
        </div>
        <div class="field">
          <label>恢复系数</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            :value="object.restitution !== undefined ? object.restitution : 0.3"
            @input="update('restitution', parseFloat($event.target.value))"
          />
        </div>
        <div class="field">
          <label>法线方向</label>
          <div class="normal-buttons">
            <button type="button" class="normal-btn" @click="setNormal(0, -1)" title="向上">↑</button>
            <button type="button" class="normal-btn" @click="setNormal(0, 1)" title="向下">↓</button>
            <button type="button" class="normal-btn" @click="setNormal(-1, 0)" title="向左">←</button>
            <button type="button" class="normal-btn" @click="setNormal(1, 0)" title="向右">→</button>
            <button type="button" class="normal-btn" @click="setNormal(-0.707, -0.707)" title="左上 45°">↖</button>
            <button type="button" class="normal-btn" @click="setNormal(0.707, -0.707)" title="右上 -45°">↗</button>
          </div>
          <div class="hint">
            当前: ({{ (object.normalX || 0).toFixed(2) }}, {{ (object.normalY || 0).toFixed(2) }})
          </div>
        </div>
        <div class="field">
          <label>法线 X</label>
          <input
            type="number"
            step="0.1"
            :value="object.normalX || 0"
            @input="update('normalX', parseFloat($event.target.value))"
          />
        </div>
        <div class="field">
          <label>法线 Y</label>
          <input
            type="number"
            step="0.1"
            :value="object.normalY || 0"
            @input="update('normalY', parseFloat($event.target.value))"
          />
        </div>
      </template>
    </form>

    <ForceEditor v-if="object" :objectId="object.id" />

    <!-- 场设置 -->
    <div class="field-section">
      <div class="section-header">
        <span class="panel-title">场景设置</span>
      </div>
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
        <select
          :value="state.field.type"
          @change="onFieldTypeChange($event.target.value)"
        >
          <option value="none">无场</option>
          <option value="electric">匀强电场</option>
          <option value="magnetic">匀强磁场</option>
        </select>
      </div>
      <div v-if="state.field.type === 'electric'" class="field-group">
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
      <div v-if="state.field.type === 'magnetic'" class="field-group">
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
    </div>
  </div>
</template>

<script setup>
import ForceEditor from './ForceEditor.vue'
import { state, PIXELS_PER_METER } from '../composables/usePhysics'

const props = defineProps({
  object: { type: Object, default: null }
})

const emit = defineEmits(['update:object'])

function update(key, value) {
  emit('update:object', { ...props.object, [key]: value })
}

function onFieldTypeChange(type) {
  state.field.type = type
}

function setNormal(nx, ny) {
  emit('update:object', { ...props.object, normalX: nx, normalY: ny })
}
</script>

<style scoped>
.property-panel {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.panel-title {
  font-size: 0.8rem;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.empty {
  color: #475569;
  font-size: 0.9rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-group {
  display: flex;
  gap: 0.5rem;
}

.field-group .field {
  flex: 1;
}

.field-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(59, 130, 246, 0.15);
}

.section-header {
  margin-bottom: 0.5rem;
}

label {
  font-size: 0.75rem;
  color: #94a3b8;
}

input, select {
  padding: 0.45rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  color: #e0e6ff;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, select:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

select {
  cursor: pointer;
}

.hint {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.normal-buttons {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
}

.normal-btn {
  padding: 0.35rem 0;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  color: #cbd5e1;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.normal-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}
</style>
