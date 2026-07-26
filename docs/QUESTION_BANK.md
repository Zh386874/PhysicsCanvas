# 题库数据文档

> 本文档描述真题库的数据结构、题型分类、场景参数格式和添加新题目的方法。

---

## 一、数据结构

### 1.1 QuestionItem 类型

定义在 `src/data/questionBank.ts`：

```typescript
interface QuestionItem {
  id: string                    // 题目唯一标识，如 'slope-001'
  title: string                 // 题目标题
  description: string           // 题目描述（完整题干）
  difficulty: 'easy' | 'medium' | 'hard'  // 难度
  tags: string[]                // 题型标签，如 ['斜面', '摩擦力']
  sceneJson: {                  // 场景参数（SI 单位）
    title: string               // 场景标题
    objects: ParsedObject[]     // 物体列表
    field?: object              // 场设置
    gravity?: number            // 重力（m/s²，默认 9.8）
    groundY?: number | null     // 地面高度（null 禁用地面）
    worldWidth?: number         // 世界宽度（米，用于自动缩放）
  }
}
```

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

#### platform（平台/线段）

```typescript
{
  id: string
  type: 'platform'
  startPoint: { x: number, y: number }   // 起点（米）
  endPoint: { x: number, y: number }     // 终点（米）
  friction?: number                       // 摩擦系数（默认 0）
  restitution?: number                    // 恢复系数（默认 0.3）
  beltVelocity?: { x: number, y: number } // 传送带速度（m/s）
  movable?: boolean                       // 是否可移动（板块模型）
  mass?: number                           // 可移动线段质量（kg）
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
}
```

### 1.3 sceneJson.field 场设置

```typescript
{
  type: 'none' | 'electric' | 'magnetic' | 'composite'
  E?: { x: number, y: number }   // 电场强度（N/C）
  B?: number                      // 磁感应强度（T，正=向里，负=向外）
}
```

---

## 二、题型分类

### 2.1 题目总览

共 21 道题目，覆盖 8 大题型：

| 题型 | 题量 | 难度分布 | ID 前缀 |
|------|------|----------|---------|
| 斜面类 | 5 道 | easy 1 / medium 2 / hard 2 | `slope-` |
| 抛体运动 | 3 道 | easy 1 / medium 2 | `projectile-` |
| 碰撞 | 3 道 | easy 1 / medium 1 / hard 1 | `collision-` |
| 磁场 | 3 道 | medium 2 / hard 1 | `magnetic-` |
| 电场 | 3 道 | easy 1 / medium 1 / hard 1 | `electric-` |
| 弹簧 | 2 道 | medium 1 / hard 1 | `spring-` |
| 传送带 | 1 道 | medium 1 | `conveyor-` |
| 板块模型 | 1 道 | hard 1 | `plate-` |

### 2.2 完整题目列表

#### 斜面类（5 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| slope-001 | 斜面滑块基础题 | easy | 斜面、重力、运动学 | 光滑斜面自由滑动 |
| slope-002 | 粗糙斜面摩擦问题 | medium | 斜面、摩擦力 | μ=0.2 粗糙斜面 |
| slope-003 | 斜面与水平面连接 | medium | 斜面、摩擦力、运动学 | 斜面→水平面过渡，水平面 μ=0.3 |
| slope-004 | 双斜面对称问题 | hard | 斜面、能量守恒 | 对称双斜面往复运动 |
| slope-005 | 斜面上弹簧问题 | hard | 斜面、弹簧、能量守恒 | 斜面+弹簧组合（k=10N/m） |

#### 抛体运动（3 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| projectile-001 | 平抛运动基础 | easy | 抛体运动、平抛 | 水平抛出，初速 10m/s |
| projectile-002 | 斜抛运动最大高度 | medium | 抛体运动、斜抛 | 45° 斜抛，求最大高度 |
| projectile-003 | 高处平抛落地角度 | medium | 抛体运动、速度分解 | 45m 高处平抛，求落地角度 |

