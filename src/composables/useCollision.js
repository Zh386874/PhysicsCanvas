/**
 * 碰撞检测模块
 * 实现：
 *   1. 质点与水平地面碰撞
 *   2. 质点间一维弹性碰撞
 *   3. 质点与任意线段碰撞（含法线反射）
 */

/**
 * 根据线段端点自动计算法线
 * 法线 = (dy, -dx) 归一化（画布坐标中视觉上的逆时针旋转 90°，默认指向上方/左侧）
 * 若当前法线与新法线方向相反（点积 < 0），翻转新法线以保留用户方向偏好
 * @param {Object} segment { x1, y1, x2, y2, normalX, normalY }
 * @returns {{ normalX: number, normalY: number }}
 */
export function autoComputeNormal(segment) {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return { normalX: 0, normalY: -1 } // 退化情况默认向上

  let nx = dy / len
  let ny = -dx / len

  // 保留用户方向偏好：当前法线与新法线点积为负则翻转
  const curNx = segment.normalX || 0
  const curNy = segment.normalY || 0
  if (curNx * nx + curNy * ny < 0) {
    nx = -nx
    ny = -ny
  }

  return { normalX: nx, normalY: ny }
}

/**
 * 质点与水平地面碰撞检测
 * 当质点底部超过地面线时，修正位置并反弹
 */
export function checkGroundCollision(obj, groundY, restitution = 0.6) {
  const radius = obj.radius || 10
  if (obj.y + radius >= groundY) {
    obj.y = groundY - radius
    if (obj.vy > 0) {
      obj.vy = -obj.vy * restitution
    }
    // 摩擦衰减
    obj.vx *= 0.98
    return true
  }
  return false
}

/**
 * 质点间一维弹性碰撞（沿 x 轴）
 * 基于动量守恒和动能守恒
 */
export function checkParticleCollision(a, b, restitution = 1.0) {
  const ra = a.radius || 10
  const rb = b.radius || 10
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const minDist = ra + rb

  if (dist < minDist && dist > 0) {
    // 分离重叠
    const overlap = minDist - dist
    const nx = dx / dist
    const ny = dy / dist
    a.x -= nx * overlap / 2
    a.y -= ny * overlap / 2
    b.x += nx * overlap / 2
    b.y += ny * overlap / 2

    // 一维弹性碰撞（沿法线方向）
    const ma = a.mass
    const mb = b.mass
    const va = a.vx * nx + a.vy * ny
    const vb = b.vx * nx + b.vy * ny

    const vaNew = ((ma - mb) * va + 2 * mb * vb) / (ma + mb) * restitution
    const vbNew = ((mb - ma) * vb + 2 * ma * va) / (ma + mb) * restitution

    a.vx += (vaNew - va) * nx
    a.vy += (vaNew - va) * ny
    b.vx += (vbNew - vb) * nx
    b.vy += (vbNew - vb) * ny
    return true
  }
  return false
}

/**
 * 质点与任意线段碰撞检测（连续碰撞检测）
 * segment: { x1, y1, x2, y2, normalX, normalY, restitution }
 * obj 需提供 prevX, prevY（上一帧位置）, x, y, vx, vy, radius
 */
