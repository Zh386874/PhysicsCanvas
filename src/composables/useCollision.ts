// ===== 类型定义 =====

interface Vec2 { x: number; y: number }

interface TrailPoint { x: number; y: number }

interface ArcMeta {
  cx: number
  cy: number
  r: number
  startAngle: number
  endAngle: number
}

export interface ParticleObject {
  id: number
  name: string
  type: '质点' | '刚体'
  mass: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  charge?: number
  friction?: number
  trail: TrailPoint[]
  prevX?: number
  prevY?: number
}

export interface SegmentObject {
  id: number
  name: string
  type: 'line_segment'
  x1: number
  y1: number
  x2: number
  y2: number
  normalX: number
  normalY: number
  restitution?: number
  friction?: number
  color?: string
  groupId?: number
  arc?: ArcMeta
}

export type PhysicsObject = ParticleObject | SegmentObject

interface NormalResult {
  normalX: number
  normalY: number
}

interface Point {
  x: number
  y: number
}

// ===== 工具函数 =====

/**
 * 自动计算线段法线，保留用户方向偏好
 * 法线 = (dy, -dx) 归一化，与当前法线点积为负则翻转
 */
export function autoComputeNormal(segment: {
  x1: number; y1: number; x2: number; y2: number
  normalX?: number; normalY?: number
}): NormalResult {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return { normalX: 0, normalY: -1 }
  let nx = dy / len
  let ny = -dx / len
  const curNx = segment.normalX || 0
  const curNy = segment.normalY || 0
  if (curNx * nx + curNy * ny < 0) { nx = -nx; ny = -ny }
  return { normalX: nx, normalY: ny }
}

export function checkGroundCollision(
  obj: ParticleObject,
  groundY: number,
  restitution = 0.6
): boolean {
  const radius = obj.radius || 10
  if (obj.y + radius >= groundY) {
    obj.y = groundY - radius
    if (obj.vy > 0) obj.vy = -obj.vy * restitution
    obj.vx *= 0.98
    return true
  }
  return false
}

export function checkParticleCollision(
  a: ParticleObject,
  b: ParticleObject,
  restitution = 1.0
): boolean {
  const ra = a.radius || 10
  const rb = b.radius || 10
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const minDist = ra + rb
  if (dist < minDist && dist > 0) {
    const overlap = minDist - dist
    const nx = dx / dist
    const ny = dy / dist
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2
    b.x += nx * overlap / 2; b.y += ny * overlap / 2
    const ma = a.mass, mb = b.mass
    const va = a.vx * nx + a.vy * ny
    const vb = b.vx * nx + b.vy * ny
    const vaNew = ((ma - mb) * va + 2 * mb * vb) / (ma + mb) * restitution
    const vbNew = ((mb - ma) * vb + 2 * ma * va) / (ma + mb) * restitution
    a.vx += (vaNew - va) * nx; a.vy += (vaNew - va) * ny
    b.vx += (vbNew - vb) * nx; b.vy += (vbNew - vb) * ny
    return true
  }
  return false
}

export function detectSegmentCollision(
  obj: ParticleObject,
  segment: SegmentObject
): boolean {
  const radius = obj.radius || 10
  const restitution = segment.restitution !== undefined ? segment.restitution : 0.3
  const prevX = obj.prevX !== undefined ? obj.prevX : obj.x
  const prevY = obj.prevY !== undefined ? obj.prevY : obj.y
  const { x1, y1, x2, y2 } = segment
  const nx = segment.normalX, ny = segment.normalY

  const d1 = cross(x1, y1, x2, y2, prevX, prevY)
  const d2 = cross(x1, y1, x2, y2, obj.x, obj.y)
  const d3 = cross(prevX, prevY, obj.x, obj.y, x1, y1)
  const d4 = cross(prevX, prevY, obj.x, obj.y, x2, y2)
  const intersect = ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                     ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))

  let hit = false, hitX = obj.x, hitY = obj.y
  if (intersect) {
    const pt = segmentIntersection(prevX, prevY, obj.x, obj.y, x1, y1, x2, y2)
    if (pt) { hitX = pt.x; hitY = pt.y; hit = true }
  }
  if (!hit) {
    const dist = pointToSegmentDistance(obj.x, obj.y, x1, y1, x2, y2)
    if (dist <= radius) {
      const P = closestPointOnSegment(obj.x, obj.y, x1, y1, x2, y2)
      hitX = P.x; hitY = P.y; hit = true
    }
  }
  if (!hit) return false

  obj.x = hitX + nx * radius
  obj.y = hitY + ny * radius
  const v_normal = obj.vx * nx + obj.vy * ny
  if (v_normal < 0) {
    obj.vx -= (1 + restitution) * v_normal * nx
    obj.vy -= (1 + restitution) * v_normal * ny
  }
  const friction = obj.friction || 0
  if (friction > 0) {
    const tx = -ny, ty = nx
    const v_tangent = obj.vx * tx + obj.vy * ty
    if (Math.abs(v_tangent) > 1e-6) {
      const damp = Math.min(friction * 0.15, 0.9)
      const newVt = v_tangent * (1 - damp)
      obj.vx += (newVt - v_tangent) * tx
      obj.vy += (newVt - v_tangent) * ty
    }
  }
  return true
}

