import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置
 * 通过 webServer 自动启停 Vite dev server，测试 3 条核心用户流程。
 * 新增的 E2E 测试位于 e2e/ 目录，不触碰 tests/ 与 tests/contracts/。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 本地 Windows 开发机复用已安装的 Edge，避免必须下载 Chromium；
        // CI（ubuntu）不传 channel，走 npx playwright install 的 Chromium。
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      }
    }
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
