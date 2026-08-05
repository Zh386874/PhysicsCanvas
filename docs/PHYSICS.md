# 物理模型文档

> 本文档描述物理解模项目的物理引擎实现：单位系统、积分方法、碰撞检测算法和力模型。

---

## 一、单位系统

### 1.1 双单位制

项目使用两套单位系统，通过 `PIXELS_PER_METER = 50` 转换：

| 物理量 | SI 单位（输入/显示） | 像素单位（内部存储） | 转换公式 |
|--------|---------------------|---------------------|----------|
| 位置 | m | px | `px = m × 50` |
| 速度 | m/s | px/s | `px/s = m/s × 50` |
| 加速度 | m/s² | px/s² | `px/s² = m/s² × 50` |
| 重力 | 9.8 m/s² | 490 px/s² | `490 = 9.8 × 50` |
| 弹簧 k | N/m | N/m（不转换） | 见弹簧力推导 |
| 电场 E | N/C | N/C（像素单位存储） | — |
| 磁场 B | T | T | — |

### 1.2 设计理由

- **内部用像素**：Canvas 绘制直接使用像素坐标，无需每帧转换
- **输入用 SI**：题库和 AI 解析使用国际标准单位，符合物理学习习惯
- **显示用 SI**：属性面板显示时转换回 SI 单位（如重力显示 9.8 而非 490）

---

## 二、积分方法

### 2.1 欧拉积分

采用半隐式欧拉法（Symplectic Euler），先更新速度再更新位置：

```typescript
// 单步更新（subStepPhysics 函数核心）
const ax = fx / p.mass    // 计算加速度
const ay = fy / p.mass

p.vx += ax * subDt        // 先更新速度
p.vy += ay * subDt

p.x += p.vx * subDt       // 再更新位置
p.y += p.vy * subDt
```

### 2.2 子步循环（防隧穿）

**问题**：高速物体在一帧内可能穿透碰撞体（隧穿现象）。

**方案**：将一帧拆分为多个子步，每步移动距离不超过 `maxStepDist = 10px`。

```typescript
function updatePhysics(dt: number): void {
  const maxStepDist = 10  // 像素

  // 计算最大速度
  let maxVelMag = 0
  for (const obj of state.objects) {
    if (obj.type === '质点' || obj.type === '刚体') {
      const velMag = Math.hypot(p.vx, p.vy)
      if (velMag > maxVelMag) maxVelMag = velMag
    }
  }

  // 动态子步数，上限 200（防卡顿）
  const steps = Math.min(200, Math.max(1, Math.ceil(maxVelMag * dt / maxStepDist)))
  const subDt = dt / steps

  for (let i = 0; i < steps; i++) {
    subStepPhysics(subDt)
  }
}
```

**子步数计算**：

| 场景 | 速度 | dt | 子步数 |
|------|------|-----|--------|
| 常规（小球 5 m/s） | 250 px/s | 0.016s | 1 |
| 高速（碰撞 10 m/s） | 500 px/s | 0.016s | 1 |
| 极速（磁场 50 m/s） | 2500 px/s | 0.016s | 4 |
| 限制上限 | 任意 | 任意 | ≤ 200 |

### 2.3 MAX_SUBSTEPS 上限

设置 `MAX_SUBSTEPS = 200` 的原因：

> 电磁场题目中微观粒子（如质子 m=1.67e-27kg, v=2e6m/s）会导致子步数爆炸（227,000 步/帧），浏览器严重卡顿。通过上限约束 + 题目参数宏观等效化（改为 m=1e-4kg, v=5~50m/s）双重保障，将子步数降至 1-4 步/帧。

---

## 三、碰撞检测

### 3.1 碰撞检测总函数

```typescript
function checkCollision(
  objects: PhysicsObject[],
  groundY: number,
  groundRestitution = 0.6,
  particleRestitution = 1.0,
  dt = 0.016,
  gravity = 490
): boolean
```

检测顺序：地面碰撞 → 线段/弧线碰撞 → 质点间碰撞

### 3.2 地面碰撞

```typescript
function checkGroundCollision(obj, groundY, restitution = 0.6): boolean {
  if (obj.y + radius >= groundY) {
    obj.y = groundY - radius           // 位置修正
    if (obj.vy > 0) obj.vy = -obj.vy * restitution  // 速度反射
    return true
  }
}
```

> **注意**：地面碰撞不处理水平摩擦力。水平摩擦统一由线段碰撞的 `detectSegmentCollision` 处理，避免双重摩擦。

### 3.3 质点间碰撞

采用动量守恒 + 恢复系数模型：

