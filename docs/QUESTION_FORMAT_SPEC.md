# 物理模型范式规范（Deepseek 题目处理专用）

> 本文档是给 Deepseek 处理高考物理题的**离线规范**。Deepseek 按本规范将题目文本转换为结构化 JSON，TRAE 接收后补元数据并写入题库。
>
> 契约唯一真相源：[`src/composables/useAIParser.ts`](../src/composables/useAIParser.ts) 的 `ParsedProblem` 类型。本文档字段表与该类型逐字段对齐。

---

## 一、文档定位与使用流程

### 1.1 适用场景

将高考物理真题文本转换为可直接加载到物理仿真引擎的场景 JSON。

### 1.2 处理流程

```
题目文本 + 本规范
        │
        ▼
   Deepseek（按本规范输出 ParsedProblem JSON）
        │
        ▼
   TRAE 补元数据（id / title / description / difficulty / tags）
        │
        ▼
   append 到 src/data/questionBank.ts
```

### 1.3 Deepseek 输出范围

**仅输出 `sceneJson`（即 `ParsedProblem` JSON）**，不含题目级元数据。

| 由 Deepseek 输出 | 由 TRAE 补 |
|------------------|-----------|
| `title`（场景显示名，含简化标注） | `id`（如 `plate-2023-zj`） |
| `topic` / `objects` / `field` / `gravity` / `groundY` / `worldWidth` 等 | `description`（完整题干） |
| — | `difficulty`（`easy` / `medium` / `hard`） |
| — | `tags`（题型标签数组） |

---

## 二、核心契约：ParsedProblem 类型

`ParsedProblem` 是场景的顶层结构。字段表如下：

| 字段 | 类型 | 必填 | 默认值 | 单位 | 说明 |
|------|------|------|--------|------|------|
| `title` | string | 否 | — | — | 场景显示名；**用于标注物理简化项**（见第 13 节） |
| `description` | string | 否 | — | — | 场景描述（题目级 description 由 TRAE 补，此字段可选） |
| `topic` | enum | **是** | — | — | `'projectile'` \| `'slope'` \| `'elastic_collision'` \| `'magnetic_circle'` \| `'electric_deflection'` \| `'custom'` |
| `objects` | ParsedObject[] | **是** | — | — | 物体数组（5 种类型，见第三至七节） |
| `field` | object | **是** | — | — | 场设置（见第八节） |
| `gravity` | number | 否 | `9.8` | m/s² | 重力加速度；高考题常设 `10` |
| `groundY` | number \| null | 否 | `0` | m | 地面 y 坐标；电磁场题目设 `null` 禁用地面 |
| `worldWidth` | number | 否 | 自动计算 | m | 世界宽度；设置后自动缩放适配画布 |
| `simulationTime` | number | 否 | — | s | 仿真时长（可选） |
| `question` | string | 否 | — | — | 问题文本（可选） |
| `particleRestitution` | number | 否 | `1` | — | 质点间恢复系数（0=完全非弹性，1=完全弹性） |
| `groundRestitution` | number | 否 | `0.6` | — | 地面恢复系数 |

> `topic` 选择建议：抛体运动→`projectile`；斜面→`slope`；弹性碰撞→`elastic_collision`；纯磁场圆周→`magnetic_circle`；纯电场偏转→`electric_deflection`；复合场/板块/圆轨/弹簧等→`custom`。

---

## 三、物体类型 1：ball（质点 / 刚体）

```typescript
{
  id: string                    // 物体名（同题内唯一）
  type: 'ball'
  mass?: number                 // 质量（kg），默认 1
  charge?: number               // 电荷量（C），默认 0；正电荷沿 E 方向
  radius?: number               // 半径（m），默认 0.2
  initialPosition?: { x: number, y: number }  // 球底接触点高度（米）
  initialVelocity?: { x: number, y: number }  // 初速度（m/s）
  fixed?: boolean               // 是否固定（可选）
  friction?: number             // 摩擦系数（可选）
}
```

