# 代码质量审查报告

> 基于 SOLID 原则、代码组织原则和架构原则检查项目代码

---

## 一、符合原则的部分 ✅

### 1.1 关注点分离（良好）

项目已实现清晰的分层架构：

| 层 | 文件 | 职责 |
|----|------|------|
| 组件层 | 11 个 Vue 组件 | UI 渲染 + 用户交互 |
| Composable 层 | 11 个 .ts 文件 | 业务逻辑封装 |
| 数据层 | questionBank.ts | 题库数据定义 |

PhysicsCanvas.vue 拆分为 3 个 composable 的设计符合 SRP：
- `useCanvasRenderer` — 纯绘制函数，无状态
- `useCanvasInteraction` — 事件处理 + 拖拽 + 平移缩放
- `useEditTools` — 工具状态管理

### 1.2 单一职责原则（良好）

大部分 composable 职责清晰：

| Composable | 职责 | 行数 |
|------------|------|------|
| usePhysics | 物理状态 + 欧拉积分 + 快照 | ~420 |
| useCollision | 碰撞检测（地面/质点/线段/弧线） | ~500 |
| useCanvasRenderer | Canvas 绘制（纯函数） | ~600 |
| useCanvasInteraction | 鼠标事件 + 拖拽 + 平移缩放 | ~500 |
| useHistory | 撤销/重做历史栈 | ~90 |

### 1.3 DRY 原则（良好）

类型定义已统一在 `usePhysics.ts`，其他文件通过 `import type` 导入（已在本次会话修复）。

### 1.4 组合优于继承（良好）

项目完全使用 Composition API 组合模式：
- Composables 之间通过 `import` 组合
- 组件之间通过 `props` + `emit` 通信
- 无深层继承体系

### 1.5 单向数据流（良好）

架构设计文档明确约定：
- `usePhysics.state` 是唯一数据源
- 组件只读取，不直接修改
- 所有修改通过 `loadScene`/`addObject`/`removeObject` 等函数

---

## 二、不符合原则的部分 ⚠️

### 2.1 【SRP 违规】App.vue 承担过多职责

**问题**：App.vue（~600 行）同时负责：
- 组件编排和布局
- 场景切换逻辑（`onSceneSwitch`）
- 播放/重置逻辑（`onTogglePlay`/`onReset`）
- 自定义场景持久化（`saveCustomScene`/`restoreCustomScene`）
- AI 解析回调（`handleLoadPreset`/`handleSceneBuilt`）
- 真题库加载（`handleLoadQuestion`）
- 物体操作（`handleAddObject`/`handleRemoveObject`）
- 场景导出/导入（`handleExportScene`/`handleImportScene`）
- 历史管理（`onUndo`/`onRedo`）

**违反原则**：单一职责原则（SRP）— 一个模块只负责一件事。

**建议**：拆分为多个 composable：
- `useSceneManager` — 场景切换、预设加载、持久化
- `useObjectOperations` — 物体增删改查
- `useSceneIO` — 导入/导出/剪贴板

---

### 2.2 【SRP 违规】usePhysics.ts 职责混杂

**问题**：usePhysics.ts（~420 行）同时负责：
- 物理状态管理（`state`）
- 欧拉积分（`subStepPhysics`）
- 子步循环（`updatePhysics`）
- 快照录制（`snapshots`）
- 关键帧检测（`detectKeyframe`）
- 场景加载（`loadScene`）
- 物体增删（`addObject`/`removeObject`）

**违反原则**：单一职责原则（SRP）— 物理引擎和快照系统混在一起。

**建议**：拆分为：
- `usePhysicsCore` — 纯物理引擎（state + updatePhysics + subStepPhysics）
- `useSnapshotManager` — 快照录制 + 关键帧检测 + 回放状态
- `useSceneManager` — 场景加载 + 物体管理

---

### 2.3 【SRP 违规】useCanvasInteraction.ts 状态分散

**问题**：文件开头定义了 8 个模块级变量：
```typescript
let panning = false
let panStart = null
let drawing = false
let drawStart = null
let dragging = false
let dragTarget = null
let selectionActive = false
let selectionStart = null
let batchDragging = false
let batchDragStartPos = null
```

**违反原则**：SRP + 隐式状态 — 多个独立状态散落在文件中，难以追踪和维护。

**建议**：将状态归类为几个 reactive 对象：
```typescript
const panState = reactive({ active: false, start: null })
const dragState = reactive({ active: false, target: null, justDragged: false })
const selectionState = reactive({ active: false, start: null, end: null })
```

---

