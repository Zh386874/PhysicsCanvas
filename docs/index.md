---
layout: home

hero:
  name: 物理仿真
  text: 高中物理高考真题仿真实验平台
  tagline: 基于自研物理引擎的交互式物理实验，场景化还原高考真题
  actions:
    - theme: brand
      text: 快速开始
      link: /REQUIREMENTS
    - theme: alt
      text: 物理引擎
      link: /PHYSICS
    - theme: alt
      text: 架构设计
      link: /ARCHITECTURE

features:
  - title: 真实物理引擎
    details: 自研半隐式欧拉积分器，支持自由落体、匀速运动、弹性/非弹性碰撞，物理定律契约测试保障正确性。
  - title: 高考真题库
    details: 浙江选考真题场景化还原（板块模型、圆周运动、动量守恒、能量守恒），支持参数调节与场景导入导出。
  - title: 交互式画布
    details: 平移缩放、物体拖拽、线段/圆弧绘制、电场力与磁场力可视化、高 DPI 适配。
  - title: 回放与快照
    details: 关键帧自动检测（速度方向突变）、分步回放导航、场景快照保存与恢复、撤销重做。
  - title: 多层测试保障
    details: unit / integration / regression / contracts 四层测试，CI 拦截测试文件删除与契约篡改。
  - title: 工程化基座
    details: ESLint + Prettier + vue-tsc 类型检查 + Vitest 覆盖率，pre-commit 钩子保护测试完整性。
---
