/**
 * 物理解模 - 自定义场景弧线绘制功能验证
 * 验证 7 个功能点并截图
 */
import { createRequire } from 'module'
const require = createRequire('C:/Users/zh200/AppData/Local/npm-cache/_npx/0b9ff77863cb6e9f/package.json')
const { chromium } = require('playwright')

const SHOT_DIR = 'D:/huancun/newwork1/screenshots/arc-test'
// 用户指定 /物理解模/,但本地 dev server 实际部署在 /PhysicsCanvas/ 下
const URL = 'http://localhost:5173/PhysicsCanvas/'

// 收集控制台消息
const consoleMsgs = []
const pageErrors = []

const result = {
  step1: {}, step2: {}, step3: {}, step4: {}, step5: {}, step6: {}, step7: {}
}

;(async () => {
  // 本地已有 chromium-1067,直接指定可执行文件路径(绕过版本校验)
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/zh200/AppData/Local/ms-playwright/chromium-1067/chrome-win/chrome.exe'
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', msg => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() })
  })
  page.on('pageerror', err => {
    pageErrors.push(err.message)
  })

  // ===== 步骤1: 页面初始加载 =====
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOT_DIR}/01-initial.png` })

  result.step1 = {
    loaded: true,
    title: await page.title(),
    sceneTabsCount: await page.$$eval('.scene-tabs .tab', els => els.length),
    initialActiveScene: await page.$$eval('.scene-tabs .tab.active', els => els.map(e => e.textContent.trim()))
  }

  // ===== 步骤2: 进入自定义场景编辑模式 =====
  await page.click('.scene-tabs .tab:has-text("自定义")')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/02-edit-mode.png` })

  // 验证工具栏
  const toolbar = await page.$('.edit-toolbar')
  const toolbarVisible = toolbar ? await toolbar.isVisible() : false
  const toolbarBox = toolbar ? await toolbar.boundingBox() : null
  const canvasEl = await page.$('canvas')
  const canvasBox = await canvasEl.boundingBox()

  // 工具栏按钮文本
  const toolBtnTexts = await page.$$eval('.edit-toolbar .tool-btn', els => els.map(e => e.textContent.trim()))

  // 工具栏是否在画布上方(独立空间,不覆盖画布):toolbar 底部 <= canvas 顶部
  const toolbarAboveCanvas = toolbarBox && canvasBox
    ? (toolbarBox.y + toolbarBox.height) <= (canvasBox.y + 1)
    : false

  // 工具栏与画布是否重叠(横向不重叠才算独立?实际 flex column 纵向排列)
  const verticalGap = toolbarBox && canvasBox
    ? canvasBox.y - (toolbarBox.y + toolbarBox.height)
    : null

  result.step2 = {
    editModeActive: await page.$$eval('.scene-tabs .tab.active', els => els.map(e => e.textContent.trim())),
    toolbarVisible,
    toolbarBox,
    canvasBox,
    toolbarAboveCanvas,
    verticalGap,
    toolBtnTexts,
    hasAllExpectedTools: ['选择/移动', '小球', '平台', '圆弧', '弹簧', '带电']
      .every(t => toolBtnTexts.some(b => b.includes(t))),
    hasActionButtons: ['撤销', '重做', '导出', '导入']
      .every(t => toolBtnTexts.some(b => b.includes(t)))
  }

  // ===== 步骤3: 绘制一条弧线 =====
  // 点击"圆弧"工具按钮
  await page.click('.edit-toolbar .tool-btn:has-text("圆弧")')
  await page.waitForTimeout(300)
  const arcToolActive = await page.$$eval('.edit-toolbar .tool-btn.active', els => els.map(e => e.textContent.trim()))

  // 三次点击:圆心 → 半径起点 → 终点角度
  // 初始 worldOffset={0,0}, worldScale=1,世界坐标 = CSS 坐标(相对 canvas 左上角)
  const cx = canvasBox.x + 320
  const cy = canvasBox.y + 220
  // 半径起点:圆心右侧 90px(> 10px 阈值)
  const rx = canvasBox.x + 410
  const ry = canvasBox.y + 220
  // 终点角度:圆心下方(顺时针绘制约 90°)
  const ax = canvasBox.x + 320
  const ay = canvasBox.y + 310

  await page.mouse.click(cx, cy)
  await page.waitForTimeout(250)
  await page.mouse.click(rx, ry)
  await page.waitForTimeout(250)
  await page.mouse.click(ax, ay)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOT_DIR}/03-arc-drawn.png` })

  result.step3 = {
    arcToolActive,
    clickPoints: { center: [cx, cy], radius: [rx, ry], angle: [ax, ay] },
    radius: Math.hypot(rx - cx, ry - cy)
  }

  // ===== 步骤4: 验证物体列表弧线分组 =====
  await page.waitForTimeout(300)
  // 弧线分组条目数(.group-item)
  const arcGroupCount = await page.$$eval('.object-list .group-item', els => els.length)
  // 顶层条目(单个物体,非分组)
  const singleItemCount = await page.$$eval('.object-list .list > .item', els => els.length)
  // 所有名为"弧线X"的条目(顶层,不应出现 20 个)
  const arcNameItems = await page.$$eval('.object-list .list > .item .name', els =>
    els.map(e => e.textContent.trim()).filter(t => t.startsWith('弧线'))
  )
  // 弧线分组中显示的名字
  const arcGroupNames = await page.$$eval('.object-list .group-item .name', els =>
    els.map(e => e.textContent.trim())
  )
  // 物体列表所有顶层条目文本
  const allTopItems = await page.$$eval('.object-list .list > *', els =>
    els.map(e => e.querySelector('.name')?.textContent.trim() || '(no-name)')
  )

  await page.screenshot({ path: `${SHOT_DIR}/04-object-list.png` })

  result.step4 = {
    arcGroupCount,
    singleItemCount,
    arcNameItems,
    arcGroupNames,
    allTopItems,
    pass: arcGroupCount === 1 && arcNameItems.length === 0
  }

  // ===== 步骤5: 验证弧线展开功能 =====
  // 点击展开按钮(▶)
  const expandBtn = await page.$('.object-list .expand-btn')
  const expandBtnTextBefore = expandBtn ? await expandBtn.textContent() : null
  await expandBtn.click()
  await page.waitForTimeout(500)
  const expandBtnTextAfter = await page.$eval('.object-list .expand-btn', el => el.textContent.trim())

  // 展开后子线段数
  const childCount = await page.$$eval('.object-list .child-item', els => els.length)
  // 子线段文本
  const childTexts = await page.$$eval('.object-list .child-item .name', els =>
    els.map(e => e.textContent.trim())
  )

  await page.screenshot({ path: `${SHOT_DIR}/05-expanded.png` })

  result.step5 = {
    expandBtnTextBefore,
    expandBtnTextAfter,
    childCount,
    childTexts,
    pass: childCount === 20 && expandBtnTextAfter.includes('▼')
  }

  // ===== 步骤6: 验证选择/移动工具 =====
  // 先收起展开(可选),记录物体数量(基于 state.objects)
  // 用 Vue 内部状态读取物体总数
  const objectTotalBefore = await page.evaluate(() => {
    // 尝试从画布渲染推断;直接读取物体列表条目总数(分组+单个+子段不重复计数)
    // 顶层条目 = .list > * 数量
    return document.querySelectorAll('.object-list .list > *').length
  })

  // 点击"选择/移动"按钮
  await page.click('.edit-toolbar .tool-btn:has-text("选择/移动")')
  await page.waitForTimeout(300)
  const selectToolActive = await page.$$eval('.edit-toolbar .tool-btn.active', els => els.map(e => e.textContent.trim()))

  // 在画布空白处点击(左上角,远离已绘制的弧线)
  await page.mouse.click(canvasBox.x + 60, canvasBox.y + 60)
  await page.waitForTimeout(400)

  const objectTotalAfter = await page.evaluate(() => {
    return document.querySelectorAll('.object-list .list > *').length
  })

  await page.screenshot({ path: `${SHOT_DIR}/06-select-tool.png` })

  result.step6 = {
    selectToolActive,
    objectTotalBefore,
    objectTotalAfter,
    pass: objectTotalBefore === objectTotalAfter
  }

  // ===== 步骤7: 检查浏览器控制台 =====
  // 统计 error / warning
  const errors = consoleMsgs.filter(m => m.type === 'error')
  const warnings = consoleMsgs.filter(m => m.type === 'warning')
  const allErrorLevel = [...errors, ...pageErrors.map(m => ({ type: 'pageerror', text: m }))]

  // 注入控制台浮层并截图
  await page.evaluate((data) => {
    const panel = document.createElement('div')
    panel.id = '__console_panel__'
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: #1e1e1e; color: #d4d4d4; z-index: 99999;
      font-family: 'Consolas', monospace; font-size: 13px;
      padding: 16px; overflow: auto;
    `
    const header = document.createElement('div')
    header.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #4fc3f7;'
    header.textContent = `浏览器控制台检查  |  Error: ${data.errorCount}  Warning: ${data.warningCount}  PageError: ${data.pageErrorCount}  总消息数: ${data.totalCount}`
    panel.appendChild(header)

    const summary = document.createElement('div')
    summary.style.cssText = 'margin-bottom: 12px; padding: 8px; background: #2d2d2d; border-radius: 4px;'
    if (data.errorCount === 0 && data.pageErrorCount === 0) {
      summary.innerHTML = `<span style="color:#4ade80;">✓ 无控制台错误,无页面运行时错误</span>`
    } else {
      summary.innerHTML = `<span style="color:#f87171;">✗ 存在错误,详见下方</span>`
    }
    panel.appendChild(summary)

    data.messages.forEach(m => {
      const line = document.createElement('div')
      const color = m.type === 'error' ? '#f87171' : m.type === 'warning' ? '#fbbf24' : m.type === 'pageerror' ? '#f87171' : '#9ca3af'
      line.style.cssText = `color: ${color}; margin: 2px 0; word-break: break-all;`
      line.textContent = `[${m.type}] ${m.text}`
      panel.appendChild(line)
    })

    document.body.appendChild(panel)
  }, {
    errorCount: errors.length,
    warningCount: warnings.length,
    pageErrorCount: pageErrors.length,
    totalCount: consoleMsgs.length,
    messages: [
      ...consoleMsgs,
      ...pageErrors.map(m => ({ type: 'pageerror', text: m }))
    ]
  })

  await page.screenshot({ path: `${SHOT_DIR}/07-console.png` })

  result.step7 = {
    totalConsoleMessages: consoleMsgs.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    pageErrorCount: pageErrors.length,
    errors: errors.map(m => m.text),
    warnings: warnings.map(m => m.text),
    pageErrors,
    allMessages: consoleMsgs,
    pass: errors.length === 0 && pageErrors.length === 0
  }

  await browser.close()

  // 输出 JSON 报告
  console.log('===== TEST RESULT JSON =====')
  console.log(JSON.stringify(result, null, 2))
  console.log('===== END =====')
})().catch(err => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
