/**
 * PhysicsCanvas 可视化验证脚本
 * 使用 npx 缓存中的 playwright（通过 NODE_PATH 注入）
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:5176/PhysicsCanvas/';
const SCREENSHOT_DIR = 'D:\\huancun\\newwork1\\screenshots';
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'report.json');

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// 收集 console / page 错误
const consoleErrors = [];
const consoleWarnings = [];
const pageErrors = [];

// 结构化报告
const report = {
  steps: {},
  consoleErrors,
  consoleWarnings,
  pageErrors,
};

function rec(step, data) {
  report.steps[step] = { ...report.steps[step], ...data };
}

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  // 记录截图文件名
  const shots = report.steps._shots || (report.steps._shots = []);
  shots.push(name);
  return p;
}

/**
 * 在画布上从 (sx,sy) 水平拖拽到 (sx+len, sy) 绘制线段
 */
async function dragDraw(page, sx, sy, len) {
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + len * i / steps, sy);
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/**
 * 读取左侧物体列表条目（name + subtype + 是否分组）
 */
async function readObjectList(page) {
  return await page.locator('.object-list .list > *').evaluateAll(els =>
    els.map(el => ({
      name: el.querySelector('.name')?.textContent?.trim() || '',
      subtype: el.querySelector('.type')?.textContent?.trim() || '',
      isGroup: !!el.querySelector('.group-item'),
    }))
  );
}

/**
 * 在画布上扫描指定 RGB 颜色的像素，返回包围盒及（可选）n 形判定
 * n 形判定：将像素按 x 分左/中/右三桶，比较各桶最高点(最小 y)
 * n 形特征：中间 x 处最高(y 最小)，两端 x 处较低(y 较大)
 */
