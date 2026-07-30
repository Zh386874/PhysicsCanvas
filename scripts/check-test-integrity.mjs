#!/usr/bin/env node
/**
 * 测试完整性检测脚本
 *
 * 检测 tests/ 下文件的三类作弊：
 *   规则1（fail）：新增 skip 标记（it.skip / xit / describe.skip / xdescribe / .todo）
 *   规则2（fail）：expect( 总数相对基线减少（删断言）
 *   规则3（fail）：弱断言方法新增伴随强断言减少（toBe→toBeTruthy 等替换）
 *
 * 用法：
 *   node scripts/check-test-integrity.mjs <base> <head>
 *     base: 基线 git ref（如 HEAD~1 或 CI 的 $BASE）
 *     head: 目标 ref（缺省 HEAD）；传 CACHED 表示对比暂存区
 *
 * 退出码：0=通过，1=发现 fail 级问题
 * 详见 .trae/documents/AI删测试防护补强计划.md
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const base = args[0] || 'HEAD~1'
const head = args[1] || 'HEAD'
const cachedMode = head === 'CACHED'

// ===== 工具：执行 git 命令 =====
function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// ===== 获取 tests/ 下改动的 .test.ts 文件列表 =====
// 注意：不使用引号包裹路径，避免 Windows cmd.exe 将单引号作为路径字面量传入 git
// （Linux 下 shell 会剥离单引号，但 Windows 不会，导致路径 'tests/' 匹配失败 → 检测静默失效）
function getChangedTestFiles() {
  const diffCmd = cachedMode
    ? `diff --cached --name-only -- tests/`
    : `diff --name-only ${base} ${head} -- tests/`
  let output
  try {
    output = git(diffCmd)
  } catch {
    return []
  }
  return output
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.endsWith('.test.ts'))
}

// ===== 获取文件的新增/删除行 =====
function getDiffLines(file) {
  const diffCmd = cachedMode
    ? `diff --cached --unified=0 -- ${file}`
    : `diff --unified=0 ${base} ${head} -- ${file}`
  let output
  try {
    output = git(diffCmd)
  } catch {
    return { added: [], removed: [] }
  }
  const added = []
  const removed = []
  for (const line of output.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('@@')) continue
    if (line.startsWith('+')) added.push(line.slice(1))
    else if (line.startsWith('-')) removed.push(line.slice(1))
  }
  return { added, removed }
}

// ===== 获取某 ref 下某文件的内容 =====
function getFileContent(ref, file) {
  try {
    return git(`show ${ref}:${file}`)
  } catch {
    return ''
  }
}

// ===== 统计 expect( 出现次数 =====
function countExpect(content) {
  const matches = content.match(/expect\s*\(/g)
  return matches ? matches.length : 0
}

// ===== 规则1：skip 标记检测 =====
const SKIP_PATTERN =
  /(\b|^|\.)(it|test|describe)\.skip\s*\(|\bxit\s*\(|\bxdescribe\s*\(|\.skip\s*\(|\.todo\s*\(/

function detectSkip(addedLines) {
  return addedLines.filter((line) => SKIP_PATTERN.test(line))
}

// ===== 规则3：弱断言 / 强断言 =====
const WEAK_ASSERT_PATTERN =
  /\.(toBeTruthy|toBeDefined|toBeNull|toContain|toBeFalsy|toBeInstanceOf)\s*\(/
const STRONG_ASSERT_PATTERN =
  /\.(toBe|toEqual|toBeCloseTo|toBeGreaterThan|toBeLessThan|toHaveLength|toMatch|toThrow)\s*\(/

function detectAssertionWeakening(added, removed) {
  const weakAdded = added.filter((line) => WEAK_ASSERT_PATTERN.test(line))
  const strongRemoved = removed.filter((line) => STRONG_ASSERT_PATTERN.test(line))
  return { weakAdded, strongRemoved }
}

// ===== 主流程 =====
const changedFiles = getChangedTestFiles()

if (changedFiles.length === 0) {
  console.log('✅ 测试完整性检测：无测试文件改动。')
  process.exit(0)
}

let hasFail = false
const weakeningCases = []

console.log(`检测 ${changedFiles.length} 个改动的测试文件...`)

for (const file of changedFiles) {
  const { added, removed } = getDiffLines(file)

  // 规则1：skip 标记
  const skips = detectSkip(added)
  if (skips.length > 0) {
    hasFail = true
    console.error(`❌ [${file}] 检测到新增 skip/跳过标记（${skips.length} 处）：`)
    skips.forEach((line) => console.error(`     + ${line.trim()}`))
  }

  // 规则2：expect 总数减少（仅非 CACHED 模式下对比两 ref 内容）
  if (!cachedMode) {
    const baseContent = getFileContent(`${base}`, file)
    const headContent = getFileContent(`${head}`, file)
    const baseCount = countExpect(baseContent)
    const headCount = countExpect(headContent)
    if (headCount < baseCount) {
      hasFail = true
      console.error(
        `❌ [${file}] 断言数量减少：${baseCount} → ${headCount}（减少 ${baseCount - headCount}）`
      )
    }
  } else {
    // CACHED 模式：对比 HEAD 与暂存区。删除行含 expect 视为断言减少
    const removedExpects = removed.filter((line) => /expect\s*\(/.test(line))
    const addedExpects = added.filter((line) => /expect\s*\(/.test(line))
    if (removedExpects.length > addedExpects.length) {
      hasFail = true
      console.error(
        `❌ [${file}] 暂存区断言数量减少：删除 ${removedExpects.length} 个 expect，新增 ${addedExpects.length} 个`
      )
    }
  }

  // 规则3：弱断言替换强断言（fail）—— 同时出现弱断言新增与强断言删除视为弱化
  const { weakAdded, strongRemoved } = detectAssertionWeakening(added, removed)
  if (weakAdded.length > 0 && strongRemoved.length > 0) {
    hasFail = true
    weakeningCases.push({
      file,
      weakAdded,
      strongRemoved
    })
  }
}

// 输出规则3详情
if (weakeningCases.length > 0) {
  console.error(`\n❌ 检测到 ${weakeningCases.length} 处断言弱化（弱断言替换强断言）：`)
  for (const w of weakeningCases) {
    console.error(`   [${w.file}]`)
    w.strongRemoved.forEach((line) => console.error(`     - ${line.trim()}`))
    w.weakAdded.forEach((line) => console.error(`     + ${line.trim()}`))
  }
  console.error('   断言弱化可能掩盖测试失效。如确为合理修改，请人工 git commit --no-verify 并说明理由。')
}

if (hasFail) {
  console.error('\n❌ 测试完整性检测未通过：发现 skip 标记、断言减少或断言弱化。')
  console.error('   AI 不得通过跳过、删除或弱化断言让测试变绿。如确为合理修改，请人工 git commit --no-verify 并说明理由。')
  process.exit(1)
}

console.log('✅ 测试完整性检测通过。')
process.exit(0)
