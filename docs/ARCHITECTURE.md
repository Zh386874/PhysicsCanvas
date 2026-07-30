# 架构设计文档

> 本文档描述物理解模项目的整体架构、分层设计、数据流和模块职责。

---

## 一、整体架构

### 1.1 技术选型

| 层 | 技术 | 选型理由 |
|----|------|----------|
| 视图层 | Vue 3.5 Composition API | 组件化、响应式、`<script setup>` 简洁 |
| 逻辑层 | Composables（组合式函数） | 逻辑复用、状态隔离 |
| 渲染层 | Canvas 2D + requestAnimationFrame | 高性能物理动画、自定义绘制 |
| 构建层 | Vite 6 | 快速 HMR、零配置 TypeScript |
| 部署层 | GitHub Actions → Pages | 自动 CI/CD |

### 1.2 架构分层图

```
┌─────────────────────────────────────────────────────────────┐
│                        App.vue                              │
│         (全局状态管理 + 组件编排 + 布局)                      │
├──────────┬──────────────────────────┬───────────────────────┤
│  左面板   │       画布区域            │      右面板           │
│          │                          │                       │
│  AIInput  │   ┌──────────────────┐   │  QuestionBankPanel   │
│ ObjectList│   │  PhysicsCanvas   │   │                       │
│ Property │   │  (渲染+事件分发)  │   │  (1道真题库)          │
│ Panel    │   └────────┬─────────┘   │                       │
│ ForceEdi │            │              │                       │
│ tor      │     ControlBar            │                       │
│          │     Timeline              │                       │
│          │     SceneTabs             │                       │
├──────────┴────────────┴──────────────┴───────────────────────┤
│                     Composable 层                            │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│usePhysics│useCollision│useCanvas│useCanvas │useEditTools     │
│ (状态+   │ (碰撞+   │Renderer │Interaction│(工具状态)       │
│  积分)   │ 约束动力学)│ (绘制)  │ (事件)    │                 │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│   useForces  useSnapshotManager  useSceneManager             │
│   useObjectOperations  useSceneIO  useKeyboard               │
├──────────────────────────────────────────────────────────────┤
│                     数据层                                    │
├──────────────────────────────────────────────────────────────┤
│  useAIParser  useSceneBuilder  usePresets  useQuestionBank   │
│  useHistory   questionBank.ts (数据)                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、单向数据流

### 2.1 核心原则

**physics state 是唯一数据源**：所有物理状态（物体、力、场、时间、播放状态）集中在 `usePhysics.ts` 的 `state` reactive 对象中。

```
                ┌─────────────┐
                │ usePhysics  │
                │   state     │ ◄──── 唯一数据源
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ 渲染层    │ │ 组件层    │ │ 物理引擎  │
    │ (读取)    │ │ (读取)    │ │ (更新)    │
    └──────────┘ └──────────┘ └──────────┘
```

### 2.2 数据流规则

| 规则 | 说明 |
|------|------|
| 组件通信 | 只通过 **props（向下）+ emit（向上）**，禁止直接跨组件操作 DOM |
| 状态修改 | 物理状态只能通过 `usePhysics` 导出的函数修改（`loadScene`、`addObject` 等） |
| 组件读取 | 组件通过 `import { state } from '../composables/usePhysics'` 直接读取 |
| 渲染读取 | 渲染函数接收 `objects` 参数，不直接 import state（纯函数） |

### 2.3 组件通信示例

```
QuestionBankPanel ──emit('load-question')──► App.vue
                                                │
                                    handleLoadQuestion()
                                                │
                                                ▼
                                    useSceneBuilder.buildScene()
                                                │
                                                ▼
                                    usePhysics.loadScene()
                                                │
                                                ▼
                                    state.objects 更新
                                                │
                                    ┌───────────┤
                                    ▼           ▼
                              PhysicsCanvas  ObjectList
                              (渲染读取)     (列表读取)
