import { reactive } from 'vue'
import { checkCollision } from './useCollision'
import { snapshots, currentFrame, keyframeIndices, recordSnapshot, clearSnapshots } from './useSnapshotManager'
import { calculateTotalForce } from './useForces'
import { MAX_SUBSTEPS, MAX_STEP_DIST, TRAIL_LENGTH, GROUND_DISABLED } from '../constants'

// ===== 类型定义 =====

/** 二维向量 */
interface Vec2 { x: number; y: number }

/** 运动轨迹点 */
interface TrailPoint { x: number; y: number }

/** 物体类型字面量 */
type ObjectType = '质点' | '刚体' | 'line_segment'

/** 场类型字面量 */
type FieldType = 'none' | 'electric' | 'magnetic' | 'composite'

/** 场设置（支持多场同时存在：gravity 始终独立，E 和 B 可同时非零） */
export interface FieldState {
  type: FieldType
  E: Vec2
  B: number
}

/** 自定义力 */
export interface CustomForce {
  id: number
  fx: number
  fy: number
  targetId: number
}

/** 弧线元数据 */
interface ArcMeta {
  cx: number
  cy: number
  r: number
  startAngle: number
  endAngle: number
}

/** 质点/刚体物体 */
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

/** 线段物体 */
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
  /** 传送带速度（像素/秒），可选。设置后摩擦力按相对速度计算 */
  velocity?: { x: number; y: number }
  /** 可移动标记（板块模型），设为 true 时线段受力可运动 */
  movable?: boolean
  /** 可移动线段质量（板块模型） */
  mass?: number
}

/** 弹簧物体 */
export interface SpringObject {
  id: number
  name: string
  type: 'spring'
  /** 固定端坐标（像素） */
  anchorX: number
  anchorY: number
  /** 连接的质点 id */
  ballId: number
  /** 自然长度（像素） */
  naturalLength: number
  /** 劲度系数 k（N/m，SI 单位） */
  k: number
  color?: string
}

/** 物体联合类型 */
export type PhysicsObject = ParticleObject | SegmentObject | SpringObject

/** 快照中的物体精简结构 */
export interface SnapshotObject {
  id: number
  x: number
  y: number
  vx: number
  vy: number
}

/** 回放帧 */
export interface SnapshotFrame {
  objects: SnapshotObject[]
  field: FieldState
  groundY: number
  gravity: number
  timestamp: number
}

/** 全局场景状态 */
export interface PhysicsState {
  objects: PhysicsObject[]
  forces: CustomForce[]
  field: FieldState
  time: number
  isPlaying: boolean
  showForce: boolean
  groundY: number
  groundRestitution: number
  particleRestitution: number
  gravity: number
}

// ===== 常量 =====

const PIXELS_PER_METER: number = 50 // 1 米 = 50 像素（全局尺度常量）
const GRAVITY_SI: number = 9.8 // m/s^2
const GRAVITY: number = GRAVITY_SI * PIXELS_PER_METER // 像素/s^2 = 490

// 初始物体数据
const initialObjects: ParticleObject[] = [
  { id: 1, name: '小球A', type: '质点', mass: 1.0, x: 100, y: 100, vx: 80, vy: 0, radius: 15, color: '#60a5fa', trail: [] },
  { id: 2, name: '滑块B', type: '刚体', mass: 2.0, x: 300, y: 200, vx: -40, vy: 0, radius: 20, color: '#a78bfa', trail: [] },
  { id: 3, name: '小球C', type: '质点', mass: 0.5, x: 500, y: 80, vx: 60, vy: 20, radius: 12, color: '#f472b6', trail: [] }
]

// ===== 全局状态 =====

const state = reactive<PhysicsState>({
  objects: JSON.parse(JSON.stringify(initialObjects)).map((o: ParticleObject) => ({ ...o, trail: [] })),
  forces: [],
  field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
  time: 0,
  isPlaying: false,
  showForce: true,
  groundY: 400,
  groundRestitution: 0.6,
  particleRestitution: 1.0,
  gravity: GRAVITY
})

// 初始快照（reset 恢复点）
let snapshot: PhysicsObject[] = JSON.parse(JSON.stringify(initialObjects))
let fieldSnapshot: FieldState = JSON.parse(JSON.stringify(state.field))
let gravitySnapshot: number = GRAVITY

// ===== 核心函数 =====

/**
 * 单次子步物理更新（供子步循环调用）
 */