### ⚠️ 球底高度语义（关键）

`initialPosition.y` 表示**球底接触点高度**（球与下方表面的接触点），**不是球心高度**。

| 场景 | initialPosition.y | 含义 |
|------|-------------------|------|
| 球放在地面上（半径 0.2m） | `0` | 球底贴地，球心自动 = 0 + 0.2 = 0.2m |
| 球在高度 5m 的斜面顶端（半径 0.2m） | `5` | 球底在 5m，球心 = 5.2m |

> 引擎内部转换：`球心 = 球底高度 + 半径`（见 useSceneBuilder.ts L76-85）。

---

## 四、物体类型 2：platform（线段 / 传送带 / 可移动板块）

```typescript
{
  id: string
  type: 'platform'
  startPoint?: { x: number, y: number }   // 起点（米）
  endPoint?: { x: number, y: number }     // 终点（米）
  friction?: number                       // 摩擦系数，默认 0
  beltVelocity?: { x: number, y: number } // 传送带速度（m/s）
  movable?: boolean                       // 是否可移动（旧式板块）
  mass?: number                           // 可移动线段质量（kg）
}
```

### 4.1 三种用途

| 用途 | 触发字段 | 渲染颜色 | 说明 |
|------|----------|----------|------|
| 普通平台 | 仅 startPoint/endPoint | 灰色 | 静态线段障碍物 |
| 传送带 | `beltVelocity` | 青色 | 摩擦力按相对速度方向（物体-传送带） |
| 可移动板块（旧式） | `movable:true` + `mass` | 红色 | 受重力下落；**推荐用 plate 类型替代** |

### 4.2 法线自动计算

法线由 startPoint→endPoint 方向自动计算，默认指向上方（`normalY < 0`）。**无需手动指定法线**。

- 竖直线段：startPoint 在上、endPoint 在下 → 法线自动指向左
- 水平线段：startPoint 在左、endPoint 在右 → 法线自动指向上

---

## 五、物体类型 3：plate（带物理厚度的板块，独立类型）

```typescript
{
  id: string
  type: 'plate'
  startPoint?: { x: number, y: number }   // 上表面起点（米）
  endPoint?: { x: number, y: number }     // 上表面终点（米）
  physicsThickness?: number               // 物理厚度（米），默认 0.1
  angle?: number                          // 静态倾角（弧度），默认 0
  frictionTop?: number                    // 上表面摩擦系数，默认 0.3
  frictionBottom?: number                 // 下表面摩擦系数，默认 0.1
  mass?: number                           // 板块质量（kg），默认 1
}
```

### 5.1 与 platform 的区别

| 维度 | platform（movable） | plate |
|------|---------------------|-------|
| 物理厚度 | 无 | **有**（physicsThickness 参与碰撞） |
| 摩擦 | 单一 friction | **上下表面分离**（frictionTop / frictionBottom） |
| 倾角 | 跟随线段方向 | **静态 angle**（不随运动旋转） |
| 推荐场景 | 简单可移动线段 | **板块模型**（滑块+木板+地面三层摩擦） |

### 5.2 板块模型典型配置

滑块在木板上滑动，木板在地面上滑动：

```json
{
  "id": "木板", "type": "plate",
  "startPoint": { "x": -1, "y": 0.2 },
  "endPoint": { "x": 1, "y": 0.2 },
  "physicsThickness": 0.1,
  "angle": 0,
  "frictionTop": 0.3,
  "frictionBottom": 0,
  "mass": 3
}
```

> `frictionBottom: 0` 表示光滑地面；`frictionTop: 0.3` 表示滑块与木板间的动摩擦因数。

---

## 六、物体类型 4：arc（圆弧，含触发器缺口）

### 6.1 基础字段

