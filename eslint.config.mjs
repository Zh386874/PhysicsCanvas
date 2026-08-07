// ESLint flat config (ESLint 9)
// 参考 Vue 官方推荐：https://eslint.vuejs.org/
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
  {
    name: 'app/files-to-lint',
    files: ['src/**/*.{ts,mts,tsx,vue}', 'tests/**/*.{ts,mts,tsx}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.*',
      '**/*.cjs',
      '物理解模/**',
      '项目分析/**',
      '帖子/**',
      '提示词/**',
      'screenshots/**',
      '网址部署/**',
      '.trae/**'
    ]
  },
  {
    name: 'app/node-scripts',
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  },
  {
    name: 'app/electron-main',
    files: ['electron/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly'
      }
    }
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  skipFormatting,
  {
    name: 'app/rules',
    rules: {
      // 项目约定：<script setup> 不加 lang="ts"（见 project_memory）
      'vue/block-lang': 'off',
      // 现有组件名兼容（Timeline 等单词名）
      'vue/multi-word-component-names': 'off',
      // 历史遗留：未使用变量降为 warn，逐步修复，不阻塞提交
      '@typescript-eslint/no-unused-vars': 'warn',
      // 历史遗留：any 降为 warn，逐步收紧
      '@typescript-eslint/no-explicit-any': 'warn',
      // 历史遗留：eslint 10 recommended 新增 no-useless-assignment，现有死赋值（useCollision 的 fromOutside、useSceneIO 的 text 初始化）降为 warn，逐步修复
      'no-useless-assignment': 'warn'
    }
  }
]