function subStepPhysics(subDt: number): boolean {
  // 保存上一帧位置，供连续碰撞检测使用
  for (const obj of state.objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      p.prevX = p.x
      p.prevY = p.y
    }
  }

  for (const obj of state.objects) {
    if (obj.type !== '质点' && obj.type !== '刚体') continue
    const p = obj as ParticleObject

    // 合力计算委托给力注册表（策略模式，遵循 OCP）
    // 添加新力只需在 useForces.ts 中调用 registerForce，无需修改此函数
    const { fx, fy } = calculateTotalForce(state, p)

    const ax = fx / p.mass
    const ay = fy / p.mass

    p.vx += ax * subDt
    p.vy += ay * subDt
    p.x += p.vx * subDt
    p.y += p.vy * subDt
  }

  // 更新可移动线段位置（板块模型，仅水平平移）
  for (const obj of state.objects) {
    if (obj.type !== 'line_segment') continue
    const seg = obj as SegmentObject
    if (!seg.movable || !seg.velocity) continue
    const dx = seg.velocity.x * subDt
    seg.x1 += dx
    seg.x2 += dx
  }

  return checkCollision(state.objects, state.groundY, state.groundRestitution, state.particleRestitution, subDt, state.gravity)
}

/**
 * 物理更新：子步循环防止隧穿 + 快照录制
 */
function updatePhysics(dt: number): void {
  if (!state.isPlaying) return

  // 子步循环：每次移动距离不超过 MAX_STEP_DIST，防止隧穿
  // 设置上限避免微观粒子（高速度）导致计算量爆炸
  let maxVelMag = 0
  for (const obj of state.objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      const velMag = Math.hypot(p.vx, p.vy)
      if (velMag > maxVelMag) maxVelMag = velMag
    }
  }

  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(maxVelMag * dt / MAX_STEP_DIST)))
  const subDt = dt / steps

  for (let i = 0; i < steps; i++) {
    subStepPhysics(subDt)
  }

  // 仅在最后一帧录制轨迹和快照（避免轨迹过于密集）
  for (const obj of state.objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      p.trail.push({ x: p.x, y: p.y })
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift()
    }
  }

  const frame: SnapshotFrame = {
    objects: state.objects
      .filter((o): o is ParticleObject => o.type === '质点' || o.type === '刚体')
      .map(o => ({ id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy })),
    field: JSON.parse(JSON.stringify(state.field)),
    groundY: state.groundY,
    gravity: state.gravity,
    timestamp: Date.now()
  }
  recordSnapshot(frame)

  state.time += dt
}

function reset(): void {
  state.objects = JSON.parse(JSON.stringify(snapshot)).map((o: PhysicsObject) => ({ ...o, trail: [] }))
  state.field = JSON.parse(JSON.stringify(fieldSnapshot))
  state.gravity = gravitySnapshot
  state.time = 0
  state.isPlaying = false
  state.forces = []
  clearSnapshots()
}

function addForce(force: CustomForce): void {
  state.forces.push(force)
}

function removeForce(forceId: number): void {
  const idx = state.forces.findIndex(f => f.id === forceId)
  if (idx !== -1) state.forces.splice(idx, 1)
}

function clearForces(): void {
  state.forces.splice(0, state.forces.length)
}

/**
 * 更新指定物体的单个属性
 */
function updateObjectProperty(id: number, key: string, value: unknown): void {
  const obj = state.objects.find(o => o.id === id) as Record<string, unknown> | undefined
  if (obj) obj[key] = value
}

function addObject(obj: PhysicsObject): void {
  state.objects.push(obj)
}

function removeObject(id: number): void {
  const idx = state.objects.findIndex(o => o.id === id)
  if (idx !== -1) state.objects.splice(idx, 1)
}

/**
 * 加载场景预设
 * @param groundY null 禁用水平地面（由线段物体接管碰撞）；undefined 保持默认
 */
function loadScene(
  objects: PhysicsObject[],
  forces: CustomForce[],
  field: FieldState,
  gravity: number,
  groundY: number | null | undefined
): void {
  state.objects = objects.map(o => ({ ...o, trail: [] }))
  state.forces = forces ? [...forces] : []
  state.field = field ? JSON.parse(JSON.stringify(field)) : { type: 'none', E: { x: 0, y: 0 }, B: 0 }
  state.gravity = gravity !== undefined ? gravity : GRAVITY
  if (groundY === null) {
    state.groundY = GROUND_DISABLED
  } else if (groundY !== undefined) {
    state.groundY = groundY
  }
  state.time = 0
  state.isPlaying = false
  snapshot = JSON.parse(JSON.stringify(objects))
  fieldSnapshot = JSON.parse(JSON.stringify(state.field))
  gravitySnapshot = state.gravity
  clearSnapshots()
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
  updateObjectProperty,
  addObject,
  removeObject,
  loadScene,
  PIXELS_PER_METER
}
