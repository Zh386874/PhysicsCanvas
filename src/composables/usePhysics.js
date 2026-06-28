import { reactive, ref } from 'vue'
import { checkCollision } from './useCollision'

const PIXELS_PER_METER = 50 // 1 米 = 50 像素（全局尺度常量）
const GRAVITY_SI = 9.8 // m/s^2
const GRAVITY = GRAVITY_SI * PIXELS_PER_METER // 像素/s^2 = 490
const MAX_SNAPSHOTS = 600 // 10秒 × 60fps

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
  field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
  time: 0,
  isPlaying: false,
  showForce: true,
  groundY: 400,
  restitution: 0.6,
  gravity: GRAVITY
})

// 回放快照
const snapshots = ref([])
const currentFrame = ref(0)
const keyframeIndices = ref([])

// 初始快照
let snapshot = JSON.parse(JSON.stringify(initialObjects))
let fieldSnapshot = JSON.parse(JSON.stringify(state.field))
let gravitySnapshot = GRAVITY

/**
 * 检测关键帧：速度分量符号变化
 */
function detectKeyframe(prevFrame, curFrame) {
  for (let i = 0; i < curFrame.length; i++) {
    const prev = prevFrame[i]
    const cur = curFrame[i]
    if (!prev) continue
    if (prev.vx * cur.vx < 0 || prev.vy * cur.vy < 0) return true
  }
  return false
}

/**
 * 物理更新：遍历所有物体，计算合力，欧拉积分，处理碰撞
 */
function updatePhysics(dt) {
  if (!state.isPlaying) return

  // 保存上一帧位置，供线段连续碰撞检测使用
  for (const obj of state.objects) {
    obj.prevX = obj.x
    obj.prevY = obj.y
  }

  for (const obj of state.objects) {
    // 跳过线段物体本身（不参与物理积分）
    if (obj.type === 'line_segment') continue

    // 合力 = 重力 + 自定义力 + 场力
    let fx = 0
    let fy = obj.mass * state.gravity // 重力（向下）

    // 累加该物体的自定义力
    for (const force of state.forces) {
      if (force.targetId === obj.id) {
        fx += force.fx
        fy += force.fy
      }
    }

    // 场力计算
    const charge = obj.charge || 0
    if (charge !== 0) {
      if (state.field.type === 'electric') {
        // 电场力 Fe = qE
        fx += charge * state.field.E.x
        fy += charge * state.field.E.y
      } else if (state.field.type === 'magnetic') {
        // 洛伦兹力 F = qv × B（B 垂直纸面向里为正）
        // Fx = q * vy * B, Fy = -q * vx * B
        fx += charge * obj.vy * state.field.B
        fy += -charge * obj.vx * state.field.B
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

  // 碰撞检测（返回是否发生碰撞，用于关键帧标记）
  const collided = checkCollision(state.objects, state.groundY, state.restitution)

  // 记录快照
  const frame = state.objects.map(o => ({ id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy }))
  const prevFrame = snapshots.value[snapshots.value.length - 1]
  if (collided || (prevFrame && detectKeyframe(prevFrame, frame))) {
    keyframeIndices.value.push(snapshots.value.length)
  }
  snapshots.value.push(frame)
  if (snapshots.value.length > MAX_SNAPSHOTS) {
    snapshots.value.shift()
    // 关键帧索引同步偏移
    keyframeIndices.value = keyframeIndices.value
      .map(i => i - 1)
      .filter(i => i >= 0)
  }

  state.time += dt
}

/**
 * 重置到初始快照
 */
function reset() {
  state.objects = JSON.parse(JSON.stringify(snapshot)).map(o => ({ ...o, trail: [] }))
  state.field = JSON.parse(JSON.stringify(fieldSnapshot))
  state.gravity = gravitySnapshot
  state.time = 0
  state.isPlaying = false
  state.forces = []
  snapshots.value = []
  currentFrame.value = 0
  keyframeIndices.value = []
}

/**
 * 添加自定义力
 */
function addForce(force) {
  state.forces.push(force)
}

/**
 * 删除指定力
 */
function removeForce(forceId) {
  const idx = state.forces.findIndex(f => f.id === forceId)
  if (idx !== -1) state.forces.splice(idx, 1)
}

/**
 * 清除所有自定义力
 */
function clearForces() {
  state.forces.splice(0, state.forces.length)
}

/**
 * 加载场景预设
 * groundY 可选：水平地面 y 坐标；传 null 表示禁用水平地面（由线段物体接管碰撞）
 */
function loadScene(objects, forces, field, gravity, groundY) {
  state.objects = objects.map(o => ({ ...o, trail: [] }))
  state.forces = forces ? [...forces] : []
  state.field = field ? JSON.parse(JSON.stringify(field)) : { type: 'none', E: { x: 0, y: 0 }, B: 0 }
  state.gravity = gravity !== undefined ? gravity : GRAVITY
  // groundY: null 禁用水平地面（设为极大值），undefined 保持默认，数值则使用
  if (groundY === null) {
    state.groundY = 100000
  } else if (groundY !== undefined) {
    state.groundY = groundY
  }
  state.time = 0
  state.isPlaying = false
  // 更新快照，使 reset 恢复到当前场景
  snapshot = JSON.parse(JSON.stringify(objects))
  fieldSnapshot = JSON.parse(JSON.stringify(state.field))
  gravitySnapshot = state.gravity
  // 清空回放数据
  snapshots.value = []
  currentFrame.value = 0
  keyframeIndices.value = []
}

export {
  state,
  snapshots,
  currentFrame,
  keyframeIndices,
  updatePhysics,
  reset,
  addForce,
  removeForce,
  clearForces,
  loadScene,
  PIXELS_PER_METER
}
