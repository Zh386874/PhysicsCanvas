import { test, expect } from '@playwright/test'

/**
 * E2E 流程 3：题库加载场景
 * 右侧「真题库」→ 点击第一题的加载按钮 → 场景构建 → 题目描述栏出现 → 自动播放
 */
test('题库加载场景：真题库 → 加载第一题 → 场景构建 → 自动播放', async ({ page }) => {
  await page.goto('/')

  // 题库面板存在（默认展开）
  const questionBank = page.locator('.right-panel .question-bank-panel')
  await expect(questionBank).toBeVisible()

  // 点击第一题的加载按钮
  const firstLoadBtn = page.locator('.question-item .load-btn').first()
  await firstLoadBtn.click()

  // 场景构建成功 → 物体列表出现条目
  await expect(page.locator('.object-list .item').first()).toBeVisible()

  // 题目描述栏出现
  await expect(page.locator('.question-desc-bar')).toBeVisible()

  // 加载后自动播放 → 播放按钮为「暂停」
  const playBtn = page.locator('.control-bar .btn').first()
  await expect(playBtn).toHaveText('暂停')
})