function cross(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

function isAngleInRange(angle: number, startAngle: number, endAngle: number): boolean {
  const TWO_PI = Math.PI * 2
  let normAngle = angle
  while (normAngle < startAngle) normAngle += TWO_PI
  while (normAngle >= startAngle + TWO_PI) normAngle -= TWO_PI
  const minA = Math.min(startAngle, endAngle)
  const maxA = Math.max(startAngle, endAngle)
  return normAngle >= minA && normAngle <= maxA
}

/**
 * 质点与弧线碰撞检测（圆-弧碰撞，自动判别内外侧）
 */
export function detectArcCollision(
  obj: ParticleObject,
  seg: SegmentObject
): boolean {
  if (!seg.arc) return false
  const radius = obj.radius || 10
  const restitution = seg.restitution !== undefined ? seg.restitution : 0.3
  const { cx, cy, r, startAngle, endAngle } = seg.arc

  const dx = obj.x - cx
  const dy = obj.y - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return false

  const angle = Math.atan2(dy, dx)
  if (!isAngleInRange(angle, startAngle, endAngle)) return false

  const onInnerSide = dist < r
  const surfaceDist = onInnerSide ? (r - dist) : (dist - r)
  if (surfaceDist > radius) return false

  let nx: number, ny: number
  if (onInnerSide) { nx = -dx / dist; ny = -dy / dist }
  else { nx = dx / dist; ny = dy / dist }

  const targetDist = onInnerSide ? (r - radius) : (r + radius)
  obj.x = cx + (dx / dist) * targetDist
  obj.y = cy + (dy / dist) * targetDist

  const v_normal = obj.vx * nx + obj.vy * ny
  if (v_normal < 0) {
    obj.vx -= (1 + restitution) * v_normal * nx
    obj.vy -= (1 + restitution) * v_normal * ny
  }
  const friction = obj.friction || 0
  if (friction > 0) {
    const tx = -ny, ty = nx
    const v_tangent = obj.vx * tx + obj.vy * ty
    if (Math.abs(v_tangent) > 1e-6) {
      const damp = Math.min(friction * 0.15, 0.9)
      const newVt = v_tangent * (1 - damp)
      obj.vx += (newVt - v_tangent) * tx
      obj.vy += (newVt - v_tangent) * ty
    }
  }
  return true
}

function segmentIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): Point | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
}

function pointToSegmentDistance(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function closestPointOnSegment(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number
): Point {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return { x: x1, y: y1 }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: x1 + t * dx, y: y1 + t * dy }
}

/**
 * 统一碰撞检测入口
 * @param groundRestitution 地面碰撞恢复系数
 * @param particleRestitution 质点间碰撞恢复系数
 */
export function checkCollision(
  objects: PhysicsObject[],
  groundY: number,
  groundRestitution = 0.6,
  particleRestitution = 1.0
): boolean {
  let collided = false

  // 地面碰撞（仅质点/刚体）
  for (const obj of objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      if (checkGroundCollision(obj, groundY, groundRestitution)) collided = true
    }
  }

  // 线段/弧线碰撞
  const processedArcs = new Set<number>()
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    for (const seg of objects) {
      if (seg.type !== 'line_segment') continue
      if (seg.arc && seg.groupId) {
        if (processedArcs.has(seg.groupId)) continue
        processedArcs.add(seg.groupId)
        if (detectArcCollision(obj, seg)) collided = true
      } else {
        if (detectSegmentCollision(obj, seg)) collided = true
      }
    }
  }

  // 质点间碰撞
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b = objects[j]
      if (a.type === 'line_segment' || b.type === 'line_segment') continue
      if (checkParticleCollision(a as ParticleObject, b as ParticleObject, particleRestitution)) collided = true
    }
  }

  return collided
}
