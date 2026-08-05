# 测试文档

> 本文档描述物理解模项目的测试策略、测试用例和未来测试计划。

---

## 一、测试现状

### 1.1 当前状态

项目已建立 **Vitest 自动化测试体系**，覆盖物理引擎积分、碰撞检测、力计算、场景管理、物体操作、撤销重做、快照回放、场区域、弧线缺口换算、板块模型、物理定律契约等，共 **358 个测试** 跨 **26 个文件**（unit / integration / regression / contracts 四层）。物理引擎积分定律与碰撞守恒已由契约测试覆盖，核心物理逻辑（积分、力、碰撞）均有单元测试覆盖。

### 1.2 测试目标

| 目标 | 说明 |
|------|------|
| 物理引擎正确性 | 验证力模型、碰撞检测、积分方法的数学正确性 |
| 回归防护 | 防止修复一个 bug 时引入新 bug（如球穿环回归） |
| 题库场景验证 | 确保真题加载后行为符合物理预期 |
| UI 交互可靠性 | 验证编辑器工具、拖拽、框选等交互 |

### 1.3 测试文件结构

```
tests/
├── helpers/
│   └── sceneBuilder.ts              ← 测试夹具：构建圆环场景 + 单步模拟（不依赖 Vue reactive）
├── unit/                            ← 单元测试（14 文件，243 测试）
│   ├── collision.test.ts            ← 弧线碰撞与约束激活（6 测试）
│   ├── collision-branches.test.ts   ← 碰撞分支全覆盖（37 测试）
│   ├── physics-engine.test.ts       ← 物理引擎积分逻辑（27 测试）
│   ├── forces.test.ts               ← 力计算策略（18 测试）
│   ├── history.test.ts              ← 撤销/重做历史（17 测试）
│   ├── object-operations.test.ts    ← 物体增删改操作（36 测试）
│   ├── presets.test.ts              ← 预设场景（37 测试）
│   ├── snapshot-manager.test.ts     ← 快照录制/回放（29 测试）
│   ├── plate-definition.test.ts     ← 板块 type:plate 定义与默认值（7 测试）
│   ├── reset-merge.test.ts          ← 重置合并策略（6 测试）
│   ├── arc-gap-conversion.test.ts   ← 弧线缺口角度换算（6 测试）
│   ├── field-region-style.test.ts   ← 场区域样式（10 测试）
│   ├── plate-rect-model.test.ts     ← 板块矩形模型（5 测试）
│   └── scene-manager.test.ts        ← 场景管理（2 测试）
├── integration/                     ← 集成测试（4 文件，52 测试）
│   ├── ring-scene.test.ts           ← 2023 浙江题圆环完整物理循环（3 测试）
│   ├── forces-physics.test.ts       ← 力与物理引擎集成（18 测试）
│   ├── scene-replay.test.ts         ← 场景回放集成（15 测试）
│   └── undo-redo-physics.test.ts    ← 撤销重做物理状态（16 测试）
├── regression/                      ← 回归测试（7 文件，59 测试）
│   ├── ball-through-ring.test.ts    ← 球穿环 bug 修复验证（3 测试）
│   ├── entry-stuck-outside.test.ts  ← 球卡环外 bug 修复验证（3 测试）
│   ├── elastic-collision-restitution.test.ts  ← 弹性碰撞恢复系数（21 测试）
│   ├── non-elastic-common-velocity.test.ts    ← 非弹性碰撞共速（7 测试）
│   ├── friction-direction.test.ts   ← 摩擦力方向（11 测试）
│   ├── plate-wall-collision.test.ts ← 板块与墙壁碰撞（7 测试）
│   └── arc-full-circle-normal.test.ts   ← 完整圆法线计算（7 测试）
└── contracts/                       ← 物理定律契约（不可篡改，1 文件，4 测试）
    └── physics-laws.test.ts         ← 自由落体/匀速/弹性碰撞/非弹性碰撞（4 测试）
```

### 1.4 测试完整性政策

为防止 AI IDE 为"让测试变绿"而删除、跳过、弱化测试断言，本项目建立**四层防御**：

