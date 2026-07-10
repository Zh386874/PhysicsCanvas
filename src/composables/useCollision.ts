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
  velocity?: { x: number; y: number }
  movable?: boolean
  mass?: number
}

export interface SpringObject {
  id: number
  name: string
  type: 'spring'
  anchorX: number
  anchorY: number
  ballId: number
  naturalLength: number
  k: number
  color?: string
}

export type PhysicsObject = ParticleObject | SegmentObject | SpringObject

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
    // 水平摩擦力由地面线段（detectSegmentCollision）统一处理，此处不再硬编码
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
    let vaNew: number, vbNew: number
    if (restitution === 0) {
      // 完全非弹性碰撞：碰撞后共速
      const vCommon = (ma * va + mb * vb) / (ma + mb)
      vaNew = vCommon
      vbNew = vCommon
    } else {
      vaNew = ((ma - mb) * va + 2 * mb * vb) / (ma + mb) * restitution
      vbNew = ((mb - ma) * vb + 2 * ma * va) / (ma + mb) * restitution
    }
    a.vx += (vaNew - va) * nx; a.vy += (vaNew - va) * ny
    b.vx += (vbNew - vb) * nx; b.vy += (vbNew - vb) * ny
    return true
  }
  return false
}

export function detectSegmentCollision(
  obj: ParticleObject,
  segment: SegmentObject,
  dt: number,
  gravity: number
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
  // 摩擦力源：优先取线段摩擦系数，兼容物体自身摩擦系数
  const friction = segment.friction ?? obj.friction ?? 0
  if (friction > 0) {
    const tx = -ny, ty = nx
    // 传送带/板块：摩擦力基于物体相对线段的速度
    const segVx = segment.velocity?.x ?? 0
    const segVy = segment.velocity?.y ?? 0
    const v_tangent = (obj.vx - segVx) * tx + (obj.vy - segVy) * ty
    if (Math.abs(v_tangent) > 1e-6) {
      // 法向力 N = m·g·cos(θ)，θ 为线段与水平面夹角
      const segDx = segment.x2 - segment.x1
      const segDy = segment.y2 - segment.y1
      const segLen = Math.hypot(segDx, segDy) || 1
      const cosA = Math.abs(segDx) / segLen
      // 摩擦减速度 a = μ·g·cos(θ)，线性减速 Δv = a·dt
      const a = friction * gravity * cosA
      const dVt = a * dt
      let newVt: number
      if (Math.abs(v_tangent) <= dVt) {
        // 摩擦力足以使物体停止（或与传送带共速）
        newVt = 0
      } else {
        newVt = v_tangent - Math.sign(v_tangent) * dVt
      }
      const dVtActual = newVt - v_tangent
      obj.vx += dVtActual * tx
      obj.vy += dVtActual * ty
      // 板块模型：牛顿第三定律，反作用力作用于可移动线段
      if (segment.movable && segment.mass) {
        const segDv = -obj.mass * dVtActual / segment.mass
        if (segment.velocity) {
          segment.velocity.x += segDv * tx
          segment.velocity.y += segDv * ty
        } else {
          segment.velocity = { x: segDv * tx, y: segDv * ty }
        }
      }
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
 * 线段-圆相交参数解（返回最早的 t ∈ [0,1]，若无交点返回 -1）
 */
function lineCircleIntersect(
  x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, radius: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const fx = x1 - cx
  const fy = y1 - cy

  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - radius * radius

  const disc = b * b - 4 * a * c
  if (disc < 0) return -1

  const sqrtDisc = Math.sqrt(disc)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)

  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return -1
}

/**
 * 质点与弧线碰撞检测（连续碰撞检测 CCD，防止隧穿）
 */
export function detectArcCollision(
  obj: ParticleObject,
  seg: SegmentObject,
  dt: number,
  gravity: number
): boolean {
  if (!seg.arc) return false
  const radius = obj.radius || 10
  const restitution = seg.restitution !== undefined ? seg.restitution : 0.3
  const { cx, cy, r, startAngle, endAngle } = seg.arc

  const prevX = obj.prevX !== undefined ? obj.prevX : obj.x
  const prevY = obj.prevY !== undefined ? obj.prevY : obj.y

  // CCD：检测路径线段与两个边界圆的交点
  const outerRadius = r + radius
  const innerRadius = r > radius ? r - radius : 0

  let tOuter = lineCircleIntersect(prevX, prevY, obj.x, obj.y, cx, cy, outerRadius)
  let tInner = lineCircleIntersect(prevX, prevY, obj.x, obj.y, cx, cy, innerRadius)

  // 找最早的交点
  let t = -1
  let fromOutside = true // true = 从外向内进入弧线
  if (tOuter >= 0 && tInner >= 0) {
    if (tOuter < tInner) { t = tOuter; fromOutside = true }
    else { t = tInner; fromOutside = false }
  } else if (tOuter >= 0) { t = tOuter; fromOutside = true }
  else if (tInner >= 0) { t = tInner; fromOutside = false }

  if (t < 0) return false // 无交点

  // 计算交点位置
  const hitX = prevX + (obj.x - prevX) * t
  const hitY = prevY + (obj.y - prevY) * t

  // 检查交点角度是否在弧范围内
  const angle = Math.atan2(hitY - cy, hitX - cx)
  if (!isAngleInRange(angle, startAngle, endAngle)) return false // 从缺口穿过

  // 计算碰撞点对应的法线（径向）
  const hitDx = hitX - cx
  const hitDy = hitY - cy
  const hitDist = Math.hypot(hitDx, hitDy)
  if (hitDist < 1e-6) return false

  let nx: number, ny: number
  if (fromOutside) {
    // 从外向内进入弧线：推向外侧
    nx = hitDx / hitDist; ny = hitDy / hitDist
  } else {
    // 从内向外离开弧线：推向内侧
    nx = -hitDx / hitDist; ny = -hitDy / hitDist
  }

  // 位置修正：将粒子推到碰撞点（加上半径偏移）
  const targetRadius = fromOutside ? (r + radius) : (r - radius)
  obj.x = cx + (hitDx / hitDist) * targetRadius
  obj.y = cy + (hitDy / hitDist) * targetRadius

  // 速度反射
  const v_normal = obj.vx * nx + obj.vy * ny
  if (v_normal < 0) {
    obj.vx -= (1 + restitution) * v_normal * nx
    obj.vy -= (1 + restitution) * v_normal * ny
  }

  // 切向摩擦（优先取线段摩擦系数）
  const friction = seg.friction ?? obj.friction ?? 0
  if (friction > 0) {
    const tx = -ny, ty = nx
    const v_tangent = obj.vx * tx + obj.vy * ty
    if (Math.abs(v_tangent) > 1e-6) {
      // 法向力 N = m·g·cos(θ)，θ 为弧线切线与水平面夹角
      const segDx = seg.x2 - seg.x1
      const segDy = seg.y2 - seg.y1
      const segLen = Math.hypot(segDx, segDy) || 1
      const cosA = Math.abs(segDx) / segLen
      // 摩擦减速度 a = μ·g·cos(θ)，线性减速 Δv = a·dt
      const a = friction * gravity * cosA
      const dVt = a * dt
      let newVt: number
      if (Math.abs(v_tangent) <= dVt) {
        newVt = 0
      } else {
        newVt = v_tangent - Math.sign(v_tangent) * dVt
      }
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
 * @param dt 子步时间（秒），用于摩擦力线性减速计算
 * @param gravity 重力加速度（像素/s²），用于法向力计算
 */
export function checkCollision(
  objects: PhysicsObject[],
  groundY: number,
  groundRestitution = 0.6,
  particleRestitution = 1.0,
  dt = 0.016,
  gravity = 490
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
        if (detectArcCollision(obj, seg, dt, gravity)) collided = true
      } else {
        if (detectSegmentCollision(obj, seg, dt, gravity)) collided = true
      }
    }
  }

  // 质点间碰撞（跳过线段和弹簧）
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b = objects[j]
      if (a.type !== '质点' && a.type !== '刚体') continue
      if (b.type !== '质点' && b.type !== '刚体') continue
      if (checkParticleCollision(a as ParticleObject, b as ParticleObject, particleRestitution)) collided = true
    }
  }

  return collided
}
