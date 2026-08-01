#!/usr/bin/env node
/**
 * 修复 package-lock.json 中 vitepress 的 esbuild@0.28.1 平台包标记
 * 将 "extraneous": true 改为 "dev": true + "optional": true
 *
 * 问题：Windows 上生成的 lock 文件将 @esbuild/*@0.28.1 标记为 extraneous，
 * 导致 Linux CI 上 npm ci 因 EBADPLATFORM 失败
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lockPath = resolve(import.meta.dirname, '..', 'package-lock.json')
const raw = readFileSync(lockPath, 'utf8')
const lines = raw.split('\n')

const VITEPRES_ESBUILD_PREFIX = '    "node_modules/vitepress/node_modules/@esbuild/'
let fixedCount = 0
const newLines = []
let i = 0

while (i < lines.length) {
  const line = lines[i]
  if (line.startsWith(VITEPRES_ESBUILD_PREFIX)) {
    // Found a vitepress @esbuild entry
    newLines.push(line)
    i++
    // Read the version line
    newLines.push(lines[i])
    i++
    // Read the resolved line
    newLines.push(lines[i])
    i++
    // Read the integrity line
    newLines.push(lines[i])
    i++

    // Read the cpu array
    newLines.push(lines[i])
    i++
    while (i < lines.length && !lines[i].trim().startsWith(']')) {
      newLines.push(lines[i])
      i++
    }
    newLines.push(lines[i]) // closing ]
    i++

    // Now we're at the "extraneous": true line
    const extraneousLine = lines[i]
    if (extraneousLine.includes('"extraneous": true')) {
      // Replace with "dev": true,
      newLines.push(extraneousLine.replace('"extraneous": true', '"dev": true'))
      // Insert "optional": true, after dev line
      const indent = extraneousLine.match(/^\s+/)[0]
      newLines.push(`${indent}"optional": true,`)
      fixedCount++
      i++
    } else {
      newLines.push(extraneousLine)
      i++
    }

    // Copy remaining lines of this entry
    while (i < lines.length && !lines[i].startsWith('    "node_modules/')) {
      newLines.push(lines[i])
      i++
    }
  } else {
    newLines.push(line)
    i++
  }
}

writeFileSync(lockPath, newLines.join('\n'), 'utf8')
console.log(`✅ 修复完成：${fixedCount} 个 @esbuild/*@0.28.1 条目已更新`)