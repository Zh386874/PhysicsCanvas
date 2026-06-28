<template>
  <div class="scene-tabs">
    <button
      v-for="scene in scenes"
      :key="scene"
      class="tab"
      :class="{ active: activeScene === scene }"
      @click="$emit('switch', scene)"
    >
      {{ scene }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  activeScene: { type: String, required: true }
})

defineEmits(['switch'])

const scenes = ['抛体运动', '斜面滑块', '弹性碰撞']
</script>

<style scoped>
.scene-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.8);
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.tab {
  padding: 0.5rem 1.2rem;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.tab:hover {
  border-color: rgba(59, 130, 246, 0.4);
  color: #cbd5e1;
}

.tab.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}
</style>