/**
 * 画布渲染层：所有纯绘制函数
 * 接收 ctx 和状态参数，无副作用，不持有状态
 */
import type { PhysicsObject, FieldState, ParticleObject, SegmentObject, SpringObject } from './usePhysics'

/** 渲染上下文：绘制所需的外部依赖 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D
  cssW: number
  cssH: number
  dpr: number
}

/** 场景显示数据 */
export interface DisplayData {
  objects: PhysicsObject[]
  field: FieldState
  groundY: number
}

/** 预览状态 */
export interface PreviewState {
  previewLine: { x1: number; y1: number; x2: number; y2: number } | null
  previewArc: {
    cx: number; cy: number; r: number
    startAngle: number; endAngle: number
    phase?: string
  } | null
}

/** 选框状态 */
export interface SelectionState {
  active: boolean
  start: { x: number; y: number } | null
  end: { x: number; y: number } | null
  selectedIds: number[]
}

/** Shift 闪烁状态 */
export interface ShiftFlashState {
  pos: { x: number; y: number } | null
  until: number
}

/** UI 状态 */
export interface UIState {
  mode: string
  aiToast: string
  editMode: boolean
  tool: string
  chargeMode: boolean
}

// ===== 基础绘制工具 =====

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width: number
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 6 * Math.cos(angle - 0.4), y2 - 6 * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - 6 * Math.cos(angle + 0.4), y2 - 6 * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
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

export function pointToSegmentDistance(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * 查找物体当前接触的线段（距离小于半径+1）
 */
export function findContactSegment(
  obj: ParticleObject,
  objects: PhysicsObject[]
): SegmentObject | null {
  const threshold = (obj.radius || 10) + 1
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const s = seg as SegmentObject
    const dist = pointToSegmentDistance(obj.x, obj.y, s.x1, s.y1, s.x2, s.y2)
    if (dist <= threshold) return s
  }
  return null
}

// ===== 场景绘制函数 =====

export function drawGrid(rc: RenderContext): void {
  const { ctx, cssW, cssH } = rc
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.06)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x < cssW; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke()
  }
  for (let y = 0; y < cssH; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke()
  }
}

export function drawGround(rc: RenderContext, groundY: number): void {
  const { ctx, cssW } = rc
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cssW, groundY); ctx.stroke()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('地面', 10, groundY + 18)
}

export function drawField(rc: RenderContext, field: FieldState): void {
  const { ctx, cssW, cssH } = rc
  const step = 60
  // 多场同时绘制：磁场和电场可共存
  if (field.B !== 0) {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke()
        if (field.B >= 0) {
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4)
          ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4)
          ctx.stroke()
        }
      }
    }
  }
  if (field.E.x !== 0 || field.E.y !== 0) {
    const ex = field.E.x, ey = field.E.y
    const mag = Math.sqrt(ex * ex + ey * ey)
    if (mag < 0.01) return
    const dx = (ex / mag) * 20, dy = (ey / mag) * 20
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.fillStyle = 'rgba(34, 211, 238, 0.2)'
    ctx.lineWidth = 1
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        ctx.beginPath()
        ctx.moveTo(x - dx / 2, y - dy / 2); ctx.lineTo(x + dx / 2, y + dy / 2)
        ctx.stroke()
        const angle = Math.atan2(dy, dx)
        ctx.beginPath()
        ctx.moveTo(x + dx / 2, y + dy / 2)
        ctx.lineTo(x + dx / 2 - 5 * Math.cos(angle - 0.4), y + dy / 2 - 5 * Math.sin(angle - 0.4))
        ctx.lineTo(x + dx / 2 - 5 * Math.cos(angle + 0.4), y + dy / 2 - 5 * Math.sin(angle + 0.4))
        ctx.closePath(); ctx.fill()
      }
    }
  }
}

export function drawTrails(rc: RenderContext, objects: PhysicsObject[], isReplay: boolean): void {
  if (isReplay) return
  const { ctx } = rc
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    if (!p.trail || p.trail.length < 2) continue
    ctx.strokeStyle = p.color + '40'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p.trail[0].x, p.trail[0].y)
    for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y)
    ctx.stroke()
  }
}

