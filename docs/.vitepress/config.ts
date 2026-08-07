import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '物理仿真',
  description: '高中物理高考真题仿真实验平台',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  // 忽略指向 docs/ 外的相对链接（如 ./../CLAUDE.md），仅放过跨目录引用，docs/ 内死链仍检测
  ignoreDeadLinks: [/^\.\/\.\./],
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '架构', link: '/ARCHITECTURE' },
      { text: '物理引擎', link: '/PHYSICS' },
      { text: '测试', link: '/TESTING' },
      { text: '题库', link: '/QUESTION_BANK' },
      { text: 'API', link: '/API' },
      { text: '部署', link: '/DEPLOYMENT' },
      { text: '桌面打包', link: '/ELECTRON' }
    ],
    sidebar: [
      {
        text: '概览',
        items: [
          { text: '首页', link: '/' },
          { text: '需求文档', link: '/REQUIREMENTS' },
          { text: '代码质量审查', link: '/CODE_QUALITY_REVIEW' }
        ]
      },
      {
        text: '设计与实现',
        items: [
          { text: '架构', link: '/ARCHITECTURE' },
          { text: '物理引擎', link: '/PHYSICS' },
          { text: 'API', link: '/API' }
        ]
      },
      {
        text: '测试与部署',
        items: [
          { text: '测试', link: '/TESTING' },
          { text: '题库', link: '/QUESTION_BANK' },
          { text: '部署', link: '/DEPLOYMENT' },
          { text: '桌面打包', link: '/ELECTRON' }
        ]
      }
    ],
    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2026 张昊'
    },
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    lastUpdatedText: '最后更新',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部'
  }
})
