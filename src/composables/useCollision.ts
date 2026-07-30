import type { ParticleObject, SegmentObject, PhysicsObject } from './usePhysics'

// ===== 类型定义 =====

interface Vec2 { x: number; y: number }

interface TrailPoint { x: number; y: number }

interface ArcMeta {
  cx: number
  cy: number
  r: number
  startAngle: number
  endAngle: number
  entryGap?: { centerAngle: number; halfWidth: number; initiallyOpen?: boolean; triggerType?: 'angleCross' | 'enterRing'; triggerAngle?: number; triggerAction?: 'open' | 'close' }
  exitGap?: { centerAngle: number; halfWidth: number; initiallyOpen?: boolean; triggerType?: 'angleCross' | 'enterRing'; triggerAngle?: number; triggerAction?: 'open' | 'close' }
}

// ParticleObject / SegmentObject / PhysicsObject 从 usePhysics.ts 导入，避免重复定义

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
  if (!hit) {
    // 板块端面碰撞：上表面未命中时，检测质点是否撞击板块左右端面（无摩擦，动量守恒）
    if (segment.subtype === 'plate' && segment.physicsThickness) {
      return detectPlateEndCollision(obj, segment)
    }
    return false
  }

  obj.x = hitX + nx * radius
  obj.y = hitY + ny * radius
  const v_normal = obj.vx * nx + obj.vy * ny
  if (v_normal < 0) {
    obj.vx -= (1 + restitution) * v_normal * nx
    obj.vy -= (1 + restitution) * v_normal * ny
  }
  // 摩擦力源：板块上下表面摩擦系数不同（法线同向=上表面，反向=下表面），其他线段取 friction
  let friction: number
  const segDefNdotN = (segment.normalX || 0) * nx + (segment.normalY || 0) * ny
  if (segment.movable && (segment.frictionTop !== undefined || segment.frictionBottom !== undefined)) {
    friction = segDefNdotN >= 0
      ? (segment.frictionTop ?? segment.friction ?? obj.friction ?? 0)
      : (segment.frictionBottom ?? segment.friction ?? obj.friction ?? 0)
  } else {
    friction = segment.friction ?? obj.friction ?? 0
  }
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
  // 完整圆（角度跨度≈2π）恒为 true：所有角度都在范围内
  const span = Math.abs(endAngle - startAngle)
  if (Math.abs(span - TWO_PI) < 0.01) return true
  let normAngle = angle
  while (normAngle < startAngle) normAngle += TWO_PI
  while (normAngle >= startAngle + TWO_PI) normAngle -= TWO_PI
  const minA = Math.min(startAngle, endAngle)
  const maxA = Math.max(startAngle, endAngle)
  return normAngle >= minA && normAngle <= maxA
}

/**
 * 判断角度是否在缺口范围内（缺口以 centerAngle 为中心，半宽 halfWidth）
 * 处理角度环绕：将 diff 归一化到 [-π, π]
 */
function isAngleInGap(angle: number, centerAngle: number, halfWidth: number): boolean {
  const PI = Math.PI
  const TWO_PI = PI * 2
  let diff = angle - centerAngle
  while (diff > PI) diff -= TWO_PI
  while (diff < -PI) diff += TWO_PI
  return Math.abs(diff) <= halfWidth
}

/**
 * 判断小球碰撞体积是否与缺口重叠
 * 在 isAngleInGap 基础上叠加球的角半径 arcsin(ballRadius/dist)，
 * 实现"小球碰撞体积与触发点重叠"的放行语义（而非仅球心角度）。
 * 球体积触及缺口即放行，避免球心未落入缺口时球体撞实体壁被弹回。
 * @param dist 球心到圆心距离；过小时退化为纯角度判断
 */
function isBallVolumeInGap(
  angle: number, centerAngle: number, halfWidth: number,
  ballRadius: number, dist: number
): boolean {
  if (dist <= 1e-9) return isAngleInGap(angle, centerAngle, halfWidth)
  const angularRadius = Math.asin(Math.min(ballRadius / dist, 1))
  return isAngleInGap(angle, centerAngle, halfWidth + angularRadius)
}

/**
 * 检测角度是否从 prev 到 curr 跨越了 target（双向，处理 ±π 环绕）
 * 用于触发器：小球经过 triggerAngle 时返回 true
 */