### 2.4 【ISP 违规】ParsedObject 接口过于庞大

**问题**：`ParsedObject` 接口（useAIParser.ts:9-37）包含 19 个可选字段：
```typescript
export interface ParsedObject {
  id?: string
  type: 'ball' | 'platform' | 'arc' | 'spring'
  mass?: number
  charge?: number
  radius?: number
  initialVelocity?: Vec2
  initialPosition?: Vec2
  startPoint?: Vec2
  endPoint?: Vec2
  center?: Vec2
  arcRadius?: number
  startAngle?: number
  endAngle?: number
  friction?: number
  fixed?: boolean
  anchor?: Vec2
  ballId?: string
  naturalLength?: number
  k?: number
  beltVelocity?: Vec2
  movable?: boolean
}
```

但每个类型实际只使用其中几个字段：
- `ball` 使用：id, mass, charge, radius, initialPosition, initialVelocity
- `platform` 使用：id, startPoint, endPoint, friction, beltVelocity, movable
- `spring` 使用：id, anchor, ballId, naturalLength, k

**违反原则**：接口隔离原则（ISP）— 类被强迫依赖它不需要的接口。

**建议**：拆分为多个类型：
```typescript
interface BaseParsedObject {
  id?: string
  type: 'ball' | 'platform' | 'arc' | 'spring'
}

interface ParsedBall extends BaseParsedObject {
  type: 'ball'
  mass?: number
  charge?: number
  radius?: number
  initialPosition?: Vec2
  initialVelocity?: Vec2
}

interface ParsedPlatform extends BaseParsedObject {
  type: 'platform'
  startPoint?: Vec2
  endPoint?: Vec2
  friction?: number
  beltVelocity?: Vec2
  movable?: boolean
}

type ParsedObject = ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring
```

---

### 2.5 【OCP 违规】subStepPhysics 函数硬编码力计算

**问题**：`usePhysics.ts` 的 `subStepPhysics` 函数（lines 193-257）硬编码了所有力计算：
```typescript
// 合力 = 重力 + 自定义力 + 场力 + 弹簧力
let fx = 0
let fy = p.mass * state.gravity

for (const force of state.forces) { ... }
if (charge !== 0) { ... }
for (const s of state.objects) { if (s.type === 'spring') ... }
```

**违反原则**：开闭原则（OCP）— 添加新力（如空气阻力、浮力）需修改核心函数。

**建议**：使用策略模式 + 力注册表：
```typescript
// usePhysics.ts
const forceCalculators = new Map<string, ForceCalculator>()

function registerForce(type: string, calculator: ForceCalculator) {
  forceCalculators.set(type, calculator)
}

function subStepPhysics(subDt: number): boolean {
  for (const [type, calc] of forceCalculators) {
    const { fx, fy } = calc(obj, state)
    totalFx += fx
    totalFy += fy
  }
}

// 注册默认力
registerForce('gravity', gravityCalculator)
registerForce('field', fieldForceCalculator)
registerForce('spring', springForceCalculator)
```

---

### 2.6 【DIP 违规】useCanvasInteraction 直接依赖具体实现

**问题**：`useCanvasInteraction.ts` 直接导入并调用 `usePhysics.state`：
```typescript
import { state } from './usePhysics'
```

在事件处理函数中直接修改状态：
```typescript
function onMouseDown(e) {
  const pos = getMousePos(e)
  if (tool.value === 'ball') {
    const newBall = { ... }
    emitFn('add-object', newBall)  // 依赖 emitFn
  }
}
```

**违反原则**：依赖倒置原则（DIP）— 高层模块（交互层）直接依赖低层模块（状态层）。

**建议**：通过依赖注入传入状态访问接口：
```typescript
interface PhysicsStateAccess {
  objects: PhysicsObject[]
  isPlaying: boolean
}

function initCanvasInteraction(
  canvas: Ref<HTMLCanvasElement>,
  stateAccess: PhysicsStateAccess,  // 抽象接口
  emitter: EventEmitter
) {
  // 通过 stateAccess 访问，而非直接 import
}
```

---

### 2.7 【显式优于隐式】any 类型滥用

**问题**：多处使用 `any` 类型：

`useCanvasInteraction.ts:39`：
```typescript
let dragTarget: any = null
let batchDragInitial: any[] | null = null
```

`App.vue:353`：
```typescript
function handleBatchUpdate(updates) {  // updates 无类型
  for (const { id, props } of updates) {
    const obj = state.objects.find(o => o.id === id)
    if (obj) Object.assign(obj, props)  // props 无类型
  }
}
```

