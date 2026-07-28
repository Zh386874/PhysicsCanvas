# PR 说明：修复小球穿过圆环 + 触发器颜色开关 + 测试体系

## 概述

本次更新解决真题库场景中小球直接穿过圆环的关键 Bug，新增触发器弧线颜色开关用于调试，并搭建 vitest 测试体系保障修复稳定性。

- **提交**: `12a8c0f` fix: 修复小球穿过圆环 + 触发器颜色开关 + 测试体系
- **远程**: 已推送至 GitHub 和 Gitee 的 master 分支
- **验证**: 12 个测试全部通过，构建 0 错误 0 警告

---

## 修复内容

### 1. Bug 修复：小球穿过圆环（根因修复）

**问题**：2023 浙江题中小球从入口缺口进入圆环后，直接穿过圆环底部，无法沿圆轨运动。

**根因**：双重距离盲区
| 函数 | 阈值检查 | 失效条件 |
|------|---------|---------|
| `tryActivateArcConstraint` | `closest.dist > radius`（4px） | 球深入环内 >4px |
| `detectArcCollision` | `closest.dist > radius && !isCCDHit` | 同上 |

两者使用相同距离阈值，小球从缺口进入后深入环内 >4px 时，约束激活与碰撞检测同时失效，导致回退路径无效。

**修复方案**：
1. **catch-up 机制**（useCollision.ts）：带缺口弧线在小球位于环内且所有门关闭时，跳过距离判定强制激活约束。此场景仅发生于球从缺口进入后门关闭的情况，球"应该"在弧面上。
2. **全圆弧角度判定**（`isAngleInRange`）：角度跨度约 2π 时归一化后角度超出 `[minA, maxA]` 导致所有角度返回 false。添加全圆检测：跨度 ≈ 2π 时恒返回 true。
3. **约束激活回退路径**：`checkCollision` 中约束激活失败时回退到 `detectArcCollision`，并修复双重距离盲区使回退真正生效。

### 2. 新功能：触发器颜色开关

**背景**：装有触发器的弧线（缺口弧线）默认与普通弧线视觉一致，调试时难以区分。

**实现**：
- 新增 `enterRing` 触发类型：小球从环外进入环内（`dist` 从 >r 变为 <r）时立即触发缺口状态变化，比 `angleCross` 更早关闭入口，避免小球偏移。
- `ControlBar.vue` 新增「🎨 触发器颜色」按钮，切换 `showGateColors` 状态。
- `useCanvasRenderer.ts` 根据 `showGateColors` 控制触发器弧线颜色显示（琥珀色）和缺口叠加层（绿色=开/红色=关）。
- `PropertyPanel.vue` 弧线高级选项新增触发类型下拉（无触发器/角度穿越/进入圆环）。

### 3. 测试体系搭建

引入 vitest 测试框架，建立三层测试覆盖：

| 层级 | 文件 | 用例数 | 覆盖场景 |
|------|------|-------|---------|
| 单元测试 | `tests/unit/collision.test.ts` | 6 | 触碰激活、缺口放行、catch-up 机制、远距离不激活 |
| 集成测试 | `tests/integration/ring-scene.test.ts` | 3 | 不穿底、enterRing 触发、约束后弧面运动 |
| 回归测试 | `tests/regression/ball-through-ring.test.ts` | 3 | 精确复现 Bug 场景验证修复 |

---

## 改动文件清单（21 个文件，+1396 / -63）