```

---

## 三、模块职责

### 3.1 Composable 职责划分

| Composable | 职责 | 不负责 |
|------------|------|--------|
| `usePhysics` | 物理状态管理、欧拉积分、场景加载、物体增删 | 碰撞检测、渲染、快照录制、合力计算 |
| `useCollision` | 碰撞检测（地面/质点/线段/弧线）+ 弧线约束动力学 + 触发器缺口 | 状态管理、渲染 |
| `useForces` | 合力计算策略层（力注册表 + 策略模式，遵循 OCP） | 状态管理、积分 |
| `useSnapshotManager` | 快照录制、关键帧检测、回放帧状态 | 物理积分 |
| `useCanvasRenderer` | 所有 Canvas 绘制函数（纯函数） | 状态管理、事件处理 |
| `useCanvasInteraction` | 鼠标事件、拖拽、框选、平移缩放 | 绘制、工具状态 |
| `useEditTools` | 编辑工具状态（小球/平台/圆弧/弹簧） | 事件处理、绘制 |
| `useAIParser` | AI 解析（DeepSeek + 本地回退） | 场景构建 |
| `useSceneBuilder` | SI→像素转换、场景构建 | AI 解析 |
| `useSceneManager` | 场景切换、播放/重置、自定义场景持久化、AI/题库加载 | 物体增删细节 |
| `useObjectOperations` | 物体增删改、选中、AI 参数应用、撤销/重做、Delete 键 | 场景切换 |
| `useSceneIO` | 场景导出/导入（剪贴板）、物体校验、深拷贝 | 状态管理 |
| `useKeyboard` | 全局键盘快捷键（Delete/Ctrl+Z/Ctrl+Y） | 业务逻辑 |
| `usePresets` | 预设场景数据 | 状态管理 |
| `useQuestionBank` | 题库筛选/选中 | 场景构建 |
| `useHistory` | 撤销/重做历史栈 | 状态管理 |

### 3.2 组件拆分原则

**PhysicsCanvas.vue** 曾有 1541 行，拆分为 3 个 composable：

```
PhysicsCanvas.vue (1541行)
    ├── useCanvasRenderer.ts   ← 所有 draw 函数
    ├── useCanvasInteraction.ts ← 所有事件处理
    └── useEditTools.ts        ← 工具状态管理
```

拆分后 `PhysicsCanvas.vue` 仅剩 ~200 行，负责：
- requestAnimationFrame 循环
- 组合三个 composable
- 组件 props/emit 声明

**App.vue** 进一步按 SRP 拆分（从 ~600 行降至 ~310 行）：

```
App.vue (~600行)
    ├── useSceneManager.ts        ← 场景切换/播放/重置/持久化
    ├── useObjectOperations.ts    ← 物体增删改/撤销重做/Delete 键
    ├── useSceneIO.ts             ← 导出/导入/物体校验
    └── useKeyboard.ts            ← 键盘快捷键
```

**usePhysics.ts** 同步拆出职责：

```
usePhysics.ts (~420行)
    ├── useSnapshotManager.ts  ← 快照录制 + 关键帧检测
    └── useForces.ts           ← 合力计算（策略注册表，OCP）