export function drawObjects(rc: RenderContext, objects: PhysicsObject[]): void {
  const { ctx } = rc
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    const r = p.radius || 10
    ctx.beginPath()
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 6)
    glow.addColorStop(0, p.color + '40')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fill()
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    ctx.fillStyle = '#e0e6ff'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(p.name, p.x, p.y - r - 8)
  }
}

export function drawSegments(rc: RenderContext, objects: PhysicsObject[]): void {
  const { ctx } = rc
  for (const obj of objects) {
    if (obj.type !== 'line_segment') continue
    const seg = obj as SegmentObject
    const { x1, y1, x2, y2, normalX, normalY } = seg
    const nx = normalX || 0, ny = normalY || 0
    const offset = 30
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.beginPath()
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
    ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
    ctx.lineTo(x1 + nx * offset, y1 + ny * offset)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = seg.color || '#475569'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2
    const arrowLen = 20
    const tipX = midX + nx * arrowLen, tipY = midY + ny * arrowLen
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(tipX, tipY); ctx.stroke()
    const angle = Math.atan2(ny, nx)
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 5 * Math.cos(angle - 0.4), tipY - 5 * Math.sin(angle - 0.4))
    ctx.lineTo(tipX - 5 * Math.cos(angle + 0.4), tipY - 5 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fillStyle = 'rgba(167, 139, 250, 0.7)'; ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(seg.name || '线段', midX, midY - 10)
  }
}

export function drawArcsVisually(rc: RenderContext, objects: PhysicsObject[]): void {
  const { ctx } = rc
  const groups = new Map<number, SegmentObject[]>()
  for (const obj of objects) {
    if (obj.type === 'line_segment' && (obj as SegmentObject).groupId && (obj as SegmentObject).arc) {
      const seg = obj as SegmentObject
      if (!groups.has(seg.groupId!)) groups.set(seg.groupId!, [])
      groups.get(seg.groupId!)!.push(seg)
    }
  }
  for (const [, segs] of groups) {
    if (segs.length === 0) continue
    const { cx, cy, r, startAngle, endAngle } = segs[0].arc!
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.stroke()
  }
}

/** 弹簧常量：螺旋圈数与振幅 */
const SPRING_COILS = 8
const SPRING_AMPLITUDE = 8

/**
 * 绘制弹簧：从固定端到连接球体的螺旋线
 */
export function drawSprings(rc: RenderContext, objects: PhysicsObject[]): void {
  const { ctx } = rc
  for (const obj of objects) {
    if (obj.type !== 'spring') continue
    const spring = obj as SpringObject
    const ball = objects.find(o => o.id === spring.ballId && (o.type === '质点' || o.type === '刚体')) as ParticleObject | undefined
    if (!ball) continue
    const x1 = spring.anchorX, y1 = spring.anchorY
    const x2 = ball.x, y2 = ball.y
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    // 螺旋方向：垂直于弹簧轴线
    const px = -dy / len, py = dx / len
    ctx.strokeStyle = spring.color || '#34d399'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    // 端部留 15% 直线，中间 70% 画螺旋
    const startPad = len * 0.15
    const endPad = len * 0.15
    const coilStart = x1 + dx / len * startPad
    const coilStartY = y1 + dy / len * startPad
    const coilEnd = x1 + dx / len * (len - endPad)
    const coilEndY = y1 + dy / len * (len - endPad)
    ctx.lineTo(coilStart, coilStartY)
    const coilLen = len - startPad - endPad
    const steps = SPRING_COILS * 8
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const cx = coilStart + (coilEnd - coilStart) * t
      const cy = coilStartY + (coilEndY - coilStartY) * t
      const wave = Math.sin(t * SPRING_COILS * Math.PI * 2) * SPRING_AMPLITUDE
      ctx.lineTo(cx + px * wave, cy + py * wave)
    }
    ctx.lineTo(x2, y2)
    ctx.stroke()
    // 固定端标记
    ctx.fillStyle = spring.color || '#34d399'
    ctx.beginPath()
    ctx.arc(x1, y1, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawVelocity(rc: RenderContext, objects: PhysicsObject[]): void {
  const { ctx } = rc
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    if (Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1) continue
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + p.vx * 0.3, p.y + p.vy * 0.3)
    ctx.stroke()
  }
}

