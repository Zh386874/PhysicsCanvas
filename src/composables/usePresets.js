/**
 * 预设场景配置
 * 每个函数返回 { objects, forces }
 * 注意：坐标基于画布像素，y 向下为正
 */

let idCounter = 100

function nextId() {
  return ++idCounter
}

/**
 * 平抛运动：单个小球从左上方水平抛出
 */
export function presetProjectile() {
  return {
    objects: [
      {
        id: 1, name: '抛体小球', type: '质点',
        mass: 1.0, x: 80, y: 80, vx: 120, vy: 0,
        radius: 15, color: '#3b82f6', trail: []
      }
    ],
    forces: [],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    gravity: 9.8
  }
}

/**
 * 斜面滑块：滑块沿斜面下滑，使用真实线段碰撞
 * 斜面端点 (150,420) -> (450,160)，法线指向左上（斜面"上方"）
 * 地面线段在画布底部，法线向上
 * 注意：画布坐标单位是像素，重力数值需放大到与像素尺度匹配，
 *       否则 SI 单位的 9.8 会让滑块几秒才移动 1 像素。
 */
export function presetIncline() {
  // 斜面方向向量 (300, -260)，法线（顺时针 90°）= (-260, -300) 归一化
  const len = Math.sqrt(260 * 260 + 300 * 300) // ≈ 396.99
  const nx = -260 / len
  const ny = -300 / len
  return {
    objects: [
      {
        id: 1, name: '滑块', type: '质点',
        mass: 3.0, x: 420, y: 180, vx: 0, vy: 0,
        radius: 14, color: '#60a5fa', friction: 0.05, trail: []
      },
      {
        id: 2, name: '斜面', type: 'line_segment',
        x1: 150, y1: 420, x2: 450, y2: 160,
        normalX: nx, normalY: ny,
        restitution: 0.2,
        color: '#475569'
      },
      {
        id: 3, name: '地面', type: 'line_segment',
        x1: 0, y1: 500, x2: 1000, y2: 500,
        normalX: 0, normalY: -1,
        restitution: 0.2,
        color: '#475569'
      }
    ],
    forces: [],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    gravity: 300, // 像素尺度重力，保证 1~2 秒内滑完斜面
    groundY: null // 禁用水平地面，由斜面/地面线段接管碰撞
  }
}

/**
 * 弹性碰撞：两个小球相向运动
 */
export function presetCollision() {
  return {
    objects: [
      {
        id: 1, name: '小球A', type: '质点',
        mass: 1.0, x: 120, y: 250, vx: 100, vy: 0,
        radius: 15, color: '#3b82f6', trail: []
      },
      {
        id: 2, name: '小球B', type: '质点',
        mass: 2.0, x: 500, y: 250, vx: -80, vy: 0,
        radius: 20, color: '#1d4ed8', trail: []
      }
    ],
    forces: [],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    gravity: 9.8
  }
}

/**
 * 带电粒子在匀强磁场中的圆周运动
 */
export function presetMagnetic() {
  return {
    objects: [
      {
        id: 1, name: '带电粒子', type: '质点',
        mass: 1.0, x: 350, y: 250, vx: 150, vy: 0,
        radius: 12, color: '#22d3ee', charge: 1, trail: []
      }
    ],
    forces: [],
    field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 1 },
    gravity: 0
  }
}

/**
 * 带电粒子在匀强电场中的抛物线运动
 */
export function presetElectric() {
  return {
    objects: [
      {
        id: 1, name: '带电粒子', type: '质点',
        mass: 1.0, x: 50, y: 400, vx: 150, vy: 0,
        radius: 12, color: '#22d3ee', charge: 1, trail: []
      }
    ],
    forces: [],
    field: { type: 'electric', E: { x: 0, y: -50 }, B: 0 },
    gravity: 9.8
  }
}

/**
 * 根据场景名称获取预设
 */
export function getPreset(sceneName) {
  switch (sceneName) {
    case '抛体运动': return presetProjectile()
    case '斜面滑块': return presetIncline()
    case '弹性碰撞': return presetCollision()
    case '磁场圆周': return presetMagnetic()
    case '电场偏转': return presetElectric()
    default: return presetProjectile()
  }
}

export { nextId }
