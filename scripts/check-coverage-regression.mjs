#!/usr/bin/env node
/**
 * 覆盖率回归检测脚本
 *
 * 读取 vitest 生成的 coverage/coverage-summary.json，
 * 与 scripts/.coverage-baseline.json 基线对比，
 * 任一指标下降 > 0.5% 则 fail。
 *
 * 用法：node scripts/check-coverage-regression.mjs
 *
 * 退出码：0=通过，1=覆盖率回归
 * 详见 .trae/documents/AI删测试防护补强计划.md
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const COVERAGE_FILE = resolve(ROOT, 'coverage', 'coverage-summary.json')
const BASELINE_FILE = resolve(__dirname, '.coverage-baseline.json')

// 1. 检查覆盖率报告文件
if (!existsSync(COVERAGE_FILE)) {
  console.error('❌ 未找到覆盖率报告：', COVERAGE_FILE)
  console.error('   请先运行 npm run test:coverage 生成报告。')
  process.exit(1)
}

// 2. 检查基线文件
if (!existsSync(BASELINE_FILE)) {
  console.warn('⚠️  未找到覆盖率基线文件：', BASELINE_FILE)
  console.warn('   跳过回归检测。请运行 npm run coverage:save-baseline 创建基线。')
  process.exit(0)
}

// 3. 读取数据
const coverage = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'))
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))

const METRICS = ['lines', 'statements', 'functions', 'branches']
const THRESHOLD = 0.5 // 允许的最大下降百分比

const current = {}
for (const key of METRICS) {
  current[key] = coverage.total?.[key]?.pct ?? 0
}

let hasRegression = false

console.log('覆盖率回归检测：')
console.log('指标           基线     当前     差异     结果')
console.log('─'.repeat(55))

for (const key of METRICS) {
  const baseVal = baseline[key] ?? 0
  const curVal = current[key]
  const diff = curVal - baseVal
  const status = diff < -THRESHOLD ? '❌ 回归' : '✅ 通过'

  if (diff < -THRESHOLD) {
    hasRegression = true
  }

  console.log(
    `${key.padEnd(14)} ${baseVal.toFixed(2).padStart(7)}  ${curVal.toFixed(2).padStart(7)}  ${diff >= 0 ? '+' : ''}${diff.toFixed(2).padStart(6)}  ${status}`
  )
}

if (hasRegression) {
  console.error('\n❌ 覆盖率回归检测未通过：有指标下降超过 0.5%。')
  console.error('   可能原因：删除断言/测试导致覆盖率下滑。')
  console.error('   请检查 tests/ 下的改动，确认非为通过测试而删减。')
  console.error('   如确为合理改动，请人工更新基线：npm run coverage:save-baseline')
  process.exit(1)
}

console.log('\n✅ 覆盖率回归检测通过。')
process.exit(0)
