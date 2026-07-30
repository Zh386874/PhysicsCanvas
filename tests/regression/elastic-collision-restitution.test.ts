/**
 * 回归测试：弹性碰撞公式 restitution 整体乘法 bug
 *
 * Bug 描述（Lessons Learned）：
 * 旧实现 `vaNew=((ma-mb)*va+2*mb*vb)/(ma+mb)*restitution` 中 `*restitution` 乘在整个
 * 弹性公式上，restitution ∈ (0, 1) 时破坏动量守恒。仅 e=0（共速分支）与 e=1（标准弹性）
 * 两个端点守恒，中间值存在 bug。
 *
 * 修复（Phase 0）：
 * 改用通用动量守恒公式：
 *   vaNew = (ma*va + mb*vb + mb*e*(vb-va)) / (ma+mb)
 *   vbNew = (ma*va + mb*vb + ma*e*(va-vb)) / (ma+mb)
 * 推导：碰后相对速度 = -e × 碰前相对速度，联立动量守恒解得。
 *
 * 本回归测试守护：所有 e ∈ [0, 1] 均满足动量守恒，且相对速度按 -e 反向。
 */
import { describe, it, expect } from 'vitest'
import { checkParticleCollision } from '../../src/composables/useCollision'
import type { ParticleObject } from '../../src/composables/usePhysics'

function makeBall(over: Partial<ParticleObject> = {}): ParticleObject {
  return {
    id: 1,
    name: 'ball',
    type: '质点',
    mass: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 10,
    color: '#60a5fa',
    trail: [],
    ...over
  }
}

describe('回归：弹性碰撞公式 restitution 整体乘法 bug', () => {
  describe('动量守恒：所有 e ∈ [0, 1] 均满足', () => {
    // 测试矩阵：不同质量比 × 不同 e 值
    const cases: Array<{ ma: number; mb: number; va: number; vb: number; e: number }> = [
      { ma: 1, mb: 1, va: 10, vb: 0, e: 0.3 },
      { ma: 1, mb: 1, va: 10, vb: 0, e: 0.5 },
      { ma: 1, mb: 1, va: 10, vb: 0, e: 0.7 },
      { ma: 1, mb: 2, va: 10, vb: 0, e: 0.4 },
      { ma: 2, mb: 1, va: 10, vb: 0, e: 0.6 },
      { ma: 1, mb: 3, va: 15, vb: -5, e: 0.5 },
      { ma: 2, mb: 2, va: 8, vb: -3, e: 0.8 },
      { ma: 1, mb: 1, va: 10, vb: -10, e: 0.5 } // 对撞
    ]

    cases.forEach(({ ma, mb, va, vb, e }, idx) => {
      it(`case ${idx + 1}: ma=${ma} mb=${mb} va=${va} vb=${vb} e=${e} 动量守恒`, () => {
        // 球重叠确保触发碰撞（间距 15 < 20）
        const a = makeBall({ id: 1, x: 100, vx: va, mass: ma })
        const b = makeBall({ id: 2, x: 115, vx: vb, mass: mb })
        const pBefore = ma * va + mb * vb
        checkParticleCollision(a, b, e)
        const pAfter = ma * a.vx + mb * b.vx
        // 动量严格守恒（bug 旧实现 e∈(0,1) 会偏差）
        expect(pAfter).toBeCloseTo(pBefore, 5)
      })

      it(`case ${idx + 1}: ma=${ma} mb=${mb} va=${va} vb=${vb} e=${e} 相对速度按 -e 反向`, () => {
        const a = makeBall({ id: 1, x: 100, vx: va, mass: ma })
        const b = makeBall({ id: 2, x: 115, vx: vb, mass: mb })
        const relBefore = va - vb
        checkParticleCollision(a, b, e)
        const relAfter = a.vx - b.vx
        // 碰后相对速度 = -e × 碰前相对速度
        expect(relAfter).toBeCloseTo(-e * relBefore, 5)
      })
    })
  })

  it('e=1 完全弹性：等质量速度交换（端点回归）', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
    checkParticleCollision(a, b, 1.0)
    expect(a.vx).toBeCloseTo(0, 5)
    expect(b.vx).toBeCloseTo(10, 5)
  })

  it('e=0 完全非弹性：共速（端点回归）', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
    checkParticleCollision(a, b, 0)
    // 共速 v = (1*10 + 1*0)/2 = 5
    expect(a.vx).toBeCloseTo(5, 5)
    expect(b.vx).toBeCloseTo(5, 5)
    expect(a.vx - b.vx).toBeCloseTo(0, 5) // 相对速度为 0
  })

  it('e=0.5 中间值：能量损失符合公式（旧 bug 此处偏差最大）', () => {
    // 旧 bug：vaNew = ((ma-mb)*va + 2*mb*vb)/(ma+mb) * e
    // 新公式：vaNew = (ma*va + mb*vb + mb*e*(vb-va))/(ma+mb)
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
    checkParticleCollision(a, b, 0.5)
    // 等质量正碰 e=0.5：
    //   旧 bug: vaNew = (0*10 + 2*0)/2 * 0.5 = 0, vbNew = (0*0 + 2*10)/2 * 0.5 = 5
    //     动量 = 1*0 + 1*5 = 5 ≠ 10（破坏动量！）
    //   新公式: vaNew = (1*10 + 1*0 + 1*0.5*(0-10))/2 = (10-5)/2 = 2.5
    //          vbNew = (1*10 + 1*0 + 1*0.5*(10-0))/2 = (10+5)/2 = 7.5
    //     动量 = 2.5 + 7.5 = 10 ✓
    expect(a.vx).toBeCloseTo(2.5, 5)
    expect(b.vx).toBeCloseTo(7.5, 5)
    // 动量严格守恒
    expect(a.vx + b.vx).toBeCloseTo(10, 5)
  })

  it('e=0.3 质量不等：动量与相对速度均守恒', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 2 })
    checkParticleCollision(a, b, 0.3)
    const pAfter = 1 * a.vx + 2 * b.vx
    const relAfter = a.vx - b.vx
    expect(pAfter).toBeCloseTo(10, 5) // 动量守恒
    expect(relAfter).toBeCloseTo(-0.3 * 10, 5) // 相对速度 -3
  })

  it('能量损失：e 越小能量损失越大', () => {
    const run = (e: number) => {
      const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
      const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
      checkParticleCollision(a, b, e)
      return 0.5 * a.vx * a.vx + 0.5 * b.vx * b.vx
    }
    const ke1 = run(1.0) // 完全弹性：能量守恒 = 50
    const ke05 = run(0.5)
    const ke0 = run(0) // 完全非弹性：能量最低
    expect(ke1).toBeGreaterThan(ke05)
    expect(ke05).toBeGreaterThan(ke0)
    // e=1 时能量守恒：初始 KE = 0.5*1*100 = 50
    expect(ke1).toBeCloseTo(50, 1)
    // e=0 时：共速 v=5，KE = 2 * 0.5 * 25 = 25
    expect(ke0).toBeCloseTo(25, 1)
  })
})