#### 碰撞（3 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| collision-001 | 正面对心弹性碰撞 | easy | 碰撞、动量守恒 | 1kg 球撞 2kg 静止球 |
| collision-002 | 完全非弹性碰撞 | medium | 碰撞、完全非弹性 | 2kg+3kg 共速碰撞 |
| collision-003 | 多球连环碰撞 | hard | 碰撞、多物体 | 3 球连环弹性碰撞 |

#### 磁场（3 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| magnetic-001 | 带电粒子在磁场中圆周运动 | medium | 磁场、圆周运动、洛伦兹力 | 单粒子磁场圆周 |
| magnetic-002 | 不同电荷在磁场中的偏转 | medium | 磁场、对比实验 | 正电/负电/中性三粒子对比 |
| magnetic-003 | 磁场中带电粒子的周期 | hard | 磁场、周期 | 低速粒子，观察周期 |

#### 电场（3 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| electric-001 | 带电粒子在电场中偏转 | medium | 电场、偏转、类平抛 | 水平初速+垂直电场 |
| electric-002 | 电场加速问题 | hard | 电场、偏转 | 反向电场减速 |
| electric-003 | 电场力与重力平衡 | easy | 电场、受力平衡 | 液滴悬浮（qE=mg） |

#### 弹簧（2 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| spring-001 | 弹簧振子简谐运动 | medium | 弹簧、简谐运动、振动 | 竖直弹簧振子（k=10N/m） |
| spring-002 | 弹簧碰撞问题 | hard | 弹簧、能量守恒、碰撞 | 滑块撞弹簧（k=20N/m） |

#### 传送带（1 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| conveyor-001 | 水平传送带问题 | medium | 传送带、摩擦力 | 传送带 v=3m/s，μ=0.2 |

#### 板块模型（1 道）

| ID | 标题 | 难度 | 标签 | 核心知识点 |
|----|------|------|------|------------|
| plate-001 | 板块模型相对滑动 | hard | 板块模型、相对滑动、摩擦力 | 滑块+木板（可移动），μ=0.3 |

---

## 三、场景参数示例

### 3.1 斜面类示例（slope-002）

```json
{
  "title": "粗糙斜面",
  "objects": [
    {
      "id": "滑块", "type": "ball",
      "mass": 1, "radius": 0.2,
      "initialPosition": { "x": 4, "y": 3 },
      "initialVelocity": { "x": 0, "y": 0 }
    },
    {
      "id": "斜面", "type": "platform",
      "startPoint": { "x": 0, "y": 0 },
      "endPoint": { "x": 4, "y": 3 },
      "friction": 0.2
    },
    {
      "id": "地面", "type": "platform",
      "startPoint": { "x": -2, "y": 0 },
      "endPoint": { "x": 8, "y": 0 },
      "friction": 0
    }
  ]
}
```

### 3.2 磁场类示例（magnetic-001）

```json
{
  "title": "磁场圆周运动",
  "objects": [
    {
      "id": "粒子", "type": "ball",
      "mass": 0.0001, "charge": 0.001, "radius": 0.1,
      "initialPosition": { "x": 0, "y": 5 },
      "initialVelocity": { "x": 10, "y": 0 }
    }
  ],
  "field": { "type": "magnetic", "B": 0.5 },
  "groundY": null
}
```

### 3.3 弹簧类示例（spring-001）

```json
{
  "title": "弹簧振子",
  "objects": [
    {
      "id": "物体", "type": "ball",
      "mass": 0.5, "radius": 0.2,
      "initialPosition": { "x": 5, "y": 0.2 },
      "initialVelocity": { "x": 0, "y": 0 }
    },
    {
      "id": "弹簧", "type": "spring",
      "anchor": { "x": 5, "y": 4 },
      "ballId": "物体",
      "naturalLength": 3,
      "k": 10
    }
  ]
}
```

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
  id: 'slope-006',
  title: '题目标题',
  description: '完整的题目描述文本...',
  difficulty: 'medium',
  tags: ['斜面', '摩擦力'],
  sceneJson: {
    title: '场景显示名',
    objects: [
      // 物体列表（SI 单位）
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
