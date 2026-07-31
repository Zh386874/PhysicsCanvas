import { reactive } from 'vue'
import { checkCollision } from './useCollision'
import {
  snapshots,
  currentFrame,
  keyframeIndices,
  recordSnapshot,
  clearSnapshots
} from './useSnapshotManager'
import { calculateTotalForce } from './useForces'
import { MAX_SUBSTEPS, MAX_STEP_DIST, TRAIL_LENGTH, GROUND_DISABLED } from '../constants'

// ===== 类型定义 =====

/** 二维向量 */
interface Vec2 {
  x: number
  y: number
}

/** 运动轨迹点 */
interface TrailPoint {
  x: number
  y: number
}

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

/** 弧线缺口定义（含触发器配置） */
interface ArcGap {
  centerAngle: number
  halfWidth: number
  /** 初始开关状态（默认 false = 关闭） */
  initiallyOpen?: boolean
  /** 触发类型：'angleCross' 角度穿越 / 'enterRing' 进入圆环 / 'spotOverlap' 触发点重叠 */
  triggerType?: 'angleCross' | 'enterRing' | 'spotOverlap'
  /** 触发角度（画布坐标系弧度）。triggerType='angleCross' 时使用 */
  triggerAngle?: number
  /** 触发动作：'open' 打开缺口 / 'close' 关闭缺口 */
  triggerAction?: 'open' | 'close'
  /** 触发点在环上的弧度（画布坐标系）。triggerType='spotOverlap' 时使用 */
  triggerSpotAngle?: number
  /** 触发点半径（像素）。缺省运行时取球半径 1.5 倍 */
  triggerSpotRadius?: number
}

/** 弧线元数据 */
interface ArcMeta {
  cx: number
  cy: number
  r: number
  startAngle: number
  endAngle: number
  /** 螺旋圆轨入口缺口（B点），运行时由 arcGateState 控制开关 */
  entryGap?: ArcGap
  /** 螺旋圆轨出口缺口（E点），运行时由 arcGateState 控制开关 */
  exitGap?: ArcGap
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
  /** 当前约束的弧线 groupId（undefined = 未约束）。运行时状态，不序列化 */
  constrainedArcGroupId?: number
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
  /** 视觉厚度（像素），仅渲染用，板块模型可选；未设置时渲染回退默认值 */
  thickness?: number
  /** 物理厚度（像素，运行时由米×scale 转换）；板块上下表面间距，参与碰撞与支撑检测 */
  physicsThickness?: number
  /** 静态倾角（弧度）；板块相对水平面的初始倾斜，物理更新中保持不变（不动态旋转） */
  angle?: number
  /** 子类型：区分 plate/conveyor/platform（运行时语义）；未设置视为普通线段 */
  subtype?: 'plate' | 'conveyor' | 'platform'
  /** 上表面摩擦系数（板块模型，板块定义法线指向侧）；未设置回退 friction */
  frictionTop?: number
  /** 下表面摩擦系数（板块模型，板块定义法线反向侧）；未设置回退 friction */
  frictionBottom?: number
  /** 弧线触发器运行时状态（不序列化，运行时由 useSceneBuilder 初始化） */
  arcGateState?: {
    entryOpen: boolean
    exitOpen: boolean
    /** 上一帧小球角度（画布坐标系），用于检测角度穿越触发。undefined = 尚未跟踪 */
    prevAngle?: number
    /** 上一帧小球是否在环内（enterRing 触发检测）。undefined = 尚未跟踪 */
    wasInside?: boolean
    /** spotOverlap 一次性触发标志：true=已触发，不再响应。undefined 视为未触发 */
    entrySpotTriggered?: boolean
    exitSpotTriggered?: boolean
  }
  /** 弧线约束动力学开关（仅首段，true=约束模式，false=碰撞模式）。未设置视为 true */
  constraintEnabled?: boolean
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
  showGateColors: boolean
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
  {
    id: 1,
    name: '小球A',
    type: '质点',
    mass: 1.0,
    x: 100,
    y: 100,
    vx: 80,
    vy: 0,
    radius: 15,
    color: '#60a5fa',
    trail: []
  },
  {
    id: 2,
    name: '滑块B',
    type: '刚体',
    mass: 2.0,
    x: 300,
    y: 200,
    vx: -40,
    vy: 0,
    radius: 20,
    color: '#a78bfa',
    trail: []
  },
  {
    id: 3,
    name: '小球C',
    type: '质点',
    mass: 0.5,
    x: 500,
    y: 80,
    vx: 60,
    vy: 20,
    radius: 12,
    color: '#f472b6',
    trail: []
  }
]

