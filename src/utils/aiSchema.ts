/**
 * AI 题目解析结果 schema 校验（zod v4）
 * 提供：parseAIProblem —— 强类型解析（失败抛可读错误）；
 *      sanitizeParsedProblem —— 对非有限值做钳制/兜底；
 *      validateParsedProblem —— 供 buildScene 前置校验（bool 语义）
 */
import { z } from 'zod'
import type { ParsedProblem, ParsedObject } from '../types/aiProblem'

/** 只能为有限数（排除 NaN/Infinity） */
const finite = () => z.number().finite()

const vec2Schema = z.object({
  x: finite(),
  y: finite()
})

/** 弧线缺口 schema */
const gapSchema = z
  .object({
    centerAngle: finite(),
    halfWidth: finite(),
    initiallyOpen: z.boolean().optional(),
    triggerType: z.enum(['angleCross', 'enterRing']).optional(),
    triggerAngle: finite().optional(),
    triggerAction: z.enum(['open', 'close']).optional()
  })
  .optional()

const ballSchema = z.object({
  id: z.string().optional(),
  type: z.literal('ball'),
  mass: finite().positive().optional(),
  charge: finite().optional(),
  radius: finite().positive().optional(),
  initialPosition: vec2Schema.optional(),
  initialVelocity: vec2Schema.optional(),
  fixed: z.boolean().optional(),
  friction: finite().optional()
})

const platformSchema = z.object({
  id: z.string().optional(),
  type: z.literal('platform'),
  startPoint: vec2Schema.optional(),
  endPoint: vec2Schema.optional(),
  friction: finite().optional(),
  beltVelocity: vec2Schema.optional(),
  movable: z.boolean().optional(),
  mass: finite().positive().optional()
})

const plateSchema = z.object({
  id: z.string().optional(),
  type: z.literal('plate'),
  startPoint: vec2Schema.optional(),
  endPoint: vec2Schema.optional(),
  physicsThickness: finite().positive().optional(),
  angle: finite().optional(),
  frictionTop: finite().optional(),
  frictionBottom: finite().optional(),
  mass: finite().positive().optional()
})

const arcSchema = z.object({
  id: z.string().optional(),
  type: z.literal('arc'),
  center: vec2Schema.optional(),
  arcRadius: finite().positive().optional(),
  startAngle: finite().optional(),
  endAngle: finite().optional(),
  friction: finite().optional(),
  entryGap: gapSchema,
  exitGap: gapSchema
})

const springSchema = z.object({
  id: z.string().optional(),
  type: z.literal('spring'),
  anchor: vec2Schema.optional(),
  ballId: z.string().optional(),
  naturalLength: finite().positive().optional(),
  k: finite().positive().optional()
})

/** 判别联合：type 字段收窄 */
const objectSchema = z.discriminatedUnion('type', [
  ballSchema,
  platformSchema,
  plateSchema,
  arcSchema,
  springSchema
])

const fieldSchema = z.object({
  type: z.enum(['none', 'electric', 'magnetic', 'composite']),
  E: vec2Schema.optional(),
  B: finite().optional(),
  region: z
    .object({
      x: finite(),
      y: finite(),
      width: finite(),
      height: finite()
    })
    .optional()
})

const problemSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  topic: z.enum([
    'projectile',
    'slope',
    'elastic_collision',
    'magnetic_circle',
    'electric_deflection',
    'custom'
  ]),
  objects: z.array(objectSchema),
  field: fieldSchema,
  gravity: finite().optional(),
  groundY: finite().nullable().optional(),
  worldWidth: finite().optional(),
  simulationTime: finite().optional(),
  question: z.string().optional(),
  particleRestitution: finite().min(0).max(1).optional(),
  groundRestitution: finite().min(0).max(1).optional(),
  reasoning: z.array(z.string()).optional(),
  answer: z.string().optional()
})

/** 解析并强类型返回；失败抛带可读原因的 Error */
export function parseAIProblem(raw: unknown): ParsedProblem {
  const result = problemSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first?.path?.join('.') || '根'
    const reason = first?.message || 'unknown'
    throw new Error(`AI 输出校验失败（${where}: ${reason}），正在重新解析…`)
  }
  return result.data as ParsedProblem
}

/** 对非有限值/非法物理量做钳制兜底（供构建前调用，避免后续崩溃） */
export function sanitizeParsedProblem(p: ParsedProblem): ParsedProblem {
  const safe = (v: number | undefined, dflt: number): number => {
    if (v === undefined || !Number.isFinite(v)) return dflt
    return v
  }
  const clone: ParsedProblem = JSON.parse(JSON.stringify(p))
  clone.objects = clone.objects.map((obj: ParsedObject) => {
    if (obj.type === 'ball') {
      obj.mass = safe(obj.mass, 1)
      obj.radius = Math.abs(safe(obj.radius, 0.2)) || 0.2
      if (obj.initialVelocity)
        obj.initialVelocity = {
          x: safe(obj.initialVelocity.x, 0),
          y: safe(obj.initialVelocity.y, 0)
        }
      if (obj.initialPosition)
        obj.initialPosition = {
          x: safe(obj.initialPosition.x, 0),
          y: safe(obj.initialPosition.y, 0)
        }
    } else if (obj.type === 'platform' || obj.type === 'plate') {
      obj.mass = safe(obj.mass, 1)
      if (obj.startPoint)
        obj.startPoint = { x: safe(obj.startPoint.x, 0), y: safe(obj.startPoint.y, 0) }
      if (obj.endPoint) obj.endPoint = { x: safe(obj.endPoint.x, 1), y: safe(obj.endPoint.y, 0) }
    } else if (obj.type === 'arc') {
      obj.arcRadius = Math.abs(safe(obj.arcRadius, 1)) || 1
      obj.startAngle = safe(obj.startAngle, 0)
      obj.endAngle = safe(obj.endAngle, Math.PI)
    } else if (obj.type === 'spring') {
      obj.naturalLength = Math.abs(safe(obj.naturalLength, 1)) || 1
      obj.k = Math.abs(safe(obj.k, 50)) || 50
    }
    return obj
  })
  clone.gravity = safe(clone.gravity, 9.8)
  if (clone.field?.E) clone.field.E = { x: safe(clone.field.E.x, 0), y: safe(clone.field.E.y, 0) }
  clone.field.B = safe(clone.field.B, 0)
  return clone
}

/** 前置物理量校验（bool 语义，供 buildScene 使用） */
export function validateParsedProblem(p: ParsedProblem): { ok: boolean; message?: string } {
  if (!p.objects || p.objects.length === 0) {
    return { ok: false, message: '未识别到任何物体' }
  }
  for (let i = 0; i < p.objects.length; i++) {
    const obj = p.objects[i]
    if ('mass' in obj && obj.mass !== undefined && !(obj.mass > 0)) {
      return { ok: false, message: `第 ${i + 1} 个物体质量非法（须 > 0）` }
    }
    if ('radius' in obj && obj.radius !== undefined && !(obj.radius > 0)) {
      return { ok: false, message: `第 ${i + 1} 个物体半径非法（须 > 0）` }
    }
  }
  const nums: number[] = []
  if (p.gravity !== undefined) nums.push(p.gravity)
  if (p.field?.B !== undefined) nums.push(p.field.B)
  if (p.field?.E?.x !== undefined) nums.push(p.field.E.x, p.field.E.y)
  if (nums.some((n) => !Number.isFinite(n))) {
    return { ok: false, message: '场强/重力存在非法数值（须为有限数）' }
  }
  return { ok: true }
}
