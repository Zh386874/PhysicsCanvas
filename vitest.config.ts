import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/composables/**/*.ts', 'src/data/**/*.ts', 'src/constants.ts'],
      exclude: ['src/**/*.d.ts', 'tests/**', 'src/types/**'],
      // 起步阈值：当前项目覆盖率约 20%（大量 UI/Canvas 交互模块难单测）。
      // 此阈值为"基座"级别，确保覆盖率机制就位且不回归。
      // 后续随核心模块（usePhysics/useCollision 等）测试补齐，逐步提升至 40%+。
      // 禁止为达标删测试或弱化断言（CLAUDE.md 测试纪律）。
      thresholds: {
        statements: 18,
        branches: 18,
        functions: 10,
        lines: 18
      }
    }
  }
})
