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
      // 覆盖率阈值：经实测（2026-08-06）当前实际覆盖率为
      // Stmts 44% / Branch 47% / Funcs 51% / Lines 44%。
      // 阈值贴近实际并留 ~4% 余量，使门禁真正生效并防覆盖回退。
      // 禁止为达标删测试或弱化断言（CLAUDE.md 测试纪律）。
      thresholds: {
        statements: 40,
        branches: 40,
        functions: 35,
        lines: 40
      }
    }
  }
})