### 核心修复
- [src/composables/useCollision.ts](file:///d:/huancun/newwork1/src/composables/useCollision.ts) — catch-up 机制、全圆弧判定、约束激活回退
- [src/data/questionBank.ts](file:///d:/huancun/newwork1/src/data/questionBank.ts) — 2023 浙江题入口缺口改用 `enterRing` 触发

### 触发器颜色开关
- [src/components/ControlBar.vue](file:///d:/huancun/newwork1/src/components/ControlBar.vue) — 新增颜色切换按钮
- [src/components/PropertyPanel.vue](file:///d:/huancun/newwork1/src/components/PropertyPanel.vue) — 触发类型下拉选择
- [src/composables/useCanvasRenderer.ts](file:///d:/huancun/newwork1/src/composables/useCanvasRenderer.ts) — 条件渲染触发器颜色
- [src/composables/usePhysics.ts](file:///d:/huancun/newwork1/src/composables/usePhysics.ts) — 新增 `showGateColors` 状态、扩展 `ArcGap` 接口
- [src/App.vue](file:///d:/huancun/newwork1/src/App.vue) — 绑定状态与事件

### 类型与构建器透传
- [src/composables/useSceneBuilder.ts](file:///d:/huancun/newwork1/src/composables/useSceneBuilder.ts) — 透传 `triggerType` 字段
- [src/composables/useAIParser.ts](file:///d:/huancun/newwork1/src/composables/useAIParser.ts) — 扩展 `ParsedArc` 接口
- [src/composables/useEditTools.ts](file:///d:/huancun/newwork1/src/composables/useEditTools.ts) — 自定义弧线默认启用约束
- [src/composables/useObjectOperations.ts](file:///d:/huancun/newwork1/src/composables/useObjectOperations.ts) / [useSceneIO.ts](file:///d:/huancun/newwork1/src/composables/useSceneIO.ts) / [useSceneManager.ts](file:///d:/huancun/newwork1/src/composables/useSceneManager.ts) — 状态字段同步

### 测试体系
- [vitest.config.ts](file:///d:/huancun/newwork1/vitest.config.ts) — vitest 配置
- [tests/helpers/sceneBuilder.ts](file:///d:/huancun/newwork1/tests/helpers/sceneBuilder.ts) — 测试场景构建辅助
- [tests/unit/collision.test.ts](file:///d:/huancun/newwork1/tests/unit/collision.test.ts) — 单元测试
- [tests/integration/ring-scene.test.ts](file:///d:/huancun/newwork1/tests/integration/ring-scene.test.ts) — 集成测试
- [tests/regression/ball-through-ring.test.ts](file:///d:/huancun/newwork1/tests/regression/ball-through-ring.test.ts) — 回归测试
- [package.json](file:///d:/huancun/newwork1/package.json) — 新增 `test` / `test:watch` 脚本与 vitest 依赖

---

## 验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 单元/集成/回归测试 | `npm run test` | ✅ 12 passed (3 files) |
| 生产构建 | `npm run build` | ✅ 0 errors, 0 warnings（49 模块，886ms） |
| GitHub 推送 | `git log github/master` | ✅ 已同步至 `12a8c0f` |
| Gitee 推送 | `git log gitee/master` | ✅ 已同步至 `12a8c0f` |

### 手动验证建议
1. 加载真题库「2023 浙江 18 题（碰撞探究）」，确认小球从 AB 滑下后进入圆轨沿圆环运动，不再穿过底部。
2. 在自定义场景创建带缺口弧线，分别在 `constraintEnabled` 开/关状态下测试小球行为。
3. 点击控制栏「🎨 触发器颜色」按钮，确认触发器弧线显示琥珀色，缺口叠加层显示绿色（开）/红色（关）。
4. 选中弧线，在属性面板高级选项中切换触发类型，确认 `triggerAngle` 输入框随类型变化显示/隐藏。

---

## 风险与遗留

- **圆轨螺旋题简化**：2024 浙江 16 题螺旋圆轨因项目限制无法完全物理还原，已简化为单弧线并在 `sceneJson.title` 中标注。
- **手动验证未完成**：自动化测试覆盖核心逻辑，但建议在浏览器中加载真题场景做最终视觉确认。

## 远程仓库

- GitHub: https://github.com/Zh386874/PhysicsCanvas
- Gitee: https://gitee.com/zhang-hao041030/physics-canvas
