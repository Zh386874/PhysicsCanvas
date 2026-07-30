/**
 * 单元测试：usePresets 预设场景
 *
 * 验证每个预设工厂返回结构合法、单位转换正确（m/s→像素/s、m/s²→像素/s²）、
 * 物体属性（质量/半径/位置/速度）符合预期、法线归一化。
 *
 * 覆盖：presetProjectile、presetIncline、presetCollision、presetMagnetic、
 *      presetElectric、customPreset、getPreset 路由、nextId。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  presetProjectile,
  presetIncline,
  presetCollision,
  presetMagnetic,
  presetElectric,
  customPreset,
  getPreset,
  nextId,
  type PresetScene
} from '../../src/composables/usePresets'
import { PIXELS_PER_METER } from '../../src/composables/usePhysics'
import type { ParticleObject, SegmentObject } from '../../src/composables/usePhysics'

const G = 9.8 * PIXELS_PER_METER

/** 断言预设场景结构合法 */
function expectValidPreset(p: PresetScene, expectedObjCount: number): void {
  expect(Array.isArray(p.objects)).toBe(true)
  expect(p.objects).toHaveLength(expectedObjCount)
  expect(Array.isArray(p.forces)).toBe(true)
  expect(p.field).toBeDefined()
  expect(p.field).toHaveProperty('type')
  expect(p.field).toHaveProperty('E')
  expect(p.field).toHaveProperty('B')
  expect(typeof p.gravity).toBe('number')
}

describe('usePresets — presetProjectile 抛体运动', () => {
  it('返回合法预设结构（1 个质点）', () => {
    const p = presetProjectile()
    expectValidPreset(p, 1)
    const ball = p.objects[0] as ParticleObject
    expect(ball.type).toBe('质点')
    expect(ball.id).toBe(1)
    expect(ball.name).toBe('抛体小球')
  })

  it('水平初速度 = 10 m/s 转像素', () => {
    const p = presetProjectile()
    const ball = p.objects[0] as ParticleObject
    expect(ball.vx).toBe(10 * PIXELS_PER_METER)
    expect(ball.vy).toBe(0)
  })

  it('重力为标准 G（490 像素/s²）', () => {
    expect(presetProjectile().gravity).toBe(G)
  })

  it('场类型为 none', () => {
    expect(presetProjectile().field.type).toBe('none')
  })

  it('groundY 未设置（默认水平地面）', () => {
    expect(presetProjectile().groundY).toBeUndefined()
  })
})

describe('usePresets — presetIncline 斜面滑块', () => {
  it('返回合法预设（1 质点 + 2 线段：斜面 + 地面）', () => {
    const p = presetIncline()
    expectValidPreset(p, 3)
    expect(p.objects[0].type).toBe('质点')
    expect((p.objects[1] as SegmentObject).type).toBe('line_segment')
    expect((p.objects[2] as SegmentObject).type).toBe('line_segment')
  })

  it('斜面法线归一化（模长=1）', () => {
    const p = presetIncline()
    const incline = p.objects[1] as SegmentObject
    const len = Math.hypot(incline.normalX, incline.normalY)
    expect(len).toBeCloseTo(1, 5)
  })

  it('斜面法线指向斜面上方（normalY 为负）', () => {
    const p = presetIncline()
    const incline = p.objects[1] as SegmentObject
    // 斜面从 (150,420) 到 (450,160)，法线指向上方（normalY < 0）
    expect(incline.normalY).toBeLessThan(0)
  })

  it('地面线段 y=500 且法线朝上', () => {
    const p = presetIncline()
    const ground = p.objects[2] as SegmentObject
    expect(ground.y1).toBe(500)
    expect(ground.y2).toBe(500)
    expect(ground.normalX).toBe(0)
    expect(ground.normalY).toBe(-1)
  })

  it('滑块有摩擦系数 friction=0.05', () => {
    const p = presetIncline()
    const ball = p.objects[0] as ParticleObject
    expect(ball.friction).toBe(0.05)
    expect(ball.mass).toBe(3.0)
  })

  it('groundY 为 null（禁用默认地面，由线段接管）', () => {
    expect(presetIncline().groundY).toBeNull()
  })
})

describe('usePresets — presetCollision 弹性碰撞', () => {
  it('返回两个相向运动的质点', () => {
    const p = presetCollision()
    expectValidPreset(p, 2)
    const a = p.objects[0] as ParticleObject
    const b = p.objects[1] as ParticleObject
    expect(a.type).toBe('质点')
    expect(b.type).toBe('质点')
    expect(a.vx).toBeGreaterThan(0) // A 向右
    expect(b.vx).toBeLessThan(0) // B 向左
  })

  it('质量不同（A=1, B=2）', () => {
    const p = presetCollision()
    expect((p.objects[0] as ParticleObject).mass).toBe(1.0)
    expect((p.objects[1] as ParticleObject).mass).toBe(2.0)
  })

  it('A 速度 = 8 m/s，B 速度 = -3 m/s 转像素', () => {
    const p = presetCollision()
    expect((p.objects[0] as ParticleObject).vx).toBe(8 * PIXELS_PER_METER)
    expect((p.objects[1] as ParticleObject).vx).toBe(-3 * PIXELS_PER_METER)
  })

  it('两球 y 相同（水平对齐碰撞）', () => {
    const p = presetCollision()
    expect((p.objects[0] as ParticleObject).y).toBe((p.objects[1] as ParticleObject).y)
  })
})

