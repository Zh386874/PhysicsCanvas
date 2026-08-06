import { test, expect } from '@playwright/test'

/**
 * E2E 流程 1：预设场景播放冒烟
 * AI 本地关键词解析（无需 API Key）→ 加载「斜面滑块」预设 → 自动播放 → 暂停 → 重置
 */
test('预设场景播放冒烟：AI 本地解析斜面 → 自动播放 → 暂停 → 重置', async ({ page }) => {
  await page.goto('/')

  // 输入斜面题目（本地关键词解析，命中「斜面滑块」预设）
  await page.locator('.question-input').fill('一个质量为2kg的滑块从倾角30°的光滑斜面顶端由静止释放')
  await page.locator('.parse-btn').click()

  // 解析后创建场景：物体列表出现条目
  await expect(page.locator('.object-list .item').first()).toBeVisible()

  // AI 解析后自动播放 → 播放按钮变为「暂停」
  const playBtn = page.locator('.control-bar .btn').first()
  await expect(playBtn).toHaveText('暂停')

  // 暂停
  await playBtn.click()
  await expect(playBtn).toHaveText('播放')

  // 重置
  await page.locator('.control-bar .btn').filter({ hasText: '重置' }).click()
  await expect(playBtn).toHaveText('播放')
})
