<template>
  <div class="app">
    <SceneTabs :activeScene="activeScene" @switch="activeScene = $event" />

    <div class="main">
      <div class="left-panel">
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
        <PhysicsCanvas />
        <ControlBar
          :isPlaying="isPlaying"
          :showForce="showForce"
          @toggle-play="state.isPlaying = !state.isPlaying"
          @reset="onReset"
          @toggle-force="state.showForce = !state.showForce"
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
import { state, reset } from './composables/usePhysics'

const activeScene = ref('抛体运动')
const selectedId = ref(1)
const isPlaying = computed(() => state.isPlaying)
const showForce = computed(() => state.showForce)

const selectedObject = computed(() =>
  state.objects.find(o => o.id === selectedId.value)
)

function onObjectUpdate(updated) {
  const idx = state.objects.findIndex(o => o.id === updated.id)
  if (idx !== -1) Object.assign(state.objects[idx], updated)
}

function onReset() {
  reset()
}
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0e27;
  color: #e0e6ff;
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
  border-right: 1px solid rgba(59, 130, 246, 0.2);
  overflow-y: auto;
}

.right-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>