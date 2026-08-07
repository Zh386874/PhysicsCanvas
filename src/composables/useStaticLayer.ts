/**
 * 离屏静态层：网格 + 地面 预渲染
 * 静态元素（网格、地面）只在平移 / 缩放 / 画布尺寸 / 地面 y 坐标变化时重绘，
 * 播放时输入不变则只渲染一次，主渲染循环每帧 blit（drawImage）一次，减少重复绘制。
 */
import { drawGrid, drawGround } from './useCanvasRenderer'
import type { RenderContext } from './useCanvasRenderer'

/** 画布 2D 底色：与主画布保持一致（VS 2019 Dark 纯 #1e1e1e） */
const BACKGROUND_COLOR = '#1e1e1e'

/** 静态层上次渲染输入缓存（用于脏检测） */
export interface StaticLayerCache {
  width: number
  height: number
  offsetX: number
  offsetY: number
  scale: number
  groundY: number
}

export function createEmptyStaticLayerCache(): StaticLayerCache {
  return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 0, groundY: Number.NaN }
}

/**
 * 判断静态层是否需要重绘（纯函数，可测试）。
 * 任一输入（尺寸 / 平移 / 缩放 / 地面）与缓存不同即返回 true。
 */
export function isStaticLayerDirty(
  cache: StaticLayerCache,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  groundY: number
): boolean {
  return (
    width !== cache.width ||
    height !== cache.height ||
    offsetX !== cache.offsetX ||
    offsetY !== cache.offsetY ||
    scale !== cache.scale ||
    groundY !== cache.groundY
  )
}

/** 模块级状态：离屏 canvas + 渲染输入缓存 */
const layerState: { cache: StaticLayerCache; canvas: HTMLCanvasElement | null } = {
  cache: createEmptyStaticLayerCache(),
  canvas: null
}

/** 供组件调用：基于模块缓存判断是否需要重绘静态层 */
export function shouldRenderStaticLayer(
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  groundY: number
): boolean {
  return isStaticLayerDirty(layerState.cache, width, height, offsetX, offsetY, scale, groundY)
}

/**
 * 渲染静态层到离屏 canvas。
 * 调用方应先用 shouldRenderStaticLayer 确认输入变化，避免每次全量重绘。
 */
export function renderStaticLayer(
  dpr: number,
  cssW: number,
  cssH: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  groundY: number
): void {
  if (!layerState.canvas) layerState.canvas = document.createElement('canvas')
  const canvas = layerState.canvas
  const width = Math.floor(cssW * dpr)
  const height = Math.floor(cssH * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 与主画布一致：先应用 dpr 变换，后续用 CSS 像素坐标
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = BACKGROUND_COLOR
  ctx.fillRect(0, 0, cssW, cssH)
  // 应用世界变换后绘制网格 + 地面
  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)
  const rc: RenderContext = {
    ctx,
    cssW,
    cssH,
    dpr,
    worldOffset: { x: offsetX, y: offsetY },
    worldScale: scale
  }
  drawGrid(rc)
  drawGround(rc, groundY)
  ctx.restore()

  // 记录本次渲染输入，供下次脏检测
  layerState.cache.width = width
  layerState.cache.height = height
  layerState.cache.offsetX = offsetX
  layerState.cache.offsetY = offsetY
  layerState.cache.scale = scale
  layerState.cache.groundY = groundY
}

/** 获取离屏静态 canvas（供每帧 blit），未渲染时返回 null */
export function getStaticCanvas(): HTMLCanvasElement | null {
  return layerState.canvas
}

/** 重置静态层（组件卸载时释放引用与缓存，避免内存残留） */
export function resetStaticLayer(): void {
  layerState.canvas = null
  layerState.cache = createEmptyStaticLayerCache()
}
