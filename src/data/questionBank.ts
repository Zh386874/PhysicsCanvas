/**
 * 预置高考真题库（浙江选考真题）
 * sceneJson 与 ParsedProblem 同构，可直接传给 buildScene
 * 坐标系：y 向上为正，地面 y=0（buildScene 内部会做画布坐标转换）
 * 题目标题末尾标注真题年份与题号，便于体现项目需求
 */

import type { ParsedProblem } from '../composables/useAIParser'

export interface QuestionItem {
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  sceneJson: ParsedProblem
}

export const questionBank: QuestionItem[] = [
  // ========== 斜面类 ==========
  {
    id: 'slope-001',
    title: '物流滑轨（2022年浙江6月选考第16题）',
    description: '物流公司通过滑轨把货物直接装运到卡车中。倾斜滑轨与水平面成24°角，长度l1=4m，水平滑轨长度可调，两滑轨间平滑连接。若货物从倾斜滑轨顶端由静止开始下滑，其与滑轨间的动摩擦因数均为μ=2/9，货物可视为质点（取cos24°=0.9，sin24°=0.4，重力加速度g=10m/s²）。求：(1)货物在倾斜滑轨上滑行时加速度a1的大小；(2)货物在倾斜滑轨末端时速度v的大小；(3)若货物滑离水平滑轨末端时的速度不超过2m/s，求水平滑轨的最短长度l2。',
    difficulty: 'medium',
    tags: ['斜面', '摩擦力', '运动学'],
    sceneJson: {
      title: '物流滑轨',
      topic: 'slope',
      objects: [
        { id: '货物', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 3.6, y: 1.6 }, initialVelocity: { x: 0, y: 0 } },
        { id: '倾斜滑轨', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 3.6, y: 1.6 }, friction: 0.222 },
        { id: '水平滑轨', type: 'platform', startPoint: { x: 3.6, y: 0 }, endPoint: { x: 13.6, y: 0 }, friction: 0.222 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 14
    }
  },

  // ========== 碰撞类 ==========
  {
    id: 'collision-001',
    title: '碰撞探究（2023年浙江6月选考第18题）',
    description: '为了探究物体间碰撞特性，设计了如图所示的实验装置。水平直轨道AB、CD和水平传送带平滑无缝连接，两半径均为r=0.4m的四分之一圆周组成的竖直细圆弧管道DEF与轨道CD和足够长的水平直轨道FG平滑相切连接。质量为3m的滑块b与质量为2m的滑块c用劲度系数k=100N/m的轻质弹簧连接，静置于轨道FG上。现有质量m=0.12kg的滑块a以初速度v0=2√21m/s从D处进入，经DEF管道后与FG上的滑块b碰撞，时间极短。已知传送带长L=0.8m，以v=2m/s的速率顺时针转动，滑块a与传送带间的动摩擦因数μ=0.5，其它摩擦和阻力均不计，各滑块均可视为质点，弹簧的弹性势能Ep=½kx²（x为形变量），g=10m/s²。',
    difficulty: 'hard',
    tags: ['碰撞', '传送带', '弹簧', '动量守恒'],
    sceneJson: {
      title: '碰撞探究',
      topic: 'elastic_collision',
      objects: [
        { id: '滑块a', type: 'ball', mass: 0.12, radius: 0.15, initialPosition: { x: 1.8, y: 0 }, initialVelocity: { x: 9.17, y: 0 } },
        { id: '传送带', type: 'platform', startPoint: { x: 1, y: 0 }, endPoint: { x: 1.8, y: 0 }, friction: 0.5, beltVelocity: { x: 2, y: 0 } },
        // 圆弧管道 DEF 由两个 1/4 圆弧组成（D→E→F），D/F 处切线水平与轨道平滑相切
        { id: '圆弧DE', type: 'arc', center: { x: 1.8, y: 0.4 }, arcRadius: 0.4, startAngle: 1.5708, endAngle: 0, friction: 0 },
        { id: '圆弧EF', type: 'arc', center: { x: 2.6, y: 0.4 }, arcRadius: 0.4, startAngle: 3.14159, endAngle: 1.5708, friction: 0 },
        { id: '水平轨道FG', type: 'platform', startPoint: { x: 2.6, y: 0 }, endPoint: { x: 8, y: 0 }, friction: 0 },
        { id: '滑块b', type: 'ball', mass: 0.36, radius: 0.15, initialPosition: { x: 4, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '滑块c', type: 'ball', mass: 0.24, radius: 0.15, initialPosition: { x: 5, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '弹簧', type: 'spring', anchor: { x: 4, y: 0 }, ballId: '滑块c', naturalLength: 1, k: 100 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 9
    }
  },

  // ========== 磁场类 ==========
  {
    id: 'magnetic-001',
    title: '磁场离子源（2023年浙江6月选考第22题）',
    description: '探究离子源发射速度大小和方向分布的原理如图所示。x轴上方存在垂直平面向外、磁感应强度大小为B的匀强磁场。x轴下方的分析器由两块相距为d、长度足够的平行金属薄板M和N组成，其中位于x轴的M板中心有一小孔C（孔径忽略不计），N板连接电流表后接地。位于坐标原点O的离子源能发射质量为m、电荷量为q的正离子，其速度方向与y轴夹角最大值为π/4，且各个方向均有速度大小连续分布在v1和v2之间的离子射出。已知速度大小为v1、沿y轴正方向射出的离子经磁场偏转后恰好垂直x轴射入孔C。不计离子的重力及相互作用，不考虑离子间的碰撞。',
    difficulty: 'hard',
    tags: ['磁场', '圆周运动', '洛伦兹力'],
    sceneJson: {
      title: '磁场离子源',
      topic: 'magnetic_circle',
      objects: [
        { id: '离子', type: 'ball', mass: 1e-10, charge: 1e-5, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 100, y: 0 } }
      ],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.5 },
      gravity: 0,
      groundY: null,
      worldWidth: 10
    }
  },

  // ========== 传送带/板块类 ==========
  {
    id: 'conveyor-001',
    title: '弹射游戏装置（2024年浙江6月选考第16题）',
    description: '一弹射游戏装置竖直截面如图所示，固定的光滑水平直轨道AB、半径为R的光滑螺旋圆形轨道BCD、光滑水平直轨道DE平滑连接。长为L、质量为M的平板紧靠长为d的固定凹槽EFGH侧壁EF放置，平板上表面与DEH齐平。将一质量为m的小滑块从A端弹射，经过轨道BCD后滑上平板并带动平板一起运动，平板到达HG即被锁定。已知R=0.5m，d=4.4m，L=1.8m，M=m=0.1kg，平板与滑块间的动摩擦因数μ1=0.6、与凹槽水平底面FG间的动摩擦因数μ2。滑块视为质点，不计空气阻力，最大静摩擦力等于滑动摩擦力，重力加速度g=10m/s²。求：(1)滑块恰好能通过圆形轨道最高点C时，求滑块离开弹簧时速度v0的大小；(2)若μ2=0，滑块恰好过C点后，求平板加速至与滑块共速时系统损耗的机械能；(3)若μ2=0.1，滑块能到达H点，求其离开弹簧时的最大速度vm。',
    difficulty: 'hard',
    tags: ['板块模型', '圆周运动', '动量守恒', '能量守恒'],
    sceneJson: {
      title: '弹射游戏装置（螺旋圆轨已简化为单圆弧）',
      topic: 'custom',
      objects: [
        { id: '滑块', type: 'ball', mass: 0.1, radius: 0.15, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 5, y: 0 } },
        { id: '水平轨道AB', type: 'platform', startPoint: { x: -2, y: 0 }, endPoint: { x: 2, y: 0 }, friction: 0 },
        { id: '圆弧轨道BCD', type: 'arc', center: { x: 2.5, y: 0 }, arcRadius: 0.5, startAngle: -3.14159, endAngle: 0, friction: 0 },
        { id: '水平轨道DE', type: 'platform', startPoint: { x: 3, y: 0 }, endPoint: { x: 5, y: 0 }, friction: 0 },
        { id: '平板', type: 'platform', startPoint: { x: 5, y: 0 }, endPoint: { x: 6.8, y: 0 }, friction: 0.6, movable: true, mass: 0.1 },
        { id: '凹槽底面', type: 'platform', startPoint: { x: 5, y: -0.5 }, endPoint: { x: 9.4, y: -0.5 }, friction: 0.1 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 12
    }
  }
]