```

usePhysics 现仅保留物理状态、欧拉积分、场景加载与物体增删，`snapshots`/`currentFrame`/`keyframeIndices` 从 useSnapshotManager re-export。

---

## 四、核心常量体系

### 4.1 单位系统

```
用户输入（SI 单位）          内部存储（像素单位）         显示输出（SI 单位）
─────────────────         ─────────────────         ─────────────────
位置: m                    位置: px                   位置: m
速度: m/s                  速度: px/s                 速度: m/s
重力: m/s²                 重力: px/s²                重力: m/s²
弹簧 k: N/m               弹簧 k: N/m（不转换）       弹簧 k: N/m
```

转换公式：`像素值 = SI值 × PIXELS_PER_METER (50)`

### 4.2 常量定义

> 全局共享常量集中管理在 `src/constants.ts`（遵循 DRY，消除魔法数字）。`PIXELS_PER_METER`/`GRAVITY`/`GRAVITY_SI` 因与物理引擎强耦合仍保留在 usePhysics.ts。

| 常量 | 值 | 位置 | 说明 |
|------|-----|------|------|
| `PIXELS_PER_METER` | 50 | usePhysics.ts | 1 米 = 50 像素 |
| `GRAVITY_SI` | 9.8 | usePhysics.ts | 标准重力（m/s²） |
| `GRAVITY` | 490 | usePhysics.ts | 像素重力（px/s²） |
| `GROUND_DISABLED` | 100000 | constants.ts | 禁用地面标记值（groundY ≥ 此值表示禁用水平地面） |
| `MAX_SUBSTEPS` | 200 | constants.ts | 子步循环上限 |
| `MAX_STEP_DIST` | 10 | constants.ts | 单步最大移动距离（像素，防隧穿） |
| `TRAIL_LENGTH` | 80 | constants.ts | 轨迹最大长度（帧数） |
| `MAX_SNAPSHOTS` | 1200 | constants.ts | 快照缓冲（20s × 60fps） |
| `DEFAULT_CANVAS_WIDTH` | 800 | constants.ts | 默认画布宽度 |
| `DEFAULT_CANVAS_HEIGHT` | 500 | constants.ts | 默认画布高度 |
| `CANVAS_MARGIN` | 60 | constants.ts | 画布边距 |
| `GROUND_BASELINE` | 400 | constants.ts | 地面基准线 |
| `PAN_LIMIT` | 3000 | constants.ts | 平移范围限制（像素） |
| `SCENE_VERSION` | 2 | constants.ts | 场景导出 JSON 版本号 |
| `MAX_HISTORY` | 50 | useHistory.ts | 撤销/重做上限 |

---

## 五、渲染循环

### 5.1 主循环

```
requestAnimationFrame(loop)
    │
    ├── 计算 dt = (now - lastTime) / 1000，上限 0.05s
    │
    ├── if (mode === 'live' && !editMode)
    │       └── updatePhysics(dt)     ← 物理更新
    │
    └── draw()                        ← 渲染
            │
            ├── setTransform(dpr)     ← 高 DPI 适配
            ├── clearRect()
            │
            ├── ctx.save()
            ├── translate(worldOffset) ← 世界坐标变换
            ├── scale(worldScale)
            │
            ├── drawGrid()             ← 分层绘制
            ├── drawField()
            ├── drawGround()
            ├── drawSegments()
            ├── drawArcsVisually()
            ├── drawTrails()
            ├── drawObjects()
            ├── drawSprings()
            ├── drawVelocity()
            ├── drawForces()
            ├── drawPreviewLine()
            ├── drawPreviewArc()
            ├── drawSelectionHighlight()
            ├── drawSelectionRect()
            ├── drawShiftFlash()
            │
            ├── ctx.restore()
            │
            ├── drawWatermark()        ← UI 层（不随世界变换）
            ├── drawAIToast()
            └── drawEditUI()
```

### 5.2 绘制分层顺序

从下到上：网格 → 场可视化 → 地面 → 线段 → 弧线 → 轨迹 → 物体 → 弹簧 → 速度 → 受力 → 预览 → 选框 → UI

---

## 六、编辑模式

### 6.1 editMode 激活条件

```typescript
const editMode = computed(() =>
  activeScene.value === '自定义' &&
  mode.value === 'live' &&
  !state.isPlaying
)
```

仅当三个条件同时满足时激活：
1. 当前场景为"自定义"
2. 模式为实时模拟（非回放）
3. 未在播放中

### 6.2 工具交互优先级

```
拖拽优先级（从高到低）：
1. 线段端点（8px 半径）    ← 最易选中
2. 线段本身（5px 阈值）
3. 圆形物体（object.radius）
```

### 6.3 工具类型

| 工具 | 交互方式 | 生成物体 |
|------|----------|----------|
| `ball` | 单击放置 | ParticleObject |
| `platform` | 拖拽两端 | SegmentObject |
| `arc` | 三次点击（圆心→半径→角度） | 20 个 SegmentObject（弧线近似） |
| `spring` | 两次点击（固定端→连接球） | SpringObject |

---

## 七、场景构建流程

### 7.1 AI 解析 → 场景加载

```
用户输入题目文本
    │
    ▼
useAIParser.parsePhysicsProblem(text)
    │
    ▼
ParsedProblem (SI 单位)
    │
    ▼
useSceneBuilder.buildScene(parsed)
    │
    ├── computeAutoScale()         ← 根据 worldWidth 计算缩放
    ├── convertObject() × N        ← SI → 像素转换
    ├── convertSpring() × N        ← 弹簧（依赖 idMap）
    └── 构建 FieldState
    │
    ▼
usePhysics.loadScene(objects, forces, field, gravity, groundY)
    │
    ▼
state 更新 → 触发渲染
```

### 7.2 真题库 → 场景加载

```
QuestionBankPanel 选中题目
    │
    ▼
emit('load-question', question)
    │
    ▼
App.vue.handleLoadQuestion()
    │
    ▼
buildScene(question.sceneJson)     ← 题目 JSON → ParsedProblem
    │
    ▼