| 层 | 机制 | 文件 | 作用 |
|----|------|------|------|
| 规则层 | AI 协作纪律 | `CLAUDE.md` | 明确禁止删测试/skip/弱化断言，失败必须修生产代码 |
| 契约层 | 物理铁律契约 | `tests/contracts/` | 能量/动量守恒等铁律，AI 不可修改 |
| 本地层 | pre-commit 拦截 | `.husky/pre-commit` | 删除测试文件 / 篡改 contracts → 拒绝提交 |
| 远程层 | CI 门禁 | `.github/workflows/ci.yml` | 测试数量减少 / contracts 篡改 → 拒绝合并 |

**合法修改测试的流程**：如确需删除或修改测试（如测试本身有 bug、需求变更），须由人工执行 `git commit --no-verify` 并在提交信息中写明理由。`tests/contracts/` 的修改还需在 PR 说明中单独说明。

详见 [`CLAUDE.md`](../CLAUDE.md) 「测试纪律」与「物理定律契约测试」章节。

---

## 二、测试策略

### 2.1 测试分层

```
┌─────────────────────────────────────────┐
│           E2E 测试（Playwright）          │  ← 🚧 规划中：题库加载、端到端流程
├─────────────────────────────────────────┤
│         组件测试（Vue Test Utils）         │  ← 🚧 规划中：props/emit、交互响应
├─────────────────────────────────────────┤
│         集成测试（Vitest）                 │  ← ✅ 已建立：composable 组合行为（圆环场景）
├─────────────────────────────────────────┤
│         单元测试（Vitest）                 │  ← ✅ 已建立：物理引擎、碰撞检测、工具函数
└─────────────────────────────────────────┘
```

### 2.2 工具栈

| 工具 | 用途 | 状态 |
|------|------|------|
| Vitest ^4.1.10 | 单元/集成/回归/契约测试 | ✅ 已安装 |
| @vitest/coverage-v8 ^4.1.10 | 覆盖率报告 | ✅ 已安装 |
| @vue/test-utils | 组件测试 | 🚧 待安装 |
| @playwright/test | E2E 测试 | 🚧 待安装 |
| jsdom | DOM 环境 | 🚧 待安装（当前 environment=node） |

---

## 三、配置与运行

### 3.1 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',              // 物理引擎为纯计算，无需 DOM
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/composables/**/*.ts', 'src/data/**/*.ts', 'src/constants.ts'],
      exclude: ['src/**/*.d.ts', 'tests/**', 'src/types/**'],
      thresholds: {
        statements: 18,
        branches: 18,
        functions: 10,
        lines: 18
      }
    }
  },
})
```

### 3.2 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run test` | 单次运行全部测试（`vitest run`） |
| `npm run test:watch` | 监听模式（`vitest`，文件变动自动重跑） |
| `npm run test:contracts` | 仅运行契约测试（`vitest run tests/contracts`） |
| `npm run test:coverage` | 运行测试并生成覆盖率报告（`vitest run --coverage`） |
| `npm run test:integrity` | 检查两次提交间的测试完整性（`node scripts/check-test-integrity.mjs`） |
| `npm run coverage:check` | 检查覆盖率是否回归（`node scripts/check-coverage-regression.mjs`） |
| `npm run coverage:save-baseline` | 保存当前覆盖率基线（`node scripts/save-coverage-baseline.mjs`，**人工操作，AI 禁止自动运行**） |
| `npm run type-check` | vue-tsc 类型检查（`vue-tsc --noEmit`） |
| `npm run lint` / `lint:check` | ESLint 自动修复 / 仅检查 |
| `npm run format` / `format:check` | Prettier 格式化 / 仅检查 |
| `npm run docs:dev` / `docs:build` / `docs:preview` | VitePress 文档开发 / 构建 / 预览 |

### 3.3 测试夹具（tests/helpers/sceneBuilder.ts）

`buildRingScene()` 基于 `questionBank.ts` 2023 浙江题圆轨 BCDE 配置（坐标 ×1.6，画布坐标系），手动构建弧线段 + 小球，**不依赖 Vue reactive**，使物理引擎可在纯 Node 环境测试。

`simulateStep(objects, dt, gravity, groundY)` 为简化版 `subStepPhysics`：处理质点重力、速度、位置更新并调用 `checkCollision`，供集成/回归测试驱动多步模拟。

