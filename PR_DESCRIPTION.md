# PR 说明：板块模型重构 + 圆环入口修复 + UI 改造 + 重置合并修复 + 文档同步

## 概述

本次更新在前一版「圆环穿透修复 + 触发器颜色开关 + 测试体系」基础上，按主题拆分为 3 个独立提交：板块模型升级为独立物理实体、圆环入口体积感知修复；UI 精简首屏默认自定义场景且真题库上移至头部；重置采用合并策略保留用户配置；同步全套项目文档。

- **提交范围**：`dfb46cb` → `272450d`（3 个提交，基于 `c463c5d`）
- **远程**：已推送至 GitHub 和 Gitee 的 master 分支
- **验证**：28 个测试全部通过，构建 0 错误 0 警告
- **改动规模**：26 个文件，+1821 / -752

---

## 改动内容

### 1. 板块模型重构 + 圆环入口卡顿修复（`364a419`）

**板块升级为独立物理实体类型**：从「普通线段 + `movable:true` 标记」升级为独立类型 `type:'plate'`，新增完整物理属性支持高考板块模型语义。

| 新增字段 | 含义 |
|---------|------|
| `physicsThickness` | 物理厚度（米→像素转换），参与碰撞与支撑检测 |
| `angle` | 静态倾角（弧度），物理更新中保持不变 |
| `frictionTop` / `frictionBottom` | 上下表面分离摩擦系数 |
| `subtype: 'plate'` | 子类型语义标记，与 `conveyor` / `platform` 区分 |

**端面碰撞**：水平板块撞竖直侧壁（如摆渡车撞凹槽侧壁）后 `vx=0` 立即静止，符合高考「碰到侧壁立即静止」语义；端面碰撞无摩擦，仅法向反射且动量守恒（`v' = ((m-e·M)·v + (1+e)·M·v_other)/M_total`）。

**圆环入口卡顿修复**：缺口放行检查原仅用球心角度，当球半径相对环半径占比显著时（4px/20px=20%）入口判定失败导致球卡在环外。新增 `isBallVolumeInGap` 体积感知检查，叠加球角半径 `arcsin(ballRadius/dist)`，在 `detectArcCollision`、`applyArcConstraint`、`tryActivateArcConstraint` 三处共 6 个缺口判定点替换原 `isAngleInGap`。

**新增测试 10 例**：
- `tests/unit/plate-definition.test.ts`（7 例）：转换完整性、默认值、端面碰撞反弹、动量守恒、摩擦分离、摆渡配置
- `tests/regression/entry-stuck-outside.test.ts`（3 例）：scale=25 真实几何验证球不再卡在环外

### 2. UI 改造 + 重置合并修复（`272450d`）

**UI 改造**：
- 移除 5 个预设场景标签（抛体运动、斜面滑块、弹性碰撞、磁场周转、电场偏转），仅保留「自定义」
- 首屏默认加载自定义场景，并尝试恢复上次保存的自定义场景状态
- 真题库从右侧固定面板迁移至头部「📚 真题库」按钮 + 下拉浮层（点击外部自动关闭），填补自定义旁空缺
- `QuestionBankPanel` 新增 `embedded` 模式 prop，支持外部控制展开/折叠

**重置合并修复**：原 `reset()` 用 `loadScene()` 时的初始快照覆盖 `state.objects`，导致用户在播放前修改的自定义配置（如 `entryGap.halfWidth`、`exitGap.halfWidth`、摩擦、质量）丢失。

修复方案——**播放起始基线 + 合并重置**：
1. `capturePlayStart()`：按下播放时捕获 `playStartSnapshot`（含用户配置修改）
2. `mergeResetState(current, baseline)`：重置时物理状态（位置/速度/几何/运行时字段）从 baseline 恢复，配置参数（mass/charge/radius/friction/color/name/缺口/摩擦）保留 current
3. `useSceneManager` 在 `onTogglePlay`、`handleLoadQuestion`、`handleSceneBuilt` 调用 `capturePlayStart()`