```typescript
function checkParticleCollision(a, b, restitution = 1.0): boolean {
  // 1. 距离检测
  const dist = Math.sqrt(dx² + dy²)
  if (dist >= ra + rb) return false  // 未碰撞

  // 2. 位置修正（分离重叠）
  const overlap = minDist - dist
  a.x -= nx * overlap / 2
  b.x += nx * overlap / 2

  // 3. 速度更新
  if (restitution === 0) {
    // 完全非弹性碰撞：共速
    const vCommon = (ma * va + mb * vb) / (ma + mb)
    vaNew = vCommon
    vbNew = vCommon
  } else {
    // 弹性/部分弹性碰撞
    vaNew = ((ma - mb) * va + 2 * mb * vb) / (ma + mb) * restitution
    vbNew = ((mb - ma) * vb + 2 * ma * va) / (ma + mb) * restitution
  }
}
```

### 3.4 线段碰撞（CCD 连续碰撞检测）

**CCD 原理**：通过上一帧位置（prevX/prevY）和当前位置之间的线段，检测是否穿越了碰撞体。

```
prevPos ────────► curPos
         │
         │ 交叉检测
         │
    ─────segment─────
```

**碰撞响应**：

1. **法向速度反射**：`v_n_new = -v_n * restitution`
2. **切向摩擦减速**：线性减速模型（见摩擦力部分）
3. **位置修正**：将物体推到线段表面上方

### 3.5 弧线碰撞

弧线由 20 个线段近似（`groupId` 标记同组），碰撞时整组检测一次，避免重复响应。

#### 3.5.1 触发器缺口机制

螺旋圆轨（如 2023 浙江题）在 2D 拓扑下无法真正实现"环"，通过动态缺口（`entryGap`/`exitGap`）模拟小球进出环：

- **缺口定义**：`centerAngle`（中心角度）+ `halfWidth`（半宽），缺口角度范围内放行小球穿过
- **面板编辑**：属性面板以**度数**（起始角度/终止角度、触发角度）编辑缺口，内部存储仍为弧度，换算见 `src/utils/arcGap.ts`
- **运行时状态**：`SegmentObject.arcGateState.{entryOpen, exitOpen}` 控制开关，由 `useSceneBuilder` 初始化
- **触发类型**（`triggerType`）：
  - `enterRing`：小球从环外进入环内时触发（基于 `wasInside` 状态变化）
  - `angleCross`：小球角度穿越 `triggerAngle` 时触发（`didAngleCross` 归一化到 [-π, π] 检测）
- **触发动作**（`triggerAction`）：`open` 打开缺口 / `close` 关闭缺口
- **完整圆特判**：`isAngleInRange` 对 span≈2π 的完整圆恒返回 true，避免全圆弧缺口误判

#### 3.5.2 弧线约束动力学

为避免小球在弧面上多次碰撞导致能量损失，启用约束模式（`constraintEnabled: true`，仅弧线首段）：

- **激活**（`tryActivateArcConstraint`）：小球触碰弧面时设置 `constrainedArcGroupId`
  - **catch-up 逻辑**：当小球已深入环内（距弧面 > 4px）且所有缺口关闭时，跳过距离判定强制激活约束——修复 `tryActivateArcConstraint` 与 `detectArcCollision` 共用 `closest.dist > radius` 判定造成的 4px 距离盲区（盲区会导致两者同时失效，球穿过环底）
- **维护**（`applyArcConstraint`）：约束期间将小球位置投影回弧面，仅保留切向动能（消除法向速度分量），实现无能量损耗的圆周运动
- **自然脱离**：当切向速度满足脱离条件时解除约束（`constrainedArcGroupId = undefined`）：
  - 内侧掉落：`v² < g·R·(-sinθ)`
  - 外侧飞出：`v² > g·R·(-sinθ)`（θ 为小球所在角度）

> 约束模式与碰撞模式（`constraintEnabled: false`）互斥：约束模式适合圆环穿越场景，碰撞模式适合普通弧面弹跳场景。

---

## 四、力模型

### 4.1 合力计算

每帧对每个质点计算合力：

```
F_total = F_gravity + F_custom + F_field + F_spring
```

### 4.2 重力

```typescript
let fy = p.mass * state.gravity  // F = mg（像素单位）
```

- `state.gravity` 默认 490 px/s²（= 9.8 × 50）
- 用户可在属性面板修改，显示时转换为 m/s²

### 4.3 摩擦力

**模型**：线性减速（帧率无关）

