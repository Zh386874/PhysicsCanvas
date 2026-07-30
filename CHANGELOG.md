# 变更日志

> 本文档记录物理解模项目的版本变更历史。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### Added
- **弧线约束动力学**：新增 `constraintEnabled`（SegmentObject）/ `constrainedArcGroupId`（ParticleObject）字段及 `applyArcConstraint` / `tryActivateArcConstraint`（useCollision.ts），小球进环后约束在弧面做无能量损耗圆周运动，满足自然脱离条件时解除
- **弧线触发器缺口机制**：新增 `entryGap`/`exitGap`（ArcGap 类型，含 `triggerType: 'enterRing' | 'angleCross'`、`triggerAction: 'open' | 'close'`）与运行时 `arcGateState`，控制圆环动态缺口开闭
- **触发器颜色可视化**：ControlBar 新增"🎨 触发器颜色"按钮，`showGateColors` 状态控制弧线缺口开关与触发器颜色显示
- **常量集中管理**：新增 `src/constants.ts`，集中 GROUND_DISABLED/MAX_SUBSTEPS/MAX_STEP_DIST/TRAIL_LENGTH/MAX_SNAPSHOTS/画布常量/SCENE_VERSION，消除魔法数字散落
- **App.vue 拆分**：按 SRP 拆出 useSceneManager / useObjectOperations / useSceneIO / useKeyboard（~600→~309 行）
- **usePhysics 拆分**：快照/关键帧拆出 useSnapshotManager，合力计算拆出 useForces（力注册表 + 策略模式，遵循 OCP）
- **DIP 改造**：useCanvasInteraction 改为通过 PhysicsStateAccess 接口注入依赖，不再直接 import state
- **类型化改造**：ParsedObject 重构为判别联合（ParsedBall|ParsedPlatform|ParsedArc|ParsedSpring），DragTarget/BatchDragItem 类型化
- **Vitest 测试体系**：新增 vitest ^4.1.10，12 个测试跨 unit/integration/regression 三层（collision.test.ts / ring-scene.test.ts / ball-through-ring.test.ts）+ tests/helpers/sceneBuilder.ts
- **SegmentObject 新增字段**：thickness（视觉厚度）/ frictionTop / frictionBottom（板块上下表面摩擦分离）/ arcGateState / constraintEnabled
- 补齐项目文档：README.md、API.md、ARCHITECTURE.md、PHYSICS.md、QUESTION_BANK.md、DEPLOYMENT.md、TESTING.md、CODE_QUALITY_REVIEW.md、REQUIREMENTS.md、CHANGELOG.md

### Changed
- **题库精简**：真题库由 21 道精简为 1 道（plate-2023-zj，2023 浙江圆环题），聚焦圆环穿越场景的完整还原；保留添加新题目的扩展指南
- **板块模型摩擦**：上/下表面摩擦分离（frictionTop/frictionBottom），未设置时回退 friction

### Fixed
- **小球穿过圆环 bug**：tryActivateArcConstraint 与 detectArcCollision 均用 `closest.dist > radius`（4px）判定，球深入环内 >4px 时两者同时失效导致穿底。修复：添加 catch-up 逻辑，球在环内且所有缺口关闭时跳过距离判定强制激活约束
- **isAngleInRange 完整圆误判**：完整弧（span≈2π）时返回 false，导致约束无法激活。修复：增加 2π 特判返回 true

---

## [0.3.0] - 2026-07-10

### Added
- 真题库添加题目独立加载按钮（▶），支持一键切换题目
- 真题库移至右侧面板，解决与物体列表的空间冲突
- 弹簧编辑工具（自定义模式工具栏新增 🌀 弹簧按钮）
- 弹簧属性编辑区域（PropertyPanel 中可编辑 k、自然长度、固定端坐标）

