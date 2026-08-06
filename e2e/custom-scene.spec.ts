import { test, expect } from '@playwright/test'

/**
 * E2E 流程 2：自定义场景建物 + 参数编辑 + 播放/重置
 * 默认「自定义」场景 → AI 本地解析创建「抛体运动」→ 选中物体 → 编辑名称 → 播放/重置
 */
test('自定义场景：AI 解析创建场景 → 选中物体 → 编辑参数 → 播放/重置', async ({ page }) => {
  await page.goto('/')

  // 默认即「自定义」场景
  await expect(page.locator('.scene-tabs .tab', { hasText: '自定义' })).toHaveClass(/active/)

  // 平抛题目 → 命中「抛体运动」预设
  await page.locator('.question-input').fill('一个质量为1kg的小球以10m/s的水平速度平抛')
  await page.locator('.parse-btn').click()

  // 物体列表出现条目
  const firstItem = page.locator('.object-list .item').first()
  await expect(firstItem).toBeVisible()

  // 选中物体 → 属性面板出现
  await firstItem.click()
  const propName = page.locator('.property-panel .field input').first()
  await expect(propName).toBeVisible()

  // 编辑名称字段
  await propName.fill('小球A')
  await expect(propName).toHaveValue('小球A')

  // AI 解析后自动播放 → 播放按钮为「暂停」
  const playBtn = page.locator('.control-bar .btn').first()
  await expect(playBtn).toHaveText('暂停')
  await playBtn.click()
  await expect(playBtn).toHaveText('播放')

  // 重置
  await page.locator('.control-bar .btn').filter({ hasText: '重置' }).click()
  await expect(playBtn).toHaveText('播放')
})