```typescript
// detectSegmentCollision 中的摩擦力计算
const friction = seg.friction ?? obj.friction ?? 0
if (friction > 0) {
  // 法向力 N = m * g * cos(θ)
  const cosA = Math.abs(normalY)  // 法线与竖直方向夹角的余弦
  const N = obj.mass * gravity * cosA

  // 摩擦力造成的加速度 a = μ * g * cos(θ)
  const a = friction * gravity * cosA

  // 切向速度减速 Δv = a * dt
  const dVt = a * dt
  if (v_tangent > 0) v_tangent = Math.max(0, v_tangent - dVt)
  else v_tangent = Math.min(0, v_tangent + dVt)
}
```

**关键修复历史**：

| 版本 | 问题 | 修复 |
|------|------|------|
| v1 | `damp = friction * 0.15`，指数衰减 `v *= (1-damp)` | 帧率相关，60fps 下每秒衰减 84% |
| v2 | `checkGroundCollision` 中硬编码 `obj.vx *= 0.98` | 与线段摩擦叠加导致双重摩擦 |
| **当前** | 线性减速 `Δv = μgcosθ·dt` | 帧率无关，单一摩擦源 |

### 4.4 弹簧力

**公式**：`F = -k · x`（胡克定律）

```typescript
// subStepPhysics 中的弹簧力
for (const s of state.objects) {
  if (s.type !== 'spring') continue
  const spring = s as SpringObject
  if (spring.ballId !== p.id) continue

  const dx = p.x - spring.anchorX
  const dy = p.y - spring.anchorY
  const currentLen = Math.hypot(dx, dy)
  const deformation = currentLen - spring.naturalLength

  // F_px = -k * x_px（k 为 SI 单位 N/m，形变用像素）
  const forceMag = -spring.k * deformation
  fx += forceMag * dx / currentLen
  fy += forceMag * dy / currentLen
}
```

**单位推导**：

```
F_SI = -k * x_m                    （SI 单位）
a_SI = F_SI / m = -k * x_m / m     （SI 加速度）
a_px = a_SI * scale = -k * (x_px / scale) / m * scale = -k * x_px / m
F_px = a_px * m = -k * x_px       （像素力）

结论：k 无需额外转换，直接用 N/m × 像素形变
```

### 4.5 电场力

```typescript
if (state.field.E.x !== 0 || state.field.E.y !== 0) {
  fx += charge * state.field.E.x   // F = qE
  fy += charge * state.field.E.y
}
```

- `charge`：电荷量（C）
- `E`：电场强度（N/C，像素单位存储）
- 方向：正电荷沿 E 方向，负电荷反向

### 4.6 洛伦兹力（磁场力）

```typescript
if (state.field.B !== 0) {
  fx += charge * p.vy * state.field.B    // F_x = qv_yB
  fy += -charge * p.vx * state.field.B   // F_y = -qv_xB
}
```

**公式**：`F = qv × B`（B 垂直纸面向里为正）

- `B > 0`：⊙ 垂直纸面向里
- `B < 0`：⊗ 垂直纸面向外
- 正电荷在 B>0 磁场中做顺时针圆周运动

**电场力与磁场力可同时存在**（复合场），由 E 和 B 是否非零判断，不依赖 `field.type` 字段。

---

## 五、传送带模型

传送带是特殊的线段物体，带有 `velocity` 属性：

```typescript
// detectSegmentCollision 中的传送带摩擦
if (seg.velocity) {
  // 相对速度 = 物体速度 - 传送带速度
  const relVt = v_tangent - (seg.velocity.x * tx + seg.velocity.y * ty)
  // 摩擦力方向与相对速度方向相反
  if (relVt > 0) v_tangent -= dVt
  else v_tangent += dVt
}
```

---

## 六、板块模型

板块是线段物体的子类型：`type: 'line_segment'` + `subtype: 'plate'`，与普通平台（`subtype: 'platform'`，灰色）和传送带（`subtype: 'conveyor'`，青色 `#0891b2`）区分。板块渲染为红色 `#dc2626`，具有矩形实体、质量、速度、上下表面独立摩擦，可受重力平移（不旋转）。

