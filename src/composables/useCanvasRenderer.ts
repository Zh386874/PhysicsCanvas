/**
 * 画布渲染层：所有纯绘制函数
 * 接收 ctx 和状态参数，无副作用，不持有状态
 */
import type {
  PhysicsObject,
  FieldState,
  ParticleObject,
  SegmentObject,
  SpringObject
} from './usePhysics'

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
    cx: number
    cy: number
    r: number
    startAngle: number
    endAngle: number
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
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
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
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
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
  ctx.strokeStyle = 'rgba(86, 156, 214, 0.08)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x < cssW; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, cssH)
    ctx.stroke()
  }
  for (let y = 0; y < cssH; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(cssW, y)
    ctx.stroke()
  }
}

export function drawGround(rc: RenderContext, groundY: number): void {
  if (groundY >= 100000) return
  const { ctx, cssW } = rc
  ctx.strokeStyle = 'rgba(86, 156, 214, 0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(cssW, groundY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(157, 157, 157, 0.5)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('地面', 10, groundY + 18)
}

export function drawField(rc: RenderContext, field: FieldState): void {
  const { ctx, cssW, cssH } = rc
  const step = 40

  // 如果定义了区域，裁剪绘制范围
  let restoreClip = false
  if (field.region) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(field.region.x, field.region.y, field.region.width, field.region.height)
    ctx.clip()
    restoreClip = true
  }

  // 多场同时绘制：磁场和电场可共存
  if (field.B !== 0) {
    // 磁场背景填充
    ctx.fillStyle = 'rgba(78, 201, 176, 0.06)'
    ctx.fillRect(0, 0, cssW, cssH)
    // 磁场符号（⊙ 或 ⊗）
    ctx.fillStyle = 'rgba(78, 201, 176, 0.35)'
    ctx.strokeStyle = 'rgba(78, 201, 176, 0.35)'
    ctx.lineWidth = 1.5
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.stroke()
        if (field.B >= 0) {
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(x - 5, y - 5)
          ctx.lineTo(x + 5, y + 5)
          ctx.moveTo(x + 5, y - 5)
          ctx.lineTo(x - 5, y + 5)
          ctx.stroke()
        }
      }
    }
  }
  if (field.E.x !== 0 || field.E.y !== 0) {
    const ex = field.E.x,
      ey = field.E.y
    const mag = Math.sqrt(ex * ex + ey * ey)
    if (mag < 0.01) return
    // 电场背景填充
    ctx.fillStyle = 'rgba(86, 156, 214, 0.06)'
    ctx.fillRect(0, 0, cssW, cssH)
    const dx = (ex / mag) * 24,
      dy = (ey / mag) * 24
    ctx.strokeStyle = 'rgba(86, 156, 214, 0.35)'
    ctx.fillStyle = 'rgba(86, 156, 214, 0.35)'
    ctx.lineWidth = 1.5
    for (let x = step / 2; x < cssW; x += step) {
      for (let y = step / 2; y < cssH; y += step) {
        ctx.beginPath()
        ctx.moveTo(x - dx / 2, y - dy / 2)
        ctx.lineTo(x + dx / 2, y + dy / 2)
        ctx.stroke()
        const angle = Math.atan2(dy, dx)
        ctx.beginPath()
        ctx.moveTo(x + dx / 2, y + dy / 2)
        ctx.lineTo(x + dx / 2 - 6 * Math.cos(angle - 0.4), y + dy / 2 - 6 * Math.sin(angle - 0.4))
        ctx.lineTo(x + dx / 2 - 6 * Math.cos(angle + 0.4), y + dy / 2 - 6 * Math.sin(angle + 0.4))
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // 恢复裁剪
  if (restoreClip) {
    ctx.restore()
  }

  // 绘制区域边界（在裁剪恢复之后）
  if (field.region) {
    const { x, y, width, height } = field.region
    // 虚线边框
    ctx.strokeStyle = 'rgba(0, 122, 204, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x, y, width, height)
    ctx.setLineDash([])
    // 区域标签
    let label = ''
    if (field.B !== 0 && (field.E.x !== 0 || field.E.y !== 0)) {
      label = '复合场区域'
    } else if (field.B !== 0) {
      label = '磁场区域'
    } else {
      label = '电场区域'
    }
    ctx.fillStyle = 'rgba(0, 122, 204, 0.7)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 6, y + 16)
  }
}

/**
 * 绘制场区域拖拽预览矩形
 */
export function drawFieldRegionPreview(
  rc: RenderContext,
  preview: { x1: number; y1: number; x2: number; y2: number } | null,
  field: FieldState
): void {
  const { ctx } = rc
  if (!preview) return
  const minX = Math.min(preview.x1, preview.x2)
  const maxX = Math.max(preview.x1, preview.x2)
  const minY = Math.min(preview.y1, preview.y2)
  const maxY = Math.max(preview.y1, preview.y2)
  const w = maxX - minX
  const h = maxY - minY
  // 半透明填充
  const color = field.type === 'magnetic' ? 'rgba(78, 201, 176, 0.15)' : 'rgba(86, 156, 214, 0.15)'
  ctx.fillStyle = color
  ctx.fillRect(minX, minY, w, h)
  // 虚线边框
  ctx.strokeStyle = 'rgba(0, 122, 204, 0.85)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(minX, minY, w, h)
  ctx.setLineDash([])
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
    ctx.fillStyle = '#d4d4d4'
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
    if (seg.arc) continue // 弧线子段由 drawArcsVisually 统一绘制
    const { x1, y1, x2, y2, normalX, normalY } = seg
    const nx = normalX || 0,
      ny = normalY || 0
    const midX = (x1 + x2) / 2,
      midY = (y1 + y2) / 2
    // 板块：用 physicsThickness 绘制真实物理边界矩形（沿法线反方向 = 板块实体方向）
    if (seg.subtype === 'plate' && seg.physicsThickness) {
      const t = seg.physicsThickness
      // 下表面端点（沿法线反方向偏移 physicsThickness）
      const x3 = x1 - nx * t,
        y3 = y1 - ny * t
      const x4 = x2 - nx * t,
        y4 = y2 - ny * t
      // 填充矩形（板块实体）
      ctx.fillStyle = 'rgba(244, 71, 71, 0.2)'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x4, y4)
      ctx.lineTo(x3, y3)
      ctx.closePath()
      ctx.fill()
      // 描边上下表面（上表面=原线段，下表面=偏移线段）
      ctx.strokeStyle = seg.color || '#F44747'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x3, y3)
      ctx.lineTo(x4, y4)
      ctx.stroke()
      // 描边左右端面（加粗，提示碰撞面）
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x3, y3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x4, y4)
      ctx.stroke()
    } else {
      // 普通线段/传送带/平台：沿用视觉厚度平行四边形
      const offset = seg.thickness ?? 30
      ctx.fillStyle = 'rgba(157, 157, 157, 0.15)'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
      ctx.lineTo(x1 + nx * offset, y1 + ny * offset)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = seg.color || '#6b6b6b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    // 法线箭头 + 名称（所有线段共用）
    const arrowLen = 20
    const tipX = midX + nx * arrowLen,
      tipY = midY + ny * arrowLen
    ctx.strokeStyle = 'rgba(197, 134, 192, 0.75)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(midX, midY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
    const angle = Math.atan2(ny, nx)
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 5 * Math.cos(angle - 0.4), tipY - 5 * Math.sin(angle - 0.4))
    ctx.lineTo(tipX - 5 * Math.cos(angle + 0.4), tipY - 5 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fillStyle = 'rgba(197, 134, 192, 0.75)'
    ctx.fill()
    ctx.fillStyle = '#9d9d9d'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(seg.name || '线段', midX, midY - 10)
  }
}