```typescript
{
  id: string
  type: 'arc'
  center?: { x: number, y: number }       // 圆心（米）
  arcRadius?: number                       // 弧线半径（米）
  startAngle?: number                      // 起始角度（弧度，数学坐标系）
  endAngle?: number                        // 终止角度（弧度，数学坐标系）
  friction?: number                        // 摩擦系数，默认 0
  entryGap?: GapConfig                     // 入口缺口（可选）
  exitGap?: GapConfig                      // 出口缺口（可选）
}
```

### 6.2 ⚠️ 角度坐标系（关键）

- **角度使用数学坐标系**：y 向上为正，弧度制
- `0` = 右方向（+x），`π/2` = 上方向（+y），`π` = 左方向（-x），`-π/2` = 下方向（-y）
- 引擎内部会转为画布坐标系（y 向下为正，角度取反），**Deepseek 输出时按数学坐标系填写即可**
- 完整圆：`startAngle: 0`, `endAngle: 2π`（或等价区间）

### 6.3 弧线约束动力学

- 弧线由 20 段线段近似
- 首段自动设置 `constraintEnabled: true`
- 小球进环后被约束在弧面做**无能量损耗圆周运动**
- 约束模式与碰撞模式互斥：圆环穿越场景用约束模式，普通弧面弹跳场景用碰撞模式（不设缺口即默认约束）

### 6.4 触发器缺口 GapConfig

用于 2D 拓扑下模拟"螺旋圆环"的进出（如 2023 浙江题）：

```typescript
{
  centerAngle: number          // 缺口中心角度（数学坐标系弧度）
  halfWidth: number            // 缺口半宽（弧度）
  initiallyOpen?: boolean      // 初始开关状态，默认 false（关闭）
  triggerType?: 'enterRing' | 'angleCross' | 'spotOverlap'
  triggerAngle?: number        // angleCross 时必填（数学坐标系弧度）
  triggerSpotAngle?: number    // spotOverlap 时使用（数学坐标系弧度）
  triggerSpotRadius?: number   // 触发点半径（米），缺省取球半径 1.5 倍
  triggerAction?: 'open' | 'close'  // 触发动作
}
```

### 6.5 三种 triggerType 触发条件

| triggerType | 触发条件 | 典型用途 |
|-------------|----------|----------|
| `'enterRing'` | 小球从环外进入环内时触发（基于 `wasInside` 状态变化） | 入口缺口：球进环后关闭入口，防止原路返回 |
| `'angleCross'` | 小球角度穿越 `triggerAngle` 时触发（归一化到 [-π, π] 检测） | 出口缺口：球过最高点后打开出口 |
| `'spotOverlap'` | 小球经过环上 `triggerSpotAngle` 位置的触发圆（半径 `triggerSpotRadius`）时触发，一次性 | 精确位置触发（如球过环顶 π/2） |

### 6.6 完整圆特判

`isAngleInRange` 对 span ≈ 2π 的完整圆恒返回 `true`，避免全圆弧缺口误判。完整圆 + 缺口配置是合法组合。

---

## 七、物体类型 5：spring（弹簧）

```typescript
{
  id: string
  type: 'spring'
  anchor?: { x: number, y: number }       // 固定端坐标（米）
  ballId?: string                          // 连接的物体名（对应 ball.id）
  naturalLength?: number                   // 自然长度（米），默认 1
  k?: number                               // 劲度系数（N/m），默认 50
}
```

### ⚠️ 约束

1. **`ballId` 必须对应同题内某个 ball 的 `id`**，否则弹簧转换失败被丢弃
2. **`k` 值建议 10-50 N/m**，确保数值稳定（dt×ω < 0.1，见第 11 节）
3. 弹簧在物体转换的第二遍处理（依赖 idMap 解析连接关系），无需关心顺序

---

## 八、场设置 field

```typescript
{
  type: 'none' | 'electric' | 'magnetic' | 'composite'
  E?: { x: number, y: number }   // 电场强度（N/C）
  B?: number                      // 磁感应强度（T）
}
```