```typescript
// 板块字段（SegmentObject 扩展，矩形模型）
interface SegmentObject {
  type: 'line_segment'
  subtype: 'plate'                       // 板块子类型标记
  movable: true                          // 始终可移动（触发重力/支撑分支）
  mass?: number                          // 质量（kg），默认 1
  velocity?: Vec2                        // 速度 {x,y}，像素/秒
  physicsThickness?: number              // 物理厚度（像素，= height），碰撞/支撑检测用
  frictionTop?: number                   // 上表面摩擦系数（滑块侧），默认 0.3
  frictionBottom?: number                // 下表面摩擦系数（地面侧），默认 0.1
  angle?: number                         // 静态倾角（弧度），0=水平；nx=sin θ, ny=-cos θ
  // —— 矩形模型核心字段（isRectPlate 要求均存在）——
  centerX?: number                       // 矩形几何中心 x（像素）
  centerY?: number                       // 矩形几何中心 y（像素）
  width?: number                         // 沿板块长度方向的尺寸（像素，上表面长度）
  height?: number                        // 沿法线方向厚度（像素，= physicsThickness）
  // —— 上表面端点（派生字段）——
  x1: number; y1: number                 // 上表面左端点
  x2: number; y2: number                 // 上表面右端点
  normalX: number; normalY: number       // 法线（normalY < 0 指向上方）
}
```

### 6.1 矩形模型与端点推导（derivePlateEndpoints）

当板块满足 `isRectPlate`（`subtype==='plate'` 且 centerX/centerY/width/height 全部存在）时，**端点 `x1/y1/x2/y2` 不再是源头数据**，而是每次物理子步从矩形中心与角度反向推导：

```typescript
function derivePlateEndpoints(seg): void {
  const halfW = seg.width / 2, halfH = seg.height / 2
  const nx = sin(seg.angle), ny = -cos(seg.angle)   // 法线（指向上）
  const wdx = cos(seg.angle), wdy = sin(seg.angle)  // 沿宽度切线
  const topCx = seg.centerX + nx * halfH            // 上表面中心
  const topCy = seg.centerY + ny * halfH
  seg.x1 = topCx - wdx * halfW                      // 上表面左
  seg.y1 = topCy - wdy * halfW
  seg.x2 = topCx + wdx * halfW                      // 上表面右
  seg.y2 = topCy + wdy * halfW
}
```

- 矩形**实体边界**：沿法线向下偏移 `height`（= physicsThickness）得到下表面两个端点，共四角。
- 上表面端点参与滑块/质点碰撞与摩擦计算；下表面端点参与地面/平台支撑检测。
- 板块端面撞竖直墙壁：立即 `vx=0`（法向动量守恒反射，无切向摩擦）。

### 6.2 双向同步不变量（关键！避免播放时端点被拉回）

端点（x1/y1/x2/y2）与矩形中心（centerX/centerY）必须**双向同步**，任何修改只走其中一条路径都会在播放时触发"端点回弹旧位置"：

| 用户编辑场景 | 修改源头 | 同步路径 |
|---|---|---|
| 画布拖拽移动板块（handleUpdateObject） | x1/y1/x2/y2 被平移 | 用当前 angle + height 反推重算 centerX/centerY：<br>`centerX = mid(x1,x2) − nx·height/2`<br>`centerY = mid(y1,y2) − ny·height/2` |
| 属性面板输入 x1/y1/x2/y2（onObjectUpdate） | x1/y1/x2/y2 被赋值 | 同上公式重算 centerX/centerY + saveCustomScene 持久化 |
| buildScene 创建板块、AI/题库加载 | 矩形中心与端点一起构造 | 两者同步写入（useSceneBuilder.ts L182-L185） |
| 物理更新（subStepPhysics） | centerX/centerY 按速度平移 | 每子步调用 derivePlateEndpoints 从中心反向推回端点 |

> **防坑提示**：如果新增了修改板块 x1/y1/x2/y2 的代码路径，必须同时套用 `handleUpdateObject` 中的 centerX/centerY 重算公式（或直接调用共用 helper），否则下一次 `capturePlayStart` 捕获的仍是旧 center，播放第一帧 derivePlateEndpoints 会把端点拉回旧位置。

### 6.3 角度 angle 语义

- 单位：**弧度**，0 = 水平（右端，法线沿 −y）。
- 法线方向：`nx = sin θ`, `ny = −cos θ`（保证 θ=0 时 `ny = −1` 指向上方）。
- 宽度切线：`wdx = cos θ`, `wdy = sin θ`（沿板块上表面从左指向右）。
- angle 为**静态常量**：板块物理更新只做平移（vx, vy），不产生旋转；若要实现倾斜板块，在创建/编辑时设置 angle，之后每次 derivePlateEndpoints 以该角度构造端点。

### 6.4 物理厚度与摩擦链

- `height === physicsThickness`（像素值）。前者用于矩形几何推导，后者用于碰撞支撑检测的语义字段，两者保持一致。
- 摩擦系数优先级链（板块上表面 ↔ 滑块）：
  `μ = segment.frictionTop ?? segment.friction ?? object.friction ?? 0`
