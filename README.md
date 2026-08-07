# 物理解模

> 基于 Vue 3 + Canvas 2D 的高中物理仿真教学工具，覆盖力学与电磁学常见题型，内置高考真题库与 AI 题目解析能力。

[![Deploy Status](https://github.com/Zh386874/PhysicsCanvas/actions/workflows/deploy.yml/badge.svg)](https://github.com/Zh386874/PhysicsCanvas/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌐 在线体验

- **GitHub Pages**：https://zh386874.github.io/PhysicsCanvas/
- **GitHub 仓库**：https://github.com/Zh386874/PhysicsCanvas
- **Gitee 镜像**：https://gitee.com/zhang-hao041030/physics-canvas

## ✨ 核心功能

### 1. 高考真题库

当前内置 8 道高考真题场景，覆盖力学与电磁学核心题型：

| ID                           | 题目                                       | 难度   | 核心知识点                                       |
| ---------------------------- | ------------------------------------------ | ------ | ------------------------------------------------ |
| plate-2023-zj                | 2023·浙江·高考真题（游戏装置）             | hard   | 斜面 + 螺旋圆轨 + 板块模型 + 动量守恒 + 能量守恒 |
| ski-jump-2022-eth-a          | 2022·全国乙卷·高考真题（跳台滑雪·平抛段）  | easy   | 平抛运动、斜面约束、速度分解                     |
| ski-jump-2022-eth-b          | 2022·全国乙卷·高考真题（跳台滑雪·反弹段）  | medium | 斜抛运动、斜面约束、速度变换、多次落点           |
| elastic-collision-2021-ng1   | 2021·新高考I卷·高考真题（一维弹性碰撞）    | medium | 弹性碰撞、动量守恒、板块模型、摩擦力、能量守恒   |
| conveyor-2020-ng1            | 2020·全国I卷·高考真题（水平传送带模型）    | medium | 传送带模型、摩擦力、相对运动、能量守恒、功能关系 |
| plate-2022-ngjia             | 2022·全国甲卷·高考真题（板块模型）         | hard   | 板块模型、摩擦力、相对运动、动量守恒、能量守恒   |
| electric-deflection-2020-ng3 | 2020·全国III卷·高考真题（电场偏转）        | medium | 电场偏转、类平抛运动、匀强电场、带电粒子         |
| magnetic-circle-2021-eth     | 2021·全国乙卷·高考真题（有界磁场圆周运动） | hard   | 有界磁场、圆周运动、洛伦兹力、带电粒子           |

> 其中 plate-2023-zj 螺旋圆轨受 2D 拓扑限制简化为单圆弧，并采用动态缺口（entryGap/exitGap 触发器）+ 弧线约束动力学还原小球穿环过程；轨道等比例放大 ×1.6、小球半径缩至 0.08m 以缓解碰撞卡顿。详见 [题库文档](docs/QUESTION_BANK.md)。

支持一键加载、参数调节、过程回放。

### 2. 自定义场景编辑器

提供 **选择 / 小球 / 平台 / 传送带 / 板块 / 圆弧 / 弹簧 / 场区域** 八种工具，支持：

- 右键框选批量操作（拖拽、删除）
- Shift 键水平/垂直方向锁定
- 中键平移 + 滚轮缩放（0.3~100x）
- 撤销 / 重做（50 步历史）
- 场景导出 / 导入（剪贴板 JSON）
- 弧线高级选项：约束动力学开关、触发器缺口配置、🎨 触发器颜色可视化

### 3. AI 题目解析

输入物理题目文字描述（如"质量 1kg 的小球以 10m/s 水平抛出"），系统自动：

1. 识别场景类型（抛体 / 斜面 / 碰撞 / 磁场 / 电场 / 自定义）
2. 提取物体参数（质量、速度、位置、电荷等）
3. 生成可运行的模拟场景

支持 **DeepSeek / OpenAI / Claude / Gemini** 多服务商接入（兼容 OpenAI Chat 与 Anthropic Messages 两种请求格式），未配置 API Key 时回退本地关键词解析。解析完成后支持参数二次微调。

### 4. 受力分析与过程回放

- **实时受力显示**：重力 mg、支持力 N、摩擦力 f、电场力 qE、洛伦兹力 qvB、弹簧力 -kx
- **20 秒过程回放**（1200 帧快照），支持逐帧拖动
- **关键帧自动识别**：速度变号、碰撞瞬间自动标记

## 🛠 技术栈

| 类别     | 技术                                                    |
| -------- | ------------------------------------------------------- |
| 框架     | Vue 3.5（Composition API，`<script setup>`）            |
| 构建工具 | Vite 6.3                                                |
| 语言     | JavaScript + TypeScript（渐进式迁移）                   |
| 渲染     | Canvas 2D + requestAnimationFrame                       |
| 物理引擎 | 自研欧拉积分 + 子步循环 + CCD 碰撞检测 + 弧线约束动力学 |
| AI       | DeepSeek / OpenAI / Claude / Gemini API（可选）         |
| 测试     | Vitest 4（单元 / 集成 / 回归 / 契约四层）               |
| 部署     | GitHub Actions → GitHub Pages / Electron 桌面打包       |

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

支持两种配置方式：

**方式一：应用内配置（推荐）**
点击界面「AI 设置」打开 `ApiKeyDialog`，选择服务商（DeepSeek / OpenAI / Claude / Gemini / 自定义）并填入对应 API Key，即存即用。支持 OpenAI Chat 与 Anthropic Messages 两种请求格式。

**方式二：环境变量（网页版）**

```bash
cp .env.example .env
```

```env
VITE_AI_API_KEY=your_deepseek_api_key_here
```

获取 API Key：DeepSeek https://platform.deepseek.com/api_keys · OpenAI https://platform.openai.com/api-keys · Anthropic https://console.anthropic.com/settings/keys · Gemini https://aistudio.google.com/apikey

> 未配置时自动回退本地关键词解析，不影响其他功能使用。

## � 打包桌面应用（Windows .exe）

将项目打包为 Windows 桌面安装包（基于 Electron + electron-builder）：

```bash
# 1. 安装 Electron 打包依赖
npm install -D electron electron-builder

# 2. 构建生成 .exe 安装包
npm run electron:build
```

构建完成后，`release/` 目录生成：

- `物理解模 Setup <版本>.exe` —— NSIS 安装包（安装后生成桌面 + 开始菜单快捷方式）
- `win-unpacked/物理解模.exe` —— 免安装版，解压即用

> 中国大陆网络：镜像已通过 `package.json` 的 `config` 字段持久化（`electron_mirror` / `electron_builder_binaries_mirror` 指向 npmmirror），解决从 GitHub 下载二进制时的证书校验失败，直接 `npm run electron:build` 即可。
> 桌面打包使用独立的 `vite.electron.config.js`（`base:'./'`），不影响线上 GitHub Pages 部署。
> 分享给他人：发送 `release/物理解模 Setup <版本>.exe` 安装包即可；因未购买商业代码签名证书，Windows SmartScreen 会提示「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可。桌面版 AI 解析需在应用内自行填写 API Key。详见 [桌面打包](docs/ELECTRON.md)。

## �� 目录结构

```
物理解模/
├── src/
│   ├── main.js                      # 应用入口
│   ├── App.vue                      # 主应用组件（布局 + 组合 composables）
│   ├── constants.ts                 # 全局共享常量（PIXELS_PER_METER 等）
│   ├── components/                  # Vue 组件（16 个）
│   │   ├── PhysicsCanvas.vue        # 画布组件（渲染循环 + 事件分发）
│   │   ├── AIInput.vue              # AI 题目解析输入
│   │   ├── ApiKeyDialog.vue         # API Key 配置对话框
│   │   ├── QuestionBankPanel.vue    # 真题库面板
│   │   ├── ObjectList.vue           # 物体列表
│   │   ├── PropertyPanel.vue        # 属性编辑面板（含弧线高级选项）
│   │   ├── ForceEditor.vue          # 附加力编辑器
│   │   ├── ControlBar.vue           # 播放控制栏（含触发器颜色按钮）
│   │   ├── Timeline.vue             # 回放时间轴
│   │   ├── InputDialog.vue          # 通用输入对话框
│   │   ├── SceneTabs.vue            # 场景切换标签
│   │   ├── EditorToolbar.vue        # 编辑工具条（工具选择）
│   │   ├── SceneSettings.vue        # 场景设置（重力/场区域等）
│   │   ├── LeftPanel.vue            # 左侧面板容器
│   │   └── RightPanel.vue           # 右侧面板容器
│   ├── composables/                 # 组合式函数（核心逻辑，共 20 个）
│   │   ├── usePhysics.ts            # 物理引擎（状态 + 积分 + 场景加载）
│   │   ├── useCollision.ts          # 碰撞检测（地面/质点/线段/弧线 + 约束动力学）
│   │   ├── useForces.ts             # 力计算策略层（注册表 + OCP）
│   │   ├── useSnapshotManager.ts    # 快照录制 + 关键帧检测
│   │   ├── useCanvasRenderer.ts     # 画布渲染（所有绘制函数）
│   │   ├── useCanvasInteraction.ts  # 画布交互（拖拽/框选/平移缩放）
│   │   ├── useEditTools.ts          # 编辑工具（选择/小球/平台/传送带/板块/圆弧/弹簧/场区域）
│   │   ├── useAIParser.ts           # AI 解析（多服务商 + 本地回退）
│   │   ├── useStaticLayer.ts        # 离屏静态层（网格+地面）预渲染优化
│   │   ├── useParseHistory.ts       # AI 解析历史记录
│   │   ├── useSceneBuilder.ts       # 场景构建（SI→像素转换）
│   │   ├── useSceneManager.ts       # 场景切换/播放/重置/持久化
│   │   ├── useObjectOperations.ts   # 物体增删改 + 撤销/重做 + Delete 键
│   │   ├── useSceneIO.ts            # 场景导出/导入 + 物体校验
│   │   ├── useKeyboard.ts           # 键盘快捷键（Delete/Ctrl+Z/Ctrl+Y）
│   │   ├── usePresets.ts            # 预设场景
│   │   ├── useQuestionBank.ts       # 题库状态管理
│   │   ├── useHistory.ts            # 撤销/重做历史
│   │   ├── questionView.ts          # 题目视图状态
│   │   └── usePanelLayout.ts        # 面板布局管理
│   ├── utils/
│   │   ├── aiClient.ts              # 通用 LLM 客户端（OpenAI Chat / Anthropic Messages）
│   │   ├── aiSchema.ts              # AI 返回结果校验（Zod）
│   │   ├── arcGap.ts                # 弧线缺口角度换算工具函数
│   │   ├── crypto.ts                # API Key AES-GCM 加解密
│   │   └── objectSerialization.ts   # 物体序列化工具
│   ├── schemas/
│   │   └── sceneSchema.ts           # 场景 JSON 结构校验（Zod）
│   └── data/
│       └── questionBank.ts          # 高考真题数据（当前 8 道）
├── tests/                           # Vitest 测试（43 文件，492 测试）
│   ├── unit/                        # 单元测试
│   │   ├── collision.test.ts        # 弧线碰撞与约束激活（6 测试）
│   │   ├── collision-branches.test.ts   # 碰撞分支全覆盖（37 测试）
│   │   ├── physics-engine.test.ts   # 物理引擎积分逻辑（27 测试）
│   │   ├── forces.test.ts           # 力计算策略（18 测试）
│   │   ├── history.test.ts          # 撤销/重做历史（17 测试）
│   │   ├── object-operations.test.ts    # 物体增删改操作（36 测试）
│   │   ├── presets.test.ts          # 预设场景（37 测试）
│   │   ├── snapshot-manager.test.ts # 快照录制/回放（29 测试）
│   │   ├── plate-definition.test.ts # 板块定义与默认值（7 测试）
│   │   ├── reset-merge.test.ts      # 重置合并策略（6 测试）
│   │   ├── arc-gap-conversion.test.ts   # 弧线缺口角度换算（6 测试）
│   │   ├── field-region-style.test.ts   # 场区域样式（10 测试）
│   │   ├── plate-rect-model.test.ts # 板块矩形模型（5 测试）
│   │   ├── scene-manager.test.ts    # 场景管理（10 测试）
│   │   ├── scene-io.test.ts         # 场景导入导出/物体校验/深拷贝（17 测试）
│   │   ├── scene-builder.test.ts    # AI 场景构建各分支（11 测试）
│   │   ├── scene-schema.test.ts     # Zod 导入校验（12 测试）
│   │   ├── question-bank.test.ts    # 题库筛选/搜索/统计（8 测试）
│   │   ├── ai-parser.test.ts        # AI 解析参数提取（5 测试）
│   │   ├── ai-schema.test.ts        # AI 返回结构校验（12 测试）
│   │   ├── ai-prompts.test.ts       # Prompt 模板（4 测试）
│   │   ├── ai-parser-link.test.ts   # AI 解析器链路（5 测试）
│   │   ├── ai-client-format.test.ts # 双 API 格式客户端（5 测试）
│   │   ├── static-layer.test.ts     # 离屏静态层（7 测试）
│   │   └── scene-builder-validation.test.ts # 场景构建校验（5 测试）
│   ├── integration/                 # 集成测试
│   │   ├── ring-scene.test.ts       # 圆环完整物理循环（3 测试）
│   │   ├── forces-physics.test.ts   # 力与物理引擎集成（18 测试）
│   │   ├── scene-replay.test.ts     # 场景回放集成（15 测试）
│   │   └── undo-redo-physics.test.ts    # 撤销重做物理状态（16 测试）
│   ├── regression/                  # 回归测试
│   │   ├── ball-through-ring.test.ts    # 球穿环 bug（3 测试）
│   │   ├── entry-stuck-outside.test.ts  # 球卡环外 bug（3 测试）
│   │   ├── elastic-collision-restitution.test.ts  # 弹性碰撞恢复系数（21 测试）
│   │   ├── non-elastic-common-velocity.test.ts    # 非弹性碰撞共速（7 测试）
│   │   ├── friction-direction.test.ts   # 摩擦力方向（11 测试）
│   │   ├── plate-wall-collision.test.ts # 板块与墙壁碰撞（7 测试）
│   │   ├── conveyor-static.test.ts      # 传送带静止回归（2 测试）
│   │   ├── segment-roll-off-end.test.ts # 质点滚落线段端点（6 测试）
│   │   └── arc-full-circle-normal.test.ts   # 完整圆法线计算（7 测试）
│   ├── contracts/                   # 物理定律契约（不可篡改）
│   │   └── physics-laws.test.ts     # 自由落体/匀速/弹性碰撞/非弹性碰撞（4 测试）
│   └── helpers/
│       └── sceneBuilder.ts          # 测试场景构建工具
├── scripts/                         # 自动化脚本
│   ├── check-test-integrity.mjs     # 测试完整性检查
│   ├── check-coverage-regression.mjs    # 覆盖率回归检查
│   ├── save-coverage-baseline.mjs   # 覆盖率基线保存
│   └── fix-lockfile-platform.mjs    # lockfile 平台修复
├── .github/workflows/               # GitHub Actions 工作流
│   └── deploy.yml                   # 部署（含测试 + 构建）
├── .husky/                          # Git hooks
│   └── pre-commit                   # 提交前测试与lint检查
├── docs/                            # 项目文档
├── electron/                        # Electron 桌面应用主进程
│   └── main.js                      # 创建窗口、生命周期、安全配置
├── index.html                       # HTML 入口
├── vite.config.js                   # Vite 配置（GitHub Pages）
├── vite.electron.config.js          # Electron 专用 Vite 配置（base:'./'）
├── vitest.config.ts                 # Vitest 测试配置（含覆盖率）
├── tsconfig.json                    # TypeScript 配置
├── .env.example                     # 环境变量示例
├── eslint.config.mjs                # ESLint 配置
├── .prettierrc.json                 # Prettier 配置
└── package.json
```

## 📖 文档

| 文档                                         | 说明                                               |
| -------------------------------------------- | -------------------------------------------------- |
| [需求文档](docs/REQUIREMENTS.md)             | 功能需求、验收标准、发展路线图                     |
| [接口文档](docs/API.md)                      | 组件 props/emit、composable 导出函数、数据结构定义 |
| [架构设计](docs/ARCHITECTURE.md)             | 分层架构、单向数据流、模块职责划分                 |
| [物理模型](docs/PHYSICS.md)                  | 单位系统、积分方法、碰撞检测、力模型               |
| [题库文档](docs/QUESTION_BANK.md)            | 题库结构、题目列表、添加新题目                     |
| [题目格式规范](docs/QUESTION_FORMAT_SPEC.md) | 场景 JSON 结构、字段定义、Schema 校验              |
| [部署文档](docs/DEPLOYMENT.md)               | GitHub Pages 部署流程、CI/CD 配置                  |
| [桌面打包](docs/ELECTRON.md)                 | Electron 打包 Windows .exe 安装包                  |
| [测试文档](docs/TESTING.md)                  | 测试策略与用例                                     |
| [代码质量审查](docs/CODE_QUALITY_REVIEW.md)  | SOLID 原则审查与现状评估                           |
| [变更日志](CHANGELOG.md)                     | 版本变更记录                                       |

## 🔑 核心常量

| 常量               | 值        | 位置          | 说明                        |
| ------------------ | --------- | ------------- | --------------------------- |
| `PIXELS_PER_METER` | 50        | constants.ts  | 1 米 = 50 像素              |
| `GRAVITY`          | 490 px/s² | constants.ts  | 重力加速度（9.8 m/s² × 50） |
| `GROUND_DISABLED`  | 100000    | constants.ts  | 禁用地面标记值              |
| `MAX_SUBSTEPS`     | 200       | constants.ts  | 子步循环上限（防卡顿）      |
| `MAX_STEP_DIST`    | 10        | constants.ts  | 单步最大移动距离（像素）    |
| `TRAIL_LENGTH`     | 80        | constants.ts  | 轨迹最大长度（帧数）        |
| `MAX_SNAPSHOTS`    | 1200      | constants.ts  | 快照缓冲区（20 秒 × 60fps） |
| `MAX_HISTORY`      | 50        | useHistory.ts | 撤销/重做历史上限           |
| `SCENE_VERSION`    | 2         | constants.ts  | 场景导出 JSON 版本号        |

## 🔒 安全状态

`npm audit` 当前报告 **0 项漏洞**，所有依赖链安全。

**历史漏洞均已消除**：

- `esbuild` / `vite` / `vitepress` 依赖链漏洞 —— 通过升级 `vitepress@1.6.4` → `2.0.0-alpha.18` 消除（内置 `vite@6.3.5`，已修复）
- `brace-expansion` / `minimatch` 链 —— 通过升级 `eslint@9.x` → `10.8.0` 消除
- `vue-tsc@2.x` 漏洞 —— 通过升级 `vue-tsc@2.x` → `3.3.8` 消除
- `electron@35` 高危通告 —— 通过升级 `electron@43` 消除

**API Key 处理说明（如实披露）**：

- 本项目为**纯前端**，代码库中不包含任何 API Key。AI 模型的 API Key 由用户在本机界面自行输入，并以 AES-GCM 加密保存在**本机浏览器 localStorage**。
- 该加密用于**防止误读/明文暴露**，但加解密密钥派生自应用内固定参数，**不构成强加密防护**——具备源码/bundle 访问权限者可逆向解密。请勿在不可信设备上使用。
- Key 会从**你的浏览器直接发送**到你所选的模型服务商 API，**无中间代理**。
- XSS 防护：本项目不使用 `v-html`，场景等数据均经 Vue 文本插值渲染，XSS 攻击面低；但用户仍应避免在不可信环境使用本应用。

## 📄 License

MIT
