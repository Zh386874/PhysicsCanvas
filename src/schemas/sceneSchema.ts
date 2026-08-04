/**
 * 场景导入 Zod Schema
 * 用于校验导入的 JSON 场景数据，防止恶意/畸形数据导致运行时错误
 */
import { z } from 'zod'

/** 二维向量 */
const Vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})

/** 线段物体 */
const LineSegmentSchema = z.object({
  id: z.number().finite(),
  name: z.string().optional().default('未命名'),
  type: z.literal('line_segment'),
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
  restitution: z.number().finite().optional().default(0.3),
  normalX: z.number().optional().default(0),
  normalY: z.number().optional().default(-1),
  friction: z.number().optional().default(0),
  color: z.string().optional()
})

/** 弹簧物体 */
const SpringSchema = z.object({
  id: z.number().finite(),
  name: z.string().optional().default('未命名'),
  type: z.literal('spring'),
  anchorX: z.number().finite(),
  anchorY: z.number().finite(),
  naturalLength: z.number().finite(),
  k: z.number().finite(),
  ballId: z.number().finite()
})

/** 质点 / 刚体 */
const ParticleSchema = z.object({
  id: z.number().finite(),
  name: z.string().optional().default('未命名'),
  type: z.union([z.literal('质点'), z.literal('刚体')]),
  x: z.number().finite(),
  y: z.number().finite(),
  vx: z.number().finite().optional().default(0),
  vy: z.number().finite().optional().default(0),
  mass: z.number().positive().finite().optional().default(1),
  radius: z.number().positive().finite().optional().default(15),
  charge: z.number().finite().optional().default(0),
  color: z.string().optional(),
  friction: z.number().optional().default(0)
})

/** 场景物体联合 schema */
const SceneObjectSchema = z.discriminatedUnion('type', [
  ParticleSchema,
  LineSegmentSchema,
  SpringSchema
])

/** 场配置 */
const FieldSchema = z.object({
  type: z.enum(['none', 'electric', 'magnetic', 'composite']).optional().default('none'),
  E: Vec2Schema.optional().default({ x: 0, y: 0 }),
  B: z.number().optional().default(0)
})

/** 新格式场景数据 */
const SceneDataSchema = z.object({
  version: z.number().optional(),
  objects: z.array(SceneObjectSchema).min(1, '场景至少包含一个物体'),
  gravity: z.number().finite().optional().default(490),
  groundY: z.union([z.number().finite(), z.null()]).optional().default(400),
  field: FieldSchema.optional().default({ type: 'none', E: { x: 0, y: 0 }, B: 0 })
})

/** 旧格式：纯物体数组 */
const LegacySceneSchema = z.array(SceneObjectSchema).min(1, '场景至少包含一个物体')

export { SceneDataSchema, LegacySceneSchema, SceneObjectSchema }
export type { SceneObjectSchema as SceneObjectType }
