/**
 * AI 物理题目解析结果类型（从 useAIParser 抽取，供解析器/场景构建/题库共用）
 * 拆分为联合类型（ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring | ParsedPlate），
 * 遵循接口隔离原则（ISP）——每个类型只包含自己需要的字段
 */

/** 二维向量 */
export interface ParsedVec2 {
  x: number
  y: number
}

/** 物体基类：仅包含公共字段 */
export interface BaseParsedObject {
  id?: string
  type: 'ball' | 'platform' | 'arc' | 'spring' | 'plate'
}

/** 质点 / 刚体 */
export interface ParsedBall extends BaseParsedObject {
  type: 'ball'
  mass?: number
  charge?: number
  radius?: number
  initialPosition?: ParsedVec2
  initialVelocity?: ParsedVec2
  fixed?: boolean
  friction?: number
}

/** 线段平台 / 传送带 / 板块 */
export interface ParsedPlatform extends BaseParsedObject {
  type: 'platform'
  startPoint?: ParsedVec2
  endPoint?: ParsedVec2
  friction?: number
  beltVelocity?: ParsedVec2
  movable?: boolean
  mass?: number
}

/** 板块（带物理厚度的可移动长方形，独立类型）
 *  与 platform 区分：板块强制上下表面摩擦分离，带物理厚度与静态倾角 */
export interface ParsedPlate extends BaseParsedObject {
  type: 'plate'
  startPoint?: ParsedVec2
  endPoint?: ParsedVec2
  /** 物理厚度（米），参与碰撞；由用户按题目设定 */
  physicsThickness?: number
  /** 静态倾角（弧度），相对水平面；不动态旋转 */
  angle?: number
  /** 上表面摩擦系数（与物体接触） */
  frictionTop?: number
  /** 下表面摩擦系数（与地面/支撑面接触） */
  frictionBottom?: number
  mass?: number
}

/** 圆弧障碍物 */
export interface ParsedArc extends BaseParsedObject {
  type: 'arc'
  center?: ParsedVec2
  arcRadius?: number
  startAngle?: number
  endAngle?: number
  friction?: number
  /** 螺旋圆轨动态入口缺口（B点），运行时由状态机控制开关 */
  entryGap?: {
    centerAngle: number
    halfWidth: number
    initiallyOpen?: boolean
    triggerType?: 'angleCross' | 'enterRing'
    triggerAngle?: number
    triggerAction?: 'open' | 'close'
  }
  /** 螺旋圆轨动态出口缺口（E点），运行时由状态机控制开关 */
  exitGap?: {
    centerAngle: number
    halfWidth: number
    initiallyOpen?: boolean
    triggerType?: 'angleCross' | 'enterRing'
    triggerAngle?: number
    triggerAction?: 'open' | 'close'
  }
}

/** 弹簧 */
export interface ParsedSpring extends BaseParsedObject {
  type: 'spring'
  anchor?: ParsedVec2
  ballId?: string
  naturalLength?: number
  k?: number
}

/** 物体联合类型（判别联合：通过 type 字段收窄） */
export type ParsedObject = ParsedBall | ParsedPlatform | ParsedPlate | ParsedArc | ParsedSpring

export interface ParsedProblem {
  title?: string
  description?: string
  topic:
    | 'projectile'
    | 'slope'
    | 'elastic_collision'
    | 'magnetic_circle'
    | 'electric_deflection'
    | 'custom'
  objects: ParsedObject[]
  field: {
    type: 'none' | 'electric' | 'magnetic' | 'composite'
    E?: { x: number; y: number }
    B?: number
    /** 场区域（SI 单位，米）；undefined = 全场 */
    region?: { x: number; y: number; width: number; height: number }
  }
  gravity?: number
  groundY?: number | null
  worldWidth?: number
  simulationTime?: number
  question?: string
  /** 质点间碰撞恢复系数（0=完全非弹性，1=完全弹性），默认 1 */
  particleRestitution?: number
  /** 地面碰撞恢复系数，默认 0.6 */
  groundRestitution?: number
  /** 分步解题过程（可选，由 AI 解析生成并展示） */
  reasoning?: string[]
  /** 最终答案/结论（可选，由 AI 解析生成并展示） */
  answer?: string
}