---

## 四、单元测试

### 4.1 collision.test.ts — 弧线碰撞与约束激活（6 测试）

通过 `checkCollision` 公共 API 测试弧线碰撞检测与约束激活的各子场景：

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 球在弧面外侧触碰 → 激活约束 | `constrainedArcGroupId` 设为弧线 groupId |
| 2 | gate 开 + 球在缺口角度 → 不激活约束 | 缺口放行优先，允许穿过 |
| 3 | gate 关 + 球在环内深处（>4px）→ 激活约束 | catch-up 机制跳过距离判定强制激活 |
| 4 | gate 关 + 球在弧外远处 → 不激活约束 | 距离过远不误激活 |
| 5 | gate 关 + 球在弧外触碰 → 激活约束 | 正常碰撞触发约束 |
| 6 | gate 开 + 球在缺口但深入环内 → 不激活约束 | 缺口放行优先于 catch-up |

> 用例 3/6 专门覆盖 `tryActivateArcConstraint` 的 **catch-up 逻辑** 与 **缺口放行优先级**，即球穿环 bug 的根因场景。

### 4.2 collision-branches.test.ts — 碰撞分支全覆盖（37 测试）

全面覆盖 `checkCollision` 的分支逻辑：

- 地面碰撞：开启/禁用、不同恢复系数、速度反射
- 线段碰撞：CCD 路径求交、法线反射、摩擦减速
- 弧线碰撞：缺口放行、约束激活/解除、完整圆特判
- 质点间碰撞：弹性、非弹性、分离重叠
- 边界条件：空物体列表、无碰撞、所有物体静止

### 4.3 physics-engine.test.ts — 物理引擎积分逻辑（27 测试）

通过 `subStepPhysics` 和 `updatePhysics` 测试积分核心：

- 半隐式欧拉积分：先更新速度再更新位置
- 子步循环：动态子步数计算，MAX_SUBSTEPS 上限
- 重力加速度：默认值、自定义值
- 弹簧力：胡克定律、形变与回复力方向
- 自定义力：方向、大小、作用目标
- 多物体场景：独立积分、互不干扰

### 4.4 forces.test.ts — 力计算策略（18 测试）

通过 `calculateTotalForce` 和 `registerForce` 测试力注册表：

- 默认注册的 4 种力：重力、自定义力、场力（qE+qvB）、弹簧力
- 力注册表扩展：`registerForce` 注册新策略
- 多力叠加：合力为各分力向量和
- 边界条件：零质量物体、无场力

### 4.5 history.test.ts — 撤销/重做历史（17 测试）

测试 `useHistory` 的撤销/重做栈：

- pushHistory → undo → redo 完整流程
- 历史栈上限 MAX_HISTORY（50），超出时移除最旧
- 清空历史、边界条件（空栈 undo/redo 返回 null）

### 4.6 object-operations.test.ts — 物体增删改操作（36 测试）

测试 `useObjectOperations` 的物体管理：

- addObject、removeObject 的增删流程
- 弧线整组删除、弹簧级联删除
- 多物体选中、批量更新
- 撤销/重做对物体状态的恢复

### 4.7 presets.test.ts — 预设场景（37 测试）

测试 `usePresets` 的所有预设场景：

- 6 种预设场景：抛体、斜面、弹性碰撞、磁场圆周、电场偏转、自定义
- 各场景的物体类型、数量、位置正确性
- 自定义场景为空初始状态

### 4.8 snapshot-manager.test.ts — 快照录制/回放（29 测试）

测试 `useSnapshotManager` 的快照功能：

- recordSnapshot 录制时序数据
- 快照结构完整性（objects/field/groundY/gravity/timestamp）
- MAX_SNAPSHOTS 上限裁剪
- 关键帧检测（速度方向突变）
- 清空快照（场景切换时）

### 4.9 plate-definition.test.ts — 板块定义与默认值（7 测试）

测试 `type: 'plate'` 的板块模型：

- 板块默认字段（subtype/movable/physicsThickness/frictionTop/frictionBottom）
- 板块与普通线段的区别
- 板块的物理边界（下表面沿法线反方向偏移 physicsThickness）