- 摩擦系数优先级链（板块下表面 ↔ 支撑平台/地面）：
  `μ = segment.frictionBottom ?? segment.friction ?? supportSegment.friction ?? 0`
- 摩擦力遵循牛顿第三定律：对滑块施加 ±μ·N 的同时，对板块施加反方向等大冲量（动量守恒）。

### 6.5 板块运动流水线（subStepPhysics）

1. **重力积分**：受重力 `mg` 更新 `velocity.y`（无支撑时自由落体）。
2. **位置平移**：`centerX += vx·dt`, `centerY += vy·dt`，整体平移不改变 angle 与形状。
3. **支撑检测**：下表面端点距离地面/平台 ≤ 阈值 → y 归位、`vy=0`；支撑摩擦按相对速度减 `vx`，与支撑共速时停止。
4. **传送带支撑**：若支撑线段为 conveyor（有 velocity 且 movable=false），取 `supportVx = velocity.x`，摩擦力驱动板块 `vx → supportVx`。
5. **调用 derivePlateEndpoints**：基于最新 center 重算 x1/y1/x2/y2，供本帧后续碰撞检测与渲染读取。


---

## 七、场景构建

### 7.1 统一缩放比例（scale = PIXELS_PER_METER）

所有场景固定按 `PIXELS_PER_METER = 50` 换算，`scale` 为常量，不再按 `worldWidth` 动态缩放：

```typescript
// useSceneBuilder.ts
const scale = PIXELS_PER_METER  // 固定 50
```

**取消原因**：旧 `computeAutoScale` 根据 `worldWidth` 动态计算 scale，导致题库/AI 场景与预设场景物理量不一致（如题库重力被错误缩放为 10×25=250 px/s²，而预设统一为 490 px/s²），破坏物理量一致性。

**适配方式**：滚轮 `worldScale`（0.3~100）只改变**视图缩放**，不改变物理换算；`worldWidth` 字段保留但被忽略。

### 7.2 球底高度语义

**重要约定**：`initialPosition.y` 表示**球底接触点高度**（球与下方表面的接触点），而非球心高度。

```typescript
// useSceneBuilder.ts 中的转换
const bottomY = obj.initialPosition.y   // 球底高度（米）
const radiusM = obj.radius || 0.2       // 半径（米）
// 球心 y = 地面基准 - (球底高度 + 半径) × 缩放
const cy = GROUND_BASELINE - (bottomY + radiusM) * scale
```

**示例**：球底高度 y=0（放在地面上），半径 r=0.2m
- 球心 y = 400 - (0 + 0.2) × 50 = 400 - 10 = 390 px

### 7.3 法线自动计算

```typescript
function autoComputeNormal(segment): { normalX, normalY } {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  let nx = dy / len    // 垂直方向
  let ny = -dx / len

  // 保留用户方向偏好：如果与当前法线方向相反，则翻转
  if (curNx * nx + curNy * ny < 0) {
    nx = -nx
    ny = -ny
  }
  return { normalX: nx, normalY: ny }
}
```

默认保证 `normalY < 0`（法线指向上方），除非用户手动设置其他方向。

---

## 八、数值稳定性

### 8.1 常见问题与解决

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 隧穿 | 速度过快，一帧穿透碰撞体 | 子步循环（maxStepDist=10px） |
| 卡顿 | 子步数无上限 | MAX_SUBSTEPS=200 + 参数宏观等效化 |
| 能量发散 | dt×ω > 0.1 时欧拉积分不稳定 | 降低弹簧 k 值，使 dt×ω < 0.1 |
| 双重摩擦 | 地面+线段同时计算摩擦 | 地面碰撞不处理水平摩擦 |
| 位置抖动 | 碰撞后未完全分离 | 位置修正（推到表面上方） |

### 8.2 弹簧数值稳定性

弹簧振子的角频率 `ω = √(k/m)`，数值稳定要求 `dt × ω < 0.1`。

| k (N/m) | m (kg) | ω (rad/s) | T (s) | dt×ω | 稳定性 |
|---------|--------|-----------|-------|------|--------|
| 50 | 0.5 | 10 | 0.63 | 0.16 | ❌ 不稳定 |
| 200 | 1 | 14.1 | 0.45 | 0.23 | ❌ 不稳定 |
| 10 | 0.5 | 4.47 | 1.41 | 0.07 | ✅ 稳定 |
| 20 | 1 | 4.47 | 1.41 | 0.07 | ✅ 稳定 |

> 题库中弹簧 k 值已调整为 10-20 N/m，确保数值稳定且振动周期在 1-2 秒（视觉清晰）。
