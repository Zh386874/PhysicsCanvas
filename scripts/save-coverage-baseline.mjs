#!/usr/bin/env node
/**
 * 覆盖率基线保存脚本
 *
 * 读取当前 coverage/coverage-summary.json，
 * 把 total 写入 scripts/.coverage-baseline.json。
 *
 * 用法：npm run coverage:save-baseline
 * （需先运行 npm run test:coverage 生成报告）
 *
 * ⚠️ 此脚本仅人工执行，AI 不得自动运行或修改基线文件。
 * 详见 CLAUDE.md「覆盖率基线不可自动更新」
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const COVERAGE_FILE = resolve(ROOT, 'coverage', 'coverage-summary.json')
const BASELINE_FILE = resolve(__dirname, '.coverage-baseline.json')

if (!existsSync(COVERAGE_FILE)) {
  console.error('❌ 未找到覆盖率报告：', COVERAGE_FILE)
  console.error('   请先运行 npm run test:coverage 生成报告。')
  process.exit(1)
}

const coverage = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8'))
const total = coverage.total ?? {}

const baseline = {
  lines: total.lines?.pct ?? 0,
  statements: total.statements?.pct ?? 0,
  functions: total.functions?.pct ?? 0,
  branches: total.branches?.pct ?? 0,
  updatedAt: new Date().toISOString().slice(0, 10)
}

writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n')

console.log('✅ 覆盖率基线已保存：')
console.log(`   lines:       ${baseline.lines.toFixed(2)}%`)
console.log(`   statements:  ${baseline.statements.toFixed(2)}%`)
console.log(`   functions:   ${baseline.functions.toFixed(2)}%`)
console.log(`   branches:    ${baseline.branches.toFixed(2)}%`)
console.log(`   文件：${BASELINE_FILE}`)
