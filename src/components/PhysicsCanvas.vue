<template>
  <div class="canvas-wrap">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { state, updatePhysics, snapshots, currentFrame } from '../composables/usePhysics'

const props = defineProps({
  mode: { type: String, default: 'live' },
  aiToast: { type: String, default: '' }
})

const emit = defineEmits(['seek'])

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

/**
 * 获取当前要绘制的物体数组：
 * live 模式 → state.objects
 * replay 模式 → 用快照帧的位置/速度覆盖 state.objects
 */
function getDisplayObjects() {
  if (props.mode !== 'replay' || snapshots.value.length === 0) {
    return state.objects
  }
  const frame = snapshots.value[currentFrame.value]
  if (!frame) return state.objects
  // 向后兼容：旧快照是数组，新快照是 { objects, field, groundY, ... }
  const frameObjects = Array.isArray(frame) ? frame : frame.objects
  // 合并：用快照的位置/速度，加上 state.objects 的颜色/半径/名称
  return state.objects.map(obj => {
    const snap = frameObjects.find(s => s.id === obj.id)
    if (!snap) return obj
    return { ...obj, x: snap.x, y: snap.y, vx: snap.vx, vy: snap.vy }
  })
}

/**
 * 回放模式下获取快照中的 field，否则用当前 state.field
 * 向后兼容：旧快照无 field 字段时回退 state.field
 */
function getDisplayField() {
  if (props.mode === 'replay' && snapshots.value.length > 0) {
    const frame = snapshots.value[currentFrame.value]
    if (frame && !Array.isArray(frame) && frame.field) {
      return frame.field
    }
  }
  return state.field
}

/**
 * 回放模式下获取快照中的 groundY，否则用当前 state.groundY
 */
function getDisplayGroundY() {
  if (props.mode === 'replay' && snapshots.value.length > 0) {
    const frame = snapshots.value[currentFrame.value]
    if (frame && !Array.isArray(frame) && frame.groundY !== undefined) {
      return frame.groundY
    }
  }
  return state.groundY
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
  const groundY = getDisplayGroundY()
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(canvas.width, groundY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('地面', 10, groundY + 18)
}

function drawField() {
  const canvas = canvasRef.value
  if (!canvas) return
  const step = 60
  // 回放模式下使用快照中的 field，保证场可视化与帧一致
  const field = getDisplayField()
  const symbol = field.type

  if (symbol === 'magnetic') {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < canvas.width; x += step) {
      for (let y = step / 2; y < canvas.height; y += step) {
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.stroke()
        if (field.B >= 0) {
          // ⊙ 向里：画实心点
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // ⊗ 向外：画叉
          ctx.beginPath()
          ctx.moveTo(x - 4, y - 4)
          ctx.lineTo(x + 4, y + 4)
          ctx.moveTo(x + 4, y - 4)
          ctx.lineTo(x - 4, y + 4)
          ctx.stroke()
        }
      }
    }
  } else if (symbol === 'electric') {
    const ex = field.E.x
    const ey = field.E.y
    const mag = Math.sqrt(ex * ex + ey * ey)
    if (mag < 0.01) return
    // 归一化方向
    const dx = (ex / mag) * 20
    const dy = (ey / mag) * 20
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.fillStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < canvas.width; x += step) {
      for (let y = step / 2; y < canvas.height; y += step) {
        // 箭头线
        ctx.beginPath()
        ctx.moveTo(x - dx / 2, y - dy / 2)
        ctx.lineTo(x + dx / 2, y + dy / 2)
        ctx.stroke()
        // 箭头头
        const angle = Math.atan2(dy, dx)
        ctx.beginPath()
        ctx.moveTo(x + dx / 2, y + dy / 2)
        ctx.lineTo(
          x + dx / 2 - 5 * Math.cos(angle - 0.4),
          y + dy / 2 - 5 * Math.sin(angle - 0.4)
        )
        ctx.lineTo(
          x + dx / 2 - 5 * Math.cos(angle + 0.4),
          y + dy / 2 - 5 * Math.sin(angle + 0.4)
        )
        ctx.closePath()
        ctx.fill()
      }
    }
  }
}