async function scanPixels(canvas, target, opts = {}) {
  return await canvas.evaluate((cv, params) => {
    const target = params.target;
    const nShape = params.nShape;
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const img = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    const pts = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (Math.abs(img[i]-target[0])<30 && Math.abs(img[i+1]-target[1])<30 && Math.abs(img[i+2]-target[2])<30) {
          count++;
          if (x<minX) minX=x; if (x>maxX) maxX=x;
          if (y<minY) minY=y; if (y>maxY) maxY=y;
          if (nShape) pts.push(x, y);
        }
      }
    }
    const result = { minX, minY, maxX, maxY, count, w, h, xSpan: maxX - minX, ySpan: maxY - minY };
    if (nShape) {
      const range = maxX - minX;
      let leftMinY = h, midMinY = h, rightMinY = h;
      let leftCount = 0, midCount = 0, rightCount = 0;
      for (let k = 0; k < pts.length; k += 2) {
        const x = pts[k], y = pts[k+1];
        if (range > 0) {
          const rel = (x - minX) / range;
          if (rel < 0.34) { if (y < leftMinY) leftMinY = y; leftCount++; }
          else if (rel < 0.66) { if (y < midMinY) midMinY = y; midCount++; }
          else { if (y < rightMinY) rightMinY = y; rightCount++; }
        }
      }
      result.leftMinY = leftMinY;
      result.midMinY = midMinY;
      result.rightMinY = rightMinY;
      result.leftCount = leftCount;
      result.midCount = midCount;
      result.rightCount = rightCount;
      result.nShape = count > 50 && midMinY < leftMinY - 2 && midMinY < rightMinY - 2;
    }
    return result;
  }, { target, nShape: !!opts.nShape }).catch(e => ({ error: e.message }));
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\zh200\\AppData\\Local\\ms-playwright\\chromium-1067\\chrome-win\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const t = msg.type();
    if (t === 'error') consoleErrors.push(msg.text());
    else if (t === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message + (err.stack ? '\n' + err.stack : '')));

  try {
    // ===== 步骤1：初始页面 =====
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    // 清除 localStorage，避免自定义场景恢复旧数据干扰测试
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    await shot(page, '01-initial.png');
    rec('step1_initial', {
      screenshot: '01-initial.png',
      loaded: true,
      activeScene: await page.locator('.scene-tabs .tab.active').textContent(),
    });

    // ===== 步骤2：切换到自定义场景 =====
    await page.locator('.scene-tabs .tab', { hasText: '自定义' }).click();
    await page.waitForTimeout(700);
    await shot(page, '02-custom-toolbar.png');

    // 验证工具栏可见
    const toolbarVisible = await page.locator('.edit-toolbar').isVisible();
    const toolBtnTexts = (await page.locator('.edit-toolbar .tool-btn').allTextContents()).map(s => s.trim());
    rec('step2_toolbar', {
      screenshot: '02-custom-toolbar.png',
      toolbarVisible,
      toolButtons: toolBtnTexts,
      hasConveyor: toolBtnTexts.some(t => t.includes('传送带')),
      hasPlate: toolBtnTexts.some(t => t.includes('板块')),
      hasSelect: toolBtnTexts.some(t => t.includes('选择/移动')),
      hasBall: toolBtnTexts.some(t => t.includes('小球')),
      hasPlatform: toolBtnTexts.some(t => t.includes('平台')),
      hasArc: toolBtnTexts.some(t => t.includes('圆弧')),
      hasSpring: toolBtnTexts.some(t => t.includes('弹簧')),
      hasCharge: toolBtnTexts.some(t => t.includes('带电')),
    });

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    // ===== 步骤3：测试平台工具（应命名"平台1"） =====
    await page.locator('.edit-toolbar .tool-btn', { hasText: '平台' }).click();
    await page.waitForTimeout(200);
    // 平台：画布上部水平拖拽 200px
    const platSx = box.x + box.width * 0.20;
    const platSy = box.y + box.height * 0.30;
    await dragDraw(page, platSx, platSy, 200);
    await shot(page, '03-platform-draw.png');

    const listItemsAfterPlatform = await readObjectList(page);
    const platformItem = listItemsAfterPlatform.find(i => i.name.includes('平台'));
    rec('step3_platform_draw', {
      screenshot: '03-platform-draw.png',
      listItems: listItemsAfterPlatform,
      platformItemName: platformItem?.name || null,
      platformItemSubtype: platformItem?.subtype || null,
      platformNameExpected: '平台1',
      platformNamePass: platformItem?.name === '平台1',
    });

    // ===== 步骤4：测试传送带工具（应命名"传送带1"，不是"传送带2"） =====
    await page.locator('.edit-toolbar .tool-btn', { hasText: '传送带' }).click();
    await page.waitForTimeout(200);
    // 传送带：画布中部水平拖拽 200px
    const convSx = box.x + box.width * 0.20;
    const convSy = box.y + box.height * 0.50;
    await dragDraw(page, convSx, convSy, 200);
    await shot(page, '04-conveyor-draw.png');

    const listItemsAfterConv = await readObjectList(page);
    const conveyorItem = listItemsAfterConv.find(i => i.name.includes('传送带'));
    rec('step4_conveyor_draw', {
      screenshot: '04-conveyor-draw.png',
      listItems: listItemsAfterConv,
      conveyorItemName: conveyorItem?.name || null,
      conveyorItemSubtype: conveyorItem?.subtype || null,
      conveyorNameExpected: '传送带1',
      conveyorNamePass: conveyorItem?.name === '传送带1',
    });

    // ===== 步骤5：测试板块工具（应命名"板块1"，不是"板块3"） =====
    await page.locator('.edit-toolbar .tool-btn', { hasText: '板块' }).click();
    await page.waitForTimeout(200);
    // 板块：画布下部水平拖拽 200px
    const plateSx = box.x + box.width * 0.20;
    const plateSy = box.y + box.height * 0.70;
    await dragDraw(page, plateSx, plateSy, 200);
    await shot(page, '05-plate-draw.png');

    const listItemsAfterPlate = await readObjectList(page);
    const plateItem = listItemsAfterPlate.find(i => i.name.includes('板块'));
    rec('step5_plate_draw', {
      screenshot: '05-plate-draw.png',
      listItems: listItemsAfterPlate,
      plateItemName: plateItem?.name || null,
      plateItemSubtype: plateItem?.subtype || null,
      plateNameExpected: '板块1',
      plateNamePass: plateItem?.name === '板块1',
    });

    // ===== 步骤6：截图左侧物体列表，确认三个条目命名 =====
    await shot(page, '06-object-list.png');
    const finalList = await readObjectList(page);
    const platformEntry = finalList.find(i => i.name.includes('平台'));
    const conveyorEntry = finalList.find(i => i.name.includes('传送带'));
    const plateEntry = finalList.find(i => i.name.includes('板块'));
    rec('step6_object_list', {
      screenshot: '06-object-list.png',
      listItems: finalList,
      platformName: platformEntry?.name || null,
      conveyorName: conveyorEntry?.name || null,
      plateName: plateEntry?.name || null,
      expectedNames: ['平台1', '传送带1', '板块1'],
      namingPass:
        platformEntry?.name === '平台1' &&
        conveyorEntry?.name === '传送带1' &&
        plateEntry?.name === '板块1',
    });

    // ===== 步骤7：加载 2023 浙江 18 题（碰撞探究） =====
    // 真题库面板默认展开；定位题目并点击 load-btn
    const questionItem = page.locator('.question-bank-panel .question-item', { hasText: '碰撞探究' });
    await questionItem.scrollIntoViewIfNeeded();
    // 确认题目标题含 2023浙江18题
    const qTitle = await questionItem.locator('.question-title').textContent();
    const isTarget = qTitle && qTitle.includes('2023') && qTitle.includes('18题');
    await questionItem.locator('.load-btn').click();
    await page.waitForTimeout(1500); // 等待场景构建 + 渲染
    await shot(page, '07-question-arcs.png');

    // 读取物体列表
    const listItemsAfterQ = await readObjectList(page);
    const conveyorEntries = listItemsAfterQ.filter(i => i.subtype === '传送带');
    const arcGroupEntries = listItemsAfterQ.filter(i => i.subtype === '弧线' && i.isGroup);

    // ===== 步骤8：像素扫描验证圆弧管道形状（n 形：两个 1/4 圆弧，顶点朝上） =====
    // drawArcsVisually 实际绘制颜色为 rgba(124,58,237,0.9) ≈ #7c3aed
    const arcPixelInfo = await scanPixels(canvas, [124, 58, 237], { nShape: true });
    rec('step7_question_arcs', {
      screenshot: '07-question-arcs.png',
      questionTitleLoaded: qTitle?.trim() || null,
      isTargetQuestion: !!isTarget,
      listItems: listItemsAfterQ,
      conveyorEntryCount: conveyorEntries.length,
      conveyorEntries,
      arcGroupEntryCount: arcGroupEntries.length,
      arcGroupEntries,
      arcPixelInfo,
      arcColorExpected: '#7c3aed',
      arcVisible: arcPixelInfo && arcPixelInfo.count > 50,
      nShapePass: arcPixelInfo && arcPixelInfo.nShape === true,
    });

    // 额外：对画布元素单独截图，更清晰看到圆弧管道
    await canvas.screenshot({ path: path.join(SCREENSHOT_DIR, '07b-canvas-only.png') });

    // ===== 步骤9：像素扫描验证真题库传送带颜色（青色 #0891b2） =====
    const cyanPixels = await scanPixels(canvas, [8, 145, 178]);
    rec('step8_conveyor_color', {
      cyanPixels,
      cyanColorExpected: '#0891b2',
      cyanPass: cyanPixels && cyanPixels.count > 50,
      notGray: cyanPixels && cyanPixels.count > 50,
    });

    // ===== 步骤10：console 检查已全程收集 =====
    rec('step9_console', {
      errorCount: consoleErrors.length,
      warningCount: consoleWarnings.length,
      pageErrorCount: pageErrors.length,
      errors: consoleErrors,
      warnings: consoleWarnings,
      pageErrors: pageErrors,
    });

  } catch (err) {
    report.fatalError = err.message + '\n' + (err.stack || '');
    try { await shot(page, '99-error.png'); } catch (e) {}
  } finally {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }

  // 控制台输出简要结果（UTF8）
  console.log('===== REPORT =====');
  console.log(JSON.stringify(report, null, 2));
})();
