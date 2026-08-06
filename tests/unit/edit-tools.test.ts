/**
 * useEditTools 编辑工具层测试
 *
 * 覆盖导出的纯逻辑：isPlatformTool、createPlatformLikeObject（平台/传送带/板块）、
 * createRectPlate（矩形拖拽建造板块）。
 */
import { describe, it, expect } from 'vitest'
import {
  isPlatformTool,
  createPlatformLikeObject,
  createRectPlate
} from '../../src/composables/useEditTools'

describe('isPlatformTool 平台类工具判定', () => {
  it('platform/conveyor 属于平台类', () => {
    expect(isPlatformTool('platform')).toBe(true)
    expect(isPlatformTool('conveyor')).toBe(true)
  })

  it('plate/select/ball/arc 不属于平台类', () => {
    expect(isPlatformTool('plate')).toBe(false)
    expect(isPlatformTool('select')).toBe(false)
    expect(isPlatformTool('ball')).toBe(false)
    expect(isPlatformTool('arc')).toBe(false)
  })
})

describe('createPlatformLikeObject 平台', () => {
  it('平台为普通线段，无 velocity/movable', () => {
    const p = createPlatformLikeObject('platform', 0, 0, 200, 0, [])
    expect(p.name).toBe('平台1')
    expect(p.color).toBe('#475569')
    expect(p.type).toBe('line_segment')
    expect(p.velocity).toBeUndefined()
    expect(p.movable).toBeUndefined()
    expect(p.x1).toBe(0)
    expect(p.y1).toBe(0)
    expect(p.x2).toBe(200)
    expect(p.y2).toBe(0)
  })
})

describe('createPlatformLikeObject 传送带', () => {
  it('传送带带默认速度 100px/s 且颜色区分', () => {
    const c = createPlatformLikeObject('conveyor', 0, 0, 200, 0, [])
    expect(c.name).toBe('传送带1')
    expect(c.color).toBe('#0891b2')
    expect(c.velocity).toEqual({ x: 100, y: 0 })
  })
})

describe('createPlatformLikeObject 板块', () => {
  it('板块矩形模型：centerX/width 正确、movable=true、subtype=plate', () => {
    const pl = createPlatformLikeObject('plate', 0, 0, 200, 0, [])
    expect(pl.name).toBe('板块1')
    expect(pl.color).toBe('#dc2626')
    expect(pl.subtype).toBe('plate')
    expect(pl.movable).toBe(true)
    expect(pl.mass).toBe(1)
    expect(pl.width).toBe(200)
    expect(pl.centerX).toBe(100)
    expect(pl.centerY).toBe(2.5) // halfH = 0.1*50/2 = 2.5，normalY=-1 → centerY = 0 - (-1)*2.5
  })

  it('序号按板块子类型独立计数', () => {
    const plate1 = createPlatformLikeObject('plate', 0, 0, 100, 0, [])
    const plate2 = createPlatformLikeObject('plate', 0, 50, 100, 50, [plate1])
    expect(plate1.name).toBe('板块1')
    expect(plate2.name).toBe('板块2')
  })
})

describe('createRectPlate 矩形拖拽建造板块', () => {
  it('矩形尺寸与中心正确，恒为水平板块', () => {
    const r = createRectPlate(0, 0, 200, 20, [])
    expect(r.name).toBe('板块1')
    expect(r.subtype).toBe('plate')
    expect(r.movable).toBe(true)
    expect(r.width).toBe(200)
    expect(r.height).toBe(20)
    expect(r.centerX).toBe(100)
    expect(r.centerY).toBe(10)
    expect(r.x2).toBe(200)
    expect(r.y2).toBe(0)
  })
})
