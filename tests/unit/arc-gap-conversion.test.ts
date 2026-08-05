/**
 * 单元测试：utils/arcGap 角度换算
 * 覆盖 deg360 归一化、端点换算、gapFromDegrees 常规/跨 0°/起始>终止、triggerAngle 换算。
 */
import { describe, it, expect } from 'vitest'
import {
  deg360,
  gapStartDeg,
  gapEndDeg,
  gapFromDegrees,
  triggerAngleDeg
} from '../../src/utils/arcGap'

describe('arcGap 角度换算', () => {
  it('deg360 归一化到 [0,360)', () => {
    expect(deg360(0)).toBe(0)
    expect(deg360(Math.PI)).toBeCloseTo(180, 5)
    expect(deg360(-Math.PI / 2)).toBeCloseTo(270, 5)
    expect(deg360(Math.PI * 2)).toBeCloseTo(0, 5)
  })

  it('gapStartDeg/gapEndDeg 由中心角与半宽换算端点', () => {
    const gap = { centerAngle: 0, halfWidth: 0.3 }
    expect(gapStartDeg(gap)).toBeCloseTo(360 - (0.3 * 180) / Math.PI, 5)
    expect(gapEndDeg(gap)).toBeCloseTo((0.3 * 180) / Math.PI, 5)
  })

  it('gapFromDegrees 常规缺口往返一致', () => {
    const r = gapFromDegrees(126.9, 172.7)
    expect(r.centerAngle).toBeCloseTo(2.614, 2) // ≈149.8°
    expect(r.halfWidth).toBeCloseTo(0.4, 2)
  })

  it('gapFromDegrees 跨 0°/360° 缺口取短弧中点（回归）', () => {
    // 默认入口缺口 centerAngle=0, halfWidth=0.3 → 显示 [342.8°, 17.2°]
    const r = gapFromDegrees(342.8, 17.2)
    expect(r.centerAngle).toBeCloseTo(0, 2) // 不应是 180°
    expect(r.halfWidth).toBeCloseTo(0.3, 2)
  })

  it('gapFromDegrees 起始>终止时按前向跨度计算', () => {
    const r = gapFromDegrees(10, 250)
    expect(r.centerAngle).toBeCloseTo((130 * Math.PI) / 180, 4)
    expect(r.halfWidth).toBeCloseTo((120 * Math.PI) / 180, 4)
  })

  it('triggerAngleDeg 弧度→度', () => {
    expect(triggerAngleDeg({ triggerAngle: -Math.PI / 2 })).toBeCloseTo(270, 5)
    expect(triggerAngleDeg({})).toBe(0)
  })
})
