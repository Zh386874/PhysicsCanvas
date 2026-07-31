# PR 说明：spotOverlap 触发器引擎 + AI 自定义配置 + 真题库更新 + z-index 修复 + 依赖更新

## 概述

本次更新在 `chore/project-consolidation` 分支上整合 5 个主题：新增 `spotOverlap` 触发器引擎能力、AI 配置弹窗支持自定义 OpenAI 兼容端点、真题库增删与标题精简、修复真题库浮层被编辑工具栏遮挡的 z-index 冲突、vitepress 依赖升级，并补全题目格式规范文档。

- **分支**：`chore/project-consolidation` → `master`
- **远程**：已推送至 GitHub 和 Gitee 的 `chore/project-consolidation` 分支
- **验证**：`npm run type-check` 通过；`npm run test` 335/335 通过
- **改动规模**：11 个文件，+1441 / -1067

---

## 改动内容

### 1. spotOverlap 触发器引擎

新增第三种圆弧缺口触发类型 `spotOverlap`：小球碰撞体积与环上固定触发点重叠时一次性触发（开/关缺口），触发后永久失效，重置场景后重新激活。补齐既有 `angleCross`（角度穿越）/ `enterRing`（进入圆环）之外的「触发点重叠」语义。

- [src/composables/usePhysics.ts](file:///d:/huancun/newwork1/src/composables/usePhysics.ts) — `ArcGap.triggerType` 联合类型扩展 `'spotOverlap'`；新增 `triggerSpotAngle`/`triggerSpotRadius` 字段；`arcGateState` 新增 `entrySpotTriggered`/`exitSpotTriggered` 一次性标志；`mergeResetState` 重置这两个标志
- [src/composables/useCollision.ts](file:///d:/huancun/newwork1/src/composables/useCollision.ts) — `updateArcGates` 新增触发点重叠检测：计算触发点世界坐标 `(cx + r·cos(spotAngle), cy + r·sin(spotAngle))`，当 `hypot(球心−触发点) ≤ 球半径 + spotRadius` 时触发，`spotRadius` 缺省取球半径 1.5 倍
- [src/composables/useSceneBuilder.ts](file:///d:/huancun/newwork1/src/composables/useSceneBuilder.ts) — `expandArcToSegments` 透传 `triggerSpotAngle`（场景 y-up → 画布 y-down 翻转取负）与 `triggerSpotRadius`，初始化两个触发标志为 `false`

### 2. AI 自定义配置

AI 配置弹窗新增第 4 个「🔧 自定义」模型选项，支持用户自行填写任意 OpenAI 兼容端点。

- **4 字段**：显示名称 + API URL + 模型标识符 + API Key（模型标识符作为请求体 `model` 字段发送，OpenAI 兼容接口必需）
- [src/components/ApiKeyDialog.vue](file:///d:/huancun/newwork1/src/components/ApiKeyDialog.vue) — `models` 数组加 `custom` 项；选中自定义时条件渲染 3 个输入框；「获取 Key」链接改为 `v-if="currentModel.docUrl"`（自定义下隐藏）；保存按钮加自定义有效性校验；`savedConfig` 支持自定义显示名；`onSave`/`onClear`/`onClose` 同步清空自定义输入；新增 `.custom-input` 样式；附带修复：API Key 组改用稳定类 `api-key-group` 替代原 `:nth-child(2)`，避免插入条件渲染字段后显隐按钮定位错位
- [src/composables/useAIParser.ts](file:///d:/huancun/newwork1/src/composables/useAIParser.ts) — `getSavedConfig()` 新增 `modelId === 'custom'` 分支，从保存的 `customName`/`customApiBase`/`customModelName` 构造 `ModelConfig`，校验 URL 与模型标识符非空；`configuredModelName`/`parsePhysicsProblem` 透传自定义值
- **存储向后兼容**：旧 `{ modelId, apiKey }` 预设配置走原路径；新自定义配置扩展 3 字段；无迁移

### 3. 真题库更新

- [src/data/questionBank.ts](file:///d:/huancun/newwork1/src/data/questionBank.ts)
  - **新增**：2022 全国乙卷跳台滑雪两题（`ski-jump-2022-eth-a` 平抛段第 1-2 问 + `ski-jump-2022-eth-b` 反弹段第 3 问），因引擎不支持自定义反弹规则拆为两个独立场景
  - **移除**：`spotOverlap-demo` 演示题（非高考大题范畴，连同「触发器演示类」空分类注释一并删除）
  - **标题精简**：第一题 `plate-2023-zj` 标题删除末尾实现提示「（螺旋圆轨已简化为单圆弧；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）」，改为单行短标题

### 4. z-index 修复

- [src/App.vue](file:///d:/huancun/newwork1/src/App.vue) — `.app-header` `z-index: 10` → `20`
- **根因**：`.app-header`（flex item, z=10）与 `.edit-toolbar`（flex item, z=10）同处根 stacking context 的 z=10 层，因 `.canvas-wrap`/`.right-area`/`.main` 均不创建 stacking context，`.edit-toolbar` 的 z=10 直接参与根上下文；DOM 顺序上工具栏在后、后绘制覆盖 header，导致真题库浮层（`.qbank-popover` z=50 被困在 header 上下文内）被遮挡
- **修复**：提升 header 到 z=20，安全落在 canvas 覆盖层（z=10）与模态弹窗 ApiKeyDialog（z=1000）之间

### 5. 依赖更新 + 文档

- [package.json](file:///d:/huancun/newwork1/package.json) / [package-lock.json](file:///d:/huancun/newwork1/package-lock.json) — vitepress `^1.6.4` → `2.0.0-alpha.18` + 锁文件同步
- [docs/QUESTION_FORMAT_SPEC.md](file:///d:/huancun/newwork1/docs/QUESTION_FORMAT_SPEC.md) — 新增题目格式规范文档（ParsedProblem 契约、物体类型字段、坐标系、数值稳定性约束、ID 命名规则、输出格式模板、真题示例）
- [src/components/DataChart.vue](file:///d:/huancun/newwork1/src/components/DataChart.vue) — prettier 格式化（内联点击处理补分号），无逻辑变化

---

## 改动文件清单（11 个文件，+1441 / -1067）

| 文件 | 主题 |
| ---- | ---- |
| `src/composables/usePhysics.ts` | spotOverlap 触发器引擎 |
| `src/composables/useCollision.ts` | spotOverlap 触发器引擎 |
| `src/composables/useSceneBuilder.ts` | spotOverlap 触发器引擎 |
| `src/components/ApiKeyDialog.vue` | AI 自定义配置 |
| `src/composables/useAIParser.ts` | AI 自定义配置 |
| `src/data/questionBank.ts` | 真题库更新 |
| `src/App.vue` | z-index 修复 |
| `src/components/DataChart.vue` | 格式化 |
| `package.json` / `package-lock.json` | 依赖更新 |
| `docs/QUESTION_FORMAT_SPEC.md` | 文档（新增） |

---

## 验证结果

| 验证项 | 命令 | 结果 |
| ------ | ---- | ---- |
| 类型检查 | `npm run type-check` | ✅ 通过 |
| 单元/集成/回归/契约测试 | `npm run test` | ✅ 335 passed (22 files) |
| Gitee 推送 | `git push gitee chore/project-consolidation` | ✅ 已同步 |
| GitHub 推送 | `git push github chore/project-consolidation` | ✅ 已同步 |

### 手动验证建议

1. 点 header「AI 配置」→ 出现第 4 个「🔧 自定义」按钮；点击后显示 3 个输入框（显示名称/API URL/模型标识符），「获取 Key」链接消失；4 字段任一为空时保存按钮禁用；填全保存后状态栏与 header 按钮显示自定义名称。
2. 自定义场景下点 header「真题库」→ 浮层完全覆盖在编辑工具栏之上，搜索框可点击。
3. 真题库列表第一题标题为「游戏装置（2023·浙江·高考真题）」（无末尾提示）；跳台滑雪两题可加载。
4. 构造含 `entryGap.triggerType:'spotOverlap'` 的圆环场景，确认小球经过触发点时缺口一次性开/关，重置后恢复。

---

## 风险与遗留

- **spotOverlap 引擎暂无题库题目使用**：移除 `spotOverlap-demo` 演示题后，该触发器能力在真题库中暂无题目引用，作为引擎能力保留供后续题目或自定义场景使用。
- **vitepress 升级到 alpha 版**：`2.0.0-alpha.18` 为预发布版本，文档站点构建需关注潜在破坏性变更。
- **AI 自定义配置无自动化测试**：本次未新增 useAIParser/ApiKeyDialog 测试（遵循写代码/写测试会话分离纪律），建议另起会话补测试。

## 远程仓库

- GitHub: https://github.com/Zh386874/PhysicsCanvas
- Gitee: https://gitee.com/zhang-hao041030/physics-canvas