### 4.10 reset-merge.test.ts — 重置合并策略（6 测试）

测试场景重置时的合并策略：保留自定义物体、清除选中状态、重置物理时间等。

### 4.11 arc-gap-conversion.test.ts — 弧线缺口角度换算（6 测试）

测试 `src/utils/arcGap.ts` 的角度换算工具函数：

- `gapToDegrees` / `gapFromDegrees` 双向换算一致性
- 经过 0°/360° 边界的缺口（如默认入口缺口中心角 0°、半宽 0.3）取短弧中点
- 完整圆/跨边界缺口的中心角计算正确性

### 4.12 field-region-style.test.ts — 场区域样式（10 测试）

测试场区域（FieldRegion）的样式判定与渲染属性：

- 场区域类型（电场/磁场/重力场）的样式区分
- 尺寸、颜色、透明度等渲染参数的推导逻辑

### 4.13 plate-rect-model.test.ts — 板块矩形模型（5 测试）

测试板块（`type:'plate'`）的矩形模型：

- 板块由线段扩展为矩形（上/下表面 + 端面）的几何计算
- 板块厚度（physicsThickness）与矩形边界的对应关系

### 4.14 scene-manager.test.ts — 场景管理（2 测试）

测试 `useSceneManager` 的场景切换行为：

- 查看题目后点击「自定义」：无保存自定义场景时清空题目回到空白画布
- 有保存自定义场景时恢复用户自定义场景（防回归）

---

## 五、集成测试

### 5.1 ring-scene.test.ts — 圆环完整物理循环（3 测试）

模拟 2023 浙江题小球从缺口进入圆环的全过程，验证约束系统端到端行为：

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 球进入圆环后不穿过底部 | 运行 500 步（~8s），最终距圆心 > r×0.5 |
| 2 | enterRing 触发后入口门关闭 | 球进环后 `arcGateState.entryOpen` 从 true → false |
| 3 | 球被约束后在弧面附近运动 | 约束期间平均距离 ≈ r ± radius×2 |

### 5.2 forces-physics.test.ts — 力与物理引擎集成（18 测试）

验证力计算与物理引擎的协同工作：

- 重力 + 弹簧力的复合场景
- 电场力 + 磁场力的洛伦兹力场景
- 自定义力叠加
- 多物体各自受力独立

### 5.3 scene-replay.test.ts — 场景回放集成（15 测试）

验证回放系统的端到端行为：

- 快照录制 → 回放 → 帧定位
- 回放模式下的物体位置/速度恢复
- 关键帧跳转
- 回放与实时模式切换

### 5.4 undo-redo-physics.test.ts — 撤销重做物理状态（16 测试）

验证撤销/重做对物理状态的完整恢复：

- 添加物体后撤销 → 恢复前状态
- 删除物体后撤销 → 恢复被删物体
- 修改属性后撤销/重做
- 多次操作的撤销/重做链

---

## 六、回归测试

### 6.1 ball-through-ring.test.ts — 球穿环 bug（3 测试）

精确复现"小球穿过圆环" bug 场景，验证修复后不再出现：

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 球从缺口高速进入后不穿过底部 | 运行 300 步，最终距圆心 > r×0.5 |
| 2 | 球在环内应被约束捕获 | 前 100 步内 `constrainedArcGroupId` 被设置 |
| 3 | 约束期间球不脱离到圆心对面 | 约束期间最小距离 > r×0.3 |

> **Bug 根因**：`tryActivateArcConstraint` 与 `detectArcCollision` 均用 `closest.dist > radius`（4px）判定，球深入环内 >4px 时两者同时失效，球穿过底部。修复：catch-up 逻辑在"球在环内 + 门全关"时跳过距离判定强制激活约束。

### 6.2 entry-stuck-outside.test.ts — 球卡环外 bug（3 测试）

验证小球进入圆环不会卡在环外的回归用例：

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 球从入口进入不应卡在环外 | 运行 300 步，球最终进入环内 |
| 2 | 入口门打开时球可穿过缺口 | 球穿过缺口时不被约束捕获 |
| 3 | 入口门关闭后球不可穿过缺口 | 球被门拦住或约束捕获 |