**新增测试 6 例**：`tests/unit/reset-merge.test.ts` 覆盖质点位置/速度恢复、配置保留、轨迹清空、无基线回退、板块几何恢复、传送带几何恢复。

### 3. 文档同步（`dfb46cb`）

更新 11 份文档与变更日志，使其与当前板块模型、弧线约束、重置合并、UI 改造等项目状态一致：

| 文档 | 关键更新 |
|------|---------|
| `docs/API.md` | 扩展至 269 行，补全板块/弧线约束/重置合并 API |
| `docs/ARCHITECTURE.md` | 补充板块类型与合并重置架构说明 |
| `docs/PHYSICS.md` | 板块物理厚度、端面碰撞、摩擦分离说明 |
| `docs/QUESTION_BANK.md` | 替换为 plate-2023-zj sceneJson 示例，新增弧线缺口与约束 |
| `docs/REQUIREMENTS.md` | FR-1.1 改为 1 题，新增 FR-2.9/3.8/3.9，FR-8.1 标记完成 |
| `docs/TESTING.md` | 重写为 Vitest 12 测试体系文档 |
| `docs/CODE_QUALITY_REVIEW.md` | 更新 8 个已解决问题与 4 个新发现 |
| `docs/DEPLOYMENT.md` | 新增 `npm run test` 步骤与 Vitest 配置段 |
| `CHANGELOG.md` | 新增未发布变更（弧线约束、Bug 修复） |
| `README.md` | 同步项目特性与使用说明 |

---

## 改动文件清单（26 个文件，+1821 / -752）

