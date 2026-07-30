# 代码质量审查报告

> 基于 SOLID 原则、代码组织原则和架构原则检查项目代码
> 本次为**现状审查**：基于当前代码重新评估既往问题并补充新发现，已解决项标注 ✅ 并简述实现。

---

## 一、符合原则的部分 ✅

### 1.1 关注点分离（良好）

项目已实现清晰的分层架构：

| 层 | 文件 | 职责 |
|----|------|------|
| 组件层 | 10 个 Vue 组件 + App.vue | UI 渲染 + 用户交互 |
| Composable 层 | 16 个 .ts 文件 | 业务逻辑封装（含本次拆分新增 6 个） |
| 数据层 | questionBank.ts | 题库数据定义 |
| 常量层 | constants.ts | 全局共享常量集中管理 |
| 测试层 | tests/（unit/integration/regression） | Vitest 自动化测试 |

PhysicsCanvas.vue 拆分为 3 个 composable，App.vue 进一步按 SRP 拆分为 4 个 composable，usePhysics.ts 拆出快照与力计算两个 composable（详见 1.2）。

### 1.2 单一职责原则（良好）

经多轮拆分后，核心模块职责清晰：

| 模块 | 职责 | 现状 |
|------------|------|------|
| App.vue | 组件编排 + 布局 | ~309 行，仅组装 4 个 composable（原 ~600 行） |
| usePhysics | 物理状态 + 欧拉积分 + 场景加载 + 物体增删 | 快照/关键帧外移至 useSnapshotManager，合力计算外移至 useForces |
| useCollision | 碰撞检测（地面/质点/线段/弧线）+ 弧线约束动力学 + 触发器缺口 | ~640 行，含 applyArcConstraint/tryActivateArcConstraint |
| useForces | 合力计算策略层（力注册表 + 策略模式） | 遵循 OCP |
| useSnapshotManager | 快照录制 + 关键帧检测 + 回放状态 | 从 usePhysics 拆出 |
| useCanvasRenderer | Canvas 绘制（纯函数） | 无状态 |
| useCanvasInteraction | 鼠标事件 + 拖拽 + 平移缩放 | 通过 PhysicsStateAccess 接口注入依赖（DIP） |
| useHistory | 撤销/重做历史栈 | ~90 行 |

### 1.3 DRY 原则（良好）

- 类型定义统一在 `usePhysics.ts`，其他文件通过 `import type` 导入
- 全局常量集中管理在 `src/constants.ts`（GROUND_DISABLED、MAX_SUBSTEPS、MAX_STEP_DIST、TRAIL_LENGTH、MAX_SNAPSHOTS、画布常量、SCENE_VERSION），消除魔法数字散落

### 1.4 组合优于继承（良好）

项目完全使用 Composition API 组合模式：
- Composables 之间通过 `import` 组合
- 组件之间通过 `props` + `emit` 通信
- 无深层继承体系

### 1.5 单向数据流（良好）

- `usePhysics.state` 是唯一数据源
- 组件只读取，不直接修改
- 所有修改通过 `loadScene`/`addObject`/`removeObject` 等函数
- 交互层通过 `PhysicsStateAccess` 抽象接口访问状态，不直接 import state

### 1.6 接口隔离原则（良好）

`ParsedObject` 已拆分为判别联合（`ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring`），每个类型只含自己需要的字段，通过 `type` 字段收窄。

---

## 二、既往问题重评

### 2.1 【SRP】App.vue 承担过多职责 → ✅ 已解决

**现状**：App.vue 已从 ~600 行降至 ~309 行，业务逻辑委托给 4 个 composable：
- `useSceneManager` — 场景切换、播放/重置、自定义场景持久化、AI/题库加载
- `useObjectOperations` — 物体增删改、选中、撤销/重做、Delete 键
- `useSceneIO` — 导出/导入/剪贴板/物体验证
- `useKeyboard` — 全局键盘快捷键

App.vue 现仅保留组件编排、布局与少量本地 UI 状态（API Key 对话框）。

### 2.2 【SRP】usePhysics.ts 职责混杂 → ✅ 已解决

**现状**：usePhysics.ts 已拆分：
- 快照录制 + 关键帧检测 + 回放状态 → `useSnapshotManager.ts`（usePhysics 通过 re-export 暴露 `snapshots`/`currentFrame`/`keyframeIndices`）
- 合力计算 → `useForces.ts`（`calculateTotalForce` 策略注册表，遵循 OCP）