// ===== 全局状态 =====

const state = reactive<PhysicsState>({
  objects: JSON.parse(JSON.stringify(initialObjects)).map((o: ParticleObject) => ({
    ...o,
    trail: []
  })),
  forces: [],
  field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
  time: 0,
  isPlaying: false,
  showForce: true,
  showGateColors: true,
  groundY: 400,
  groundRestitution: 0.6,
  particleRestitution: 1.0,
  gravity: GRAVITY
})

// 初始快照（loadScene 时捕获，reset 的回退基线）
let snapshot: PhysicsObject[] = JSON.parse(JSON.stringify(initialObjects))
// 播放起始基线（按下播放时捕获，reset 优先使用）。null 时回退到 snapshot
let playStartSnapshot: PhysicsObject[] | null = null

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

  // 更新可移动线段位置
  for (const obj of state.objects) {
    if (obj.type !== 'line_segment') continue
    const seg = obj as SegmentObject
    // 传送带（有 velocity 且非 movable）：保持恒速水平平移
    if (seg.velocity && !seg.movable) {
      const dx = seg.velocity.x * subDt
      seg.x1 += dx
      seg.x2 += dx
      continue
    }
    // 板块（movable）：经典板块模型 —— 受重力、位置更新、地面/平台支撑、摩擦阻尼
    if (!seg.movable) continue
    // 1. 受重力
    if (seg.velocity) seg.velocity.y += state.gravity * subDt
    // 2. 位置更新（x、y 同步平移，保持形状不旋转）
    const vx = seg.velocity?.x ?? 0
    const vy = seg.velocity?.y ?? 0
    seg.x1 += vx * subDt
    seg.x2 += vx * subDt
    seg.y1 += vy * subDt
    seg.y2 += vy * subDt
    // 3. 地面/平台支撑检测（用下表面 y：板块中心 + 物理厚度/2，沿画布 y 正方向）
    //    法线指向上方（normalY<0），下表面 = 中心 + physicsThickness/2（画布 y 向下为正）
    const segMidY = (seg.y1 + seg.y2) / 2
    const segMidX = (seg.x1 + seg.x2) / 2
    const segHalfLen = Math.abs(seg.x2 - seg.x1) / 2
    const halfThickness = seg.physicsThickness ? seg.physicsThickness / 2 : 0
    const bottomY = segMidY + halfThickness // 下表面 y（画布坐标）
    let supportY: number | null = null
    let supportFriction = 0
    let supportVx = 0
    // 3a. 地面支撑：下表面接触地面；摩擦用板块下表面系数 frictionBottom（默认 0.1）
    if (state.groundY < GROUND_DISABLED && bottomY >= state.groundY) {
      supportY = state.groundY
      supportFriction = seg.frictionBottom ?? 0.1
    }
    // 3b. 平台/传送带支撑（水平非 movable 线段）
    if (supportY === null) {
      for (const o2 of state.objects) {
        if (o2.id === seg.id || o2.type !== 'line_segment') continue
        const s2 = o2 as SegmentObject
        if (s2.movable || s2.arc) continue
        // 仅当水平线段（|y1-y2| < 3px 视为水平）且 x 范围重叠时作为支撑
        if (Math.abs(s2.y1 - s2.y2) > 3) continue
        const s2MidY = (s2.y1 + s2.y2) / 2
        const s2MidX = (s2.x1 + s2.x2) / 2
        const s2HalfLen = Math.abs(s2.x2 - s2.x1) / 2
        if (Math.abs(segMidX - s2MidX) < segHalfLen + s2HalfLen && bottomY >= s2MidY) {
          supportY = s2MidY
          // 板块下表面摩擦优先（frictionBottom），否则用支撑面 friction
          supportFriction = seg.frictionBottom ?? s2.friction ?? 0.1
          supportVx = s2.velocity?.x ?? 0 // 传送带速度
          break
        }
      }
    }
    // 4. 应用支撑：下表面归位到 supportY + vy 清零 + 摩擦减速 vx（相对支撑面速度）
    if (supportY !== null && seg.velocity) {
      const dy = supportY - bottomY
      seg.y1 += dy
      seg.y2 += dy
      seg.velocity.y = 0
      if (supportFriction > 0) {
        const vRel = seg.velocity.x - supportVx
        const a = supportFriction * state.gravity * subDt
        if (Math.abs(vRel) <= a) {
          seg.velocity.x = supportVx // 与支撑面共速
        } else {
          seg.velocity.x -= Math.sign(vRel) * a
        }
      }
    }
    // 5. 板块端面与静态竖直线段的碰撞（水平板块撞竖直侧壁，如摆渡车撞凹槽侧壁IJ）
    //    碰撞后板块水平速度清零（立即静止），符合高考"碰到侧壁立即静止"语义
    if (Math.abs(seg.y1 - seg.y2) < 3 && seg.velocity) {
      const segLeftX = Math.min(seg.x1, seg.x2)
      const segRightX = Math.max(seg.x1, seg.x2)
      const segTopY = segMidY - halfThickness // 板块上表面
      const segBottomY2 = bottomY // 板块下表面
      for (const o2 of state.objects) {
        if (o2.id === seg.id || o2.type !== 'line_segment') continue
        const s2 = o2 as SegmentObject
        if (s2.movable || s2.arc) continue
        // 仅竖直线段（|x1-x2|<3px 视为竖直）
        if (Math.abs(s2.x1 - s2.x2) > 3) continue
        const wallX = (s2.x1 + s2.x2) / 2
        const wallTopY = Math.min(s2.y1, s2.y2)
        const wallBotY = Math.max(s2.y1, s2.y2)
        // y 范围重叠才碰撞（板块上下表面与墙竖直范围有交集）
        if (segBottomY2 < wallTopY || segTopY > wallBotY) continue
        // 板块右端撞墙（墙在右侧，板块向右移动越过墙）
        if (wallX > segRightX && segRightX >= wallX - 1) {
          const dx = wallX - segRightX
          seg.x1 += dx
          seg.x2 += dx
          seg.velocity.x = 0 // 立即静止
          break
        }
        // 板块左端撞墙（墙在左侧，板块向左移动越过墙）
        if (wallX < segLeftX && segLeftX <= wallX + 1) {
          const dx = wallX - segLeftX
          seg.x1 += dx
          seg.x2 += dx
          seg.velocity.x = 0 // 立即静止
          break
        }
      }
    }
  }

  return checkCollision(
    state.objects,
    state.groundY,
    state.groundRestitution,
    state.particleRestitution,
    subDt,
    state.gravity
  )
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

  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((maxVelMag * dt) / MAX_STEP_DIST)))
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
      .map((o) => ({ id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy })),
    field: JSON.parse(JSON.stringify(state.field)),
    groundY: state.groundY,
    gravity: state.gravity,
    timestamp: Date.now()
  }
  recordSnapshot(frame)

  state.time += dt
}

