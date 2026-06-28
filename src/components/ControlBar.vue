<template>
  <div class="control-bar">
    <button class="btn" @click="$emit('toggle-play')">
      {{ isPlaying ? '暂停' : '播放' }}
    </button>
    <button class="btn" @click="$emit('reset')">重置</button>
    <button
      class="btn"
      :class="{ active: showForce }"
      @click="$emit('toggle-force')"
    >
      受力显示
    </button>
  </div>
</template>

<script setup>
defineProps({
  isPlaying: { type: Boolean, default: false },
  showForce: { type: Boolean, default: true }
})

defineEmits(['toggle-play', 'reset', 'toggle-force'])
</script>

<style scoped>
.control-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.8);
  border-top: 1px solid rgba(59, 130, 246, 0.2);
}

.btn {
  padding: 0.5rem 1.2rem;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn:hover {
  border-color: rgba(59, 130, 246, 0.4);
  color: #cbd5e1;
}

.btn.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}
</style>