### 6.3 elastic-collision-restitution.test.ts — 弹性碰撞恢复系数（21 测试）

全面覆盖弹性碰撞的恢复系数行为：

- restitution=1（完全弹性）：动量守恒 + 动能守恒
- restitution=0（完全非弹性）：共速、动量守恒
- 0<restitution<1：动量守恒、能量损失符合预期
- 不同质量比的碰撞（大撞小、小撞大、等质量）
- 静止物体被碰撞后的速度

### 6.4 non-elastic-common-velocity.test.ts — 非弹性碰撞共速（7 测试）

专门验证完全非弹性碰撞的共速公式：

- 等质量对撞 → 共速为 0
- 不同质量 → 共速符合动量守恒
- 同向运动 → 共速后一起运动
- 碰撞后不分离

### 6.5 friction-direction.test.ts — 摩擦力方向（11 测试）

验证摩擦力方向始终与相对运动方向相反：

- 斜面滑块：摩擦力沿斜面向上（下滑时）
- 传送带：摩擦力方向基于相对速度
- 水平面摩擦：摩擦力与速度方向相反
- 板块模型：上表面/下表面独立摩擦方向

### 6.6 plate-wall-collision.test.ts — 板块与墙壁碰撞（7 测试）

验证板块与竖直墙壁碰撞的行为：

- 板块撞墙后 vx=0（正常反射，无摩擦）
- 板块撞墙后动量传递
- 板块上物体在撞墙瞬间的运动状态

### 6.7 arc-full-circle-normal.test.ts — 完整圆法线计算（7 测试）

验证完整圆弧（span≈2π）的法线计算：

- 完整圆各段法线方向正确
- 法线不自相矛盾
- 与缺口法线兼容

---

## 七、题库场景验证（手动）

### 7.1 验证方法

每道真题加载后，检查以下条件：

| 检查项 | 方法 |
|--------|------|
| 物体位置正确 | 加载后截图，对比预期位置 |
| 初始速度正确 | 检查 state.objects 中 vx/vy 值 |
| 播放无报错 | 播放 20 秒，控制台无错误 |
| 物理行为合理 | 观察运动轨迹是否符合物理规律 |
| 无卡顿 | FPS > 30（子步数 < 200） |

### 7.2 关键场景验证清单

| 题目 ID | 验证重点 |
|---------|----------|
| plate-2023-zj | 滑块从 AB 下滑 → 进入圆环被约束捕获沿弧面运动 → 过最高点 C 后出口缺口打开 → 经 EF/FG → 滑上摆渡车（板块模型） |

---

## 八、手动测试清单

### 8.1 编辑器测试

| # | 测试步骤 | 预期结果 |
|---|----------|----------|
| 1 | 选择"小球"工具，单击画布 | 在点击位置生成一个小球 |
| 2 | 选择"平台"工具，拖拽 | 生成一条线段，法线自动朝上 |
| 3 | 选择"圆弧"工具，三次点击 | 生成弧线（20 个线段近似） |
| 4 | 选择"弹簧"工具，两次点击 | 第一次设固定端，第二次选球连接 |
| 5 | 按住 Shift 拖拽线段 | 线段方向锁定水平或垂直 |
| 6 | 右键拖拽框选 | 选中框内所有物体 |
| 7 | 中键拖拽 | 平移画布 |
| 8 | 滚轮缩放 | 以鼠标为中心缩放（0.3~100x） |
| 9 | Ctrl+Z / Ctrl+Y | 撤销/重做 |
| 10 | 切换到预设场景 | editMode 关闭，工具栏隐藏 |

### 8.2 真题库测试

| # | 测试步骤 | 预期结果 |
|---|----------|----------|
| 1 | 点击题目项 | 高亮选中，底部显示"加载场景并播放"按钮 |
| 2 | 点击题目右侧 ▶ 按钮 | 直接加载该题目场景 |
| 3 | 搜索关键词 | 列表过滤匹配的题目 |
| 4 | 切换难度筛选 | 列表过滤对应难度的题目 |
| 5 | 加载 plate-2023-zj | 圆环场景正确显示，小球进环后沿弧面运动不穿底 |
| 6 | 连续切换题目 | 每次切换场景正确重置 |