function didAngleCross(prev: number, curr: number, target: number): boolean {
  const TWO_PI = Math.PI * 2
  // 归一化角度差到 [-π, π]
  let diff = curr - prev
  while (diff > Math.PI) diff -= TWO_PI
  while (diff < -Math.PI) diff += TWO_PI
  if (Math.abs(diff) < 1e-9) return false
  // target 相对 prev 的归一化偏移
  let targetRel = target - prev
  while (targetRel > Math.PI) targetRel -= TWO_PI
  while (targetRel < -Math.PI) targetRel += TWO_PI
  // 判断 target 是否在 prev→curr 的角路径上
  if (diff > 0) return targetRel > 0 && targetRel < diff
  else return targetRel < 0 && targetRel > diff
}

/**
 * 计算点到弧线的最近点及距离
 * 正向弧（endAngle > startAngle）覆盖角度区间 [startAngle, endAngle]
 * 反向弧（endAngle < startAngle，Shift 绘制）覆盖角度区间 [endAngle, startAngle] 的反向走法
 */
function closestPointOnArc(
  px: number, py: number,
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number
): { x: number; y: number; dist: number } {
  const TWO_PI = Math.PI * 2
  let delta = endAngle - startAngle
  while (delta <= -TWO_PI) delta += TWO_PI
  while (delta > TWO_PI) delta -= TWO_PI

  const pointAngle = Math.atan2(py - cy, px - cx)
  let rel = pointAngle - startAngle
  let clampedRel: number
  if (delta >= 0) {
    while (rel < 0) rel += TWO_PI
    while (rel >= TWO_PI) rel -= TWO_PI
    clampedRel = rel > delta ? delta : rel
  } else {
    while (rel > 0) rel -= TWO_PI
    while (rel <= -TWO_PI) rel += TWO_PI
    clampedRel = rel < delta ? delta : rel
  }
  const arcAngle = startAngle + clampedRel
  const ax = cx + r * Math.cos(arcAngle)
  const ay = cy + r * Math.sin(arcAngle)
  return { x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) }
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

  let isCCDHit = false // 标记是否为 CCD 路径命中（高速冲击场景）
  if (t >= 0) {
    // CCD 路径交点：校验角度在弧范围内（从缺口穿过则放弃）
    const ccdX = prevX + (obj.x - prevX) * t
    const ccdY = prevY + (obj.y - prevY) * t
    const angle = Math.atan2(ccdY - cy, ccdX - cx)
    if (!isAngleInRange(angle, startAngle, endAngle)) return false
    isCCDHit = true
  }
  // 缺口动态放行：小球在"已打开"的缺口范围内时跳过碰撞
  // entryOpen 时入口缺口放行（小球从 AB 进入圆轨），exitOpen 时出口缺口放行（小球从圆轨穿出到 EF）
  const objAngle = Math.atan2(obj.y - cy, obj.x - cx)
  const objDist = Math.hypot(obj.x - cx, obj.y - cy)
  if (seg.arcGateState) {
    if (seg.arcGateState.entryOpen && seg.arc.entryGap &&
        isBallVolumeInGap(objAngle, seg.arc.entryGap.centerAngle, seg.arc.entryGap.halfWidth, radius, objDist)) return false
    if (seg.arcGateState.exitOpen && seg.arc.exitGap &&
        isBallVolumeInGap(objAngle, seg.arc.exitGap.centerAngle, seg.arc.exitGap.halfWidth, radius, objDist)) return false
  }
  // 完整圆（2π）isAngleInRange 恒 true，不会触发；非完整弧仍保留静态缺口放行
  if (!isAngleInRange(objAngle, startAngle, endAngle)) return false
  // 统一用 closestPointOnArc 计算碰撞点：角度限制在弧线范围内，
  // 避免球滑到端点时因角度越界被位置修正推到弧线外导致震荡；
  // 同时碰撞点随球位置动态变化，避免 CCD t≈0 时碰撞点固定为起点导致停滞
  const closest = closestPointOnArc(obj.x, obj.y, cx, cy, r, startAngle, endAngle)
  if (closest.dist > radius && !isCCDHit) return false
  const hitX = closest.x
  const hitY = closest.y
  // 球心在弧线圆外 → 从外向内接触；在圆内 → 从内向外接触
  // objDist 已在缺口放行判定前计算，此处复用
  fromOutside = objDist > r

  // 计算碰撞点对应的法线（径向）
  // 碰撞点已由 closestPointOnArc 限制在弧线角度范围内，位置修正不会把球推到弧线外
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

  // 法向速度处理
  const v_normal = obj.vx * nx + obj.vy * ny
  if (fromOutside) {
    // 从外侧冲击：弹性反射（仅 CCD 命中时，高速反弹）
    if (isCCDHit && v_normal < 0) {
      obj.vx -= (1 + restitution) * v_normal * nx
      obj.vy -= (1 + restitution) * v_normal * ny
    }
  } else {
    // 从内侧接触：清零法向速度（非弹性），避免反弹震荡导致 v_normal 反号后跳过反射造成能量陷阱
    obj.vx -= v_normal * nx
    obj.vy -= v_normal * ny
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

/**
 * 弧线约束动力学：将小球锁定在弧面，投影位置与速度，检查脱离条件。
 * 仅当小球已激活约束（constrainedArcGroupId 已设置）时调用。
 * 返回 true 表示约束仍生效，false 表示已脱离。
 *
 * 与 detectArcCollision（碰撞响应）的区别：
 * - 无恢复系数损失：速度仅去法向分量，切向完全保留 → 能量守恒
 * - 位置每帧投影到弧面（非穿透后才修正）→ 无 snap-back 离散误差
 * - 摩擦用圆周运动法向力 |v²/R + g·sinθ|（非平面斜坡 g·cosA）
 */
function applyArcConstraint(
  obj: ParticleObject,
  seg: SegmentObject,
  dt: number,
  gravity: number
): boolean {
  if (!seg.arc || !seg.groupId) return false
  const { cx, cy, r, startAngle, endAngle } = seg.arc
  const radius = obj.radius || 10

  const objDist = Math.hypot(obj.x - cx, obj.y - cy)
  const isInside = objDist < r
  const surfaceR = isInside ? (r - radius) : (r + radius)
  if (surfaceR <= 0) return false  // 弧线半径过小，无法约束

  const angle = Math.atan2(obj.y - cy, obj.x - cx)

  // —— 结构性脱离：角度超出弧线范围（轨道结束，沿切线飞出）——
  if (!isAngleInRange(angle, startAngle, endAngle)) {
    obj.constrainedArcGroupId = undefined
    return false
  }

  // —— 结构性脱离：进入开启的缺口（题库场景出口 E）——
  if (seg.arcGateState) {
    if (seg.arcGateState.entryOpen && seg.arc.entryGap &&
        isBallVolumeInGap(angle, seg.arc.entryGap.centerAngle, seg.arc.entryGap.halfWidth, radius, objDist)) {
      obj.constrainedArcGroupId = undefined
      return false
    }
    if (seg.arcGateState.exitOpen && seg.arc.exitGap &&
        isBallVolumeInGap(angle, seg.arc.exitGap.centerAngle, seg.arc.exitGap.halfWidth, radius, objDist)) {
      obj.constrainedArcGroupId = undefined
      return false
    }
  }

  // —— 自然脱离：法向力 N 降为 0 ——
  // 屏幕坐标 y 向下，gravity > 0。angle = atan2(y-cy, x-cx)。
  // 重力沿"球→圆心"方向分量 = -g·sin(angle)（顶部 sin=-1 → 分量 = +g 向心）
  // 内侧 N/m = v²/R + g·sin(angle)，顶部(angle=-π/2): N=m·v²/R - m·g ✓
  // 外侧 N/m = -(v²/R + g·sin(angle))，顶部: N=m·g - m·v²/R ✓
  const v2 = obj.vx * obj.vx + obj.vy * obj.vy
  const threshold = -gravity * surfaceR * Math.sin(angle)
  let shouldDepart = false
  if (isInside) {
    if (v2 < threshold) shouldDepart = true   // 速度不足，坠落
  } else {
    if (v2 > threshold) shouldDepart = true    // 速度过大，飞出
  }
  if (shouldDepart) {
    obj.constrainedArcGroupId = undefined
    return false
  }

  // —— 约束投影：位置归位到弧面（保持角度，修正半径）——
  obj.x = cx + Math.cos(angle) * surfaceR
  obj.y = cy + Math.sin(angle) * surfaceR

  // —— 切向速度保留 + 摩擦减速 ——
  // subStepPhysics 已施加重力（vy += g·dt），切向分量已包含在 v_tangent 中
  // 此处不再额外施加重力切向分量，避免双重计数
  // 切向方向 t = (-sin(angle), cos(angle))（n 逆时针旋转 90°）
  const tx = -Math.sin(angle)
  const ty = Math.cos(angle)
  const v_tangent = obj.vx * tx + obj.vy * ty

  // 法向力 |N|/m = |v²/R + g·sin(angle)|（用于摩擦计算）
  const normalForcePerMass = Math.abs(v2 / surfaceR + gravity * Math.sin(angle))
  const friction = seg.friction ?? obj.friction ?? 0

  // 切向速度更新：仅摩擦减速（重力已由 subStepPhysics 施加）
  let newVt = v_tangent
  if (friction > 0) {
    const a_friction = friction * normalForcePerMass
    const dVt = a_friction * dt
    if (Math.abs(newVt) <= dVt) {
      newVt = 0
    } else {
      newVt -= Math.sign(newVt) * dVt
    }
  }

  // 重建速度：纯切向（法向为 0，满足约束）
  obj.vx = newVt * tx
  obj.vy = newVt * ty

  return true
}

/**
 * 尝试激活弧线约束：小球接近弧面时将其锁定。
 * 复用 closestPointOnArc 的距离判定（与碰撞检测一致的触发条件）。
 * 激活后立即投影位置与速度，避免一帧偏移导致视觉跳跃。
 */
function tryActivateArcConstraint(
  obj: ParticleObject,
  seg: SegmentObject
): boolean {
  if (!seg.arc || !seg.groupId) return false
  if (obj.constrainedArcGroupId !== undefined) return false

  const { cx, cy, r, startAngle, endAngle } = seg.arc
  const radius = obj.radius || 10

  const closest = closestPointOnArc(obj.x, obj.y, cx, cy, r, startAngle, endAngle)
  const angle = Math.atan2(obj.y - cy, obj.x - cx)
  const objDist = Math.hypot(obj.x - cx, obj.y - cy)

  // 角度范围判定
  if (!isAngleInRange(angle, startAngle, endAngle)) return false

  // 缺口区域不激活（让球穿过缺口进入/离开）：按球碰撞体积判定，球体触及缺口即放行
  if (seg.arcGateState) {
    if (seg.arcGateState.entryOpen && seg.arc.entryGap &&
        isBallVolumeInGap(angle, seg.arc.entryGap.centerAngle, seg.arc.entryGap.halfWidth, radius, objDist)) return false
    if (seg.arcGateState.exitOpen && seg.arc.exitGap &&
        isBallVolumeInGap(angle, seg.arc.exitGap.centerAngle, seg.arc.exitGap.halfWidth, radius, objDist)) return false
  }

  // 距离判定
  // 带缺口的弧线特例：球在环内且所有门已关闭时，跳过距离判定强制激活约束
  // 场景：球从缺口进入后门关闭，球离弧面较远（> radius），但应在弧面上
  // 无此特例时，球会穿过圆环底部（closest.dist > radius 导致约束和碰撞都失效）
  const isInside = objDist < r
  const allGatesClosed = !!seg.arcGateState && !seg.arcGateState.entryOpen && !seg.arcGateState.exitOpen
  const isGatedArcInsideCatchUp = allGatesClosed && isInside
  if (!isGatedArcInsideCatchUp && closest.dist > radius) return false

  // 激活约束
  obj.constrainedArcGroupId = seg.groupId

  // 立即投影位置与速度（避免一帧偏移导致视觉跳跃）
  // objDist/isInside 已在距离判定中计算，此处复用
  const surfaceR = isInside ? (r - radius) : (r + radius)
  if (surfaceR <= 0) {
    obj.constrainedArcGroupId = undefined
    return false
  }
  obj.x = cx + Math.cos(angle) * surfaceR
  obj.y = cy + Math.sin(angle) * surfaceR
  const nx = Math.cos(angle)
  const ny = Math.sin(angle)
  const v_normal = obj.vx * nx + obj.vy * ny
  obj.vx -= v_normal * nx
  obj.vy -= v_normal * ny

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
 * 板块端面碰撞检测（质点撞击板块左右端面）
 * - 板块四个角点：上表面两端 (x1,y1)/(x2,y2) + 下表面两端（沿法线反方向偏移 physicsThickness）
 * - 左端面 = (x1,y1)-(x3,y3)，法线指向 -切线方向；右端面 = (x2,y2)-(x4,y4)，法线指向 +切线方向
 * - 碰撞响应：法向反射 + 动量守恒（考虑板块 mass），**不计算摩擦**
 * @returns true 表示发生端面碰撞（已处理响应）
 */
function detectPlateEndCollision(
  obj: ParticleObject,
  seg: SegmentObject
): boolean {
  if (!seg.physicsThickness) return false
  const radius = obj.radius || 10
  const restitution = seg.restitution !== undefined ? seg.restitution : 0.3
  const { x1, y1, x2, y2 } = seg
  const nx = seg.normalX || 0, ny = seg.normalY || 0
  const t = seg.physicsThickness
  // 下表面端点：上表面沿法线反方向偏移 physicsThickness（法线 normalY<0 指上，反方向向下 y 增大）
  const x3 = x1 - nx * t, y3 = y1 - ny * t
  const x4 = x2 - nx * t, y4 = y2 - ny * t
  // 切线方向（沿板块长度，从端点1指向端点2）
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const tx = dx / len, ty = dy / len
  // 端面列表：左端面法线指向 -切线，右端面法线指向 +切线
  const endFaces = [
    { ax: x1, ay: y1, bx: x3, by: y3, enx: -tx, eny: -ty },
    { ax: x2, ay: y2, bx: x4, by: y4, enx: tx, eny: ty }
  ]
  for (const face of endFaces) {
    const dist = pointToSegmentDistance(obj.x, obj.y, face.ax, face.ay, face.bx, face.by)
    if (dist > radius) continue
    const P = closestPointOnSegment(obj.x, obj.y, face.ax, face.ay, face.bx, face.by)
    // 位置修正：将质点推到端面外（沿端面法线 + radius）
    obj.x = P.x + face.enx * radius
    obj.y = P.y + face.eny * radius
    // 法向速度（沿端面法线投影）
    const v_obj_n = obj.vx * face.enx + obj.vy * face.eny
    if (v_obj_n < 0) {
      // 质点向端面内运动 → 反射 + 动量守恒（考虑板块可移动）
      // 使用带恢复系数的正确碰撞公式（动量守恒 + e=-(v1'-v2')/(v1-v2)）：
      //   v_obj' = ((m_obj - e*m_seg)*v_obj + (1+e)*m_seg*v_seg) / M
      //   v_seg' = ((1+e)*m_obj*v_obj + (m_seg - e*m_obj)*v_seg) / M
      const m_obj = obj.mass, m_seg = seg.mass || 1
      const segVx = seg.velocity?.x ?? 0, segVy = seg.velocity?.y ?? 0
      const v_seg_n = segVx * face.enx + segVy * face.eny
      const totalM = m_obj + m_seg
      const v_obj_n_new = ((m_obj - restitution * m_seg) * v_obj_n + (1 + restitution) * m_seg * v_seg_n) / totalM
      const v_seg_n_new = ((1 + restitution) * m_obj * v_obj_n + (m_seg - restitution * m_obj) * v_seg_n) / totalM
      // 更新质点速度
      obj.vx += (v_obj_n_new - v_obj_n) * face.enx
      obj.vy += (v_obj_n_new - v_obj_n) * face.eny
      // 更新板块速度（牛顿第三定律反作用）
      const segDv = v_seg_n_new - v_seg_n
      if (seg.velocity) {
        seg.velocity.x += segDv * face.enx
        seg.velocity.y += segDv * face.eny
      } else {
        seg.velocity = { x: segDv * face.enx, y: segDv * face.eny }
      }
    }
    return true
  }
  return false
}

/**
 * 更新弧线触发器状态（基于小球角度穿越检测）
 * 通用可配置机制：当小球经过 gap.triggerAngle 时，按 gap.triggerAction 打开/关闭缺口
 */
function updateArcGates(objects: PhysicsObject[]): void {
  const processedGroups = new Set<number>()
  for (const seg of objects) {
    if (seg.type !== 'line_segment') continue
    const s = seg as SegmentObject
    if (!s.arc || !s.arcGateState) continue
    if (s.groupId && processedGroups.has(s.groupId)) continue
    if (s.groupId) processedGroups.add(s.groupId)

    const { cx, cy, r, entryGap, exitGap } = s.arc
    const gate = s.arcGateState

    for (const obj of objects) {
      if (obj.type !== '质点' && obj.type !== '刚体') continue
      const p = obj as ParticleObject
      const dist = Math.hypot(p.x - cx, p.y - cy)
      const isInside = dist < r

      // 远离弧线时重置跟踪（避免误触发）
      if (dist > r * 1.5) {
        gate.prevAngle = undefined
        gate.wasInside = undefined
        continue
      }

      // enterRing 触发：小球从环外进入环内
      if (gate.wasInside === false && isInside) {
        if (entryGap?.triggerType === 'enterRing' && entryGap.triggerAction) {
          gate.entryOpen = entryGap.triggerAction === 'open'
        }
        if (exitGap?.triggerType === 'enterRing' && exitGap.triggerAction) {
          gate.exitOpen = exitGap.triggerAction === 'open'
        }
      }

      // angleCross 触发：小球角度穿越 triggerAngle
      const angle = Math.atan2(p.y - cy, p.x - cx)
      if (gate.prevAngle !== undefined) {
        if (entryGap?.triggerType === 'angleCross' && entryGap.triggerAngle !== undefined && entryGap.triggerAction) {
          if (didAngleCross(gate.prevAngle, angle, entryGap.triggerAngle)) {
            gate.entryOpen = entryGap.triggerAction === 'open'
          }
        }
        if (exitGap?.triggerType === 'angleCross' && exitGap.triggerAngle !== undefined && exitGap.triggerAction) {
          if (didAngleCross(gate.prevAngle, angle, exitGap.triggerAngle)) {
            gate.exitOpen = exitGap.triggerAction === 'open'
          }
        }
      }
      gate.prevAngle = angle
      gate.wasInside = isInside
    }
  }
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

  // 更新螺旋圆轨动态缺口状态（基于小球当前位置自动触发）
  updateArcGates(objects)

  // 地面碰撞（仅质点/刚体）
  for (const obj of objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      if (checkGroundCollision(obj, groundY, groundRestitution)) collided = true
    }
  }

  // 约束维持：对已约束小球施加弧线约束投影（可能脱离）
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    if (p.constrainedArcGroupId === undefined) continue
    const seg = objects.find(
      s => s.type === 'line_segment' && s.groupId === p.constrainedArcGroupId
    ) as SegmentObject | undefined
    if (!seg || !seg.arc) {
      p.constrainedArcGroupId = undefined  // 弧线已被删除
      continue
    }
    if (seg.constraintEnabled === false) {
      p.constrainedArcGroupId = undefined  // 用户关闭了约束
      continue
    }
    applyArcConstraint(p, seg, dt, gravity)
  }

  // 线段/弧线碰撞 + 约束激活
  const processedArcs = new Set<number>()
  for (const obj of objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject
    for (const seg of objects) {
      if (seg.type !== 'line_segment') continue
      if (seg.arc && seg.groupId) {
        if (processedArcs.has(seg.groupId)) continue
        processedArcs.add(seg.groupId)
        // 已约束小球跳过弧线碰撞/激活（约束维持遍历已处理）
        if (p.constrainedArcGroupId !== undefined) continue
        if (seg.constraintEnabled !== false) {
            // 约束开启：尝试激活；激活失败则回退到碰撞检测（防止小球穿过弧线）
            // detectArcCollision 内部已处理缺口放行（gate 开 + 在缺口范围 → return false），回退安全
            if (!tryActivateArcConstraint(p, seg)) {
              if (detectArcCollision(p, seg, dt, gravity)) collided = true
            }
          } else {
            // 约束关闭：走原有碰撞检测
            if (detectArcCollision(p, seg, dt, gravity)) collided = true
          }
      } else {
        if (detectSegmentCollision(p, seg, dt, gravity)) collided = true
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