usePhysics.loadScene()
    │
    ▼
state.isPlaying = true             ← 自动播放
```

---

## 八、回放系统

### 8.1 快照录制

每帧物理更新后录制一帧快照：

```typescript
interface SnapshotFrame {
  objects: SnapshotObject[]  // 仅 id/x/y/vx/vy（精简）
  field: FieldState
  groundY: number
  gravity: number
  timestamp: number
}
```

缓冲区上限 `MAX_SNAPSHOTS = 1200`（20 秒），超出时移除最旧帧。

### 8.2 关键帧检测

```typescript
function detectKeyframe(prevFrame, curFrame): boolean {
  // 速度分量符号变化 → 关键帧
  if (prev.vx * cur.vx < 0 || prev.vy * cur.vy < 0) return true
  return false
}
```

关键帧用于 Timeline 上的黄色标记，方便定位碰撞瞬间和方向变化点。

### 8.3 回放渲染

回放模式下，`getDisplayObjects()` 用快照帧的位置/速度覆盖 `state.objects` 的颜色/半径/名称，实现"回放时保持外观一致"。

---

## 九、坐标系统

### 9.1 三套坐标系

| 坐标系 | 说明 | y 方向 |
|--------|------|--------|
| SI 坐标 | 题库/AI 输入，单位米 | y 向上为正 |
| Canvas 坐标 | 内部存储，单位像素 | y 向下为正 |
| 世界坐标 | 渲染变换后，支持平移缩放 | y 向下为正 |

### 9.2 坐标转换链

```
SI 输入 (y-up)
    │ useSceneBuilder: y_canvas = GROUND_BASELINE - y_si * scale
    ▼
Canvas 坐标 (y-down)
    │ 渲染时: x_world = (x_canvas - worldOffset.x) / worldScale
    ▼
世界坐标 (y-down, 可平移缩放)
```

### 9.3 screenToWorld 转换

```typescript
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  return {
    x: (sx - worldOffset.value.x) / worldScale.value,
    y: (sy - worldOffset.value.y) / worldScale.value
  }
}
```

---

## 十、弧线约束与触发器

为还原 2023 浙江高考题中小球穿越螺旋圆环的过程，引入弧线约束动力学与触发器缺口机制，跨三层协作：

```
数据层（usePhysics.ts 类型）        引擎层（useCollision.ts）          视图层（useCanvasRenderer.ts）
─────────────────────────         ──────────────────────         ──────────────────────────
ArcMeta.entryGap / exitGap   ──►  tryActivateArcConstraint  ──►  drawArcsVisually
  (triggerType/triggerAction)      applyArcConstraint              (受 state.showGateColors 控制
SegmentObject.arcGateState        isAngleInRange / didAngleCross    显示触发器颜色与缺口开关)
SegmentObject.constraintEnabled   detectArcCollision
ParticleObject.constrainedArcGroupId
```

### 10.1 数据层

- `SegmentObject.constraintEnabled`（仅弧线首段，默认 true）：true=约束模式，false=碰撞模式
- `SegmentObject.arcGateState`：运行时缺口开关状态（entryOpen/exitOpen/prevAngle/wasInside），不序列化，由 useSceneBuilder 初始化
- `ParticleObject.constrainedArcGroupId`：当前约束的弧线组 ID（undefined=未约束），运行时状态
- `ArcMeta.entryGap`/`exitGap`：缺口定义（centerAngle/halfWidth/initiallyOpen/triggerType/triggerAngle/triggerAction）

### 10.2 引擎层

- `tryActivateArcConstraint`：球触碰弧面或进入环内（catch-up 逻辑：球在环内且所有门关闭时强制激活，修复 4px 距离盲区）时，设置 `constrainedArcGroupId`
- `applyArcConstraint`：约束期间将球位置投影到弧面，保留切向动能；满足自然脱离条件（v² 与 g·R·(-sinθ) 比较）时解除约束
- 触发器：`enterRing`（球进环触发）、`angleCross`（角度穿越 triggerAngle 触发），动作 open/close 缺口
- `isAngleInRange`：完整圆（span≈2π）特判返回 true，避免全圆弧缺口误判

### 10.3 视图层

`drawArcsVisually` 根据 `state.showGateColors`（ControlBar 🎨 触发器颜色按钮切换）决定是否渲染触发器弧段颜色（amber）与缺口开关叠加（green=开 / red=关）。