describe('usePresets — presetMagnetic 磁场圆周', () => {
  it('返回 1 个带电粒子 + magnetic 场', () => {
    const p = presetMagnetic()
    expectValidPreset(p, 1)
    expect(p.field.type).toBe('magnetic')
    expect(p.field.B).toBe(1)
  })

  it('粒子带正电荷（charge=1）', () => {
    const p = presetMagnetic()
    expect((p.objects[0] as ParticleObject).charge).toBe(1)
  })

  it('重力为 0（纯磁场运动）', () => {
    expect(presetMagnetic().gravity).toBe(0)
  })

  it('粒子初速度非零（圆周运动前提）', () => {
    const p = presetMagnetic()
    const ball = p.objects[0] as ParticleObject
    expect(Math.hypot(ball.vx, ball.vy)).toBeGreaterThan(0)
  })
})

describe('usePresets — presetElectric 电场偏转', () => {
  it('返回 1 个带电粒子 + electric 场', () => {
    const p = presetElectric()
    expectValidPreset(p, 1)
    expect(p.field.type).toBe('electric')
  })

  it('电场强度 E.y = -1000（向上电场）', () => {
    const p = presetElectric()
    expect(p.field.E?.y).toBe(-1000)
  })

  it('粒子水平初速度 = 6 m/s 转像素', () => {
    const p = presetElectric()
    expect((p.objects[0] as ParticleObject).vx).toBe(6 * PIXELS_PER_METER)
  })

  it('重力为标准 G', () => {
    expect(presetElectric().gravity).toBe(G)
  })
})

describe('usePresets — customPreset 自定义场景', () => {
  it('返回空 objects 数组', () => {
    const p = customPreset()
    expectValidPreset(p, 0)
  })

  it('场为 none，重力为 G，groundY=null', () => {
    const p = customPreset()
    expect(p.field.type).toBe('none')
    expect(p.gravity).toBe(G)
    expect(p.groundY).toBeNull()
  })
})

describe('usePresets — getPreset 路由', () => {
  it('"抛体运动" → presetProjectile', () => {
    const p = getPreset('抛体运动')
    expect(p.objects).toHaveLength(1)
    expect((p.objects[0] as ParticleObject).name).toBe('抛体小球')
  })

  it('"斜面滑块" → presetIncline（3 物体）', () => {
    expect(getPreset('斜面滑块').objects).toHaveLength(3)
  })

  it('"弹性碰撞" → presetCollision（2 物体）', () => {
    expect(getPreset('弹性碰撞').objects).toHaveLength(2)
  })

  it('"磁场圆周" → presetMagnetic（magnetic 场）', () => {
    expect(getPreset('磁场圆周').field.type).toBe('magnetic')
  })

  it('"电场偏转" → presetElectric（electric 场）', () => {
    expect(getPreset('电场偏转').field.type).toBe('electric')
  })

  it('"自定义" → customPreset（空场景）', () => {
    expect(getPreset('自定义').objects).toHaveLength(0)
  })

  it('未知场景名回退到 presetProjectile', () => {
    const p = getPreset('不存在的场景')
    expect(p.objects).toHaveLength(1)
    expect((p.objects[0] as ParticleObject).name).toBe('抛体小球')
  })
})

describe('usePresets — nextId 全局自增', () => {
  beforeEach(() => {
    // nextId 内部用模块级 idCounter，测试验证单调递增（不重置以避免污染其他测试）
  })

  it('每次调用返回递增 id', () => {
    const a = nextId()
    const b = nextId()
    const c = nextId()
    expect(b).toBe(a + 1)
    expect(c).toBe(b + 1)
  })

  it('返回值 > 100（初始值）', () => {
    expect(nextId()).toBeGreaterThan(100)
  })
})

describe('usePresets — 单位转换一致性', () => {
  it('所有预设重力要么是 G 要么是 0', () => {
    const presets = [
      presetProjectile(),
      presetIncline(),
      presetCollision(),
      presetMagnetic(),
      presetElectric(),
      customPreset()
    ]
    for (const p of presets) {
      expect([G, 0]).toContain(p.gravity)
    }
  })

  it('所有预设 forces 为空数组（仅靠场和重力驱动）', () => {
    const presets = [
      presetProjectile(),
      presetIncline(),
      presetCollision(),
      presetMagnetic(),
      presetElectric(),
      customPreset()
    ]
    for (const p of presets) {
      expect(p.forces).toEqual([])
    }
  })

  it('质点 trail 初始化为空数组', () => {
    const presets = [presetProjectile(), presetCollision(), presetMagnetic(), presetElectric()]
    for (const p of presets) {
      for (const obj of p.objects) {
        if (obj.type === '质点') {
          expect((obj as ParticleObject).trail).toEqual([])
        }
      }
    }
  })
})