export function detectSegmentCollision(obj, segment) {
  if (obj.type !== '质点' && obj.type !== '刚体') return false

  const radius = obj.radius || 10
  const restitution = segment.restitution !== undefined ? segment.restitution : 0.3

  const prevX = obj.prevX !== undefined ? obj.prevX : obj.x
  const prevY = obj.prevY !== undefined ? obj.prevY : obj.y

  // 线段端点
  const { x1, y1, x2, y2 } = segment
  const nx = segment.normalX
  const ny = segment.normalY

  // 1. 路径与线段相交判断（叉积法）
  // 路径 (prevX,prevY) -> (x,y)
  // 线段 (x1,y1) -> (x2,y2)
  const d1 = cross(x1, y1, x2, y2, prevX, prevY)
  const d2 = cross(x1, y1, x2, y2, obj.x, obj.y)
  const d3 = cross(prevX, prevY, obj.x, obj.y, x1, y1)
  const d4 = cross(prevX, prevY, obj.x, obj.y, x2, y2)

  const intersect = ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                     ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))

  // 2. 即使路径不严格相交，也用距离判断（半径接触）
  let hit = false
  let hitX = obj.x
  let hitY = obj.y

  if (intersect) {
    // 计算精确交点
    const pt = segmentIntersection(prevX, prevY, obj.x, obj.y, x1, y1, x2, y2)
    if (pt) {
      hitX = pt.x
      hitY = pt.y
      hit = true
    }
  }

  // 3. 距离接触：质点到线段距离小于半径（不论在哪一侧都需处理）
  if (!hit) {
    const dist = pointToSegmentDistance(obj.x, obj.y, x1, y1, x2, y2)
    if (dist <= radius) {
      // 取斜面上最近点 P，以 P 为基准做位置修正
      const P = closestPointOnSegment(obj.x, obj.y, x1, y1, x2, y2)
      hitX = P.x
      hitY = P.y
      hit = true
    }
  }

  if (!hit) return false

  // 4. 位置修正：将质点放到 hitX,hitY + 沿法线偏移 radius
  //    （路径交点情况 hitX,hitY 为交点；距离接触情况为斜面上最近点）
  obj.x = hitX + nx * radius
  obj.y = hitY + ny * radius

  // 5. 速度反射：仅在质点正在向线段内侧（法线反方向）运动时反射
  const v_normal = obj.vx * nx + obj.vy * ny
  if (v_normal < 0) {
    // 反射法向速度（恢复系数作用于法向分量）
    obj.vx -= (1 + restitution) * v_normal * nx
    obj.vy -= (1 + restitution) * v_normal * ny
  }

  // 6. 切向摩擦：接触时沿斜面方向施加摩擦衰减
  //    切向单位向量 t（与法线垂直），取与速度方向一致的那个
  const friction = obj.friction || 0
  if (friction > 0) {
    let tx = -ny
    let ty = nx
    const v_tangent = obj.vx * tx + obj.vy * ty
    if (Math.abs(v_tangent) > 1e-6) {
      // 摩擦使切向速度衰减（每帧衰减比例与摩擦系数成正比）
      const damp = Math.min(friction * 0.15, 0.9)
      const newVt = v_tangent * (1 - damp)
      obj.vx += (newVt - v_tangent) * tx
      obj.vy += (newVt - v_tangent) * ty
    }
  }

  return true
}

/**
 * 叉积辅助：向量 AB × AP 的 z 分量
 */
function cross(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

/**
 * 两线段交点
 */
function segmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  }
}

/**
 * 点到线段距离
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) {
    return Math.hypot(px - x1, py - y1)
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * 点到线段的最近点
 */
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return { x: x1, y: y1 }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: x1 + t * dx, y: y1 + t * dy }
}

/**
 * 执行所有碰撞检测
 * @param {Array} objects 物体数组
 * @param {number} groundY 地面 y 坐标
 * @param {number} restitution 地面恢复系数
 * @returns {boolean} 是否发生任何碰撞
 */
export function checkCollision(objects, groundY, restitution = 0.6) {
  let collided = false

  // 地面碰撞
  for (const obj of objects) {
    if (checkGroundCollision(obj, groundY, restitution)) collided = true
  }

  // 线段碰撞
  for (const obj of objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      for (const seg of objects) {
        if (seg.type === 'line_segment') {
          if (detectSegmentCollision(obj, seg)) collided = true
        }
      }
    }
  }

  // 质点间碰撞
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      if (objects[i].type === 'line_segment' || objects[j].type === 'line_segment') continue
      if (checkParticleCollision(objects[i], objects[j], restitution)) collided = true
    }
  }

  return collided
}
