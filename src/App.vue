<template>
  <div class="app">
    <header class="app-header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">物理解模</span>
      </div>
      <SceneTabs :activeScene="activeScene" @switch="onSceneSwitch" />
    </header>

    <div class="main">
      <div class="left-panel">
        <AIInput @parsed="onAIParsed" />
        <ObjectList
          :objects="state.objects"
          :selectedId="selectedId"
          @select="selectedId = $event"
        />
        <PropertyPanel
          :object="selectedObject"
          @update:object="onObjectUpdate"
        />
      </div>

      <div class="right-area">
        <PhysicsCanvas :mode="mode" :aiToast="aiToast" />
        <Timeline
          v-if="mode === 'replay'"
          :snapshots="snapshots"
          :currentFrame="currentFrame"
          :keyframeIndices="keyframeIndices"
          @update:currentFrame="currentFrame = $event"
        />
        <ControlBar
          :isPlaying="isPlaying"
          :showForce="showForce"
          :mode="mode"
          @toggle-play="state.isPlaying = !state.isPlaying"
          @reset="onReset"
          @toggle-force="state.showForce = !state.showForce"
          @toggle-replay="onToggleReplay"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SceneTabs from './components/SceneTabs.vue'
import ObjectList from './components/ObjectList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import ControlBar from './components/ControlBar.vue'
import PhysicsCanvas from './components/PhysicsCanvas.vue'
import Timeline from './components/Timeline.vue'
import AIInput from './components/AIInput.vue'
import { state, reset, loadScene, snapshots, currentFrame, keyframeIndices } from './composables/usePhysics'
import { getPreset } from './composables/usePresets'

const activeScene = ref('抛体运动')
const selectedId = ref(1)
const mode = ref('live')
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)
const aiToast = ref('')

// 初始化默认场景
{
  const preset = getPreset('抛体运动')
  loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
}

const selectedObject = computed(() =>
  state.objects.find(o => o.id === selectedId.value)
)

function onObjectUpdate(updated) {
  const idx = state.objects.findIndex(o => o.id === updated.id)
  if (idx !== -1) Object.assign(state.objects[idx], updated)
}

function onSceneSwitch(sceneName) {
  activeScene.value = sceneName
  const preset = getPreset(sceneName)
  loadScene(preset.objects, preset.forces, preset.field, preset.gravity, preset.groundY)
  selectedId.value = preset.objects[0]?.id ?? null
  // 切换场景时退出回放模式
  mode.value = 'live'
}

function onReset() {
  reset()
  mode.value = 'live'
}

function onToggleReplay() {
  if (mode.value === 'live') {
    // 进入回放：暂停物理，跳到最后一帧
    state.isPlaying = false
    mode.value = 'replay'
    if (snapshots.value.length > 0) {
      currentFrame.value = snapshots.value.length - 1
    }
  } else {
    mode.value = 'live'
  }
}

/**
 * AI 解析完成回调：切换场景 + 自动播放 + 显示画布提示
 */
function onAIParsed(sceneName) {
  activeScene.value = sceneName
  selectedId.value = state.objects[0]?.id ?? null
  mode.value = 'live'
  // 自动开始播放
  state.isPlaying = true
  // 显示画布左上角提示
  aiToast.value = 'AI 已解析：' + sceneName + '场景'
  setTimeout(() => { aiToast.value = '' }, 3000)
}
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #0a0e27 0%, #0f172a 100%);
  color: #e0e6ff;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.25rem;
  height: 56px;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(59, 130, 246, 0.25);
  backdrop-filter: blur(10px);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.logo-icon {
  font-size: 1.3rem;
  filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.6));
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.08em;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.5);
  border-right: 1px solid rgba(59, 130, 246, 0.2);
  overflow-y: auto;
}

.right-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