function drawTrails(objects) {
  // 回放模式不画实时轨迹（位置是快照的，轨迹会错乱）
  if (props.mode === 'replay') return
  for (const obj of objects) {
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

function drawObjects(objects) {
  for (const obj of objects) {
    if (obj.type === 'line_segment') continue
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

/**
 * 绘制所有线段物体
 * 包括：线段本身、法线方向箭头、内侧（实体面）半透明填充
 */
function drawSegments(objects) {
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const { x1, y1, x2, y2, normalX, normalY } = seg
    const nx = normalX || 0
    const ny = normalY || 0

    // 1. 内侧半透明面（沿法线方向偏移 30px 形成四边形）
    const offset = 30
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
    ctx.lineTo(x1 + nx * offset, y1 + ny * offset)
    ctx.closePath()
    ctx.fill()

    // 2. 线段本身
    ctx.strokeStyle = seg.color || '#475569'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // 3. 法线箭头（从中点指向内侧）
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const arrowLen = 25
    const tipX = midX + nx * arrowLen
    const tipY = midY + ny * arrowLen
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(midX, midY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
    // 箭头头
    const angle = Math.atan2(ny, nx)
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 5 * Math.cos(angle - 0.4), tipY - 5 * Math.sin(angle - 0.4))
    ctx.lineTo(tipX - 5 * Math.cos(angle + 0.4), tipY - 5 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fillStyle = 'rgba(96, 165, 250, 0.6)'
    ctx.fill()

    // 4. 名称
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(seg.name || '线段', midX, midY - 10)
  }
}

function drawVelocity(objects) {
  for (const obj of objects) {
    if (Math.abs(obj.vx) < 1 && Math.abs(obj.vy) < 1) continue
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(obj.x, obj.y)
    ctx.lineTo(obj.x + obj.vx * 0.3, obj.y + obj.vy * 0.3)
    ctx.stroke()
  }
}

function drawForces(objects) {
  if (!state.showForce) return
  for (const obj of objects) {
    if (obj.type === 'line_segment') continue
    const r = obj.radius || 10

    // 重力箭头（红色，竖直向下）—— 仅当重力不为 0 时绘制
    const fgy = obj.mass * state.gravity
    if (fgy > 0.01) {
      const gLen = Math.min(fgy * 2, 50)
      drawArrow(obj.x, obj.y, obj.x, obj.y + gLen, 'rgba(239, 68, 68, 0.8)', 2)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('mg', obj.x + 6, obj.y + gLen / 2)
    }

    // 电磁场力（仅当存在场且物体带电时绘制）
    const charge = obj.charge || 0
    if (charge !== 0) {
      if (state.field.type === 'electric') {
        // 电场力 Fe = qE（绿色）
        const Fex = charge * state.field.E.x
        const Fey = charge * state.field.E.y
        const feMag = Math.hypot(Fex, Fey)
        if (feMag > 0.01) {
          const feLen = Math.min(feMag * 0.8, 60)
          const ex = obj.x + (Fex / feMag) * feLen
          const ey = obj.y + (Fey / feMag) * feLen
          drawArrow(obj.x, obj.y, ex, ey, 'rgba(34, 197, 94, 0.9)', 2)
          ctx.fillStyle = 'rgba(34, 197, 94, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qE', ex + 4, ey)
        }
      } else if (state.field.type === 'magnetic') {
        // 洛伦兹力 F = qv×B（紫色，垂直于速度）
        // Fx = q*vy*B, Fy = -q*vx*B
        const Fmx = charge * obj.vy * state.field.B
        const Fmy = -charge * obj.vx * state.field.B
        const fmMag = Math.hypot(Fmx, Fmy)
        if (fmMag > 0.01) {
          const fmLen = Math.min(fmMag * 0.8, 60)
          const mx = obj.x + (Fmx / fmMag) * fmLen
          const my = obj.y + (Fmy / fmMag) * fmLen
          drawArrow(obj.x, obj.y, mx, my, 'rgba(168, 85, 247, 0.9)', 2)
          ctx.fillStyle = 'rgba(168, 85, 247, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qvB', mx + 4, my)
        }
      }
    }

    // 查找物体是否贴近某条线段（在斜面上）
    const seg = findContactSegment(obj, objects)
    if (seg) {
      const nx = seg.normalX
      const ny = seg.normalY
      // 斜面倾角 α（线段与水平方向夹角）
      const segDx = seg.x2 - seg.x1
      const segDy = seg.y2 - seg.y1
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy)
      const cosA = Math.abs(segDx) / segLen // 斜面与水平夹角 α 的余弦：cos(α)=dx/len
      // 支持力 N = mg*cos(α)，方向沿法线（指向内侧）
      const N = obj.mass * state.gravity * cosA
      const nLen = Math.min(N * 2, 50)
      drawArrow(
        obj.x, obj.y,
        obj.x + nx * nLen, obj.y + ny * nLen,
        'rgba(148, 163, 184, 0.8)', 2
      )
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
      ctx.fillText('N', obj.x + nx * nLen + 4, obj.y + ny * nLen)

      // 摩擦力 f = μ*N，方向沿斜面与运动方向相反
      const mu = obj.friction || 0
      if (mu > 0) {
        const f = mu * N
        const fLen = Math.min(f * 2, 40)
        // 斜面方向单位向量
        const tx = segDx / segLen
        const ty = segDy / segLen
        // 摩擦力方向：与速度沿斜面分量方向相反
        const vAlong = obj.vx * tx + obj.vy * ty
        const dir = vAlong >= 0 ? -1 : 1
        drawArrow(
          obj.x, obj.y,
          obj.x + tx * fLen * dir, obj.y + ty * fLen * dir,
          'rgba(251, 146, 60, 0.8)', 2
        )
        ctx.fillStyle = 'rgba(251, 146, 60, 0.9)'
        ctx.fillText('f', obj.x + tx * fLen * dir + 4, obj.y + ty * fLen * dir)
      }
    }
  }
}

/**
 * 绘制带箭头的线段
 */
function drawArrow(x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  // 箭头头
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 6 * Math.cos(angle - 0.4), y2 - 6 * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - 6 * Math.cos(angle + 0.4), y2 - 6 * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

/**
 * 查找物体当前接触的线段（距离小于半径+阈值）
 */
function findContactSegment(obj, objects) {
  const threshold = (obj.radius || 10) + 4
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const dist = pointToSegmentDistance(obj.x, obj.y, seg.x1, seg.y1, seg.x2, seg.y2)
    if (dist <= threshold) return seg
  }
  return null
}

/**
 * 点到线段距离
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function drawWatermark() {
  if (props.mode !== 'replay') return
  const canvas = canvasRef.value
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('回放模式', canvas.width - 16, 24)
}

/**
 * 绘制 AI 解析提示（画布左上角，3秒后由父组件清空）
 */
function drawAIToast() {
  if (!props.aiToast) return
  const canvas = canvasRef.value
  // 背景胶囊
  ctx.font = 'bold 13px sans-serif'
  const metrics = ctx.measureText(props.aiToast)
  const padX = 12
  const padY = 6
  const boxW = metrics.width + padX * 2
  const boxH = 26
  const x = 16
  const y = 16
  ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'
  roundRect(ctx, x, y, boxW, boxH, 13)
  ctx.fill()
  // 文字
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(props.aiToast, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}

/**
 * 圆角矩形辅助
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const objects = getDisplayObjects()

  drawGrid()
  drawField()
  drawGround()
  drawSegments(objects)
  drawTrails(objects)
  drawObjects(objects)
  drawVelocity(objects)
  drawForces(objects)
  drawWatermark()
  drawAIToast()
}

function loop(now) {
  if (lastTime === 0) lastTime = now
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  // 回放模式：跳过物理更新
  if (props.mode === 'live') {
    updatePhysics(dt)
  }
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
