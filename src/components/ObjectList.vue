<template>
  <div class="object-list">
    <div class="panel-title">物体列表</div>
    <div class="list">
      <div
        v-for="obj in objects"
        :key="obj.id"
        class="item"
        :class="{ selected: obj.id === selectedId, 'multi-selected': selectedIds.includes(obj.id) }"
        @click="$emit('select', obj.id)"
      >
        <span class="name">{{ obj.name }}</span>
        <div class="item-right">
          <span class="type">{{ obj.type }}</span>
          <button
            v-if="removable"
            class="del-btn"
            title="删除"
            @click.stop="$emit('remove', obj.id)"
          >✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  objects: { type: Array, required: true },
  selectedId: { type: Number, default: null },
  selectedIds: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false }
})

defineEmits(['select', 'remove'])
</script>

<style scoped>
.object-list {
  padding: 1rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
}

.panel-title {
  font-size: 0.75rem;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
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
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.item:hover {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
}

.item.selected {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(96, 165, 250, 0.05));
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
}

.item.multi-selected {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.22), rgba(167, 139, 250, 0.12));
  border-color: rgba(167, 139, 250, 0.8);
  border-left: 3px solid rgba(167, 139, 250, 0.95);
  box-shadow: 0 0 12px rgba(167, 139, 250, 0.4);
}

.item.multi-selected .name {
  font-weight: 600;
  color: #c4b5fd;
}

.name {
  color: #e0e6ff;
  font-size: 0.9rem;
}

.type {
  color: #64748b;
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.08);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.del-btn {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.del-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
}
</style>