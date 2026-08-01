<template>
  <div class="control-bar">
    <button class="btn" :disabled="mode === 'replay'" @click="$emit('toggle-play')">
      {{ isPlaying ? '暂停' : '播放' }}
    </button>
    <button class="btn" @click="$emit('reset')">重置</button>
    <button class="btn" :class="{ active: showForce }" @click="$emit('toggle-force')">
      受力显示
    </button>
    <button class="btn" :class="{ active: showGateColors }" @click="$emit('toggle-gate-colors')">
      🎨 触发器颜色
    </button>
    <button class="btn" :class="{ active: mode === 'replay' }" @click="$emit('toggle-replay')">
      ⏪ 分步回放
    </button>
  </div>
</template>

<script setup>
defineProps({
  isPlaying: { type: Boolean, default: false },
  showForce: { type: Boolean, default: true },
  showGateColors: { type: Boolean, default: true },
  mode: { type: String, default: 'live' }
})

defineEmits(['toggle-play', 'reset', 'toggle-force', 'toggle-gate-colors', 'toggle-replay'])
</script>

<style scoped>
.control-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(var(--vsd-panel-rgb), 0.9);
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  backdrop-filter: blur(10px);
}

.btn {
  padding: 0.5rem 1.4rem;
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.25);
  border-radius: 8px;
  background: rgba(var(--vsd-blue-rgb), 0.05);
  color: var(--vsd-text);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: rgba(var(--vsd-blue-rgb), 0.15);
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
  color: var(--vsd-text);
}

.btn.active {
  background: var(--vsd-selection);
  border-color: rgba(var(--vsd-blue-rgb), 0.6);
  color: var(--vsd-info);
}

.btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
