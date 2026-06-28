<template>
  <div class="object-list">
    <div class="panel-title">物体列表</div>
    <div class="list">
      <div
        v-for="obj in objects"
        :key="obj.id"
        class="item"
        :class="{ selected: obj.id === selectedId }"
        @click="$emit('select', obj.id)"
      >
        <span class="name">{{ obj.name }}</span>
        <span class="type">{{ obj.type }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  objects: { type: Array, required: true },
  selectedId: { type: Number, default: null }
})

defineEmits(['select'])
</script>

<style scoped>
.object-list {
  padding: 1rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
}

.panel-title {
  font-size: 0.8rem;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.item:hover {
  border-color: rgba(59, 130, 246, 0.3);
}

.item.selected {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.4);
}

.name {
  color: #e0e6ff;
  font-size: 0.9rem;
}

.type {
  color: #64748b;
  font-size: 0.75rem;
}
</style>