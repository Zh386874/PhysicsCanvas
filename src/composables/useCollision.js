/**
 * 碰撞检测模块
 * 目前实现：质点与水平线段（地面）碰撞、质点间一维弹性碰撞
 */

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
 * 执行所有碰撞检测
 */
export function checkCollision(objects, groundY, restitution = 0.6) {
  // 地面碰撞
  for (const obj of objects) {
    checkGroundCollision(obj, groundY, restitution)
  }
  // 质点间碰撞
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      checkParticleCollision(objects[i], objects[j], restitution)
    }
  }
}
