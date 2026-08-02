# 题库数据文档

> 本文档描述真题库的数据结构、题型分类、场景参数格式和添加新题目的方法。

---

## 一、数据结构

### 1.1 QuestionItem 类型

定义在 `src/data/questionBank.ts`：

```typescript
interface QuestionItem {
  id: string                    // 题目唯一标识，如 'plate-2023-zj'
  title: string                 // 题目标题
  description: string           // 题目描述（完整题干）
  difficulty: 'easy' | 'medium' | 'hard'  // 难度
  tags: string[]                // 题型标签，如 ['板块模型', '圆周运动']
  sceneJson: ParsedProblem      // 场景参数（与 ParsedProblem 同构，SI 单位）
}
```

> `sceneJson` 与 `useAIParser.ts` 的 `ParsedProblem` 同构，可直接传给 `useSceneBuilder.buildScene`。详见 [API.md - AI 解析类型](API.md#15-ai-解析类型)。

### 1.2 sceneJson.objects 物体格式

每种物体类型的参数（均为 SI 单位）：

#### ball（质点）

```typescript
{
  id: string                    // 物体名（如 '滑块'）
  type: 'ball'
  mass: number                  // 质量（kg）
  radius: number                // 半径（m）
  charge?: number               // 电荷量（C，可选）
  initialPosition: { x: number, y: number }  // 球底高度（米）
  initialVelocity: { x: number, y: number }  // 初速度（m/s）
}
```

> **重要**：`initialPosition.y` 表示**球底接触点高度**（球与下方表面的接触点），而非球心高度。详见 [物理模型文档 - 球底高度语义](PHYSICS.md#72-球底高度语义)。

#### platform（平台/线段/板块）

```typescript
{
  id: string
  type: 'platform' | 'plate'               // 'plate' 为板块模型
  startPoint: { x: number, y: number }     // 起点（米）
  endPoint: { x: number, y: number }       // 终点（米）
  friction?: number                         // 摩擦系数（默认 0）
  restitution?: number                      // 恢复系数（默认 0.3）
  beltVelocity?: { x: number, y: number }   // 传送带速度（m/s）
  movable?: boolean                         // 是否可移动（板块模型）
  mass?: number                             // 可移动线段质量（kg）
  // 板块模型专属字段（type='plate' 时使用）
  physicsThickness?: number                 // 物理厚度（米，默认 0.1）
  frictionTop?: number                      // 上表面摩擦系数（与滑块，未设置回退 friction）
  frictionBottom?: number                   // 下表面摩擦系数（与地面，未设置回退 friction）
}
```

#### spring（弹簧）

```typescript
{
  id: string
  type: 'spring'
  anchor: { x: number, y: number }       // 固定端坐标（米）
  ballId: string                          // 连接的物体名（对应 ball.id）
  naturalLength: number                   // 自然长度（米）
  k: number                               // 劲度系数（N/m）
}
```

#### arc（圆弧）

```typescript
{
  id: string
  type: 'arc'
  center: { x: number, y: number }       // 圆心（米）
  arcRadius: number                       // 弧线半径（米）
  startAngle: number                      // 起始角度（弧度）
  endAngle: number                        // 终止角度（弧度）
  friction?: number
  // 螺旋圆轨动态缺口（可选，用于圆环穿越场景）
  entryGap?: {                            // 入口缺口
    centerAngle: number                   // 缺口中心角度（弧度）
    halfWidth: number                     // 缺口半宽（弧度）
    initiallyOpen?: boolean               // 初始开关状态（默认 false=关闭）
    triggerType?: 'angleCross' | 'enterRing'  // 触发类型
    triggerAngle?: number                 // 触发角度（angleCross 时使用）
    triggerAction?: 'open' | 'close'      // 触发动作
  }
  exitGap?: { /* 同 entryGap 结构 */ }    // 出口缺口
}
```

> 弧线由 20 段线段近似（`groupId` 同组），首段携带 `constraintEnabled: true` 启用约束动力学。缺口与约束机制详见 [PHYSICS.md - 弧线碰撞](PHYSICS.md#35-弧线碰撞)。

### 1.3 sceneJson.field 场设置

```typescript
{
  type: 'none' | 'electric' | 'magnetic' | 'composite'
  E?: { x: number, y: number }   // 电场强度（N/C）
  B?: number                      // 磁感应强度（T，正=向里，负=向外）
}
```

---

## 二、题目列表

### 2.1 当前题目

当前题库含 8 道高考真题，按题型分类如下：

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| plate-2023-zj | 游戏装置（2023·浙江·高考真题） | hard | 板块模型、圆周运动、动量守恒、能量守恒、斜面 | 斜面 + 螺旋圆轨 + 板块模型 |
| ski-jump-2022-eth-a | 跳台滑雪·平抛段（2022·全国乙卷·高考真题） | easy | 平抛运动、斜面约束、速度分解 | 平抛运动 + 斜面约束 |
| ski-jump-2022-eth-b | 跳台滑雪·反弹段（2022·全国乙卷·高考真题） | medium | 斜抛运动、斜面约束、速度变换、多次落点 | 斜抛运动 + 多次落点 |
| elastic-collision-2021-ng1 | 一维弹性碰撞（2021·新高考I卷·高考真题） | medium | 弹性碰撞、动量守恒、板块模型、摩擦力、能量守恒 | 弹性碰撞 + 板块模型 |
| conveyor-2020-ng1 | 水平传送带模型（2020·全国I卷·高考真题） | medium | 传送带模型、摩擦力、相对运动、能量守恒、功能关系 | 传送带模型 + 功能关系 |
| plate-2022-ngjia | 板块模型（2022·全国甲卷·高考真题） | hard | 板块模型、摩擦力、相对运动、动量守恒、能量守恒 | 板块模型 + 相对运动 |
| electric-deflection-2020-ng3 | 电场偏转（2020·全国III卷·高考真题） | medium | 电场偏转、类平抛运动、匀强电场、带电粒子 | 电场偏转 + 类平抛 |
| magnetic-circle-2021-eth | 有界磁场圆周运动（2021·全国乙卷·高考真题） | hard | 有界磁场、圆周运动、洛伦兹力、带电粒子 | 有界磁场 + 圆周运动 |

### 2.2 plate-2023-zj 详解

**题源**：2023 年浙江省高考物理真题，游戏装置题（斜面 AB → 螺旋圆轨 BCDE → 斜面 EF → 水平 FG → 摆渡车）。

**简化与还原说明**（受 2D 拓扑与项目能力限制）：

| 项目 | 真实题目 | 仿真实现 |
|------|----------|----------|
| 螺旋圆轨 BCDE | 三维螺旋圆环 | 简化为单圆弧（完整圆 2π），在 `sceneJson.title` 中标注 |
| B/E 进出点 | 螺旋上下分层 | 分离为动态双缺口（entryGap/exitGap），由触发器状态机控制开关 |
| 凹槽侧壁 IJ 碰撞 | 滑块碰 IJ 静止 | 已实现（端面碰撞，vx=0） |
| 轨道尺度 | R=0.5m | 等比例放大 ×1.6（R=0.8m），小球半径缩至 0.08m，缓解碰撞卡顿（球径/轨径比从 40% 降至 20%） |
| 重力 | 9.8 m/s² | 题目设为 10 m/s²（按题意） |

**触发器配置**：
- 入口缺口（B 点）：`triggerType: 'enterRing'`（球进环时关闭入口），`initiallyOpen: true`
- 出口缺口（E 点）：`triggerType: 'angleCross'`（球过最高点 C 后打开出口，`triggerAngle: π/2`），`initiallyOpen: false`

**约束动力学**：圆轨首段 `constraintEnabled: true`，小球进环后被约束在弧面做无能量损耗圆周运动。

---

## 三、场景参数示例

### 3.1 plate-2023-zj 真实 sceneJson（圆环穿越场景）

以下为题库唯一题目 `plate-2023-zj` 的完整 `sceneJson`，展示了 ball + platform（含可移动板块）+ arc（含动态缺口）的复合场景结构：

```json
{
  "title": "游戏装置（2023浙江高考）（螺旋圆轨分离B/E为动态双缺口；凹槽侧壁IJ碰撞未实现；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）",
  "topic": "custom",
  "objects": [
    {
      "id": "滑块", "type": "ball",
      "mass": 1, "radius": 0.08,
      "initialPosition": { "x": 2.768, "y": 3.68 },
      "initialVelocity": { "x": 0, "y": 0 }
    },
    {
      "id": "直轨道AB", "type": "platform",
      "startPoint": { "x": 2.768, "y": 3.68 },
      "endPoint": { "x": 6.189, "y": 1.197 },
      "friction": 0
    },
    {
      "id": "圆轨BCDE", "type": "arc",
      "center": { "x": 6.88, "y": 1.6 },
      "arcRadius": 0.8,
      "startAngle": -2.214, "endAngle": 4.069,
      "friction": 0,
      "entryGap": {
        "centerAngle": -2.614, "halfWidth": 0.4,
        "initiallyOpen": true,
        "triggerType": "enterRing",
        "triggerAction": "close"
      },
      "exitGap": {
        "centerAngle": -1.814, "halfWidth": 0.4,
        "initiallyOpen": false,
        "triggerType": "angleCross",
        "triggerAngle": 1.5708,
        "triggerAction": "open"
      }
    },
    {
      "id": "直轨道EF", "type": "platform",
      "startPoint": { "x": 6.688, "y": 0.824 },
      "endPoint": { "x": 7.68, "y": 0 },
      "friction": 0
    },
    {
      "id": "水平轨道FG", "type": "platform",
      "startPoint": { "x": 7.68, "y": 0 },
      "endPoint": { "x": 11.68, "y": 0 },
      "friction": 0.2
    },
    {
      "id": "摆渡车", "type": "platform",
      "startPoint": { "x": 11.68, "y": 0 },
      "endPoint": { "x": 16.48, "y": 0 },
      "friction": 0.3, "movable": true, "mass": 1
    },
    {
      "id": "凹槽底面HI", "type": "platform",
      "startPoint": { "x": 11.68, "y": -0.8 },
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
- `entryGap.triggerType: 'enterRing'`：小球进入圆环时触发，`triggerAction: 'close'` 关闭入口（防止小球原路返回）
- `exitGap.triggerType: 'angleCross'`：小球角度穿越 `triggerAngle`（π/2，即最高点 C）时触发，`triggerAction: 'open'` 打开出口
- `movable: true` + `mass`：摆渡车作为可移动板块，参与动量守恒
- 坐标已等比例放大 ×1.6，小球半径缩至 0.08m，缓解碰撞卡顿（球径/轨径比 20%）

---

## 四、添加新题目

### 4.1 步骤

1. 打开 `src/data/questionBank.ts`
2. 在 `questionBank` 数组中添加新题目对象
3. 遵循 ID 命名规则：`{题型前缀}-{序号}`（如 `slope-006`）
4. 构建并测试

### 4.2 模板

```typescript
{
  id: 'arc-002',
  title: '题目标题',
  description: '完整的题目描述文本...',
  difficulty: 'medium',
  tags: ['圆周运动', '能量守恒'],
  sceneJson: {
    title: '场景显示名',
    topic: 'custom',
    objects: [
      // ball / platform / arc / spring（SI 单位）
      // arc 可选 entryGap / exitGap 触发器缺口：
      {
        id: '圆轨', type: 'arc',
        center: { x: 5, y: 2 }, arcRadius: 1,
        startAngle: 0, endAngle: Math.PI * 2,
        friction: 0,
        entryGap: {
          centerAngle: -Math.PI / 2, halfWidth: 0.3,
          initiallyOpen: true,
          triggerType: 'enterRing',     // 'enterRing' | 'angleCross'
          triggerAction: 'close'        // 'open' | 'close'
        },
        exitGap: {
          centerAngle: Math.PI / 2, halfWidth: 0.3,
          initiallyOpen: false,
          triggerType: 'angleCross',
          triggerAngle: 0,              // angleCross 时必填
          triggerAction: 'open'
        }
      }
    ],
    field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
    gravity: 9.8,
    groundY: 0,
    worldWidth: 12  // 可选，用于自动缩放
  }
}
```

### 4.3 注意事项

| 注意点 | 说明 |
|--------|------|
| 单位 | 所有位置、速度、质量使用 SI 单位（m、m/s、kg） |
| 球底高度 | `initialPosition.y` 是球底接触点高度，不是球心高度 |
| 弹簧 k 值 | 建议范围 10-50 N/m，避免数值不稳定（dt×ω < 0.1） |
| 电磁场粒子 | 使用宏观等效参数（m≥1e-4kg, v≤50m/s），避免微观粒子导致卡顿 |
| groundY | 电磁场题目设为 `null` 禁用地面 |
| worldWidth | 设置后自动缩放场景宽度以适配画布 |
| 物体 ID | 同一题目内物体 `id`（字符串名）不可重复 |
| 弹簧 ballId | 必须对应同题目内某个 ball 的 `id` |
| 弧线约束 | 题库/自定义弧线默认 `constraintEnabled: true`（由 useSceneBuilder 自动设置首段），小球进环后约束在弧面无能量损耗运动 |
| 板块类型 | 可移动线段使用 `type: 'plate'` 而非 `type: 'platform'` + `movable: true`。`physicsThickness` 定义物理厚度（米），碰撞检测时下表面沿法线反方向偏移此值。`frictionTop`/`frictionBottom` 分别控制上下表面摩擦系数 |
| 触发器缺口角度 | `entryGap`/`exitGap` 的 `centerAngle`/`triggerAngle` 使用画布坐标系弧度（y 向下为正，0=右，π/2=下）；由 useSceneBuilder 从 SI 坐标转换 |
| 球径/轨径比 | 建议 ≤ 20%（小球半径 / 弧线半径），过大易碰撞卡顿；可放大轨道坐标或缩小球径缓解 |

### 4.4 电磁场题目参数建议

为避免子步循环卡顿，电磁场题目使用宏观等效参数：

| 参数 | 建议范围 | 说明 |
|------|----------|------|
| mass | ≥ 1e-4 kg | 避免过轻导致加速度爆炸 |
| charge | 1e-3 ~ 1e-2 C | 宏观等效电荷 |
| velocity | ≤ 50 m/s | 避免子步数过多 |
| B | 0.1 ~ 1 T | 可视范围内圆周运动 |
| E | 10 ~ 500 N/C | 可视偏转效果 |

**圆周半径公式**：`r = mv / (qB)`，建议 r 在 100-250px（2-5m）范围内。
