<template>
  <div class="control-bar">
    <button
      class="btn"
      :disabled="mode === 'replay'"
      @click="$emit('toggle-play')"
    >
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
    <button
      class="btn"
      :class="{ active: mode === 'replay' }"
      @click="$emit('toggle-replay')"
    >
      ⏪ 分步回放
    </button>
  </div>
</template>

<script setup>
defineProps({
  isPlaying: { type: Boolean, default: false },
  showForce: { type: Boolean, default: true },
  mode: { type: String, default: 'live' }
})

defineEmits(['toggle-play', 'reset', 'toggle-force', 'toggle-replay'])
</script>

<style scoped>
.control-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(15, 23, 42, 0.9);
  border-top: 1px solid rgba(59, 130, 246, 0.25);
  backdrop-filter: blur(10px);
}

.btn {
  padding: 0.5rem 1.4rem;
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.05);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #fff;
}

.btn.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(96, 165, 250, 0.1));
  border-color: rgba(59, 130, 246, 0.6);
  color: #93c5fd;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
}

.btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
