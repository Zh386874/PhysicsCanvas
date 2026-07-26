# 物理解模

> 基于 Vue 3 + Canvas 2D 的高中物理仿真教学工具，覆盖力学与电磁学常见题型，内置 21 道高考真题库与 AI 题目解析能力。

[![Deploy Status](https://github.com/Zh386874/PhysicsCanvas/actions/workflows/deploy.yml/badge.svg)](https://github.com/Zh386874/PhysicsCanvas/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌐 在线体验

- **GitHub Pages**：https://zh386874.github.io/PhysicsCanvas/
- **GitHub 仓库**：https://github.com/Zh386874/PhysicsCanvas
- **Gitee 镜像**：https://gitee.com/zhang-hao041030/physics-canvas

## ✨ 核心功能

### 1. 高考真题库

内置 21 道高考常见题型场景，覆盖 8 大题型分类：

| 题型 | 题量 | 示例 |
|------|------|------|
| 斜面类 | 5 道 | 斜面滑块、粗糙斜面摩擦、双斜面对称、斜面弹簧 |
| 抛体运动 | 3 道 | 平抛、斜抛最大高度、高处平抛落地角度 |
| 碰撞 | 3 道 | 正面对心弹性碰撞、完全非弹性碰撞、多球连环碰撞 |
| 磁场 | 3 道 | 圆周运动、不同电荷偏转对比、周期运动 |
| 电场 | 3 道 | 电场偏转、电场加速、电场力与重力平衡 |
| 弹簧 | 2 道 | 弹簧振子简谐运动、弹簧碰撞问题 |
| 传送带 | 1 道 | 水平传送带摩擦力问题 |
| 板块模型 | 1 道 | 板块模型相对滑动 |

每题支持一键加载、参数调节、过程回放。

### 2. 自定义场景编辑器

提供 **小球 / 平台 / 圆弧 / 弹簧** 四种绘制工具，支持：

- 右键框选批量操作（拖拽、删除）
- Shift 键水平/垂直方向锁定
- 中键平移 + 滚轮缩放（0.3~5x）
- 撤销 / 重做（50 步历史）
- 场景导出 / 导入（剪贴板 JSON）

### 3. AI 题目解析

输入物理题目文字描述（如"质量 1kg 的小球以 10m/s 水平抛出"），系统自动：

1. 识别场景类型（抛体 / 斜面 / 碰撞 / 磁场 / 电场 / 自定义）
2. 提取物体参数（质量、速度、位置、电荷等）
3. 生成可运行的模拟场景

支持 DeepSeek AI 接入，未配置 API Key 时回退本地关键词解析。解析完成后支持参数二次微调。

### 4. 受力分析与过程回放

- **实时受力显示**：重力 mg、支持力 N、摩擦力 f、电场力 qE、洛伦兹力 qvB、弹簧力 -kx
- **20 秒过程回放**（1200 帧快照），支持逐帧拖动
- **关键帧自动识别**：速度变号、碰撞瞬间自动标记

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3.5（Composition API，`<script setup>`） |
| 构建工具 | Vite 6.3 |
| 语言 | JavaScript + TypeScript（渐进式迁移） |
| 渲染 | Canvas 2D + requestAnimationFrame |
| 物理引擎 | 自研欧拉积分 + 子步循环 + CCD 碰撞检测 |
| AI | DeepSeek API（可选） |
| 部署 | GitHub Actions → GitHub Pages |

## 📦 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/Zh386874/PhysicsCanvas.git
cd PhysicsCanvas

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

开发服务器默认运行在 http://localhost:5173/PhysicsCanvas/

### 配置 AI 解析（可选）

1. 复制 `.env.example` 为 `.env`
2. 填入 DeepSeek API Key：

```bash
cp .env.example .env
```

```env
VITE_AI_API_KEY=your_deepseek_api_key_here
```

获取 API Key：https://platform.deepseek.com/api_keys

> 未配置时自动回退本地关键词解析，不影响其他功能使用。

## 📁 目录结构

```
物理解模/
├── src/
│   ├── main.js                      # 应用入口
│   ├── App.vue                      # 主应用组件（状态管理 + 布局）
│   ├── components/                  # Vue 组件
│   │   ├── PhysicsCanvas.vue        # 画布组件（渲染循环 + 事件分发）
│   │   ├── AIInput.vue              # AI 题目解析输入
│   │   ├── ApiKeyDialog.vue         # API Key 配置对话框
│   │   ├── QuestionBankPanel.vue    # 真题库面板
│   │   ├── ObjectList.vue           # 物体列表
│   │   ├── PropertyPanel.vue        # 属性编辑面板
│   │   ├── ForceEditor.vue          # 附加力编辑器
│   │   ├── ControlBar.vue           # 播放控制栏
│   │   ├── Timeline.vue             # 回放时间轴
│   │   └── SceneTabs.vue            # 场景切换标签
│   ├── composables/                 # 组合式函数（核心逻辑）
│   │   ├── usePhysics.ts            # 物理引擎（状态 + 积分 + 快照）
│   │   ├── useCollision.ts          # 碰撞检测（地面/质点/线段/弧线）
│   │   ├── useCanvasRenderer.ts     # 画布渲染（所有绘制函数）
│   │   ├── useCanvasInteraction.ts  # 画布交互（拖拽/框选/平移缩放）
│   │   ├── useEditTools.ts          # 编辑工具（小球/平台/圆弧/弹簧）
│   │   ├── useAIParser.ts           # AI 解析（DeepSeek + 本地回退）
│   │   ├── useSceneBuilder.ts       # 场景构建（SI→像素转换）
│   │   ├── usePresets.ts            # 预设场景
│   │   ├── useQuestionBank.ts       # 题库状态管理
│   │   └── useHistory.ts            # 撤销/重做历史
│   └── data/
│       └── questionBank.ts          # 21 道高考真题数据
├── .github/workflows/deploy.yml     # GitHub Actions 部署配置
├── docs/                            # 项目文档
├── index.html                       # HTML 入口
├── vite.config.js                   # Vite 配置
├── tsconfig.json                    # TypeScript 配置
└── package.json
```

## 📖 文档

| 文档 | 说明 |
|------|------|
| [接口文档](docs/API.md) | 组件 props/emit、composable 导出函数、数据结构定义 |
| [架构设计](docs/ARCHITECTURE.md) | 分层架构、单向数据流、模块职责划分 |
| [物理模型](docs/PHYSICS.md) | 单位系统、积分方法、碰撞检测、力模型 |
| [题库文档](docs/QUESTION_BANK.md) | 题库结构、题型分类、添加新题目 |
| [部署文档](docs/DEPLOYMENT.md) | GitHub Pages 部署流程、CI/CD 配置 |
| [测试文档](docs/TESTING.md) | 测试策略与用例 |
| [变更日志](CHANGELOG.md) | 版本变更记录 |

## 🔑 核心常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `PIXELS_PER_METER` | 50 | 1 米 = 50 像素 |
| `GRAVITY` | 490 px/s² | 重力加速度（9.8 m/s² × 50） |
| `MAX_SUBSTEPS` | 200 | 子步循环上限（防卡顿） |
| `MAX_SNAPSHOTS` | 1200 | 快照缓冲区（20 秒 × 60fps） |
| `MAX_HISTORY` | 50 | 撤销/重做历史上限 |

## 📄 License

MIT