export function drawArcsVisually(
  rc: RenderContext,
  objects: PhysicsObject[],
  selectedIds: number[] = [],
  showGateColors: boolean = true
): void {
  const { ctx } = rc
  const selectedSet = new Set(selectedIds)
  const groups = new Map<number, SegmentObject[]>()
  for (const obj of objects) {
    if (
      obj.type === 'line_segment' &&
      (obj as SegmentObject).groupId &&
      (obj as SegmentObject).arc
    ) {
      const seg = obj as SegmentObject
      if (!groups.has(seg.groupId!)) groups.set(seg.groupId!, [])
      groups.get(seg.groupId!)!.push(seg)
    }
  }
  for (const [, segs] of groups) {
    if (segs.length === 0) continue
    const firstSeg = segs[0]
    const arc = firstSeg.arc!
    const { cx, cy, r, startAngle, endAngle, entryGap, exitGap } = arc
    const isSelected = segs.some((s) => selectedSet.has(s.id))
    // 检测是否有触发器配置（任一缺口定义了 triggerType 或 triggerAngle）
    const hasTrigger = !!(
      entryGap?.triggerType ||
      exitGap?.triggerType ||
      entryGap?.triggerAngle !== undefined ||
      exitGap?.triggerAngle !== undefined
    )
    const gate = firstSeg.arcGateState

    // 基色：选中蓝 > 触发 VS 黄 (showGateColors时) > 普通紫
    if (isSelected) {
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.95)'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(0, 122, 204, 0.7)'
      ctx.shadowBlur = 10
    } else if (hasTrigger && showGateColors) {
      ctx.strokeStyle = '#DCDCAA'
      ctx.lineWidth = 3
    } else {
      ctx.strokeStyle = 'rgba(197, 134, 192, 0.9)'
      ctx.lineWidth = 3
    }
    // 根据 endAngle - startAngle 符号选择绘制方向，避免 startAngle > endAngle 时画成 3/4 圆
    const anticlockwise = endAngle - startAngle < 0
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, endAngle, anticlockwise)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 绘制缺口状态叠加（仅触发器弧线且有运行时状态且开启颜色显示时）
    if (hasTrigger && gate && showGateColors) {
      ctx.lineWidth = 6
      const drawGapOverlay = (gap: typeof entryGap, isOpen: boolean) => {
        if (!gap) return
        ctx.beginPath()
        ctx.strokeStyle = isOpen ? '#6A9955' : '#F44747'
        ctx.arc(cx, cy, r, gap.centerAngle - gap.halfWidth, gap.centerAngle + gap.halfWidth, false)
        ctx.stroke()
      }
      drawGapOverlay(entryGap, gate.entryOpen)
      drawGapOverlay(exitGap, gate.exitOpen)
      ctx.lineWidth = 3
    }
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
    const ball = objects.find(
      (o) => o.id === spring.ballId && (o.type === '质点' || o.type === '刚体')
    ) as ParticleObject | undefined
    if (!ball) continue
    const x1 = spring.anchorX,
      y1 = spring.anchorY
    const x2 = ball.x,
      y2 = ball.y
    const dx = x2 - x1,
      dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    // 螺旋方向：垂直于弹簧轴线
    const px = -dy / len,
      py = dx / len
    ctx.strokeStyle = spring.color || '#4EC9B0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    // 端部留 15% 直线，中间 70% 画螺旋
    const startPad = len * 0.15
    const endPad = len * 0.15
    const coilStart = x1 + (dx / len) * startPad
    const coilStartY = y1 + (dy / len) * startPad
    const coilEnd = x1 + (dx / len) * (len - endPad)
    const coilEndY = y1 + (dy / len) * (len - endPad)
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
    ctx.fillStyle = spring.color || '#4EC9B0'
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
    ctx.strokeStyle = 'rgba(220, 220, 170, 0.8)'
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
      drawArrow(ctx, p.x, p.y, p.x, p.y + gLen, 'rgba(244, 71, 71, 0.85)', 2)
      ctx.fillStyle = 'rgba(244, 71, 71, 0.95)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('mg', p.x + 6, p.y + gLen / 2)
    }
    const charge = p.charge || 0
    if (charge !== 0) {
      // 多场同时绘制力箭头
      if (field.E.x !== 0 || field.E.y !== 0) {
        const Fex = charge * field.E.x,
          Fey = charge * field.E.y
        const feMag = Math.hypot(Fex, Fey)
        if (feMag > 0.01) {
          const feLen = Math.min(feMag * 0.8, 60)
          const ex = p.x + (Fex / feMag) * feLen,
            ey = p.y + (Fey / feMag) * feLen
          drawArrow(ctx, p.x, p.y, ex, ey, 'rgba(106, 153, 85, 0.95)', 2)
          ctx.fillStyle = 'rgba(106, 153, 85, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qE', ex + 4, ey)
        }
      }
      if (field.B !== 0) {
        const Fmx = charge * p.vy * field.B,
          Fmy = -charge * p.vx * field.B
        const fmMag = Math.hypot(Fmx, Fmy)
        if (fmMag > 0.01) {
          const fmLen = Math.min(fmMag * 0.8, 60)
          const mx = p.x + (Fmx / fmMag) * fmLen,
            my = p.y + (Fmy / fmMag) * fmLen
          drawArrow(ctx, p.x, p.y, mx, my, 'rgba(197, 134, 192, 0.95)', 2)
          ctx.fillStyle = 'rgba(197, 134, 192, 1)'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('qvB', mx + 4, my)
        }
      }
    }
    // 弹簧力 -kx：查找连接到当前粒子的弹簧并绘制
    for (const obj of objects) {
      if (obj.type !== 'spring') continue
      const spring = obj as SpringObject
      if (spring.ballId !== p.id) continue
      const dx = p.x - spring.anchorX
      const dy = p.y - spring.anchorY
      const currentLen = Math.hypot(dx, dy)
      if (currentLen < 1e-6) continue
      const deformation = currentLen - spring.naturalLength
      const forceMag = -spring.k * deformation
      const fsLen = Math.min(Math.abs(forceMag) * 0.5, 50)
      if (fsLen < 1) continue
      // 力方向：拉伸时指向锚点（-dx），压缩时远离锚点（+dx）
      const dirX = forceMag >= 0 ? -dx / currentLen : dx / currentLen
      const dirY = forceMag >= 0 ? -dy / currentLen : dy / currentLen
      const fx2 = p.x + dirX * fsLen
      const fy2 = p.y + dirY * fsLen
      drawArrow(ctx, p.x, p.y, fx2, fy2, 'rgba(78, 201, 176, 0.95)', 2)
      ctx.fillStyle = 'rgba(78, 201, 176, 1)'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('-kx', fx2 + 4, fy2)
    }
    const seg = findContactSegment(p, objects)
    if (seg) {
      const nx = seg.normalX,
        ny = seg.normalY
      const segDx = seg.x2 - seg.x1,
        segDy = seg.y2 - seg.y1
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy)
      const cosA = Math.abs(segDx) / segLen
      const N = p.mass * gravity * cosA
      const nLen = Math.min(N * 2, 50)
      drawArrow(ctx, p.x, p.y, p.x + nx * nLen, p.y + ny * nLen, 'rgba(157, 157, 157, 0.9)', 2)
      ctx.fillStyle = 'rgba(157, 157, 157, 0.95)'
      ctx.fillText('N', p.x + nx * nLen + 4, p.y + ny * nLen)
      const mu = seg.friction ?? p.friction ?? 0
      if (mu > 0) {
        const f = mu * N
        const fLen = Math.min(f * 2, 40)
        const tx = segDx / segLen,
          ty = segDy / segLen
        const vAlong = p.vx * tx + p.vy * ty
        const dir = vAlong >= 0 ? -1 : 1
        drawArrow(
          ctx,
          p.x,
          p.y,
          p.x + tx * fLen * dir,
          p.y + ty * fLen * dir,
          'rgba(206, 145, 120, 0.85)',
          2
        )
        ctx.fillStyle = 'rgba(206, 145, 120, 0.95)'
        ctx.fillText('f', p.x + tx * fLen * dir + 4, p.y + ty * fLen * dir)
      }
    }
  }
}

