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
    </form>
  </div>
</template>

<script setup>
const props = defineProps({
  object: { type: Object, default: null }
})

const emit = defineEmits(['update:object'])

function update(key, value) {
  emit('update:object', { ...props.object, [key]: value })
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

label {
  font-size: 0.75rem;
  color: #94a3b8;
}

input {
  padding: 0.45rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  color: #e0e6ff;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}
</style>