/**
 * 捕获播放起始基线（按下播放时调用），作为重置的位置恢复点。
 * 重置时物理状态从此基线恢复，配置参数保留当前值。
 */
function capturePlayStart(): void {
  // JSON 深拷贝（避免引入 useSceneIO 运行时循环依赖；运行时字段保留无害，merge 不读取）
  playStartSnapshot = JSON.parse(JSON.stringify(state.objects)) as PhysicsObject[]
}

/**
 * 重置合并：物理状态（位置/速度/几何/运行时字段）从 baseline 恢复，配置参数保留 current。
 * 用于 reset() —— 重置物理但保留用户配置修改（缺口/摩擦/质量等）。
 */
export function mergeResetState(
  current: PhysicsObject[],
  baseline: PhysicsObject[]
): PhysicsObject[] {
  const baselineById = new Map<number, PhysicsObject>()
  for (const o of baseline) baselineById.set(o.id, o)

  return current.map((obj) => {
    const b = baselineById.get(obj.id)
    if (!b) {
      // 无基线（防御性，播放期间不会新增物体）：保留当前状态，质点清轨迹
      if (obj.type === '质点' || obj.type === '刚体') return { ...obj, trail: [] } as ParticleObject
      return { ...obj } as PhysicsObject
    }

    if (obj.type === '质点' || obj.type === '刚体') {
      const p = obj as ParticleObject
      const bp = b as ParticleObject
      return {
        ...p, // 配置(mass/charge/radius/friction/color/name)保留 current
        x: bp.x,
        y: bp.y, // 位置从 baseline 恢复
        vx: bp.vx,
        vy: bp.vy, // 速度从 baseline 恢复
        trail: [], // 运行时重置
        prevX: undefined,
        prevY: undefined,
        constrainedArcGroupId: undefined
      } as ParticleObject
    }

    if (obj.type === 'line_segment') {
      const s = obj as SegmentObject
      const bs = b as SegmentObject
      const merged: SegmentObject = { ...s } // 配置保留 current
      if (s.velocity || s.movable) {
        // 传送带/板块：物理会平移，几何与法线从 baseline 恢复
        merged.x1 = bs.x1
        merged.y1 = bs.y1
        merged.x2 = bs.x2
        merged.y2 = bs.y2
        merged.normalX = bs.normalX
        merged.normalY = bs.normalY
      }
      // 静态线段：几何保留 current（用户可能编辑过端点）
      if (s.movable) {
        // 板块速度=物理状态，从 baseline 恢复
        merged.velocity = bs.velocity ? { ...bs.velocity } : undefined
      }
      // 传送带 velocity=belt speed=config，保留 current（已在 ...s 中）
      // 触发器运行时状态重置为初始（修复 deepCopyObjects 剥离导致的丢失）
      merged.arcGateState = s.arc
        ? {
            entryOpen: s.arc.entryGap?.initiallyOpen ?? false,
            exitOpen: s.arc.exitGap?.initiallyOpen ?? false,
            prevAngle: undefined,
            wasInside: undefined,
            entrySpotTriggered: false,
            exitSpotTriggered: false
          }
        : undefined
      return merged
    }

    // spring：无物理状态，保留 current
    return { ...obj } as PhysicsObject
  })
}