| 字段 | 单位 | 方向约定 |
|------|------|----------|
| `E.x` | N/C | x 方向（向右为正） |
| `E.y` | N/C | y 方向（**向上为正**） |
| `B` | T | **正=垂直纸面向里**，负=垂直纸面向外 |

### 8.1 复合场

`E` 和 `B` 可同时非零，**不依赖 `type` 字段**。引擎根据 E/B 是否非零判断是否施加电场力/磁场力。

- `type: 'none'` + E/B 均为 0 → 无场
- `type: 'composite'` + E/B 均非零 → 复合场
- `type: 'electric'` + 仅 E 非零 → 纯电场
- `type: 'magnetic'` + 仅 B 非零 → 纯磁场

### 8.2 力公式

- 电场力：`F = qE`（正电荷沿 E 方向）
- 洛伦兹力：`F = qv × B`（B 向里为正时，正电荷做顺时针圆周运动）

---

## 九、全局参数

| 字段 | 单位 | 默认值 | 说明 |
|------|------|--------|------|
| `gravity` | m/s² | `9.8` | 高考题常设 `10`；纯磁场/电场题可设 `0` |
| `groundY` | m | `0` | 地面 y 坐标；电磁场题目设 `null` **禁用地面** |
| `worldWidth` | m | 自动计算 | 设置后自动缩放；不设则按物体范围计算 |
| `simulationTime` | s | — | 仿真时长（可选） |
| `particleRestitution` | — | `1` | 质点间恢复系数（0=完全非弹性，1=完全弹性） |
| `groundRestitution` | — | `0.6` | 地面恢复系数 |

### 9.1 worldWidth 自动缩放

设置 `worldWidth` 后，引擎按 `scale = (画布宽度 - 2×边距) / worldWidth` 计算缩放比例，使场景完整显示在画布内。**建议根据物体 x 范围设置**，如物体最右 x=27m，则 `worldWidth: 27.2`（略留边距）。

---

## 十、坐标系与单位制约定

### 10.1 坐标系

- **y 向上为正**，地面 `y=0`，x 轴向右
- 与画布坐标系（y 向下为正）的转换由引擎内部处理，**Deepseek 按"y 向上"输出即可**

### 10.2 单位制（全部 SI）

| 物理量 | 单位 | 备注 |
|--------|------|------|
| 位置 | m | — |
| 速度 | m/s | — |
| 加速度 | m/s² | — |
| 质量 | kg | — |
| 力 | N | — |
| 电荷 | C | — |
| 电场 E | N/C | — |
| 磁场 B | T | 正=向里 |
| 劲度系数 k | N/m | **不做单位转换**（见下） |
| 角度 | rad | 数学坐标系 |

### 10.3 k 值不转换的推导

弹簧力 `F = -k·x`，在像素单位下推导：

```
F_SI = -k · x_m
a_SI = F_SI / m = -k · x_m / m
a_px = a_SI · scale = -k · (x_px / scale) / m · scale = -k · x_px / m
F_px = a_px · m = -k · x_px
```

结论：**k 直接用 N/m × 像素形变**，无需额外转换。

### 10.4 引擎内部转换（Deepseek 无需关心）

- 位置/速度/加速度：SI × scale → 像素
- y 坐标：翻转（SI 向上 → 画布向下）
- 角度：取反（数学坐标系 → 画布坐标系）
- E.y：翻转
- B：不转换
- k：不转换

---

## 十一、数值稳定性硬约束（防卡顿 / 防隧穿）

### 11.1 弹簧 k 值

**建议范围：10-50 N/m**

弹簧振子角频率 `ω = √(k/m)`，数值稳定要求 `dt × ω < 0.1`。

