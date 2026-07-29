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

板块是可移动的线段（`movable: true`），具有质量和速度。板块模型支持上下表面独立摩擦与视觉厚度：

```typescript
// 板块字段
interface SegmentObject {
  movable?: boolean        // 板块标记
  mass?: number            // 板块质量
  velocity?: Vec2          // 板块速度（受重力、支撑、摩擦更新）
  thickness?: number       // 视觉厚度（像素，仅渲染用）
  frictionTop?: number     // 上表面摩擦系数（未设置回退 friction）
  frictionBottom?: number  // 下表面摩擦系数（未设置回退 friction）
}
```

板块运动模型（`subStepPhysics` 中）：
1. 受重力更新 `velocity.y`
2. 位置更新（x、y 同步平移，保持形状不旋转）
3. 地面/平台支撑检测：y 归位、`vy` 清零；支撑面摩擦按相对速度减速 `vx`（与支撑面共速时停止）
4. 传送带支撑：`supportVx` 取支撑线段 `velocity.x`，摩擦力驱动板块至传送带速度

板块与滑块之间的摩擦力遵循牛顿第三定律——摩擦力同时对滑块和板块施加反作用冲量。`frictionTop`/`frictionBottom` 允许板块上下表面采用不同摩擦系数（如上表面粗糙、下表面光滑）。

---

## 七、场景构建

### 7.1 自动缩放（computeAutoScale）

```typescript
function computeAutoScale(parsed: ParsedProblem): number {
  if (!parsed.worldWidth) return PIXELS_PER_METER  // 默认 50
  // scale = (画布宽度 - 2×边距) / 世界宽度
  return (DEFAULT_CANVAS_WIDTH - 2 * CANVAS_MARGIN) / parsed.worldWidth
}
```

- `DEFAULT_CANVAS_WIDTH = 800`
- `CANVAS_MARGIN = 60`
- 默认 scale = 50（即 `PIXELS_PER_METER`）

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
