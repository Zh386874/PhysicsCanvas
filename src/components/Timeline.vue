<template>
  <div class="timeline">
    <button class="kf-btn" :disabled="!hasPrevKeyframe" @click="prevKeyframe" title="上一关键帧">
      ⏮
    </button>
    <button class="kf-btn" :disabled="snapshots.length === 0" @click="stepFrame(-1)" title="上一帧">
      ◀
    </button>

    <button
      class="kf-btn play-btn"
      :disabled="snapshots.length === 0"
      @click="togglePlay"
      :title="isPlaying ? '暂停' : '播放'"
    >
      {{ isPlaying ? '⏸' : '▶' }}
    </button>

    <button class="kf-btn" :disabled="snapshots.length === 0" @click="stepFrame(1)" title="下一帧">
      ▶
    </button>
    <button class="kf-btn" :disabled="!hasNextKeyframe" @click="nextKeyframe" title="下一关键帧">
      ⏭
    </button>

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

    <div class="speed-select">
      <button
        v-for="s in speedOptions"
        :key="s"
        class="speed-btn"
        :class="{ active: playbackSpeed === s }"
        @click="setPlaybackSpeed(s)"
      >
        {{ s }}x
      </button>
    </div>

    <span class="frame-info">第 {{ currentFrame }} 帧 / 共 {{ snapshots.length }} 帧</span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue'
import {
  isPlaying,
  playbackSpeed,
  togglePlay,
  stepFrame,
  setPlaybackSpeed,
  pause
} from '../composables/useSnapshotManager'

const props = defineProps({
  snapshots: { type: Array, default: () => [] },
  currentFrame: { type: Number, default: 0 },
  keyframeIndices: { type: Array, default: () => [] }
})

const speedOptions = [0.5, 1, 2]

const hasPrevKeyframe = computed(() => props.keyframeIndices.some((i) => i < props.currentFrame))

const hasNextKeyframe = computed(() => props.keyframeIndices.some((i) => i > props.currentFrame))

function markerPos(idx) {
  const total = props.snapshots.length
  if (total <= 1) return '0%'
  return (idx / (total - 1)) * 100 + '%'
}

function prevKeyframe() {
  const prev = props.keyframeIndices.filter((i) => i < props.currentFrame).sort((a, b) => b - a)[0]
  if (prev !== undefined) emitUpdate(prev)
}

function nextKeyframe() {
  const next = props.keyframeIndices.filter((i) => i > props.currentFrame).sort((a, b) => a - b)[0]
  if (next !== undefined) emitUpdate(next)
}

// 关键帧导航通过 emit 通知父组件更新 currentFrame
const emit = defineEmits(['update:currentFrame'])
function emitUpdate(frame) {
  emit('update:currentFrame', frame)
}

// 组件卸载时暂停回放，避免 rAF 泄漏
onBeforeUnmount(() => {
  pause()
})
</script>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  background: rgba(var(--vsd-panel-rgb), 0.9);
  border-top: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
}

.kf-btn {
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.3);
  border-radius: 6px;
  background: rgba(var(--vsd-blue-rgb), 0.05);
  color: var(--vsd-info);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
  min-width: 30px;
}

.kf-btn:hover:not(:disabled) {
  background: rgba(var(--vsd-blue-rgb), 0.15);
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
}

.kf-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-btn {
  background: rgba(var(--vsd-green-rgb), 0.15);
  border-color: rgba(var(--vsd-green-rgb), 0.4);
  color: var(--vsd-green);
}

.play-btn:hover:not(:disabled) {
  background: rgba(var(--vsd-green-rgb), 0.25);
  border-color: rgba(var(--vsd-green-rgb), 0.6);
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
  background: linear-gradient(
    90deg,
    rgba(var(--vsd-blue-rgb), 0.2),
    rgba(var(--vsd-info-rgb), 0.4)
  );
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
  background: var(--vsd-info);
  border: 2px solid var(--vsd-panel-light);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--vsd-info);
  border: 2px solid var(--vsd-panel-light);
  cursor: pointer;
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
  background: var(--vsd-yellow);
  border-radius: 1px;
  transform: translateX(-50%);
}

.speed-select {
  display: flex;
  gap: 0.2rem;
  background: rgba(var(--vsd-panel-rgb), 0.6);
  border: 1px solid rgba(var(--vsd-blue-rgb), 0.2);
  border-radius: 6px;
  padding: 0.15rem;
}

.speed-btn {
  padding: 0.2rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vsd-text-muted);
  cursor: pointer;
  font-size: 0.72rem;
  transition: all 0.2s;
}

.speed-btn:hover {
  color: var(--vsd-text);
}

.speed-btn.active {
  background: rgba(var(--vsd-blue-rgb), 0.3);
  color: var(--vsd-info);
}

.frame-info {
  font-size: 0.8rem;
  color: var(--vsd-text-muted);
  white-space: nowrap;
  min-width: 130px;
  text-align: right;
}
</style>
