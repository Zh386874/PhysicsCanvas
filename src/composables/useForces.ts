/**
 * 力计算策略层：力注册表 + 策略模式
 * 从 usePhysics.ts 的 subStepPhysics 拆分，遵循 OCP（开闭原则）
 * 添加新力（如空气阻力、浮力）只需调用 registerForce 注册新策略，
 * 无需修改 subStepPhysics 核心逻辑
 *
 * 依赖说明：useForces 仅 `import type` usePhysics 的类型（编译时移除），
 * usePhysics 运行时 import useForces 的 calculateTotalForce，无循环依赖
 */
import type { PhysicsState, ParticleObject, SpringObject } from './usePhysics'

/** 力计算上下文 */
export interface ForceContext {
  state: PhysicsState
  particle: ParticleObject
}

/** 力计算策略：接收上下文，返回该力对粒子的 xy 分量 */
export type ForceCalculator = (ctx: ForceContext) => { fx: number; fy: number }

/** 力注册表（按注册顺序执行） */
const forceCalculators: ForceCalculator[] = []

/**
 * 注册力计算策略
 * 添加新力时调用此函数，无需修改 subStepPhysics
 */
export function registerForce(calculator: ForceCalculator): void {
  forceCalculators.push(calculator)
}

/**
 * 计算粒子所受合力（遍历所有已注册的力计算器）
 */
export function calculateTotalForce(state: PhysicsState, particle: ParticleObject): { fx: number; fy: number } {
  const ctx: ForceContext = { state, particle }
  let fx = 0
  let fy = 0
  for (const calc of forceCalculators) {
    const f = calc(ctx)
    fx += f.fx
    fy += f.fy
  }
  return { fx, fy }
}

// ===== 默认力注册（模块加载时执行）=====

/**
 * 1. 重力：F = m·g（g 为像素加速度，向下为正）
 */
registerForce(({ state, particle }) => ({
  fx: 0,
  fy: particle.mass * state.gravity
}))

/**
 * 2. 自定义力：用户通过 addForce 添加的定向力
 */
registerForce(({ state, particle }) => {
  let fx = 0
  let fy = 0
  for (const force of state.forces) {
    if (force.targetId === particle.id) {
      fx += force.fx
      fy += force.fy
    }
  }
  return { fx, fy }
})

/**
 * 3. 场力：电场力 qE + 洛伦兹力 qv×B（可同时存在）
 *    E 需乘 scale（已由 useSceneBuilder 转换为像素加速度单位）
 *    B 不需缩放（v 已是 px/s，a=qvB/m 直接是 px/s²）
 */
registerForce(({ state, particle }) => {
  const charge = particle.charge || 0
  if (charge === 0) return { fx: 0, fy: 0 }
  let fx = 0
  let fy = 0
  // 电场力 qE（多场同时支持，根据 E 值是否非零判断）
  if (state.field.E.x !== 0 || state.field.E.y !== 0) {
    fx += charge * state.field.E.x
    fy += charge * state.field.E.y
  }
  // 洛伦兹力 qv×B（B 沿 z 轴，叉积展开）
  if (state.field.B !== 0) {
    fx += charge * particle.vy * state.field.B
    fy += -charge * particle.vx * state.field.B
  }
  return { fx, fy }
})

/**
 * 4. 弹簧力：F = -k·x（x 为形变量，k 为劲度系数）
 *    k 为 SI 单位 N/m，形变用像素。F_px = -k * x_px
 *    推导：a_px = F_SI/m * scale = (-k * x_m / m) * scale = -k * (x_px/scale) / m * scale = -k * x_px / m
 *    故 F_px = a_px * m = -k * x_px，k 无需额外转换
 */
registerForce(({ state, particle }) => {
  let fx = 0
  let fy = 0
  for (const s of state.objects) {
    if (s.type !== 'spring') continue
    const spring = s as SpringObject
    if (spring.ballId !== particle.id) continue
    const dx = particle.x - spring.anchorX
    const dy = particle.y - spring.anchorY
    const currentLen = Math.hypot(dx, dy)
    if (currentLen < 1e-6) continue
    const deformation = currentLen - spring.naturalLength
    const forceMag = -spring.k * deformation
    fx += forceMag * dx / currentLen
    fy += forceMag * dy / currentLen
  }
  return { fx, fy }
})