export function drawForces(
  rc: RenderContext,
  objects: PhysicsObject[],
  gravity: number,
  field: FieldState,
  showForce: boolean
): void {
  const { ctx } = rc
  if (!showForce) return
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    const fgy = p.mass * gravity
    if (fgy > 0.01) {
      const gLen = Math.min(fgy * 2, 50)
      drawArrow(ctx, p.x, p.y, p.x, p.y + gLen, 'rgba(239, 68, 68, 0.8)', 2)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('mg', p.x + 6, p.y + gLen / 2)
    }
    const charge = p.charge || 0
    if (charge !== 0) {
      // 多场同时绘制力箭头
      if (field.E.x !== 0 || field.E.y !== 0) {
        const Fex = charge * field.E.x, Fey = charge * field.E.y
        const feMag = Math.hypot(Fex, Fey)
        if (feMag > 0.01) {
          const feLen = Math.min(feMag * 0.8, 60)
          const ex = p.x + (Fex / feMag) * feLen, ey = p.y + (Fey / feMag) * feLen
          drawArrow(ctx, p.x, p.y, ex, ey, 'rgba(34, 197, 94, 0.9)', 2)
          ctx.fillStyle = 'rgba(34, 197, 94, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qE', ex + 4, ey)
        }
      }
      if (field.B !== 0) {
        const Fmx = charge * p.vy * field.B, Fmy = -charge * p.vx * field.B
        const fmMag = Math.hypot(Fmx, Fmy)
        if (fmMag > 0.01) {
          const fmLen = Math.min(fmMag * 0.8, 60)
          const mx = p.x + (Fmx / fmMag) * fmLen, my = p.y + (Fmy / fmMag) * fmLen
          drawArrow(ctx, p.x, p.y, mx, my, 'rgba(168, 85, 247, 0.9)', 2)
          ctx.fillStyle = 'rgba(168, 85, 247, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qvB', mx + 4, my)
        }
      }
    }
    const seg = findContactSegment(p, objects)
    if (seg) {
      const nx = seg.normalX, ny = seg.normalY
      const segDx = seg.x2 - seg.x1, segDy = seg.y2 - seg.y1
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy)
      const cosA = Math.abs(segDx) / segLen
      const N = p.mass * gravity * cosA
      const nLen = Math.min(N * 2, 50)
      drawArrow(ctx, p.x, p.y, p.x + nx * nLen, p.y + ny * nLen, 'rgba(148, 163, 184, 0.8)', 2)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
      ctx.fillText('N', p.x + nx * nLen + 4, p.y + ny * nLen)
      const mu = seg.friction ?? p.friction ?? 0
      if (mu > 0) {
        const f = mu * N
        const fLen = Math.min(f * 2, 40)
        const tx = segDx / segLen, ty = segDy / segLen
        const vAlong = p.vx * tx + p.vy * ty
        const dir = vAlong >= 0 ? -1 : 1
        drawArrow(ctx, p.x, p.y, p.x + tx * fLen * dir, p.y + ty * fLen * dir, 'rgba(251, 146, 60, 0.8)', 2)
        ctx.fillStyle = 'rgba(251, 146, 60, 0.9)'
        ctx.fillText('f', p.x + tx * fLen * dir + 4, p.y + ty * fLen * dir)
      }
    }
  }
}

// ===== 预览绘制 =====

export function drawPreviewLine(rc: RenderContext, preview: { x1: number; y1: number; x2: number; y2: number } | null): void {
  const { ctx } = rc
  if (!preview) return
  const { x1, y1, x2, y2 } = preview
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)'
  ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill()
}