| k (N/m) | m (kg) | ω (rad/s) | dt×ω | 稳定性 |
|---------|--------|-----------|------|--------|
| 50 | 0.5 | 10 | 0.16 | ❌ 不稳定 |
| 200 | 1 | 14.1 | 0.23 | ❌ 不稳定 |
| 10 | 0.5 | 4.47 | 0.07 | ✅ 稳定 |
| 20 | 1 | 4.47 | 0.07 | ✅ 稳定 |

### 11.2 电磁场宏观等效参数表

**微观粒子（如质子 m=1.67e-27kg, v=2e6m/s）会导致子步数爆炸（227,000 步/帧），浏览器严重卡顿。电磁场题目必须使用宏观等效参数。**

| 参数 | 建议范围 | 说明 |
|------|----------|------|
| `mass` | ≥ 1e-4 kg | 避免过轻导致加速度爆炸 |
| `charge` | 1e-3 ~ 1e-2 C | 宏观等效电荷 |
| `velocity` | ≤ 50 m/s | 避免子步数过多 |
| `B` | 0.1 ~ 1 T | 可视范围内圆周运动 |
| `E` | 10 ~ 500 N/C | 可视偏转效果 |

**圆周半径公式**：`r = mv / (qB)`，建议 r 在 2-5m（可视范围内）。

### 11.3 球径/轨径比

**建议 ≤ 20%**（小球半径 / 弧线半径）。

过大易碰撞卡顿。缓解方法：
- 放大轨道坐标（如 ×1.6）
- 缩小球径（如 0.15 → 0.08）

参考 plate-2023-zj：轨道 R=0.5m 放大至 0.8m，小球半径缩至 0.08m，球径/轨径比 = 10%。

### 11.4 MAX_SUBSTEPS 上限

引擎设置 `MAX_SUBSTEPS = 200`（子步数上限）。子步数计算：`steps = min(200, max(1, ceil(maxVel × dt / 10px)))`。参数宏观等效化是避免触顶的双重保障。

---

## 十二、ID 命名与引用规则

### 12.1 物体 ID 唯一性

- 同一题目内物体 `id`（字符串名）**不可重复**
- 建议用中文表意名：`'滑块'`、`'摆渡车'`、`'圆轨BCDE'`、`'直轨道AB'`、`'凹槽底面HI'`
- 避免使用 `data`/`info`/`temp` 等模糊名

### 12.2 弹簧 ballId 引用

- `spring.ballId` **必须对应同题内某个 ball 的 `id`**
- 否则弹簧转换失败被丢弃（useSceneBuilder.ts L348）

### 12.3 题目级 ID（TRAE 负责）

- 题目级 `id`（如 `plate-2023-zj`）由 TRAE 补，**Deepseek 不输出**
- 命名规则：`{题型前缀}-{序号}` 或 `{题型前缀}-{年份}-{省份}`（如 `slope-006`、`plate-2023-zj`）

---

## 十三、物理简化标注规范

### 13.1 何时标注

当题目存在以下情况时，**必须在 `sceneJson.title` 中标注简化项**：

1. **三维→二维简化**：如螺旋圆轨 → 单圆弧
2. **未实现项**：如凹槽侧壁碰撞未实现
3. **坐标缩放**：如轨道等比例放大 ×1.6
4. **球径调整**：如小球缩小至 0.08m
5. **拓扑分离**：如螺旋 B/E 进出点分离为动态双缺口

### 13.2 标注格式

`{题目标题}（{简化项1}；{简化项2}；...）`

### 13.3 参考示例（plate-2023-zj）

```
游戏装置（2023浙江高考）（螺旋圆轨分离B/E为动态双缺口；凹槽侧壁IJ端面碰撞已实现；
摆渡车为plate类型带物理厚度；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）
```

---

## 十四、Deepseek 输出格式与模板

### 14.1 输出要求

- **纯 JSON**，无任何解释文字
- **无 markdown 代码块包裹**（不要 ```json ... ```）
- **temperature**：0.1（低温度保证稳定输出）
- **response_format**：`json_object`
- 所有数值用 SI 单位
- 缺失量用合理默认值（重力 9.8 或题目指定 10，质量 1kg，半径 0.2m）

