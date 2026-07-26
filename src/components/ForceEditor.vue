<template>
  <div class="force-editor">
    <div class="section-header">
      <span class="panel-title">附加力</span>
      <button class="btn-add" @click="onAddForce">+ 添加</button>
    </div>

    <div v-if="objectForces.length === 0" class="empty">暂无附加力</div>

    <div v-else class="force-list">
      <div v-for="force in objectForces" :key="force.id" class="force-item">
        <div class="force-inputs">
          <div class="force-field">
            <label>Fx (N)</label>
            <input
              type="number"
              step="0.1"
              :value="force.fx"
              @input="updateForce(force.id, 'fx', parseFloat($event.target.value))"
            />
          </div>
          <div class="force-field">
            <label>Fy (N)</label>
            <input
              type="number"
              step="0.1"
              :value="force.fy"
              @input="updateForce(force.id, 'fy', parseFloat($event.target.value))"
            />
          </div>
        </div>
        <button class="btn-del" @click="removeForce(force.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { state, addForce, removeForce } from '../composables/usePhysics'
import { nextId } from '../composables/usePresets'

const props = defineProps({
  objectId: { type: Number, default: null }
})

const objectForces = computed(() =>
  state.forces.filter(f => f.targetId === props.objectId)
)

function onAddForce() {
  addForce({ id: nextId(), fx: 0, fy: 0, targetId: props.objectId })
}

function updateForce(forceId, key, value) {
  const force = state.forces.find(f => f.id === forceId)
  if (force) force[key] = value
}
</script>

<style scoped>
.force-editor {
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(59, 130, 246, 0.15);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.panel-title {
  font-size: 0.8rem;
  color: #60a5fa;
  letter-spacing: 0.05em;
}

.btn-add {
  padding: 0.25rem 0.7rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 6px;
  color: #60a5fa;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  background: rgba(59, 130, 246, 0.25);
}

.empty {
  color: #475569;
  font-size: 0.85rem;
}

.force-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.force-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 8px;
}

.force-inputs {
  flex: 1;
  display: flex;
  gap: 0.5rem;
}

.force-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.force-field label {
  font-size: 0.7rem;
  color: #64748b;
}

.force-field input {
  padding: 0.35rem 0.5rem;
  background: rgba(10, 14, 39, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 5px;
  color: #e0e6ff;
  font-size: 0.8rem;
  outline: none;
  width: 100%;
}

.force-field input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.btn-del {
  padding: 0.35rem 0.6rem;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 5px;
  color: #f87171;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-del:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>
