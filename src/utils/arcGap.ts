/** 弧线缺口角度换算（度数视图 ↔ 弧度存储） */

export interface ArcGapLike {
  centerAngle?: number
  halfWidth?: number
  triggerAngle?: number
}

export const RAD_TO_DEG = 180 / Math.PI

/** 弧度 → 归一化到 [0,360) 的度数 */
export function deg360(rad: number): number {
  return (((rad * RAD_TO_DEG) % 360) + 360) % 360
}

/** 缺口起始角度（°） */
export function gapStartDeg(gap?: ArcGapLike): number {
  return gap ? deg360((gap.centerAngle || 0) - (gap.halfWidth || 0)) : 0
}

/** 缺口终止角度（°） */
export function gapEndDeg(gap?: ArcGapLike): number {
  return gap ? deg360((gap.centerAngle || 0) + (gap.halfWidth || 0)) : 0
}

/** 缺口触发角度（°） */
export function triggerAngleDeg(gap?: ArcGapLike): number {
  return gap && gap.triggerAngle !== undefined ? deg360(gap.triggerAngle) : 0
}

/**
 * 由起始/终止角度（°）求 centerAngle/halfWidth（rad）。
 * 按「从起始到终止的前向跨度」计算，跨 0°/360° 时取短弧中点，
 * 避免算术平均取到长弧。halfWidth 恒 >= 0。
 */
export function gapFromDegrees(
  startDeg: number,
  endDeg: number
): { centerAngle: number; halfWidth: number } {
  const startNorm = ((startDeg % 360) + 360) % 360
  const endNorm = ((endDeg % 360) + 360) % 360
  let delta = endNorm - startNorm
  if (delta < 0) delta += 360
  const centerNorm = (((startNorm + delta / 2) % 360) + 360) % 360
  return {
    centerAngle: (centerNorm * Math.PI) / 180,
    halfWidth: (delta / 2) * (Math.PI / 180)
  }
}
