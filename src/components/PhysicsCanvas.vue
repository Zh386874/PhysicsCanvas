<template>
  <div class="canvas-wrap">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { state, updatePhysics } from '../composables/usePhysics'

const canvasRef = ref(null)
let ctx = null
let rafId = null
let lastTime = 0

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.parentElement.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  ctx = canvas.getContext('2d')
  state.groundY = rect.height - 60
}

function drawGrid() {
  const canvas = canvasRef.value
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.06)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x < canvas.width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let y = 0; y < canvas.height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }
}

function drawGround() {
  const canvas = canvasRef.value
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, state.groundY)
  ctx.lineTo(canvas.width, state.groundY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('地面', 10, state.groundY + 18)
}

function drawTrails() {
  for (const obj of state.objects) {
    if (!obj.trail || obj.trail.length < 2) continue
    ctx.strokeStyle = obj.color + '40'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.trail[0].x, obj.trail[0].y)
    for (let i = 1; i < obj.trail.length; i++) {
      ctx.lineTo(obj.trail[i].x, obj.trail[i].y)
    }
    ctx.stroke()
  }
}

function drawObjects() {
  for (const obj of state.objects) {
    const r = obj.radius || 10

    // 光晕
    ctx.beginPath()
    ctx.arc(obj.x, obj.y, r + 6, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(obj.x, obj.y, r, obj.x, obj.y, r + 6)
    glow.addColorStop(0, obj.color + '40')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fill()

    // 物体
    ctx.beginPath()
    ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2)
    ctx.fillStyle = obj.color
    ctx.fill()

    // 名称
    ctx.fillStyle = '#e0e6ff'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(obj.name, obj.x, obj.y - r - 8)
  }
}

function drawVelocity() {
  for (const obj of state.objects) {
    if (Math.abs(obj.vx) < 1 && Math.abs(obj.vy) < 1) continue
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.x, obj.y)
    ctx.lineTo(obj.x + obj.vx * 0.3, obj.y + obj.vy * 0.3)
    ctx.stroke()
  }
}

function drawForces() {
  if (!state.showForce) return
  for (const obj of state.objects) {
    const r = obj.radius || 10
    // 重力箭头
    const fgy = obj.mass * state.gravity
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.x, obj.y)
    ctx.lineTo(obj.x, obj.y + Math.min(fgy * 2, 50))
    ctx.stroke()
    // 箭头头
    const arrowY = obj.y + Math.min(fgy * 2, 50)
    ctx.beginPath()
    ctx.moveTo(obj.x - 4, arrowY - 4)
    ctx.lineTo(obj.x, arrowY)
    ctx.lineTo(obj.x + 4, arrowY - 4)
    ctx.stroke()
    // 标注
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('mg', obj.x + 6, obj.y + 20)
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawGrid()
  drawGround()
  drawTrails()
  drawObjects()
  drawVelocity()
  drawForces()
}

function loop(now) {
  if (lastTime === 0) lastTime = now
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  updatePhysics(dt)
  draw()
  rafId = requestAnimationFrame(loop)
}

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  rafId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style scoped>
.canvas-wrap {
  flex: 1;
  background: #0a0e27;
  overflow: hidden;
  position: relative;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
