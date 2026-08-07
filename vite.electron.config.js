import { defineConfig } from 'vite'
import baseConfig from './vite.config.js'

// Electron 专用构建配置：复用主配置，但 base 改为相对路径 './'，
// 使产物可通过 file:// 协议被 Electron 加载，同时不影响线上 GitHub Pages 的 /PhysicsCanvas/ 基路径。
export default defineConfig({
  ...baseConfig,
  base: './'
})