**违反原则**：显式优于隐式 — 失去类型安全保护。

**建议**：定义明确类型：
```typescript
interface DragTarget {
  type: 'particle' | 'segment' | 'endpoint'
  object: PhysicsObject
  endpointType?: 'start' | 'end'
}

interface BatchUpdate {
  id: number
  props: Partial<PhysicsObject>
}
```

---

### 2.8 【KISS 违规】handleImportScene 函数过长

**问题**：`App.vue` 的 `handleImportScene` 函数约 150 行，包含：
- 剪贴板读取
- JSON 解析
- 版本兼容
- 字段校验
- 物体验证
- 状态更新
- 错误提示

**违反原则**：KISS（保持简单）— 单个函数承担过多逻辑。

**建议**：拆分为：
- `readFromClipboard()` — 剪贴板操作
- `parseSceneData(text)` — JSON 解析 + 版本迁移
- `validateSceneObjects(objs)` — 物体验证
- `loadSceneData(data)` — 状态更新

---

### 2.9 【DRY 违规】魔法数字散落

**问题**：多处硬编码数字：

`usePhysics.ts:280-281`：
```typescript
const MAX_SUBSTEPS = 200
const maxStepDist = 10  // 无注释说明来源
```

`usePhysics.ts:143`：
```typescript
const MAX_SNAPSHOTS = 1200  // 20秒 × 60fps
```

`useSceneBuilder.ts:11-16`：
```typescript
const DEFAULT_CANVAS_WIDTH = 800
const DEFAULT_CANVAS_HEIGHT = 500
const CANVAS_MARGIN = 60
const GROUND_BASELINE = 400
```

`useCanvasInteraction.ts:281`：
```typescript
const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(maxVelMag * dt / maxStepDist)))
```

**违反原则**：DRY（不重复自己）+ 定义常量为荣，魔法数字为耻。

**建议**：集中到 `src/constants.ts`：
```typescript
export const PHYSICS = {
  MAX_SUBSTEPS: 200,
  MAX_STEP_DIST: 10,  // 像素，防隧穿
  MAX_SNAPSHOTS: 1200,  // 20秒 × 60fps
  TRAIL_LENGTH: 80,
} as const

export const CANVAS = {
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 500,
  MARGIN: 60,
  GROUND_BASELINE: 400,
} as const
```

---

### 2.10 【YAGNI 违规】预留的 future 字段

**问题**：`ParticleObject` 接口包含 `prevX`/`prevY` 字段：
```typescript
interface ParticleObject {
  // ...
  prevX?: number  // CCD 碰撞检测用
  prevY?: number  // CCD 碰撞检测用
}
```

但实际只有 `subStepPhysics` 开头赋值，`detectSegmentCollision` 读取。如果未来移除 CCD，这些字段会变成死码。

**违反原则**：YAGNI（你不会需要它）— 只有当前需求的字段才是必须的。

**建议**：如果 CCD 是核心功能，改为必填字段并初始化；否则移除。

---

## 三、问题严重程度分级

| 级别 | 问题 | 影响 |
|------|------|------|
| 🔴 P0 | SRP 违规（App.vue） | 600 行大文件，难以维护和测试 |
| 🔴 P0 | ISP 违规（ParsedObject） | 类型不安全，需要大量运行时判断 |
| 🟡 P1 | SRP 违规（usePhysics.ts） | 物理引擎和快照耦合，修改风险高 |
| 🟡 P1 | OCP 违规（subStepPhysics） | 添加新力需修改核心代码 |
| 🟡 P1 | DIP 违规（useCanvasInteraction） | 测试困难，无法替换状态源 |
| 🟢 P2 | 显式优于隐式（any 类型） | 失去类型检查，潜在运行时错误 |
| 🟢 P2 | KISS 违规（长函数） | 可读性差，难以测试 |
| 🟢 P2 | DRY 违规（魔法数字） | 修改需查找多处 |

---

## 四、修复优先级建议

### 立即修复（P0）

1. **拆分 App.vue** — 提取场景管理、物体操作、历史管理到独立 composable
2. **拆分 ParsedObject 接口** — 使用联合类型替代单一庞大接口

### 本次比赛前修复（P1）

3. **重构 usePhysics.ts** — 分离快照系统
4. **引入力计算策略模式** — 注册表替代硬编码
5. **依赖注入改造** — 抽象 PhysicsStateAccess 接口

### 长期优化（P2）

6. **消除 any 类型** — 定义精确类型
7. **拆分长函数** — handleImportScene、handleRemoveObject 等
8. **集中常量定义** — 创建 constants.ts