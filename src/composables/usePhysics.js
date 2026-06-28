import { reactive } from 'vue'
import { checkCollision } from './useCollision'

const GRAVITY = 9.8 // m/s^2

// 初始物体数据
const initialObjects = [
  { id: 1, name: '小球A', type: '质点', mass: 1.0, x: 100, y: 100, vx: 80, vy: 0, radius: 15, color: '#60a5fa' },
  { id: 2, name: '滑块B', type: '刚体', mass: 2.0, x: 300, y: 200, vx: -40, vy: 0, radius: 20, color: '#a78bfa' },
  { id: 3, name: '小球C', type: '质点', mass: 0.5, x: 500, y: 80, vx: 60, vy: 20, radius: 12, color: '#f472b6' }
]

// 场景状态
const state = reactive({
  objects: JSON.parse(JSON.stringify(initialObjects)).map(o => ({ ...o, trail: [] })),
  forces: [], // 自定义力 { id, fx, fy, targetId }
  time: 0,
  isPlaying: false,
  showForce: true,
  groundY: 400,
  restitution: 0.6,
  gravity: GRAVITY
})

// 初始快照
let snapshot = JSON.parse(JSON.stringify(initialObjects))

/**
 * 物理更新：遍历所有物体，计算合力，欧拉积分，处理碰撞
 */
function updatePhysics(dt) {
  if (!state.isPlaying) return

  for (const obj of state.objects) {
    // 合力 = 重力 + 自定义力
    let fx = 0
    let fy = obj.mass * state.gravity // 重力（向下）

    // 累加该物体的自定义力
    for (const force of state.forces) {
      if (force.targetId === obj.id) {
        fx += force.fx
        fy += force.fy
      }
    }

    // 加速度 = 合力 / 质量
    const ax = fx / obj.mass
    const ay = fy / obj.mass

    // 欧拉积分：先更新速度，再更新位置
    obj.vx += ax * dt
    obj.vy += ay * dt
    obj.x += obj.vx * dt
    obj.y += obj.vy * dt

    // 记录轨迹（最多保留 80 个点）
    obj.trail.push({ x: obj.x, y: obj.y })
    if (obj.trail.length > 80) obj.trail.shift()
  }

  // 碰撞检测
  checkCollision(state.objects, state.groundY, state.restitution)

  state.time += dt
}

/**
 * 重置到初始快照
 */
function reset() {
  state.objects = JSON.parse(JSON.stringify(snapshot)).map(o => ({ ...o, trail: [] }))
  state.time = 0
  state.isPlaying = false
  state.forces = []
}

/**
 * 添加自定义力
 */
function addForce(force) {
  state.forces.push(force)
}

/**
 * 清除所有自定义力
 */
function clearForces() {
  state.forces = []
}

export {
  state,
  updatePhysics,
  reset,
  addForce,
  clearForces
}