### 14.2 完整输出模板

```json
{
  "title": "题目标题（含简化标注）",
  "topic": "custom",
  "objects": [
    {
      "id": "滑块",
      "type": "ball",
      "mass": 1,
      "charge": 0,
      "radius": 0.2,
      "initialPosition": { "x": 0, "y": 5 },
      "initialVelocity": { "x": 0, "y": 0 }
    },
    {
      "id": "木板",
      "type": "plate",
      "startPoint": { "x": -1, "y": 0.2 },
      "endPoint": { "x": 1, "y": 0.2 },
      "physicsThickness": 0.1,
      "angle": 0,
      "frictionTop": 0.3,
      "frictionBottom": 0,
      "mass": 3
    },
    {
      "id": "地面",
      "type": "platform",
      "startPoint": { "x": -5, "y": 0 },
      "endPoint": { "x": 5, "y": 0 },
      "friction": 0
    },
    {
      "id": "圆轨",
      "type": "arc",
      "center": { "x": 5, "y": 2 },
      "arcRadius": 1,
      "startAngle": 0,
      "endAngle": 6.283185307179586,
      "friction": 0,
      "entryGap": {
        "centerAngle": -1.5707963267948966,
        "halfWidth": 0.3,
        "initiallyOpen": true,
        "triggerType": "enterRing",
        "triggerAction": "close"
      },
      "exitGap": {
        "centerAngle": 1.5707963267948966,
        "halfWidth": 0.3,
        "initiallyOpen": false,
        "triggerType": "angleCross",
        "triggerAngle": 0,
        "triggerAction": "open"
      }
    },
    {
      "id": "弹簧",
      "type": "spring",
      "anchor": { "x": 0, "y": 3 },
      "ballId": "滑块",
      "naturalLength": 1,
      "k": 20
    }
  ],
  "field": { "type": "none", "E": { "x": 0, "y": 0 }, "B": 0 },
  "gravity": 9.8,
  "groundY": 0,
  "worldWidth": 12,
  "simulationTime": 5,
  "particleRestitution": 1,
  "groundRestitution": 0.6
}
```

### 14.3 真题示例（plate-2023-zj 的 sceneJson）

以下为 2023 浙江高考游戏装置题的完整 `sceneJson`，展示 ball + platform + plate + arc（含动态双缺口）的复合场景：

```json
{
  "title": "游戏装置（2023浙江高考）（螺旋圆轨分离B/E为动态双缺口；凹槽侧壁IJ端面碰撞已实现；摆渡车为plate类型带物理厚度；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）",
  "topic": "custom",
  "objects": [
    {
      "id": "滑块",
      "type": "ball",
      "mass": 1,
      "radius": 0.08,
      "initialPosition": { "x": 2.768, "y": 3.68 },
      "initialVelocity": { "x": 0, "y": 0 }
    },
    {
      "id": "直轨道AB",
      "type": "platform",
      "startPoint": { "x": 2.768, "y": 3.68 },
      "endPoint": { "x": 6.189, "y": 1.197 },
      "friction": 0
    },
    {
      "id": "圆轨BCDE",
      "type": "arc",
      "center": { "x": 6.88, "y": 1.6 },
      "arcRadius": 0.8,
      "startAngle": -2.214,
      "endAngle": 4.069,
      "friction": 0,
      "entryGap": {
        "centerAngle": -2.614,
        "halfWidth": 0.4,
        "initiallyOpen": true,
        "triggerType": "enterRing",
        "triggerAction": "close"
      },
      "exitGap": {
        "centerAngle": -1.814,
        "halfWidth": 0.4,
        "initiallyOpen": false,
        "triggerType": "angleCross",
        "triggerAngle": 1.5707963267948966,
        "triggerAction": "open"
      }
    },
    {
      "id": "直轨道EF",
      "type": "platform",
      "startPoint": { "x": 6.688, "y": 0.824 },
      "endPoint": { "x": 7.68, "y": 0 },
      "friction": 0
    },
    {
      "id": "水平轨道FG",
      "type": "platform",
      "startPoint": { "x": 7.68, "y": 0 },
      "endPoint": { "x": 11.68, "y": 0 },
      "friction": 0.2
    },
    {
      "id": "摆渡车",
      "type": "plate",
      "startPoint": { "x": 11.68, "y": 0 },
      "endPoint": { "x": 16.48, "y": 0 },
      "physicsThickness": 0.8,
      "angle": 0,
      "frictionTop": 0.3,
      "frictionBottom": 0,
      "mass": 1
    },
    {
      "id": "凹槽底面HI",
      "type": "platform",
      "startPoint": { "x": 11.68, "y": -0.8 },
      "endPoint": { "x": 26.08, "y": -0.8 },
      "friction": 0
    },
    {
      "id": "凹槽侧壁IJ",
      "type": "platform",
      "startPoint": { "x": 26.08, "y": 0 },
      "endPoint": { "x": 26.08, "y": -0.8 },
      "friction": 0
    }
  ],
  "field": { "type": "none", "E": { "x": 0, "y": 0 }, "B": 0 },
  "gravity": 10,
  "groundY": 0,
  "worldWidth": 27.2
}
```

