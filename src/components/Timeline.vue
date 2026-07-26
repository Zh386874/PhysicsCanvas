<template>
  <div class="timeline">
    <button class="kf-btn" :disabled="!hasPrevKeyframe" @click="prevKeyframe">◀</button>

    <div class="slider-wrap">
      <input
        type="range"
        class="slider"
        :min="0"
        :max="Math.max(snapshots.length - 1, 0)"
        :value="currentFrame"
        @input="$emit('update:currentFrame', parseInt($event.target.value))"
      />
      <div class="kf-markers">
        <span
          v-for="idx in keyframeIndices"
          :key="idx"
          class="kf-marker"
          :style="{ left: markerPos(idx) }"
        ></span>
      </div>
    </div>

    <button class="kf-btn" :disabled="!hasNextKeyframe" @click="nextKeyframe">▶</button>

    <span class="frame-info">
      第 {{ currentFrame }} 帧 / 共 {{ snapshots.length }} 帧
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  snapshots: { type: Array, default: () => [] },
  currentFrame: { type: Number, default: 0 },
  keyframeIndices: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:currentFrame'])

const hasPrevKeyframe = computed(() =>
  props.keyframeIndices.some(i => i < props.currentFrame)
)

const hasNextKeyframe = computed(() =>
  props.keyframeIndices.some(i => i > props.currentFrame)
)

function markerPos(idx) {
  const total = props.snapshots.length
  if (total <= 1) return '0%'
  return ((idx / (total - 1)) * 100) + '%'
}

function prevKeyframe() {
  const prev = props.keyframeIndices
    .filter(i => i < props.currentFrame)
    .sort((a, b) => b - a)[0]
  if (prev !== undefined) emit('update:currentFrame', prev)
}

function nextKeyframe() {
  const next = props.keyframeIndices
    .filter(i => i > props.currentFrame)
    .sort((a, b) => a - b)[0]
  if (next !== undefined) emit('update:currentFrame', next)
}
</script>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: rgba(15, 23, 42, 0.9);
  border-top: 1px solid rgba(59, 130, 246, 0.2);
}

.kf-btn {
  padding: 0.3rem 0.6rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.05);
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.kf-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
}

.kf-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.slider-wrap {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}

.slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(96, 165, 250, 0.4));
  border-radius: 3px;
  outline: none;
  position: relative;
  z-index: 1;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #60a5fa;
  border: 2px solid #1e293b;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #60a5fa;
  border: 2px solid #1e293b;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.kf-markers {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 20px;
  pointer-events: none;
  z-index: 2;
}

.kf-marker {
  position: absolute;
  width: 3px;
  height: 14px;
  background: #fbbf24;
  border-radius: 1px;
  transform: translateX(-50%);
  box-shadow: 0 0 4px rgba(251, 191, 36, 0.6);
}

.frame-info {
  font-size: 0.8rem;
  color: #94a3b8;
  white-space: nowrap;
  min-width: 130px;
  text-align: right;
}
</style>