### 板块模型 + 圆环入口（Commit `364a419`）
- [src/composables/usePhysics.ts](file:///d:/huancun/newwork1/src/composables/usePhysics.ts) — `SegmentObject` 扩展 `physicsThickness`/`angle`/`frictionTop`/`frictionBottom`/`subtype`，板块支撑/端面碰撞物理更新
- [src/composables/useCollision.ts](file:///d:/huancun/newwork1/src/composables/useCollision.ts) — `isBallVolumeInGap` 体积感知替换 6 个缺口判定点
- [src/composables/useSceneBuilder.ts](file:///d:/huancun/newwork1/src/composables/useSceneBuilder.ts) — 板块字段透传与构建
- [src/composables/useAIParser.ts](file:///d:/huancun/newwork1/src/composables/useAIParser.ts) — 板块解析支持
- [src/composables/useEditTools.ts](file:///d:/huancun/newwork1/src/composables/useEditTools.ts) — 板块编辑工具
- [src/composables/useCanvasRenderer.ts](file:///d:/huancun/newwork1/src/composables/useCanvasRenderer.ts) — 板块视觉厚度渲染
- [src/components/PropertyPanel.vue](file:///d:/huancun/newwork1/src/components/PropertyPanel.vue) — 板块属性面板字段
- [src/data/questionBank.ts](file:///d:/huancun/newwork1/src/data/questionBank.ts) — 板块类型定义验证
- [tests/unit/plate-definition.test.ts](file:///d:/huancun/newwork1/tests/unit/plate-definition.test.ts) — 板块单元测试 7 例
- [tests/regression/entry-stuck-outside.test.ts](file:///d:/huancun/newwork1/tests/regression/entry-stuck-outside.test.ts) — 入口卡顿回归测试 3 例

### UI 改造 + 重置合并（Commit `272450d`）
- [src/components/SceneTabs.vue](file:///d:/huancun/newwork1/src/components/SceneTabs.vue) — 场景标签精简为仅「自定义」
- [src/composables/useSceneManager.ts](file:///d:/huancun/newwork1/src/composables/useSceneManager.ts) — 默认自定义场景、`capturePlayStart` 调用点
- [src/components/QuestionBankPanel.vue](file:///d:/huancun/newwork1/src/components/QuestionBankPanel.vue) — `embedded` 模式 prop
- [src/App.vue](file:///d:/huancun/newwork1/src/App.vue) — 移除右侧面板，头部按钮 + 下拉浮层 + 点击外部关闭
- [src/composables/usePhysics.ts](file:///d:/huancun/newwork1/src/composables/usePhysics.ts) — `playStartSnapshot` / `capturePlayStart` / `mergeResetState` / `reset` 合并重置
- [src/composables/useObjectOperations.ts](file:///d:/huancun/newwork1/src/composables/useObjectOperations.ts) — 移除 `refreshCustomSnapshot`
- [tests/unit/reset-merge.test.ts](file:///d:/huancun/newwork1/tests/unit/reset-merge.test.ts) — 合并重置单元测试 6 例

### 文档同步（Commit `dfb46cb`）
- [docs/API.md](file:///d:/huancun/newwork1/docs/API.md) / [docs/ARCHITECTURE.md](file:///d:/huancun/newwork1/docs/ARCHITECTURE.md) / [docs/PHYSICS.md](file:///d:/huancun/newwork1/docs/PHYSICS.md) / [docs/QUESTION_BANK.md](file:///d:/huancun/newwork1/docs/QUESTION_BANK.md)
- [docs/REQUIREMENTS.md](file:///d:/huancun/newwork1/docs/REQUIREMENTS.md) / [docs/TESTING.md](file:///d:/huancun/newwork1/docs/TESTING.md) / [docs/CODE_QUALITY_REVIEW.md](file:///d:/huancun/newwork1/docs/CODE_QUALITY_REVIEW.md) / [docs/DEPLOYMENT.md](file:///d:/huancun/newwork1/docs/DEPLOYMENT.md)
- [CHANGELOG.md](file:///d:/huancun/newwork1/CHANGELOG.md) / [README.md](file:///d:/huancun/newwork1/README.md)

### 其他
- [.gitignore](file:///d:/huancun/newwork1/.gitignore) — 新增 `screenshots/` 忽略本地 UI 测试截图

---

## 验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 单元/回归测试 | `npm run test` | ✅ 28 passed |
| 生产构建 | `npm run build` | ✅ 0 errors, 0 warnings |
| GitHub 推送 | `git log github/master` | ✅ 已同步至 `272450d` |
| Gitee 推送 | `git log gitee/master` | ✅ 已同步至 `272450d` |

### 手动验证建议
1. 加载真题库「2023 浙江 18 题（碰撞探究）」，确认小球从入口进入圆环后沿圆轨运动，不再卡在环外或穿过底部。
2. 加载含板块的真题（如摆渡车场景），确认板块撞竖直侧壁后立即静止，端面碰撞动量守恒。
3. 修改自定义场景缺口宽度、摩擦、质量等参数后点击播放 → 暂停 → 重置，确认物理状态恢复但配置参数保留。
4. 刷新页面，确认首屏默认加载「自定义」场景标签，真题库按钮位于头部自定义旁，点击展开浮层且点击外部自动关闭。

---

## 风险与遗留

- **代码质量待改进**：`useHistory.ts` 存在 `as any` 类型断言；核心物理引擎逻辑（`subStepPhysics` / `checkCollision`）尚缺单元测试覆盖。
- **圆轨螺旋题简化**：2024 浙江 16 题螺旋圆轨因项目限制无法完全物理还原，已简化为单弧线并在 `sceneJson.title` 中标注。
- **手动验证未完成**：自动化测试覆盖核心逻辑，建议在浏览器中加载真题场景做最终视觉确认。

## 提交历史

| Commit | 主题 |
|--------|------|
| `dfb46cb` | docs: 同步项目文档与变更日志 |
| `364a419` | feat: 板块模型重构 + 圆环入口卡顿修复 |
| `272450d` | feat: UI 改造（精简场景标签 + 真题库上移）+ 重置合并修复 |

## 远程仓库

- GitHub: https://github.com/Zh386874/PhysicsCanvas
- Gitee: https://gitee.com/zhang-hao041030/physics-canvas