// ===== 预览绘制 =====

export function drawPreviewLine(
  rc: RenderContext,
  preview: { x1: number; y1: number; x2: number; y2: number } | null
): void {
  const { ctx } = rc
  if (!preview) return
  const { x1, y1, x2, y2 } = preview
  ctx.strokeStyle = 'rgba(197, 134, 192, 0.75)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(197, 134, 192, 0.95)'
  ctx.beginPath()
  ctx.arc(x1, y1, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x2, y2, 3, 0, Math.PI * 2)
  ctx.fill()
}

export function drawPreviewArc(
  rc: RenderContext,
  preview: {
    cx: number
    cy: number
    r: number
    startAngle: number
    endAngle: number
    phase?: string
  } | null
): void {
  const { ctx } = rc
  if (!preview) return
  const { cx, cy, r, phase } = preview
  if (r < 1) return
  ctx.fillStyle = 'rgba(197, 134, 192, 0.95)'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()
  if (phase === 'radius') {
    ctx.strokeStyle = 'rgba(197, 134, 192, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  } else if (phase === 'angle') {
    ctx.strokeStyle = 'rgba(197, 134, 192, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    const { startAngle, endAngle } = preview
    let delta = endAngle - startAngle
    while (delta <= 0) delta += Math.PI * 2
    ctx.strokeStyle = 'rgba(197, 134, 192, 0.95)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, startAngle + delta)
    ctx.stroke()
    ctx.fillStyle = '#c586c0'
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
  ctx.fillStyle = 'rgba(38, 79, 120, 0.35)'
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
  ctx.strokeStyle = 'rgba(0, 122, 204, 0.85)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
  ctx.setLineDash([])
}

export function drawSelectionHighlight(
  rc: RenderContext,
  objects: PhysicsObject[],
  selectedIds: number[]
): void {
  const { ctx } = rc
  const selectedSet = new Set(selectedIds)
  if (selectedSet.size === 0) return
  for (const obj of objects) {
    if (!selectedSet.has(obj.id)) continue
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      const r = p.radius || 10
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.95)'
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(0, 122, 204, 0.8)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    } else if (obj.type === 'line_segment') {
      const seg = obj as SegmentObject
      if (seg.arc) continue // 弧线选中高亮由 drawArcsVisually 处理
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.95)'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(0, 122, 204, 0.7)'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()
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
  ctx.strokeStyle = 'rgba(106, 153, 85, ' + alpha * 0.9 + ')'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(106, 153, 85, ' + alpha + ')'
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
  ctx.fillStyle = 'rgba(220, 220, 170, 0.75)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('回放模式', cssW - 16, 24)
}

