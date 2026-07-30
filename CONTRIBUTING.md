# 贡献指南

感谢你对物理仿真项目的关注！本文档说明如何参与开发。

## 环境准备

- Node.js ≥ 20
- npm ≥ 10

```bash
git clone <repo-url>
cd physics-sim
npm install
```

## 开发命令

| 命令                     | 说明                         |
| ------------------------ | ---------------------------- |
| `npm run dev`            | 启动开发服务器               |
| `npm run build`          | 生产构建                     |
| `npm run preview`        | 预览构建产物                 |
| `npm run test`           | 运行全部测试                 |
| `npm run test:watch`     | 监听模式测试                 |
| `npm run test:coverage`  | 运行测试并生成覆盖率报告     |
| `npm run test:contracts` | 仅运行物理定律契约测试       |
| `npm run type-check`     | vue-tsc 类型检查             |
| `npm run lint`           | eslint 自动修复              |
| `npm run lint:check`     | eslint 检查（不修复，CI 用） |
| `npm run format`         | prettier 格式化              |
| `npm run format:check`   | prettier 格式检查（CI 用）   |

## 提交规范

- pre-commit 钩子会自动执行：eslint/prettier 修复暂存文件 + 全量测试
- 提交信息建议遵循 conventional commits（如 `feat:`/`fix:`/`docs:`/`refactor:`），但**不强制** commitlint
- 提交前确保 `npm run lint:check`、`npm run type-check`、`npm run test` 全绿

## 测试纪律（重要）

详见 [`CLAUDE.md`](./CLAUDE.md)「测试纪律」章节。核心规则：

1. **禁止删除或弱化测试以让构建变绿**：遇到失败测试必须修生产代码，不得删测试、skip 测试、弱化断言或修改期望值。
2. **tests/contracts/ 为物理定律契约**：自由落体、匀速、弹性碰撞、非弹性碰撞的断言不可被 AI 修改。首次添加（A 状态）放行后，任何 M/D 变更都会被 pre-commit 与 CI 拦截。
3. **tests/ 下测试文件不可随意删除**：删除会被 pre-commit 拦截（exit 1）。如确需删除，需人工执行 `git commit --no-verify` 并在提交信息说明理由。
4. **覆盖率阈值**：当前起步阈值 18%（lines/statements/branches）+ 10%（functions），随测试补齐逐步提升。禁止为达标删测试或弱化断言。

## PR 流程

1. 从 `main` 拉取最新代码
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交代码，确保 CI 全绿
4. CI 检查项：lint:check、type-check、build、test:coverage、测试文件数量不减少、contracts 未被篡改
5. 创建 PR，描述变更内容与验证方式

## 物理引擎贡献注意事项

- 修改物理引擎前请阅读 [`docs/PHYSICS.md`](./docs/PHYSICS.md) 与 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- 物理状态集中在 `src/composables/usePhysics.ts`，数据流单向
- 全局常量 `PIXELS_PER_METER = 50` 用于米/像素换算
- 重力以像素单位存储（490 px/s² = 9.8 m/s² × 50），对用户显示 m/s²
- 修改碰撞/积分逻辑后，务必运行 `npm run test:contracts` 确认物理定律契约仍成立

## 代码风格

- Vue 组件使用 `<script setup>`（不加 `lang="ts"`，项目约定）
- 缩进 2 空格，单引号，无分号（见 `.prettierrc.json`）
- TypeScript 严格模式（`tsconfig.json` strict: true）
- 类型定义集中在 `usePhysics.ts`，其他模块通过 `import type` 引用