usePhysics 现仅保留物理状态、欧拉积分、子步循环、场景加载与物体增删。

### 2.3 【SRP】useCanvasInteraction.ts 状态分散 → 🟡 部分改善（低优先级）

**现状**：模块级 `let` 变量仍存在（panning/drawing/dragging/selectionActive/batchDragging 等），但已按职责分组并加注释（平移/绘制/拖拽/框选/批量拖拽），且 `dragTarget`/`batchDragInitial` 已替换为类型化接口（`DragTarget`/`BatchDragItem`）。功能正常运行。

**残留**：未进一步归并为几个 reactive 对象。属可读性优化，非功能性问题，优先级低。

### 2.4 【ISP】ParsedObject 接口过于庞大 → ✅ 已解决

**现状**：`ParsedObject` 已重构为判别联合，详见 [API.md - AI 解析类型](API.md#15-ai-解析类型)：

```typescript
interface BaseParsedObject { id?: string; type: 'ball' | 'platform' | 'arc' | 'spring' }
interface ParsedBall extends BaseParsedObject { type: 'ball'; mass?; charge?; radius?; initialPosition?; initialVelocity?; ... }
interface ParsedPlatform extends BaseParsedObject { type: 'platform'; startPoint?; endPoint?; friction?; beltVelocity?; movable?; mass? }
interface ParsedArc extends BaseParsedObject { type: 'arc'; center?; arcRadius?; ...; entryGap?; exitGap? }
interface ParsedSpring extends BaseParsedObject { type: 'spring'; anchor?; ballId?; naturalLength?; k? }
type ParsedObject = ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring
```

`convertToSceneParams` 中通过 `obj.type === 'ball'` 判别收窄，类型安全。

### 2.5 【OCP】subStepPhysics 硬编码力计算 → ✅ 已解决

**现状**：合力计算已抽离至 `useForces.ts`，采用力注册表 + 策略模式：

```typescript
const forceCalculators: ForceCalculator[] = []
export function registerForce(calculator: ForceCalculator): void { ... }
export function calculateTotalForce(state, particle): { fx, fy } { ... }
```

默认注册 4 种力（重力、自定义力、场力 qE+qvB、弹簧力 -kx）。添加新力（如空气阻力）只需调用 `registerForce` 注册新策略，无需修改 subStepPhysics 核心逻辑，符合 OCP。

### 2.6 【DIP】useCanvasInteraction 直接依赖具体实现 → ✅ 已解决

**现状**：useCanvasInteraction 不再 `import { state } from './usePhysics'`，改为通过 `PhysicsStateAccess` 接口注入：

```typescript
export interface PhysicsStateAccess {
  readonly objects: PhysicsObject[]
  groundY: number
}
export function initCanvasInteraction(canvas, propsGetter, emitter, state: PhysicsStateAccess): void
```

仅 `import type` 类型与 `constants`，运行时依赖由 `initCanvasInteraction` 注入，便于测试和替换状态源。

### 2.7 【显式优于隐式】any 类型滥用 → ✅ 基本解决

**现状**：useCanvasInteraction 的 `dragTarget`/`batchDragInitial` 已替换为类型化接口（`DragTarget`/`BatchDragItem`），App.vue 的 `handleBatchUpdate` 已移至 useObjectOperations 并类型化。

**残留**：`useHistory.ts:27` 仍有一处 `o as any`（剥离运行时字段 trail/prevX/prevY 时）。useSceneIO.ts 同类操作已改用更安全的 `as unknown as Record<string, unknown>`，useHistory 可对齐此写法（见三、新发现）。

### 2.8 【KISS】handleImportScene 函数过长 → ✅ 已解决

**现状**：导入逻辑已移至 `useSceneIO.ts` 并拆分为：
- `deepCopyObjects(objs)` — 纯函数，深拷贝并剥离运行时字段
- `validateObject(o)` — 纯函数，校验并规范化单个物体
- `handleImportScene()` — ~50 行，读取剪贴板 → 解析 → 校验 → 加载 → 错误提示

原 150 行长函数已分解，可读性与可测试性提升。

### 2.9 【DRY】魔法数字散落 → ✅ 已解决

**现状**：全局共享常量集中管理在 `src/constants.ts`，详见 [ARCHITECTURE.md - 核心常量体系](ARCHITECTURE.md#四核心常量体系)。各 composable 通过 `import` 使用，无重复定义。

### 2.10 【YAGNI】预留的 prevX/prevY 字段 → ✅ 非问题（重新评估）

**现状**：`prevX`/`prevY` 是 CCD（连续碰撞检测）的核心字段，**正在被积极使用**：
- `usePhysics.ts:222-223`（subStepPhysics 开头赋值上一帧位置）
- `useCollision.ts:113-127`（detectSegmentCollision 线段 CCD 路径求交）
- `useCollision.ts:321-344`（detectArcCollision 弧线 CCD 路径求交）

CCD 是防隧穿的核心机制，非"预留未来字段"。原审查的 YAGNI 担忧不成立，字段合理保留。

---

## 三、新发现的问题

### 3.1 【一致性】useHistory.ts 残留 `as any`（🟢 P2）

`useHistory.ts:27` 剥离运行时字段时使用 `o as any`，而 `useSceneIO.ts:20` 同类操作已改用 `as unknown as Record<string, unknown>`。建议对齐写法以保持一致性。

### 3.2 【测试覆盖】物理引擎核心逻辑测试缺口（🟡 P1）

当前 Vitest 12 个测试集中在**弧线碰撞与约束**（collision.test.ts / ring-scene.test.ts / ball-through-ring.test.ts）。以下核心逻辑仍无自动化测试覆盖：
- `usePhysics.ts` 欧拉积分（自由落体、平抛、弹簧周期）
- `useForces.ts` 合力计算策略（重力、场力、弹簧力）
- `useCollision.ts` 地面碰撞、质点间碰撞、线段 CCD 碰撞

详见 [TESTING.md - 未来测试计划](TESTING.md#十未来测试计划) 第二阶段。

### 3.3 【SRP 残留】useCanvasInteraction 模块级状态（🟢 P2）

见 2.3，模块级 `let` 状态可归并为几个 reactive 对象以提升可追踪性，属可选优化。

### 3.4 【类型】emit 桥接函数签名宽松（🟢 P2）

`useCanvasInteraction.ts` 的 `emitFn: (event: string, ...args: unknown[]) => void` 为兼容 Vue emit 采用宽松签名。这是 Vue `<script setup>`（非 TS）与 composable 交互的 pragmatic 折中，影响有限。

---

## 四、问题严重程度分级（现状）

| 级别 | 问题 | 影响 |
|------|------|------|
| 🟡 P1 | 测试覆盖缺口（积分/力计算/基础碰撞未覆盖） | 核心逻辑改动缺乏回归保护 |
| 🟢 P2 | useHistory.ts 残留 `as any` | 一致性，非功能性 |
| 🟢 P2 | useCanvasInteraction 模块级状态 | 可读性，非功能性问题 |
| 🟢 P2 | emit 桥接签名宽松 | 类型安全折中，影响有限 |

> 既往 P0 问题（App.vue SRP、ParsedObject ISP）均已解决。当前无 P0 问题。

---

## 五、修复优先级建议

### 近期（P1）

1. **扩展单元测试覆盖** — 为 usePhysics 积分、useForces 力计算、基础碰撞编写单元测试（对应 TESTING.md 第二阶段）

### 长期优化（P2）

2. **对齐 useHistory 类型写法** — `as any` → `as unknown as Record<string, unknown>`
3. **归并 useCanvasInteraction 模块级状态** — 按职责封装为 reactive 对象（可选）
4. **vue-tsc 类型检查纳入 CI** — 对应 FR-8.2，需先补全 emit 类型签名

---

## 六、已解决问题汇总（可追溯）

| 原问题 | 解决方式 |
|--------|----------|
| 2.1 App.vue SRP | 拆分为 useSceneManager/useObjectOperations/useSceneIO/useKeyboard，~600→~309 行 |
| 2.2 usePhysics SRP | 拆出 useSnapshotManager（快照/关键帧）与 useForces（合力计算） |
| 2.4 ParsedObject ISP | 重构为判别联合 ParsedBall\|ParsedPlatform\|ParsedArc\|ParsedSpring |
| 2.5 OCP 硬编码力 | useForces 力注册表 + 策略模式，registerForce 扩展 |
| 2.6 DIP 直接依赖 | PhysicsStateAccess 接口 + initCanvasInteraction 依赖注入 |
| 2.7 any 类型 | DragTarget/BatchDragItem 类型化（useHistory 残留 1 处） |
| 2.8 KISS 长函数 | 移至 useSceneIO，提取 deepCopyObjects/validateObject 纯函数 |
| 2.9 魔法数字 | 集中至 src/constants.ts |
| 2.10 prevX/prevY | 重新评估为 CCD 核心字段，非 YAGNI，合理保留 |
