# 桌面应用打包（Electron）

> 本文档描述如何将物理解模 Web 项目通过 Electron 打包为 Windows 桌面应用，并生成可安装的 `.exe` 安装包。

---

## 一、概述

使用 **Electron** + **electron-builder** 将 Vue 3 项目打包为 Windows 桌面应用。产物有两种形态：

| 形态 | 产物 | 说明 |
|------|------|------|
| 安装版 | `release/物理解模 Setup <版本>.exe` | NSIS 安装包，安装后自动生成**桌面快捷方式**与**开始菜单快捷方式** |
| 免安装版 | `release/win-unpacked/物理解模.exe` | 解压即用，无需安装 |

---

## 二、技术架构

桌面版由三部分组成，与网页版（GitHub Pages）互不干扰。

### 2.1 Electron 主进程 `electron/main.js`

负责创建窗口、管理应用生命周期、加载构建产物：

- `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true` —— 渲染进程与 Node 隔离，提升安全性
- `win.loadFile('dist/index.html')` —— 生产模式加载 Vite 构建产物（`file://` 协议）
- 外部链接通过 `shell.openExternal` 交给系统浏览器打开

### 2.2 Electron 专用 Vite 配置 `vite.electron.config.js`

```javascript
import { defineConfig } from 'vite'
import baseConfig from './vite.config.js'

export default defineConfig({
  ...baseConfig,
  base: './'
})
```

**为什么必须用 `base: './'`？**

- 网页版 `vite.config.js` 的 `base: '/PhysicsCanvas/'` 用于 GitHub Pages 子路径部署
- 若桌面版也使用该绝对路径，Electron 用 `file://` 加载 `dist/index.html` 时，资源会解析为 `file:///PhysicsCanvas/assets/...`，**文件不存在 → 白屏**
- 因此桌面版单独使用 `base: './'`（相对路径），与线上配置**隔离**，既不破坏 GitHub Pages 部署，又能保证 `file://` 下资源正常加载

### 2.3 `package.json` 的 `build` 配置

```jsonc
"main": "electron/main.js",
"build": {
  "appId": "com.example.physics-sim",
  "productName": "物理解模",
  "directories": { "output": "release" },
  "files": ["dist/**", "electron/**"],
  "win": { "target": "nsis" },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

- `main`：electron-builder 与 `electron .` 查找主进程的入口
- `directories.output`：安装包输出到 `release/`
- `win.target: "nsis"`：生成 Windows 安装包
- `nsis.*`：允许自定义安装目录，并创建桌面与开始菜单快捷方式

---

## 三、关键文件对照

| 文件 | 作用 |
|------|------|
| `electron/main.js` | Electron 主进程：创建 `BrowserWindow`、管理生命周期、安全配置 |
| `vite.electron.config.js` | Electron 专用构建配置，`base:'./'`，隔离线上部署 |
| `package.json`（`main` + `build`） | electron-builder 打包配置与脚本入口 |
| `.gitignore` | 忽略 `release/` 及 `.electron-cache/`、`.electron-builder-cache/`、`.localappdata/` 构建缓存 |

---

## 四、环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | 18+ | 推荐 20 LTS |
| npm | 9+ | 随 Node 安装 |
| 操作系统 | Windows | 当前仅配置 Windows 目标（NSIS） |

---

## 五、构建 .exe 安装包（详细步骤）

### 5.1 安装依赖

```bash
# 安装 Electron 与 electron-builder（作为开发依赖）
npm install -D electron electron-builder
```

> 首次安装会下载 Electron 二进制（约 100MB），耗时取决于网络。详见下文「网络镜像」。

### 5.2 运行构建

```bash
npm run electron:build
```

该命令等价于：

```bash
# 1. 用 Electron 专用配置构建前端（base:'./'）
vite build --config vite.electron.config.js

