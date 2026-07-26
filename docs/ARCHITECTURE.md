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
│ AIInput  │   ┌──────────────────┐   │  QuestionBankPanel   │
│ ObjectList│   │  PhysicsCanvas   │   │                       │
│ Property │   │  (渲染+事件分发)  │   │  (21道真题库)         │
│ Panel    │   └────────┬─────────┘   │                       │
│ ForceEdi │            │              │                       │
│ tor      │     ControlBar            │                       │
│          │     Timeline              │                       │
│          │     SceneTabs             │                       │
├──────────┴────────────┴──────────────┴───────────────────────┤
│                     Composable 层                            │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│usePhysics│useCollision│useCanvas│useCanvas │useEditTools     │
│ (状态+   │ (碰撞检测) │Renderer │Interaction│(工具状态)       │
│  积分)   │           │ (绘制)  │ (事件)    │                 │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
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
| `usePhysics` | 物理状态管理、欧拉积分、快照录制 | 碰撞检测、渲染 |
| `useCollision` | 碰撞检测（地面/质点/线段/弧线） | 状态管理、渲染 |
| `useCanvasRenderer` | 所有 Canvas 绘制函数（纯函数） | 状态管理、事件处理 |
| `useCanvasInteraction` | 鼠标事件、拖拽、框选、平移缩放 | 绘制、工具状态 |
| `useEditTools` | 编辑工具状态（小球/平台/圆弧/弹簧） | 事件处理、绘制 |
| `useAIParser` | AI 解析（DeepSeek + 本地回退） | 场景构建 |
| `useSceneBuilder` | SI→像素转换、场景构建 | AI 解析 |
| `usePresets` | 预设场景数据 | 状态管理 |
| `useQuestionBank` | 题库筛选/选中 | 场景构建 |
| `useHistory` | 撤销/重做历史栈 | 状态管理 |

### 3.2 PhysicsCanvas.vue 拆分原则

原 `PhysicsCanvas.vue` 曾有 1541 行，拆分为 3 个 composable：

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

| 常量 | 值 | 位置 | 说明 |
|------|-----|------|------|
| `PIXELS_PER_METER` | 50 | usePhysics.ts | 1 米 = 50 像素 |
| `GRAVITY_SI` | 9.8 | usePhysics.ts | 标准重力（m/s²） |
| `GRAVITY` | 490 | usePhysics.ts | 像素重力（px/s²） |
| `MAX_SNAPSHOTS` | 1200 | usePhysics.ts | 快照缓冲（20s × 60fps） |
| `MAX_SUBSTEPS` | 200 | usePhysics.ts | 子步循环上限 |
| `MAX_HISTORY` | 50 | useHistory.ts | 撤销/重做上限 |
| `GROUND_BASELINE` | 400 | useSceneBuilder.ts | 地面基准线 |
| `CANVAS_MARGIN` | 60 | useSceneBuilder.ts | 画布边距 |
| `DEFAULT_CANVAS_WIDTH` | 800 | useSceneBuilder.ts | 默认画布宽度 |

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
