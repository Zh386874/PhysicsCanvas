/**
 * 回归测试：非弹性碰撞共速公式 vCommon 守恒
 *
 * Lessons Learned：
 * "Non-elastic collisions (restitution=0) require calculation of common velocity
 *  using conservation of momentum (vCommon = (ma·va + mb·vb)/(ma+mb)) to prevent
 *  energy errors"
 *
 * 当 restitution=0 时，碰后两球共速，使用动量守恒解得 vCommon。
 * 错误实现可能直接取平均 v=(va+vb)/2（仅等质量正确），或归零两球速度。
 *
 * 本回归测试守护：restitution=0 时两球共速 = vCommon，且动量严格守恒。
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

describe('回归：非弹性碰撞共速 vCommon', () => {
  it('等质量同向速度差 → 共速 = 平均值', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
    checkParticleCollision(a, b, 0)
    // vCommon = (1*10 + 1*0)/2 = 5
    expect(a.vx).toBeCloseTo(5, 5)
    expect(b.vx).toBeCloseTo(5, 5)
  })

  it('不等质量 → 共速 = 动量/总质量（非简单平均）', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 3 })
    checkParticleCollision(a, b, 0)
    // vCommon = (1*10 + 3*0)/4 = 2.5（不是简单平均 5）
    expect(a.vx).toBeCloseTo(2.5, 5)
    expect(b.vx).toBeCloseTo(2.5, 5)
    // 简单平均会得到 5，错！本测试守护非简单平均
    expect(a.vx).not.toBeCloseTo(5, 5)
  })

  it('对撞（反向速度）→ 共速可能为 0', () => {
    // m=1, va=10; m=1, vb=-10 → vCommon = 0
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: -10, mass: 1 })
    checkParticleCollision(a, b, 0)
    expect(a.vx).toBeCloseTo(0, 5)
    expect(b.vx).toBeCloseTo(0, 5)
  })

  it('动量守恒：所有质量/速度组合 vCommon 均满足 m1v1+m2v2=(m1+m2)vCommon', () => {
    const cases = [
      { ma: 1, mb: 1, va: 10, vb: 0 },
      { ma: 1, mb: 2, va: 10, vb: 0 },
      { ma: 2, mb: 1, va: 10, vb: 0 },
      { ma: 3, mb: 2, va: 15, vb: -5 },
      { ma: 1, mb: 5, va: 0, vb: 20 }
    ]
    cases.forEach(({ ma, mb, va, vb }, idx) => {
      const a = makeBall({ id: 1, x: 100, vx: va, mass: ma })
      const b = makeBall({ id: 2, x: 115, vx: vb, mass: mb })
      checkParticleCollision(a, b, 0)
      const pBefore = ma * va + mb * vb
      const pAfter = ma * a.vx + mb * b.vx
      expect(pAfter).toBeCloseTo(pBefore, 5)
      // 两球共速
      expect(a.vx).toBeCloseTo(b.vx, 5)
    })
  })

  it('共速后相对速度严格为 0', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 2 })
    checkParticleCollision(a, b, 0)
    expect(a.vx - b.vx).toBeCloseTo(0, 5)
  })

  it('能量损失最大（共速状态动能最低）', () => {
    const a = makeBall({ id: 1, x: 100, vx: 10, mass: 1 })
    const b = makeBall({ id: 2, x: 115, vx: 0, mass: 1 })
    const keBefore = 0.5 * 1 * 100 + 0.5 * 1 * 0 // 50
    checkParticleCollision(a, b, 0)
    const keAfter = 0.5 * 1 * a.vx * a.vx + 0.5 * 1 * b.vx * b.vx
    // vCommon=5, 共速后 KE = 2 * 0.5 * 25 = 25
    expect(keAfter).toBeCloseTo(25, 5)
    expect(keAfter).toBeLessThan(keBefore)
  })

  it('质量悬殊（m1 >> m2）→ 共速接近大质量球初速', () => {
    // 大球几乎不动，小球撞上后被同化
    const a = makeBall({ id: 1, x: 100, vx: 0, mass: 100 }) // 大球静止
    const b = makeBall({ id: 2, x: 115, vx: 50, mass: 1 }) // 小球高速
    checkParticleCollision(a, b, 0)
    // vCommon = (0 + 1*50)/101 ≈ 0.495，接近大球初速 0
    expect(a.vx).toBeCloseTo(50 / 101, 3)
    expect(b.vx).toBeCloseTo(50 / 101, 3)
  })
})