# 2. 调用 electron-builder 打包 Windows 安装包
electron-builder --win
```

### 5.3 构建产物

构建完成后，在 `release/` 目录生成：

```
release/
├── 物理解模 Setup 0.0.1.exe        # NSIS 安装包（约 90MB+）
├── 物理解模 Setup 0.0.1.exe.blockmap # 增量更新用块映射
├── builder-debug.yml               # 构建调试信息
└── win-unpacked/                   # 免安装版（可直接运行）
    ├── 物理解模.exe                # 应用主程序
    └── resources/app.asar          # 打包的应用内容（dist + electron）
```

### 5.4 安装与使用

双击 `物理解模 Setup 0.0.1.exe` 进行安装：

1. 选择安装目录（本配置允许自定义，非一键安装）
2. 安装完成后自动创建**桌面快捷方式**与**开始菜单快捷方式**
3. 首次运行建议确认页面正常显示（非白屏）、无 CSP 报错、AI 调用可用

### 5.5 分发给他人

- **发送安装包**：只需发送 `release/物理解模 Setup <版本>.exe`（自包含，对方双击安装即可，无需拷贝 `win-unpacked/`）。
- **SmartScreen 提示**：因未购买商业代码签名证书，对方首次运行可能提示「Windows 已保护你的电脑」——点击「更多信息 → 仍要运行」即可，属正常现象。
- **AI 功能**：物理模拟开箱即用；AI 解析需对方在应用内「AI 设置」自行填写 API Key。

---

## 六、开发模式

```bash
npm run electron:dev
```

该命令先构建前端，再以 Electron 启动本地应用：

```bash
vite build --config vite.electron.config.js && electron electron/main.js
```

> 适用于快速验证桌面版效果；如需热更新联调，请结合 Vite 开发服务器并配合主进程加载开发地址。

---

## 七、网络镜像（中国大陆）

首次构建需从 GitHub 下载 Electron 二进制与 NSIS 工具，国内网络可能因证书校验失败报 `unable to verify the first certificate`。

项目 `package.json` 的 `config` 字段已**持久化**镜像配置，指向 npmmirror：

```json
"config": {
  "electron_mirror": "https://npmmirror.com/mirrors/electron/",
  "electron_builder_binaries_mirror": "https://npmmirror.com/mirrors/electron-builder-binaries/"
}
```

npm 会以 `npm_package_config_*` 把上述配置传给构建脚本，因此**直接 `npm run electron:build` 即可**，无需额外设置环境变量，也不会产生 npm 警告。

> 若需临时覆盖，可在命令前设置环境变量（优先级更高）：
>
> ```bash
> # PowerShell
> $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> npm run electron:build
> ```

---

## 八、常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 页面白屏 / 资源 404 | `base` 未被隔离为 `./` | 确认桌面版使用 `vite.electron.config.js`，勿改线上 `vite.config.js` 的 `/PhysicsCanvas/` |
| Electron 二进制下载失败 / 证书校验失败 | 网络受限 | 使用 npmmirror 镜像（见第七章） |
| 缓存目录写入被拒（权限/沙箱） | 缓存落在系统目录 | 重定向 `LOCALAPPDATA` 或 `ELECTRON_BUILDER_CACHE` 到工作区 |
| 构建末尾被系统「最近使用」写入拦截 | 沙箱环境限制 | 非项目问题，安装包已生成，正常环境不会出现 |
| CSP 拦截（运行期） | 严格 CSP 在 `file://` 下异常 | 在 `index.html` 中按需放宽 `script-src` / `connect-src` |

---

## 九、注意事项

- **AI 功能**：桌面版 AI 解析通过页面内「AI 设置」对话框使用，支持 **DeepSeek / OpenAI / Claude / Gemini** 多服务商与 OpenAI Chat / Anthropic Messages 两种请求格式，无需配置 `.env`。
- **CSP 验证**：`index.html` 使用 `script-src 'self'`、`connect-src 'self' https:`，理论上在 `file://` 下可用；若实际运行出现 CSP 报错，需按需调整。
- **与网页部署隔离**：桌面打包**不得**改动 `vite.config.js` 的 `base`，否则会破坏 GitHub Pages 部署（详见 [DEPLOYMENT.md](DEPLOYMENT.md)）。