### Fixed
- **电磁场模型严重卡顿**：子步循环无上限导致微观粒子（m=1e-27kg, v=2e6m/s）产生 227,000 子步/帧。添加 `MAX_SUBSTEPS=200` 上限 + 题目参数宏观等效化（降至 1-4 步/帧）
- **弹簧弹力系数过大**：降低题库 k 值（50→10, 200→20），使 `dt×ω < 0.1` 确保数值稳定，振动周期 T≈1.4-2s
- **PropertyPanel 无法正常显示**：移除 `flex: 1`，改为 `flex-shrink: 0`，解决真题库展开时面板被压缩
- **类型错误**：修复 useAIParser.ts 的 `groundY` 类型（支持 null）、useCanvasInteraction.ts 的类型守卫和空值检查
- **死码清理**：移除 usePhysics.ts 中未使用的 `const collided = false`
- **刚体批量拖拽**：修复刚体类型走 `line_segment` 分支的错误

---

## [0.2.0] - 2026-07-09

### Added
- 高考真题库：21 道题目，覆盖 8 大题型（斜面/抛体/碰撞/磁场/电场/弹簧/传送带/板块）
- AI 题目解析：接入 DeepSeek API，支持自然语言题目→场景自动生成
- 参数微调功能：AI 解析完成后可二次编辑物体参数
- 弹簧力模型（F=-kx）与螺旋渲染
- 传送带模型（相对速度摩擦）
- 板块模型（可移动线段 + 牛顿第三定律反作用冲量）
- 场景导出/导入（剪贴板 JSON）
- 撤销/重做（50 步历史）
- GitHub Actions 自动部署至 GitHub Pages

### Changed
- PhysicsCanvas.vue 从 1541 行拆分为 3 个 composable（useCanvasRenderer / useEditTools / useCanvasInteraction），可维护性提升 84%
- 核心 composables 渐进式迁移至 TypeScript

### Fixed
- **摩擦力帧率依赖**：从指数衰减 `v *= (1 - friction*0.15)` 重构为线性减速 `Δv = μgcosθ·dt`
- **双重摩擦**：移除 `checkGroundCollision` 中硬编码的 `obj.vx *= 0.98`
- **弹簧力单位换算错误**：移除多余的 `/ PIXELS_PER_METER`（原公式力弱 50 倍）
- **球底高度语义**：统一 `initialPosition.y` 为球底接触点高度（非球心高度）
- **非弹性碰撞**：添加公共速度公式 `vCommon = (ma·va + mb·vb)/(ma+mb)`
- **斜面法线方向**：自动计算保证 `normalY < 0`（指向上方）
- **中键平移被拦截**：修复 editMode 下 `if (!props.editMode) return` 阻止平移的问题
- **弧线组删除**：同组弧线段整组删除
- **高 DPI 适配**：Canvas 使用 dpr 缩放
- **场景切换二次确认**：防止误操作丢失编辑内容
- 临时调试代码清理（`window.__physicsDebug`、`window.__physicsHistory`）

---

## [0.1.0] - 2026-07-08

### Added
- 项目初始化：Vue 3.5 + Vite 6.3 + Canvas 2D 架构
- 物理引擎核心：欧拉积分 + 子步循环防隧穿
- 三类碰撞检测：地面碰撞、质点间碰撞、线段 CCD 连续碰撞
- 5 个预设场景：抛体运动、斜面滑块、弹性碰撞、磁场圆周、电场偏转
- 自定义场景编辑器：小球/平台/圆弧三工具
- 右键框选批量操作
- Shift 键水平/垂直方向锁定
- 中键平移 + 滚轮缩放（0.3~5x）
- 受力分析：重力 mg、支持力 N、摩擦力 f、电场力 qE、洛伦兹力 qvB
- 20 秒过程回放（1200 帧快照）
- 关键帧自动识别（速度变号、碰撞瞬间）
- 核心常量体系：PIXELS_PER_METER=50，GRAVITY=490 px/s²
- 单向数据流架构（composables 管状态，组件 props+emit 通信）

---

## 版本说明

| 版本 | 重点 | 状态 |
|------|------|------|
| 0.1.0 | 核心引擎 + 编辑器 | ✅ 完成 |
| 0.2.0 | 真题库 + AI 解析 + 架构优化 | ✅ 完成 |
| 0.3.0 | Bug 修复 + 弹簧工具 + 文档 | ✅ 完成 |
| Unreleased | 弧线约束动力学 + 触发器缺口 + 架构拆分 + Vitest 测试体系 | ✅ 完成 |
| 未来 | 测试覆盖扩展 + 移动端适配 + 3D 模式 | 📋 规划中 |