### 8.3 回放测试

| # | 测试步骤 | 预期结果 |
|---|----------|----------|
| 1 | 播放 2 秒后切换到回放模式 | 时间轴显示已录制的帧 |
| 2 | 拖动时间轴滑块 | 画面跳转到对应帧 |
| 3 | 点击关键帧导航 ◀ ▶ | 跳转到上一个/下一个关键帧 |
| 4 | 关键帧标记 | 黄色竖线标记在速度变号/碰撞位置 |

---

## 九、性能测试

### 9.1 FPS 监控

```javascript
// 在浏览器控制台执行
let frames = 0
let lastTime = performance.now()
function measure() {
  frames++
  const now = performance.now()
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frames}`)
    frames = 0
    lastTime = now
  }
  requestAnimationFrame(measure)
}
measure()
```

### 9.2 性能基准

| 场景 | 目标 FPS | 子步数/帧 | 说明 |
|------|----------|-----------|------|
| 常规力学（3 物体） | ≥ 60 | 1-2 | 无压力 |
| 碰撞（3 球连环） | ≥ 60 | 1-3 | 碰撞瞬间子步增加 |
| 磁场（宏观参数） | ≥ 60 | 1-4 | 参数已优化 |
| 电场（宏观参数） | ≥ 60 | 1-4 | 参数已优化 |
| 弹簧（k=10-20） | ≥ 60 | 1-2 | 数值稳定 |
| 极端情况（MAX_SUBSTEPS） | ≥ 30 | ≤ 200 | 上限保护 |

---

## 十、未来测试计划

### 10.1 第一阶段：基础测试体系 ✅ 已完成

- [x] 安装 Vitest（^4.1.10）
- [x] 为 `useCollision.ts` 编写弧线碰撞与约束激活单元测试（6 用例）
- [x] 建立 `tests/helpers/sceneBuilder.ts` 测试夹具
- [x] 添加 `"test"` / `"test:watch"` / `"test:coverage"` / `"test:contracts"` 等脚本

### 10.2 第二阶段：扩展测试覆盖 ✅ 已完成

- [x] 为 `usePhysics.ts` 积分逻辑编写单元测试（physics-engine.test.ts，27 测试）
- [x] 为 `useForces.ts` 合力计算策略编写单元测试（forces.test.ts，18 测试）
- [x] 覆盖地面碰撞、线段 CCD 碰撞（collision-branches.test.ts，37 测试）
- [x] 覆盖撤销/重做历史（history.test.ts，17 测试）
- [x] 覆盖物体增删改操作（object-operations.test.ts，36 测试）
- [x] 覆盖预设场景（presets.test.ts，37 测试）
- [x] 覆盖快照录制/回放（snapshot-manager.test.ts，29 测试）
- [x] 覆盖板块模型（plate-definition.test.ts，7 测试）
- [x] 覆盖重置合并策略（reset-merge.test.ts，6 测试）
- [x] 覆盖弹性碰撞恢复系数（elastic-collision-restitution.test.ts，21 测试）
- [x] 覆盖非弹性碰撞共速（non-elastic-common-velocity.test.ts，7 测试）
- [x] 覆盖摩擦力方向（friction-direction.test.ts，11 测试）
- [x] 覆盖板块与墙壁碰撞（plate-wall-collision.test.ts，7 测试）
- [x] 覆盖完整圆法线计算（arc-full-circle-normal.test.ts，7 测试）
- [x] 建立物理定律契约测试（physics-laws.test.ts，4 测试）
- [x] 建立四层测试完整性防御（CLAUDE.md 规则 + husky pre-commit + CI 门禁 + contracts 不可篡改）

### 10.3 第三阶段：组件测试 🚧

- [ ] 安装 @vue/test-utils + jsdom
- [ ] 为 ControlBar、ObjectList、Timeline 编写组件测试
- [ ] 验证 props 传递和 emit 事件

### 10.4 第四阶段：E2E 测试 🚧

- [ ] 安装 Playwright
- [ ] 编写真题库加载流程的 E2E 测试
- [ ] 编写编辑器交互的 E2E 测试
- [ ] 在 CI 中添加测试步骤