export function drawPreviewArc(rc: RenderContext, preview: {
  cx: number; cy: number; r: number; startAngle: number; endAngle: number; phase?: string
} | null): void {
  const { ctx } = rc
  if (!preview) return
  const { cx, cy, r, phase } = preview
  if (r < 1) return
  ctx.fillStyle = 'rgba(167, 139, 250, 0.9)'
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()
  if (phase === 'radius') {
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
  } else if (phase === 'angle') {
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    let { startAngle, endAngle } = preview
    let delta = endAngle - startAngle
    while (delta <= 0) delta += Math.PI * 2
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, startAngle + delta); ctx.stroke()
    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.arc(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle), 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ===== 选框与高亮 =====

export function drawSelectionRect(rc: RenderContext, sel: SelectionState): void {
  const { ctx } = rc
  if (!sel.active || !sel.start || !sel.end) return
  const minX = Math.min(sel.start.x, sel.end.x)
  const maxX = Math.max(sel.start.x, sel.end.x)
  const minY = Math.min(sel.start.y, sel.end.y)
  const maxY = Math.max(sel.start.y, sel.end.y)
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
  ctx.setLineDash([])
}

export function drawSelectionHighlight(rc: RenderContext, objects: PhysicsObject[], selectedIds: number[]): void {
  const { ctx } = rc
  const selectedSet = new Set(selectedIds)
  if (selectedSet.size === 0) return
  for (const obj of objects) {
    if (!selectedSet.has(obj.id)) continue
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      const r = p.radius || 10
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)'
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(96, 165, 250, 0.8)'
      ctx.shadowBlur = 12
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke()
      ctx.shadowBlur = 0
    } else if (obj.type === 'line_segment') {
      const seg = obj as SegmentObject
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(96, 165, 250, 0.7)'
      ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke()
      ctx.shadowBlur = 0
    }
  }
}

// ===== Shift 闪烁 =====

export function drawShiftFlash(rc: RenderContext, flash: ShiftFlashState): void {
  const { ctx } = rc
  if (!flash.pos) return
  const now = Date.now()
  if (now >= flash.until) return
  const remaining = flash.until - now
  const alpha = Math.min(1, remaining / 700)
  const r = 15
  const expand = (1 - alpha) * 20
  ctx.strokeStyle = 'rgba(34, 197, 94, ' + (alpha * 0.9) + ')'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(34, 197, 94, ' + alpha + ')'
  ctx.shadowBlur = 15
  ctx.beginPath()
  ctx.arc(flash.pos.x, flash.pos.y, r + 6 + expand, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
}

// ===== UI 层（不随世界变换） =====

export function drawWatermark(rc: RenderContext, mode: string): void {
  const { ctx, cssW } = rc
  if (mode !== 'replay') return
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('回放模式', cssW - 16, 24)
}

export function drawAIToast(rc: RenderContext, aiToast: string): void {
  const { ctx } = rc
  if (!aiToast) return
  ctx.font = 'bold 13px sans-serif'
  const metrics = ctx.measureText(aiToast)
  const padX = 12, padY = 6
  const boxW = metrics.width + padX * 2
  const boxH = 26
  const x = 16, y = 16
  ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'
  roundRect(ctx, x, y, boxW, boxH, 13); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(aiToast, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}

export function drawEditUI(rc: RenderContext, ui: UIState): void {
  const { ctx, cssW } = rc
  if (!ui.editMode) return
  let text = '工具：' + (
    ui.tool === 'ball' ? '⚽ 小球（点击添加，拖拽移动）' :
    ui.tool === 'platform' ? '➖ 平台（拖拽绘制，Shift 吸附）' :
    ui.tool === 'spring' ? '🌀 弹簧（两次点击：固定端→连接的球）' :
    '⤵ 圆弧（三次点击：圆心→半径起点→终点，Shift反向）'
  )
  if (ui.chargeMode) text += '  ⚡带电粒子'
  ctx.font = '12px sans-serif'
  const metrics = ctx.measureText(text)
  const padX = 10
  const boxW = metrics.width + padX * 2
  const boxH = 24
  const x = cssW - boxW - 16
  const y = 16
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  roundRect(ctx, x, y, boxW, boxH, 6); ctx.fill()
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, boxW, boxH, 6); ctx.stroke()
  ctx.fillStyle = '#c4b5fd'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}
