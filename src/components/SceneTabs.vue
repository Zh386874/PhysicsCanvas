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

const scenes = ['抛体运动', '斜面滑块', '弹性碰撞', '磁场圆周', '电场偏转', '自定义']
</script>

<style scoped>
.scene-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab {
  padding: 0.4rem 1rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(59, 130, 246, 0.08);
  color: #cbd5e1;
}

.tab.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(96, 165, 250, 0.1));
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
}
</style>