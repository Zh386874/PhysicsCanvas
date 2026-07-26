# 部署文档

> 本文档描述物理解模项目的部署流程、CI/CD 配置和本地构建方法。

---

## 一、部署架构

```
本地开发 ──git push──► GitHub 仓库 ──触发 Actions──► 构建 ──► GitHub Pages
                         (main 分支)                    (Vite build)    (自动部署)
```

- **代码托管**：GitHub（主仓库）+ Gitee（镜像）
- **CI/CD**：GitHub Actions
- **部署平台**：GitHub Pages
- **访问地址**：https://zh386874.github.io/PhysicsCanvas/

---

## 二、本地构建

### 2.1 环境要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18+ | 推荐 20 LTS |
| npm | 9+ | 随 Node 安装 |
| Git | 2.30+ | 版本控制 |

### 2.2 构建步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Zh386874/PhysicsCanvas.git
cd PhysicsCanvas

# 2. 安装依赖
npm install

# 3. 开发模式（热更新）
npm run dev
# → 访问 http://localhost:5173/PhysicsCanvas/

# 4. 生产构建
npm run build
# → 输出到 dist/ 目录

# 5. 本地预览构建结果
npm run preview
# → 访问 http://localhost:4173/PhysicsCanvas/
```

### 2.3 Vite 配置

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/PhysicsCanvas/',  // GitHub Pages 子路径
})
```

> **重要**：`base` 必须设置为 `'/PhysicsCanvas/'`（仓库名），否则 GitHub Pages 上的资源路径会 404。

---

## 三、GitHub Actions 自动部署

### 3.1 Workflow 配置

配置文件位置：`.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]          # main 分支推送时触发
  workflow_dispatch:           # 支持手动触发

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 3.2 触发条件

| 触发方式 | 说明 |
|----------|------|
| `push` 到 `main` 分支 | 自动触发 |
| `workflow_dispatch` | 在 Actions 页面手动触发 |

### 3.3 构建流程

```
1. checkout 代码
2. 安装 Node.js 20
3. npm ci（严格按 lockfile 安装）
4. npm run build（Vite 生产构建）
5. 上传 dist/ 为 Pages artifact
6. 部署到 GitHub Pages
```

### 3.4 查看部署状态

- **Actions 页面**：https://github.com/Zh386874/PhysicsCanvas/actions
- **部署成功后**：约 1-2 分钟后访问 https://zh386874.github.io/PhysicsCanvas/

---

## 四、GitHub Pages 设置

### 4.1 首次配置

1. 打开仓库 **Settings** → **Pages**
2. **Source** 选择 **GitHub Actions**
3. 保存设置

> 如果 Source 设为 "Deploy from a branch"，Actions 部署会失败，显示 "Deploy step failed"。

### 4.2 自定义域名（可选）

在 **Settings** → **Pages** → **Custom domain** 中填写自定义域名。

> 使用自定义域名时，`vite.config.js` 的 `base` 应改为 `'/'`。

---

## 五、环境变量

### 5.1 配置文件

```bash
# .env.example
VITE_AI_API_KEY=your_deepseek_api_key_here
```

### 5.2 本地配置

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env，填入 API Key
VITE_AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

### 5.3 GitHub Secrets（部署用）

如果需要在部署的版本中启用 AI 解析：

1. 打开仓库 **Settings** → **Secrets and variables** → **Actions**
2. 添加 Repository Secret：
   - Name: `VITE_AI_API_KEY`
   - Value: 你的 DeepSeek API Key
3. 修改 `deploy.yml` 构建步骤：

```yaml
      - run: npm run build
        env:
          VITE_AI_API_KEY: ${{ secrets.VITE_AI_API_KEY }}
```

> **注意**：当前部署版本未配置 API Key，AI 解析回退为本地关键词解析。用户可在页面内通过 API Key 配置对话框手动输入。

---

## 六、Gitee 镜像部署

### 6.1 同步到 Gitee

```bash
# 添加 Gitee 远程仓库
git remote add gitee https://gitee.com/zhang-hao041030/physics-canvas.git

# 推送到 Gitee
git push gitee master
```

### 6.2 Gitee Pages（可选）

Gitee 也支持 Pages 服务：

1. 在 Gitee 仓库 **服务** → **Gitee Pages** 中开启
2. 部署分支：`master`，目录：`/dist`（需先构建并提交 dist）
3. 或使用 Gitee Actions（需 Gitee Go）

> Gitee Pages 免费版需要实名认证，且每次推送后需手动更新。

---

## 七、故障排查

### 7.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 页面空白 | `base` 路径错误 | 确认 `vite.config.js` 中 `base: '/PhysicsCanvas/'` |
| 资源 404 | GitHub Pages 未配置 | Settings → Pages → Source 选 "GitHub Actions" |
| Deploy step failed | Pages 权限不足 | 确认 workflow 的 `permissions` 包含 `pages: write` |
| Actions 未触发 | 分支名不匹配 | 确认推送到 `main` 分支（非 `master`） |
| AI 解析不可用 | 未配置 API Key | 本地创建 `.env`，或在页面内手动配置 |

### 7.2 分支名问题

本地分支可能为 `master`，而 GitHub Actions 监听 `main` 分支。解决方法：

```bash
# 方法一：推送时映射分支名
git push github master:main

# 方法二：重命名本地分支
git branch -M main
git push -u origin main
```

### 7.3 查看构建日志

1. 访问 https://github.com/Zh386874/PhysicsCanvas/actions
2. 点击最新的 workflow run
3. 查看 `build` 和 `deploy` job 的日志

---

## 八、版本发布

### 8.1 创建 Release

```bash
# 打标签
git tag -a v1.0.0 -m "首个完整版本"

# 推送标签
git push origin v1.0.0
```

### 8.2 在 GitHub 创建 Release

1. 打开仓库 **Releases** → **Create a new release**
2. 选择标签
3. 填写发布说明
4. 发布

> Release 不会自动触发部署，仅 `main` 分支的 push 会触发。
