# 接口文档

> 本文档描述物理解模项目的所有组件接口、Composable 导出 API 和核心数据结构定义。

---

## 目录

- [一、数据结构定义](#一数据结构定义)
- [二、组件接口](#二组件接口)
- [三、Composable 接口](#三composable-接口)

---

## 一、数据结构定义

> 定义在 `usePhysics.ts` 中，其他文件通过 `import type` 导入使用。

### 1.1 基础类型

```typescript
/** 二维向量 */
interface Vec2 { x: number; y: number }

/** 运动轨迹点 */
interface TrailPoint { x: number; y: number }

/** 弧线缺口定义（含触发器配置） */
interface ArcGap {
  centerAngle: number       // 缺口中心角度（画布坐标系弧度）
  halfWidth: number         // 缺口半宽（弧度）
  initiallyOpen?: boolean   // 初始开关状态（默认 false = 关闭）
  /** 触发类型：'angleCross' 角度穿越 / 'enterRing' 进入圆环 */
  triggerType?: 'angleCross' | 'enterRing'
  /** 触发角度（画布坐标系弧度）。triggerType='angleCross' 时使用 */
  triggerAngle?: number
  /** 触发动作：'open' 打开缺口 / 'close' 关闭缺口 */
  triggerAction?: 'open' | 'close'
}

/** 弧线元数据 */
interface ArcMeta {
  cx: number        // 圆心 x
  cy: number        // 圆心 y
  r: number         // 半径
  startAngle: number // 起始角度（弧度）
  endAngle: number   // 终止角度（弧度）
  /** 螺旋圆轨入口缺口（运行时由 arcGateState 控制开关） */
  entryGap?: ArcGap
  /** 螺旋圆轨出口缺口（运行时由 arcGateState 控制开关） */
  exitGap?: ArcGap
}
```

### 1.2 物体类型

#### ParticleObject（质点/刚体）

```typescript
interface ParticleObject {
  id: number
  name: string
  type: '质点' | '刚体'
  mass: number           // 质量（kg）
  x: number              // 位置 x（像素）
  y: number              // 位置 y（像素）
  vx: number             // 速度 x（像素/秒）
  vy: number             // 速度 y（像素/秒）
  radius: number         // 半径（像素）
  color: string          // 颜色（十六进制）
  charge?: number        // 电荷量（C，可选）
  friction?: number      // 摩擦系数（可选）
  trail: TrailPoint[]    // 运动轨迹
  prevX?: number         // 上一帧位置 x（CCD 碰撞检测用）
  prevY?: number         // 上一帧位置 y
  /** 当前约束的弧线 groupId（undefined = 未约束）。运行时状态，不序列化 */
  constrainedArcGroupId?: number
}
```

#### SegmentObject（线段）

```typescript
interface SegmentObject {
  id: number
  name: string
  type: 'line_segment'
  x1: number             // 端点1 x
  y1: number             // 端点1 y
  x2: number             // 端点2 x
  y2: number             // 端点2 y
  normalX: number        // 法线 x 分量
  normalY: number        // 法线 y 分量
  restitution?: number   // 恢复系数（0~1，默认 0.3）
  friction?: number      // 摩擦系数
  color?: string         // 颜色
  groupId?: number       // 弧线组 ID（弧线由多个线段近似，同组共享）
  arc?: ArcMeta          // 弧线元数据（弧线段专属）
  velocity?: Vec2        // 传送带速度（像素/秒）
  movable?: boolean      // 是否可移动（板块模型）
  mass?: number          // 可移动线段质量（板块模型）
  thickness?: number     // 视觉厚度（像素），仅渲染用（板块模型可选）
  frictionTop?: number   // 上表面摩擦系数（板块模型）；未设置回退 friction
  frictionBottom?: number // 下表面摩擦系数（板块模型）；未设置回退 friction
  /** 弧线触发器运行时状态（不序列化，由 useSceneBuilder 初始化） */
  arcGateState?: {
    entryOpen: boolean
    exitOpen: boolean
    prevAngle?: number   // 上一帧小球角度（angleCross 触发检测）
    wasInside?: boolean  // 上一帧小球是否在环内（enterRing 触发检测）
  }
  /** 弧线约束动力学开关（仅首段，true=约束模式，false=碰撞模式）。未设置视为 true */
  constraintEnabled?: boolean
}
```

#### SpringObject（弹簧）

```typescript
interface SpringObject {
  id: number
  name: string
  type: 'spring'
  anchorX: number        // 固定端 x（像素）
  anchorY: number        // 固定端 y（像素）
  ballId: number         // 连接的质点 id
  naturalLength: number  // 自然长度（像素）
  k: number              // 劲度系数（N/m，SI 单位）
  color?: string         // 颜色
}
```

#### 联合类型

```typescript
type PhysicsObject = ParticleObject | SegmentObject | SpringObject
```

### 1.3 场景状态类型

#### FieldState（场设置）

```typescript
interface FieldState {
  type: 'none' | 'electric' | 'magnetic' | 'composite'
  E: Vec2     // 电场强度（N/C，像素单位存储）
  B: number   // 磁感应强度（T）
  region?: {  // 场区域（像素坐标）；undefined = 全场
    x: number     // 左边界
    y: number     // 上边界
    width: number // 宽度
    height: number // 高度
  }
}
```

#### CustomForce（自定义力）

```typescript
interface CustomForce {
  id: number
  fx: number       // x 方向力（N）
  fy: number       // y 方向力（N）
  targetId: number // 作用目标物体 id
}
```

#### PhysicsState（全局物理状态）

```typescript
interface PhysicsState {
  objects: PhysicsObject[]
  forces: CustomForce[]
  field: FieldState
  time: number                  // 模拟时间（秒）
  isPlaying: boolean            // 是否播放中
  showForce: boolean            // 是否显示受力
  showGateColors: boolean       // 是否显示弧线触发器颜色与缺口开关
  groundY: number               // 地面 y 坐标（像素，GROUND_DISABLED=100000 表示禁用）
  groundRestitution: number     // 地面恢复系数
  particleRestitution: number   // 质点间恢复系数
  gravity: number               // 重力加速度（像素/s²）
}
```

### 1.4 快照类型

```typescript
interface SnapshotObject {
  id: number
  x: number
  y: number
  vx: number
  vy: number
}

interface SnapshotFrame {
  objects: SnapshotObject[]
  field: FieldState
  groundY: number
  gravity: number
  timestamp: number
}
```

### 1.5 AI 解析类型

> 定义在 `useAIParser.ts` 中，描述 AI 解析的结构化结果。`ParsedObject` 为判别联合（通过 `type` 字段收窄），遵循接口隔离原则（ISP）——每个类型只含自己需要的字段。

```typescript
interface ParsedVec2 { x: number; y: number }

interface BaseParsedObject {
  id?: string
  type: 'ball' | 'platform' | 'arc' | 'spring'
}

interface ParsedBall extends BaseParsedObject {
  type: 'ball'
  mass?: number
  charge?: number
  radius?: number
  initialPosition?: ParsedVec2   // SI 单位 m（球底高度）
  initialVelocity?: ParsedVec2   // SI 单位 m/s
  fixed?: boolean
  friction?: number
}

interface ParsedPlatform extends BaseParsedObject {
  type: 'platform'
  startPoint?: ParsedVec2
  endPoint?: ParsedVec2
  friction?: number
  beltVelocity?: ParsedVec2      // 传送带速度（m/s）
  movable?: boolean              // 板块模型
  mass?: number
}

interface ParsedArc extends BaseParsedObject {
  type: 'arc'
  center?: ParsedVec2            // 弧线圆心（米）
  arcRadius?: number
  startAngle?: number
  endAngle?: number
  friction?: number
  /** 螺旋圆轨动态入口缺口（运行时由状态机控制开关） */
  entryGap?: { centerAngle: number; halfWidth: number; initiallyOpen?: boolean; triggerType?: 'angleCross' | 'enterRing'; triggerAngle?: number; triggerAction?: 'open' | 'close' }
  /** 螺旋圆轨动态出口缺口 */
  exitGap?: { centerAngle: number; halfWidth: number; initiallyOpen?: boolean; triggerType?: 'angleCross' | 'enterRing'; triggerAngle?: number; triggerAction?: 'open' | 'close' }
}

interface ParsedSpring extends BaseParsedObject {
  type: 'spring'
  anchor?: ParsedVec2            // 弹簧固定端（米）
  ballId?: string                // 弹簧连接物体 id
  naturalLength?: number         // 弹簧自然长度（米）
  k?: number                     // 劲度系数（N/m）
}

type ParsedObject = ParsedBall | ParsedPlatform | ParsedArc | ParsedSpring

interface ParsedProblem {
  title?: string
  description?: string
  topic: 'projectile' | 'slope' | 'elastic_collision' | 'magnetic_circle' | 'electric_deflection' | 'custom'
  objects: ParsedObject[]
  field: {
    type: 'none' | 'electric' | 'magnetic' | 'composite'
    E?: Vec2
    B?: number
    region?: { x: number; y: number; width: number; height: number }  // SI 单位，米；undefined = 全场
  }
  gravity?: number
  groundY?: number | null
  worldWidth?: number
  simulationTime?: number
  question?: string
  particleRestitution?: number
  groundRestitution?: number
}
```

### 1.6 预设场景类型

```typescript
interface PresetScene {
  objects: PhysicsObject[]
  forces: CustomForce[]
  field: FieldState
  gravity: number
  groundY?: number | null
}
```

---

## 二、组件接口

### 2.1 App.vue（主应用）

根组件，无 props。管理全局状态和组件间通信。

**内部状态**：`activeScene`、`mode`（'live' | 'replay'）、`selectedId`、`selectedIds`、`aiToast`

**关键函数**：
- `handleLoadQuestion(question)` — 加载真题库题目
- `handleLoadPreset(parsed)` — 加载 AI 解析结果
- `handleRemoveObject(id)` — 删除物体
- `onObjectUpdate(obj)` — 更新物体属性
- `onSelectObject(id)` — 选中物体

---

### 2.2 PhysicsCanvas.vue（画布组件）

核心渲染组件，负责 requestAnimationFrame 循环和事件分发。

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | String | `'live'` | 运行模式：`'live'` 实时模拟 / `'replay'` 回放 |
| `aiToast` | String | `''` | AI 提示文本（画布上显示） |
| `editMode` | Boolean | `false` | 是否编辑模式（禁用物理更新） |
| `selectedIds` | Array | `[]` | 选中的物体 id 列表 |

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `seek` | `(frame: number)` | 回放跳转到指定帧 |
| `add-object` | `(obj: PhysicsObject)` | 添加物体 |
| `update-object` | `(obj: PhysicsObject)` | 更新物体 |
| `remove-object` | `(id: number)` | 删除物体 |
| `export-scene` | — | 导出场景 |
| `import-scene` | — | 导入场景 |
| `undo` | — | 撤销 |
| `redo` | — | 重做 |
| `update-selected` | `(ids: number[])` | 更新选中列表 |
| `batch-update` | `(updates: any[])` | 批量更新 |

---

### 2.3 AIInput.vue（AI 题目解析）

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `load-preset` | `(parsed: ParsedProblem)` | 加载 AI 解析的场景 |
| `update-params` | `(parsed: ParsedProblem)` | 参数微调后更新 |
| `scene-built` | `(info: { title, objectCount })` | 场景构建完成通知 |

---

### 2.4 ApiKeyDialog.vue（API Key 配置）

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `close` | — | 关闭对话框 |
| `saved` | `(config: object)` | 保存 API 配置 |
| `cleared` | — | 清除配置 |

---

### 2.5 ControlBar.vue（播放控制栏）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isPlaying` | Boolean | `false` | 是否播放中 |
| `showForce` | Boolean | `true` | 是否显示受力 |
| `showGateColors` | Boolean | `true` | 是否显示弧线触发器颜色与缺口开关 |
| `mode` | String | `'live'` | 运行模式 |

**Emits**：`toggle-play`、`reset`、`toggle-force`、`toggle-gate-colors`、`toggle-replay`

---

### 2.6 ForceEditor.vue（附加力编辑器）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `objectId` | Number | `null` | 当前选中物体 id |

> 直接操作 `usePhysics` 的 `state.forces`，无 emit。

---

### 2.7 ObjectList.vue（物体列表）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `objects` | Array | **必填** | 物体列表 |
| `selectedId` | Number | `null` | 单选选中 id |
| `selectedIds` | Array | `[]` | 多选选中 id 列表 |
| `removable` | Boolean | `false` | 是否显示删除按钮 |

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `select` | `(id: number)` | 选中物体 |
| `remove` | `(id: number)` | 删除物体 |

---

### 2.8 QuestionBankPanel.vue（真题库面板）

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `load-question` | `(question: QuestionItem)` | 加载选中题目 |

---

### 2.9 SceneTabs.vue（场景切换标签）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `activeScene` | String | **必填** | 当前场景名 |

**Emits**：`switch (scene: string)`

预设场景列表：`'抛体运动'`、`'斜面滑块'`、`'弹性碰撞'`、`'磁场圆周'`、`'电场偏转'`、`'自定义'`

---

### 2.10 Timeline.vue（回放时间轴）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `snapshots` | Array | `[]` | 快照帧列表 |
| `currentFrame` | Number | `0` | 当前帧索引 |
| `keyframeIndices` | Array | `[]` | 关键帧索引列表 |

**Emits**：`update:currentFrame (frame: number)`

---

### 2.11 DataChart.vue（数据图表）

基于 ECharts 的数据图表组件，支持 v-t 图和能量曲线展示。

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `snapshots` | Array | `[]` | 快照帧列表（用于提取时序数据） |
| `objects` | Array | `[]` | 物体列表（用于选择可追踪物体） |
| `currentFrame` | Number | `0` | 当前回放帧索引（标记线） |

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `collapse` | — | 收起图表 |

**内部状态**：
- 图表类型切换：`v-t 图`（vx/vy/速率） / `能量曲线`（动能/势能/机械能）
- 自动选择第一个可追踪物体（`type: '质点'` 或 `'刚体'`）
- 当前帧标记线（青色虚线，与回放帧同步）

---

### 2.12 InputDialog.vue（通用输入对话框）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | Boolean | `false` | 是否显示 |
| `title` | String | `'输入'` | 对话框标题 |
| `initialValue` | String | `''` | 输入框初始值 |
| `placeholder` | String | `''` | 输入框占位符 |
| `message` | String | `''` | 消息模式（非空时显示消息文本，不显示输入框） |
| `errorMessage` | String | `''` | 输入验证错误提示 |

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `confirm` | `(value: string)` | 确认（返回输入值） |
| `cancel` | — | 取消 |

**交互说明**：
- 输入框自动聚焦并全选初始值
- Enter 键确认，Esc 键取消
- 点击遮罩层取消
- 消息模式（message 非空）：仅显示消息文本，无输入框

---

### 2.13 PropertyPanel.vue（属性编辑面板）

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `object` | Object | `null` | 当前选中物体 |

**Emits**：`update:object (newObj: PhysicsObject)`

> 面板还包含场景设置（重力、场类型、场强），直接操作 `usePhysics` 的 `state`。
>
> 弧线物体的高级选项区：约束动力学开关（`constraintEnabled`）、触发器缺口配置（`entryGap`/`exitGap` 的 triggerType 下拉：angleCross/enterRing、triggerAngle、triggerAction）。

---

### 2.14 EditorToolbar.vue（编辑工具条）

封装 `SceneTabs` 与「编辑/导出/导入/保存」按钮，位于画布顶部。

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `activeScene` | String | **必填** | 当前场景名 |
| `savedSceneNames` | Array | `[]` | 已保存的自定义场景名列表 |
| `isSavedSceneActive` | Boolean | `false` | 当前是否为已保存自定义场景 |
| `savedSceneEditing` | Boolean | `false` | 是否处于已保存场景编辑模式 |

**Emits**：

| 事件 | 参数 | 说明 |
|------|------|------|
| `switch` | `(scene: string)` | 切换场景 |
| `delete` | `(scene: string)` | 删除已保存场景 |
| `rename` | `(payload)` | 重命名场景 |
| `toggle-saved-scene-edit` | — | 切换已保存场景编辑模式 |
| `export` | — | 导出场景 |
| `import` | — | 导入场景 |
| `save-scene` | — | 保存场景 |

---

### 2.15 LeftPanel.vue（左侧面板）

左侧面板容器，组合 AIInput / ObjectList / PropertyPanel / SceneSettings，并带拖拽分隔条。

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `leftPanelWidth` | Number | `280` | 面板宽度（px） |
| `leftCollapsed` | Boolean | `false` | 是否折叠 |
| `objects` | Array | `[]` | 物体列表 |
| `selectedId` | Number | `null` | 单选选中 id |
| `selectedIds` | Array | `[]` | 多选选中 id 列表 |
| `removable` | Boolean | `false` | 是否显示删除按钮 |
| `selectedObject` | Object | `null` | 当前选中物体 |
| `dragMoved` | Boolean | `false` | 分隔条是否已拖动 |
| `dragSide` | String | `null` | 当前拖动的分隔条方向 |

**Emits**：`splitter-mousedown`、`select`、`select-group`、`remove`、`update:object`、`load-preset`、`update-params`、`scene-built`

---

### 2.16 RightPanel.vue（右侧面板）

右侧面板容器，组合 QuestionBankPanel，带拖拽分隔条。

**Props**：

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rightPanelWidth` | Number | `330` | 面板宽度（px） |
| `rightCollapsed` | Boolean | `false` | 是否折叠 |
| `dragMoved` | Boolean | `false` | 分隔条是否已拖动 |
| `dragSide` | String | `null` | 当前拖动的分隔条方向 |

**Emits**：`splitter-mousedown`、`load-question`

---

### 2.17 SceneSettings.vue（场景设置）

场景设置面板（重力、场类型、场区域），**无 props/emits**，直接操作 `usePhysics` 的 `state` 与 `useEditTools` 的 `tool`。

**内部能力**：
- 重力加速度编辑（SI 显示，内部按像素存储）
- 场类型切换（none/electric/magnetic/composite），切换时清零非当前类型的场数值
- 场区域启用/禁用：启用时默认画布中心 10m×10m；关闭时若当前为 `field` 工具自动切回 `select`
- 场区域中心/宽高编辑（SI 单位 → 像素换算）

---

## 三、Composable 接口

### 3.1 usePhysics.ts — 物理引擎

> 快照与关键帧状态（`snapshots`/`currentFrame`/`keyframeIndices`）已拆分到 `useSnapshotManager.ts`，此处为 re-export；合力计算委托给 `useForces.ts` 的 `calculateTotalForce`（策略注册表）。

**导出状态**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `state` | `reactive<PhysicsState>` | 全局物理状态（唯一数据源） |
| `snapshots` | `ref<SnapshotFrame[]>` | 回放快照列表 |
| `currentFrame` | `ref<number>` | 当前回放帧 |
| `keyframeIndices` | `ref<number[]>` | 关键帧索引列表 |

**导出函数**：

```typescript
/** 物理更新（每帧调用） */
function updatePhysics(dt: number): void

/** 重置到初始状态 */
function reset(): void

/** 添加自定义力 */
function addForce(force: CustomForce): void

/** 删除自定义力 */
function removeForce(forceId: number): void

/** 清空所有自定义力 */
function clearForces(): void

/** 更新物体单个属性 */
function updateObjectProperty(id: number, key: string, value: unknown): void

/** 添加物体 */
function addObject(obj: PhysicsObject): void

/** 删除物体 */
function removeObject(id: number): void

/**
 * 加载场景
 * @param groundY null 禁用水平地面；undefined 保持默认
 */
function loadScene(
  objects: PhysicsObject[],
  forces: CustomForce[],
  field: FieldState,
  gravity: number,
  groundY: number | null | undefined
): void
```

**导出常量**：`PIXELS_PER_METER = 50`（其余常量见 `src/constants.ts`：GROUND_DISABLED、MAX_SUBSTEPS、MAX_STEP_DIST、TRAIL_LENGTH、MAX_SNAPSHOTS 等）

---

### 3.2 useCollision.ts — 碰撞检测

```typescript
/** 自动计算线段法线（保留用户方向偏好） */
function autoComputeNormal(segment: {
  x1: number; y1: number; x2: number; y2: number
  normalX?: number; normalY?: number
}): { normalX: number; normalY: number }

/** 地面碰撞检测 */
function checkGroundCollision(
  obj: ParticleObject,
  groundY: number,
  restitution?: number    // 默认 0.6
): boolean

/** 质点间碰撞检测（动量守恒） */
function checkParticleCollision(
  a: ParticleObject,
  b: ParticleObject,
  restitution?: number    // 默认 1.0
): boolean

/** 线段碰撞检测（CCD 连续碰撞） */
function detectSegmentCollision(
  obj: ParticleObject,
  seg: SegmentObject,
  dt: number,
  gravity: number
): boolean

/** 弧线碰撞检测（含触发器缺口放行判断） */
function detectArcCollision(
  obj: ParticleObject,
  seg: SegmentObject,
  dt: number,
  gravity: number
): boolean

/** 弧线约束动力学：约束期间将球投影到弧面、保留切向动能，满足自然脱离条件时解除 */
function applyArcConstraint(
  obj: ParticleObject,
  seg: SegmentObject,
  dt: number,
  gravity: number
): void

/**
 * 弧线约束激活：球触碰弧面或进入环内时设置 constrainedArcGroupId
 * 含 catch-up 逻辑——球在环内且所有门关闭时强制激活（修复 4px 距离盲区）
 */
function tryActivateArcConstraint(
  obj: ParticleObject,
  seg: SegmentObject
): boolean

/** 角度是否在弧线范围内（完整圆 span≈2π 特判返回 true） */
function isAngleInRange(angle: number, startAngle: number, endAngle: number): boolean

/** 检测小球角度是否穿越目标角度（归一化到 [-π, π]，用于 angleCross 触发） */
function didAngleCross(prev: number, curr: number, target: number): boolean

/** 总碰撞检测（地面 + 线段 + 弧线 + 质点间 + 弧线约束激活/维护） */
function checkCollision(
  objects: PhysicsObject[],
  groundY: number,
  groundRestitution?: number,    // 默认 0.6
  particleRestitution?: number,  // 默认 1.0
  dt?: number,                   // 默认 0.016
  gravity?: number               // 默认 490
): boolean
```

---

### 3.3 useCanvasRenderer.ts — 画布渲染

**导出类型**：`RenderContext`、`DisplayData`、`PreviewState`、`SelectionState`、`ShiftFlashState`、`UIState`

**基础工具函数**：

```typescript
function drawArrow(ctx, x1, y1, x2, y2, color, width): void
function roundRect(ctx, x, y, w, h, r): void
function pointToSegmentDistance(px, py, x1, y1, x2, y2): number
function findContactSegment(objects, obj): SegmentObject | null
```

**绘制函数**（均接收 `rc: RenderContext`）：

| 函数 | 参数 | 说明 |
|------|------|------|
| `drawGrid` | `(rc)` | 绘制网格 |
| `drawGround` | `(rc, groundY)` | 绘制地面 |
| `drawField` | `(rc, field)` | 绘制场可视化 |
| `drawTrails` | `(rc, objects, isReplay)` | 绘制运动轨迹 |
| `drawObjects` | `(rc, objects)` | 绘制物体 |
| `drawSegments` | `(rc, objects)` | 绘制线段 |
| `drawArcsVisually` | `(rc, objects)` | 绘制弧线 |
| `drawSprings` | `(rc, objects)` | 绘制弹簧 |
| `drawVelocity` | `(rc, objects)` | 绘制速度矢量 |
| `drawForces` | `(rc, objects, gravity, field, showForce)` | 绘制受力箭头 |
| `drawPreviewLine` | `(rc, preview)` | 绘制线段预览 |
| `drawPreviewArc` | `(rc, preview)` | 绘制弧线预览 |
| `drawSelectionRect` | `(rc, sel)` | 绘制选框 |
| `drawSelectionHighlight` | `(rc, objects, selectedIds)` | 绘制选中高亮 |
| `drawShiftFlash` | `(rc, flash)` | 绘制 Shift 闪烁 |
| `drawWatermark` | `(rc, mode)` | 绘制水印 |
| `drawAIToast` | `(rc, aiToast)` | 绘制 AI 提示 |
| `drawEditUI` | `(rc, ui)` | 绘制编辑工具 UI |

---

### 3.4 useCanvasInteraction.ts — 画布交互

**导出状态**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `worldOffset` | `ref<{x, y}>` | 世界坐标偏移 |
| `worldScale` | `ref<number>` | 世界坐标缩放 |

**Getter 函数**：

```typescript
function getDpr(): number
function getCssW(): number
function getCssH(): number
function getSelectionState(): SelectionState
function isPanning(): boolean
function isDragging(): boolean
function isBatchDragging(): boolean
function isDrawing(): boolean
function isSelectionActive(): boolean
```

**初始化与事件**：

```typescript
/** 初始化交互层（在 onMounted 中调用） */
function initCanvasInteraction(
  canvas: Ref<HTMLCanvasElement | null>,
  propsGetter: () => any,
  emitter: (event: string, ...args: any[]) => void
): void

/** 事件处理函数（绑定到 canvas 元素） */
function onCanvasClick(e: MouseEvent): void
function onMouseDown(e: MouseEvent): void
function onMouseMove(e: MouseEvent): void
function onMouseUp(e: MouseEvent): void
function onWheel(e: WheelEvent): void

/** 重置视图（平移与缩放归位） */
function resetView(): void

/** 调整画布尺寸（响应窗口变化） */
function resizeCanvas(): void
```

---

### 3.5 useEditTools.ts — 编辑工具

**导出状态**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `tool` | `ref<ToolType>` | 当前工具（`'select'`/`'ball'`/`'platform'`/`'conveyor'`/`'plate'`/`'arc'`/`'spring'`/`'field'`） |
| `chargeMode` | `ref<boolean>` | 带电模式 |
| `previewArc` | `ref<object \| null>` | 弧线预览状态 |
| `previewLine` | `ref<object \| null>` | 线段预览状态 |

**工具函数**：

```typescript
function genId(): number                    // 生成唯一 ID
function resetArcState(): void              // 重置弧线绘制
function getArcPhase(): string              // 获取弧线绘制阶段
function getArcCenter(): Vec2 | null        // 获取弧线圆心
function handleArcClick(pos): void          // 处理弧线点击
function updateArcPreview(pos): void        // 更新弧线预览
function getSpringAnchor(): Vec2 | null     // 获取弹簧固定端
function resetSpringState(): void           // 重置弹簧绘制
function handleSpringClick(pos, objects): PhysicsObject | null  // 处理弹簧点击
function updateSpringPreview(pos): void     // 更新弹簧预览
function findOverlap(objects, newObj): PhysicsObject | null     // 查找重叠
function pushOutOfOverlap(objects, newObj): void                // 推开重叠
function triggerShiftFlash(pos): void       // 触发 Shift 闪烁
function getShiftFlashState(): ShiftFlashState                   // 获取闪烁状态
```

---

### 3.6 useAIParser.ts — AI 解析

**导出状态**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `loading` | `ref<boolean>` | 解析中 |
| `errorMsg` | `ref<string>` | 错误信息 |
| `result` | `ref<object \| null>` | 解析结果展示 |
| `isAIConfigured` | `ref<boolean>` | 是否配置了 API Key |
| `configuredModelName` | `ref<string>` | 当前模型名 |

**导出函数**：

```typescript
/** 解析物理题目（异步） */
async function parsePhysicsProblem(question: string): Promise<ParsedProblem | null>

/** 将解析结果转换为场景参数 */
function convertToSceneParams(parsed: ParsedProblem): {
  objects: PhysicsObject[]
  forces: CustomForce[]
  field: FieldState
  gravity: number
  groundY: number | null
}
```

---

### 3.7 useSceneBuilder.ts — 场景构建

```typescript
/**
 * 将 AI 解析结果构建为可运行场景
 * 包含：统一 SI→像素换算（PIXELS_PER_METER=50）、弹簧 id 映射
 */
function buildScene(parsed: ParsedProblem): {
  success: boolean
  message: string
  objectCount: number
}
```

---

### 3.8 usePresets.ts — 预设场景

```typescript
interface PresetScene {
  objects: PhysicsObject[]
  forces: CustomForce[]
  field: FieldState
  gravity: number
  groundY?: number | null
}

function presetProjectile(): PresetScene     // 平抛运动
function presetIncline(): PresetScene         // 斜面滑块
function presetCollision(): PresetScene       // 弹性碰撞
function presetMagnetic(): PresetScene        // 磁场圆周
function presetElectric(): PresetScene        // 电场偏转
function customPreset(): PresetScene          // 自定义（空场景）
function getPreset(sceneName: string): PresetScene  // 按名获取

function nextId(): number  // 生成递增 ID
```

---

### 3.9 useQuestionBank.ts — 题库管理

```typescript
function useQuestionBank(): {
  questions: Ref<QuestionItem[]>
  filteredQuestions: ComputedRef<QuestionItem[]>
  selectedId: Ref<string | null>
  selectedQuestion: ComputedRef<QuestionItem | null>
  filterDifficulty: Ref<'all' | 'easy' | 'medium' | 'hard'>
  filterTag: Ref<string | null>
  searchKeyword: Ref<string>
  allTags: ComputedRef<string[]>
  difficultyStats: ComputedRef<{ total, easy, medium, hard }>
  selectQuestion(id: string): void
  clearSelection(): void
}
```

---

### 3.10 useHistory.ts — 撤销/重做

```typescript
interface HistorySnapshot {
  objects: PhysicsObject[]
  gravity: number
  groundY: number | null
  field: FieldState
}

const undoStack: Ref<HistorySnapshot[]>
const redoStack: Ref<HistorySnapshot[]>

/** 推入历史（编辑操作前调用） */
function pushHistory(objects, gravity, groundY, field): void

/** 撤销，返回要恢复的状态 */
function undo(objects, gravity, groundY, field): HistorySnapshot | null

/** 重做，返回要恢复的状态 */
function redo(objects, gravity, groundY, field): HistorySnapshot | null

function canUndo(): boolean
function canRedo(): boolean
function clearHistory(): void
```

---

### 3.11 useForces.ts — 力计算策略层

> 力注册表 + 策略模式，遵循 OCP。添加新力只需 `registerForce`，无需修改 `subStepPhysics`。模块加载时注册默认 4 种力：重力、自定义力、场力（qE + qvB）、弹簧力。

```typescript
interface ForceContext {
  state: PhysicsState
  particle: ParticleObject
}

type ForceCalculator = (ctx: ForceContext) => { fx: number; fy: number }

/** 注册力计算策略 */
function registerForce(calculator: ForceCalculator): void

/** 计算粒子所受合力（遍历所有已注册的力计算器） */
function calculateTotalForce(state: PhysicsState, particle: ParticleObject): { fx: number; fy: number }
```

---

### 3.12 useSnapshotManager.ts — 快照管理

```typescript
const snapshots: Ref<SnapshotFrame[]>       // 回放快照序列
const currentFrame: Ref<number>             // 当前回放帧索引
const keyframeIndices: Ref<number[]>        // 关键帧索引（速度方向突变点）

/** 录制一帧快照（含关键帧检测和容量上限裁剪） */
function recordSnapshot(frame: SnapshotFrame): void

/** 清空所有快照（场景切换/重置时调用） */
function clearSnapshots(): void
```

> `usePhysics.ts` re-export `snapshots`/`currentFrame`/`keyframeIndices`，对外接口不变。

---

### 3.13 useSceneManager.ts — 场景管理

```typescript
interface SceneBuiltInfo { title: string; objectCount: number }
interface QuestionPayload { title: string; description?: string; sceneJson: ParsedProblem }

function useSceneManager(): {
  // 状态
  activeScene: Ref<string>                  // 当前场景名
  selectedId: Ref<number | null>            // 单选 id
  selectedIds: Ref<number[]>                // 多选 id 列表
  mode: Ref<'live' | 'replay'>             // 运行模式
  aiToast: Ref<string>                      // 画布提示文本
  currentQuestionDesc: Ref<string>          // 当前题目描述
  editMode: ComputedRef<boolean>            // 编辑模式（自定义+live+未播放）
  // 操作
  saveCustomScene(): void                   // 持久化自定义场景到 localStorage
  refreshCustomSnapshot(): void             // 刷新自定义场景重置基线
  onSceneSwitch(sceneName: string): void    // 场景切换
  onTogglePlay(): void                      // 播放/暂停
  onReset(): void                           // 重置
  onToggleReplay(): void                    // 切换回放模式
  handleLoadPreset(sceneName: string): void // 加载 AI 解析预设
  handleSceneBuilt(info: SceneBuiltInfo): void  // AI buildScene 完成
  handleLoadQuestion(question: QuestionPayload): void  // 加载题库题目
}
```

---

### 3.14 useObjectOperations.ts — 物体操作

```typescript
interface BatchUpdateItem { id: number; props: Record<string, unknown> }
interface ObjectOpsContext {
  activeScene: Ref<string>
  mode: Ref<'live' | 'replay'>
  aiToast: Ref<string>
  selectedId: Ref<number | null>
  selectedIds: Ref<number[]>
  saveCustomScene: () => void
  refreshCustomSnapshot: () => void
}

function useObjectOperations(ctx: ObjectOpsContext): {
  selectedObject: ComputedRef<PhysicsObject | undefined>
  onObjectUpdate(updated: Partial<PhysicsObject> & { id: number }): void
  onSelectObject(id: number): void
  onSelectGroup(ids: number[]): void        // 弧线整组选中
  handleBatchUpdate(updates: BatchUpdateItem[]): void
  handleAddObject(obj: PhysicsObject): void
  handleUpdateObject(payload: { id: number; props: Record<string, unknown> }): void
  handleRemoveObject(id: number): void      // 弧线整组删除 + 弹簧级联删除
  handleUpdateParams(params: { mass?: number; vx?: number; charge?: number }): void
  onDeleteKey(): void                       // Delete 键批量删除
  onUndo(): void
  onRedo(): void
}
```

---

### 3.15 useSceneIO.ts — 场景导入导出

```typescript
interface SceneIOContext {
  state: PhysicsState
  aiToast: Ref<string>
  selectedId: Ref<number | null>
  activeScene: Ref<string>
  saveCustomScene: () => void
}

// 纯函数（直接导出）
function deepCopyObjects(objs: PhysicsObject[]): PhysicsObject[]  // 剥离运行时字段
function validateObject(o: unknown): PhysicsObject | null         // 校验并规范化物体

// 有状态操作（工厂注入 context）
function useSceneIO(ctx: SceneIOContext): {
  handleExportScene(): Promise<void>  // 导出 JSON 到剪贴板（降级 prompt）
  handleImportScene(): Promise<void>  // 从剪贴板导入（兼容旧/新格式，逐物体校验）
}
```

---

### 3.16 useKeyboard.ts — 键盘快捷键

```typescript
interface KeyboardContext {
  onDeleteKey: () => void
  onUndo: () => void
  onRedo: () => void
}

/** 注册全局键盘快捷键（须在组件 setup 中调用以绑定生命周期） */
function useKeyboard(ctx: KeyboardContext): void
// Delete / Backspace → onDeleteKey
// Ctrl+Z → onUndo
// Ctrl+Y 或 Ctrl+Shift+Z → onRedo
// 输入框聚焦时不触发
```

---

### 3.17 questionView.ts — 题目视图状态

```typescript
/** 是否正在查看题库/AI 构建的场景（此时不覆盖用户自定义场景） */
export const viewingQuestionScene: Ref<boolean>
```

---

### 3.18 usePanelLayout.ts — 面板布局

面板折叠/展开/拖拽调整宽度，纯 UI 状态，与业务逻辑无关。单例：每次调用返回同一组状态。

```typescript
function usePanelLayout(): {
  leftPanelWidth: Ref<number>    // 左侧面板宽度（px，localStorage 持久化）
  rightPanelWidth: Ref<number>   // 右侧面板宽度（px）
  leftCollapsed: Ref<boolean>    // 左侧折叠
  rightCollapsed: Ref<boolean>   // 右侧折叠
  dragSide: Ref<'left' | 'right' | null>  // 当前拖动的分隔条
  dragMoved: Ref<boolean>        // 是否已拖动
  onSplitterMouseDown(e: MouseEvent, side: 'left' | 'right'): void  // 分隔条按下
}
```

---

### 3.19 src/utils/arcGap.ts — 弧线缺口角度换算

弧线缺口（ArcGap）与角度显示/编辑之间的纯换算工具函数，渲染、碰撞、场景构建三处共用，保证角度换算一致性。

```typescript
export interface ArcGapLike {
  centerAngle?: number   // 缺口中心角（弧度）
  halfWidth?: number     // 缺口半宽（弧度）
  triggerAngle?: number  // 触发角（弧度）
}
export const RAD_TO_DEG: number   // 180 / Math.PI

/** 弧度 → 归一化到 [0,360) 的度数 */
function deg360(rad: number): number
/** 缺口起始角度（°） */
function gapStartDeg(gap?: ArcGapLike): number
/** 缺口终止角度（°） */
function gapEndDeg(gap?: ArcGapLike): number
/** 缺口触发角度（°） */
function triggerAngleDeg(gap?: ArcGapLike): number
/**
 * 由起始/终止角度（°）求 centerAngle/halfWidth（弧度）。
 * 按「前向跨度」计算，跨 0°/360° 时取短弧中点，halfWidth 恒 >= 0。
 */
function gapFromDegrees(startDeg: number, endDeg: number): { centerAngle: number; halfWidth: number }
```