export function drawAIToast(rc: RenderContext, aiToast: string): void {
  const { ctx } = rc
  if (!aiToast) return
  ctx.font = 'bold 13px sans-serif'
  const metrics = ctx.measureText(aiToast)
  const padX = 12,
    padY = 6
  const boxW = metrics.width + padX * 2
  const boxH = 26
  const x = 16,
    y = 16
  ctx.fillStyle = 'rgba(0, 122, 204, 0.9)'
  roundRect(ctx, x, y, boxW, boxH, 13)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(aiToast, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}

export function drawEditUI(rc: RenderContext, ui: UIState): void {
  const { ctx, cssW } = rc
  if (!ui.editMode) return
  let text =
    '工具：' +
    (ui.tool === 'select'
      ? '🖱️ 选择/移动（点击物体拖动，点击空白取消选择）'
      : ui.tool === 'ball'
        ? '⚽ 小球（点击添加，拖拽移动）'
        : ui.tool === 'platform'
          ? '➖ 平台（拖拽绘制，Shift 吸附）'
          : ui.tool === 'conveyor'
            ? '📦 传送带（拖拽绘制，默认 2m/s 沿 x 正向）'
            : ui.tool === 'plate'
              ? '🟫 板块（拖拽绘制，可被滑块带动）'
              : ui.tool === 'spring'
                ? '🌀 弹簧（两次点击：固定端→连接的球）'
                : '⤵ 圆弧（三次点击：圆心→半径起点→终点，Shift反向）')
  if (ui.chargeMode) text += '  ⚡带电粒子'
  if (ui.tool === 'field') text = '▭ 场区域（拖拽绘制矩形范围）'
  ctx.font = '12px sans-serif'
  const metrics = ctx.measureText(text)
  const padX = 10
  const boxW = metrics.width + padX * 2
  const boxH = 24
  const x = cssW - boxW - 16
  const y = 16
  ctx.fillStyle = 'rgba(45, 45, 48, 0.92)'
  roundRect(ctx, x, y, boxW, boxH, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 122, 204, 0.45)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, boxW, boxH, 6)
  ctx.stroke()
  ctx.fillStyle = '#d4d4d4'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + boxH / 2)
  ctx.textBaseline = 'alphabetic'
}