function reset(): void {
  // 基线：优先播放起始快照（保留用户配置 + 重置物理状态），回退 loadScene 快照
  const baseline = playStartSnapshot ?? snapshot
  const merged = mergeResetState(state.objects, baseline)
  state.objects.splice(0, state.objects.length)
  for (const o of merged) state.objects.push(o)
  state.time = 0
  state.isPlaying = false
  // forces/field/gravity/groundY 保留（用户配置）
  clearSnapshots()
}

function addForce(force: CustomForce): void {
  state.forces.push(force)
}

function removeForce(forceId: number): void {
  const idx = state.forces.findIndex((f) => f.id === forceId)
  if (idx !== -1) state.forces.splice(idx, 1)
}

function clearForces(): void {
  state.forces.splice(0, state.forces.length)
}

/**
 * 更新指定物体的单个属性
 */
function updateObjectProperty(id: number, key: string, value: unknown): void {
  const obj = state.objects.find((o) => o.id === id) as Record<string, unknown> | undefined
  if (obj) obj[key] = value
}

function addObject(obj: PhysicsObject): void {
  state.objects.push(obj)
}

function removeObject(id: number): void {
  const idx = state.objects.findIndex((o) => o.id === id)
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
  state.objects = objects.map((o) => ({ ...o, trail: [] }))
  state.forces = forces ? [...forces] : []
  state.field = field
    ? JSON.parse(JSON.stringify(field))
    : { type: 'none', E: { x: 0, y: 0 }, B: 0 }
  state.gravity = gravity !== undefined ? gravity : GRAVITY
  if (groundY === null) {
    state.groundY = GROUND_DISABLED
  } else if (groundY !== undefined) {
    state.groundY = groundY
  }
  state.time = 0
  state.isPlaying = false
  snapshot = JSON.parse(JSON.stringify(objects))
  playStartSnapshot = null // 新场景：重置回退到 loadScene 快照
  clearSnapshots()
}

export {
  state,
  snapshots,
  currentFrame,
  keyframeIndices,
  updatePhysics,
  reset,
  capturePlayStart,
  addForce,
  removeForce,
  clearForces,
  updateObjectProperty,
  addObject,
  removeObject,
  loadScene,
  PIXELS_PER_METER
}