**关键配置解读**：
- `entryGap.triggerType: 'enterRing'` + `triggerAction: 'close'`：球进环时关闭入口（防原路返回）
- `exitGap.triggerType: 'angleCross'` + `triggerAngle: π/2` + `triggerAction: 'open'`：球过最高点 C 后打开出口
- `摆渡车` 用 `type: 'plate'`，`physicsThickness: 0.8` 参与碰撞，`frictionTop: 0.3`（滑块摩擦），`frictionBottom: 0`（凹槽底面光滑）
- 坐标等比例放大 ×1.6，小球半径缩至 0.08m（球径/轨径比 10%，防卡顿）
- 重力设为 `10`（按题意）

---

## 附录：Deepseek 使用流程

### Step 1：准备题目文本

将高考物理真题的完整题干（含已知量、求解项）整理为纯文本。

### Step 2：构造 Prompt

```
System: 你是高考物理题解析引擎。按《物理模型范式规范》将题目转换为 ParsedProblem JSON。
        严格遵循规范中的字段表、坐标系约定、数值稳定性约束。
        仅返回 JSON，无任何解释文字。

User:   {粘贴本规范文档}

User:   题目：{粘贴题目文本}
```

### Step 3：Deepseek 输出

Deepseek 输出 `ParsedProblem` JSON（即 `sceneJson`）。

### Step 4：交 TRAE

将 JSON 交给 TRAE，TRAE 负责：
1. 校验 JSON 语法与字段合规性
2. 补元数据：`id` / `title`（题目级）/ `description` / `difficulty` / `tags`
3. append 到 `src/data/questionBank.ts` 的 `questionBank` 数组
4. 运行测试验证场景可加载

### Step 5：验证清单

- [ ] JSON 可直接 `JSON.parse`（无注释、无尾逗号、无 markdown 包裹）
- [ ] `topic` 字段存在且为合法枚举值
- [ ] `objects` 数组非空，每个物体 `type` 合法
- [ ] 同题内物体 `id` 唯一
- [ ] 弹簧 `ballId` 引用有效（对应同题内某个 ball 的 `id`）
- [ ] 电磁场题目使用宏观等效参数（见第 11.2 节）
- [ ] 弹簧 `k` 值在 10-50 N/m 范围内
- [ ] 球径/轨径比 ≤ 20%
- [ ] `initialPosition.y` 是球底高度（非球心高度）
- [ ] 角度使用数学坐标系（y 向上为正，弧度制）
- [ ] 物理简化项已在 `title` 中标注
