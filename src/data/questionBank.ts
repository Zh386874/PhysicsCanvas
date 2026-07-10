/**
 * 预置高考真题库
 * sceneJson 与 ParsedProblem 同构，可直接传给 buildScene
 * 坐标系：y 向上为正，地面 y=0（buildScene 内部会做画布坐标转换）
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
  // ========== 斜面类（5道）==========
  {
    id: 'slope-001',
    title: '斜面滑块基础题',
    description: '倾角30°的光滑斜面顶端，质量m=2kg的滑块由静止释放，斜面高h=5m，g=10m/s²。求滑块滑到底端时的速度大小。',
    difficulty: 'easy',
    tags: ['斜面', '重力', '运动学'],
    sceneJson: {
      title: '斜面滑块',
      topic: 'slope',
      objects: [
        { id: '滑块', type: 'ball', mass: 2, radius: 0.2, initialPosition: { x: 8.66, y: 5 }, initialVelocity: { x: 0, y: 0 } },
        { id: '斜面', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 8.66, y: 5 }, friction: 0 },
        { id: '地面', type: 'platform', startPoint: { x: -2, y: 0 }, endPoint: { x: 12, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 12
    }
  },
  {
    id: 'slope-002',
    title: '粗糙斜面摩擦问题',
    description: '倾角37°的粗糙斜面，滑块质量m=1kg，与斜面动摩擦因数μ=0.2，从斜面顶端由静止释放，斜面长L=5m。g=10m/s²。',
    difficulty: 'medium',
    tags: ['斜面', '摩擦力'],
    sceneJson: {
      title: '粗糙斜面',
      topic: 'slope',
      objects: [
        { id: '滑块', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 4, y: 3 }, initialVelocity: { x: 0, y: 0 } },
        { id: '斜面', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 4, y: 3 }, friction: 0.2 },
        { id: '地面', type: 'platform', startPoint: { x: -2, y: 0 }, endPoint: { x: 8, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 8
    }
  },
  {
    id: 'slope-003',
    title: '斜面与水平面连接',
    description: '质量m=2kg物体从高h=3m、倾角30°的光滑斜面顶端滑下，进入粗糙水平面μ=0.3，求在水平面上滑行的距离。g=10m/s²。',
    difficulty: 'medium',
    tags: ['斜面', '摩擦力', '运动学'],
    sceneJson: {
      title: '斜面连接水平面',
      topic: 'slope',
      objects: [
        { id: '滑块', type: 'ball', mass: 2, radius: 0.2, initialPosition: { x: 5.2, y: 3 }, initialVelocity: { x: 0, y: 0 } },
        { id: '斜面', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 5.2, y: 3 }, friction: 0 },
        { id: '水平面', type: 'platform', startPoint: { x: 5.2, y: 0 }, endPoint: { x: 15, y: 0 }, friction: 0.3 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 15
    }
  },
  {
    id: 'slope-004',
    title: '双斜面对称问题',
    description: '光滑双斜面，左右倾角均为30°，质量m=1kg小球从左斜面h=4m高处由静止释放，求小球在右斜面上升的最大高度。g=10m/s²。',
    difficulty: 'hard',
    tags: ['斜面', '能量守恒'],
    sceneJson: {
      title: '双斜面',
      topic: 'custom',
      objects: [
        { id: '小球', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 6.93, y: 4 }, initialVelocity: { x: 0, y: 0 } },
        { id: '左斜面', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 6.93, y: 4 }, friction: 0 },
        { id: '右斜面', type: 'platform', startPoint: { x: 6.93, y: 0 }, endPoint: { x: 13.86, y: 4 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 14
    }
  },
  {
    id: 'slope-005',
    title: '斜面上弹簧问题',
    description: '倾角30°光滑斜面底端固定弹簧，质量m=1kg滑块从距弹簧自由端s=2m处由静止释放，求滑块最大速度。g=10m/s²。',
    difficulty: 'hard',
    tags: ['斜面', '弹簧', '能量守恒'],
    sceneJson: {
      title: '斜面弹簧',
      topic: 'custom',
      objects: [
        { id: '滑块', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 3.46, y: 2 }, initialVelocity: { x: 0, y: 0 } },
        { id: '斜面', type: 'platform', startPoint: { x: 0, y: 0 }, endPoint: { x: 4, y: 2.31 }, friction: 0 },
        { id: '弹簧', type: 'spring', anchor: { x: 0, y: 0 }, ballId: '滑块', naturalLength: 4, k: 10 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: null,
      worldWidth: 8
    }
  },

  // ========== 抛体运动（3道）==========
  {
    id: 'projectile-001',
    title: '平抛运动基础',
    description: '从高h=20m处水平抛出质量m=0.5kg物体，初速度v0=10m/s。g=10m/s²。求落地时间和水平射程。',
    difficulty: 'easy',
    tags: ['抛体运动', '平抛'],
    sceneJson: {
      title: '平抛运动',
      topic: 'projectile',
      objects: [
        { id: '物体', type: 'ball', mass: 0.5, radius: 0.2, initialPosition: { x: 0, y: 20 }, initialVelocity: { x: 10, y: 0 } }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 25
    }
  },
  {
    id: 'projectile-002',
    title: '斜抛运动最大高度',
    description: '以初速度v0=20m/s、与水平方向成45°角斜抛物体，g=10m/s²。求最大高度和射程。',
    difficulty: 'medium',
    tags: ['抛体运动', '斜抛'],
    sceneJson: {
      title: '斜抛运动',
      topic: 'projectile',
      objects: [
        { id: '物体', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 14.14, y: 14.14 } }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 45
    }
  },
  {
    id: 'projectile-003',
    title: '高处平抛落地角度',
    description: '从高h=45m平台边缘水平抛出小球，初速度v0=15m/s，g=10m/s²。求落地时速度方向与水平面的夹角。',
    difficulty: 'medium',
    tags: ['抛体运动', '速度分解'],
    sceneJson: {
      title: '高处平抛',
      topic: 'projectile',
      objects: [
        { id: '小球', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 45 }, initialVelocity: { x: 15, y: 0 } }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 50
    }
  },

  // ========== 碰撞类（3道）==========
  {
    id: 'collision-001',
    title: '正面对心弹性碰撞',
    description: '质量m1=1kg、速度v1=6m/s的小球与静止的m2=2kg小球在光滑水平面上发生弹性正碰，求碰后两球速度。',
    difficulty: 'easy',
    tags: ['碰撞', '动量守恒'],
    sceneJson: {
      title: '弹性碰撞',
      topic: 'elastic_collision',
      objects: [
        { id: '球A', type: 'ball', mass: 1, radius: 0.3, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 6, y: 0 } },
        { id: '球B', type: 'ball', mass: 2, radius: 0.3, initialPosition: { x: 5, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '地面', type: 'platform', startPoint: { x: -3, y: 0 }, endPoint: { x: 15, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 15
    }
  },
  {
    id: 'collision-002',
    title: '完全非弹性碰撞',
    description: '质量m1=2kg、v1=4m/s的物体与静止的m2=3kg物体碰撞后粘在一起，求共同速度和动能损失。g=10m/s²。',
    difficulty: 'medium',
    tags: ['碰撞', '完全非弹性'],
    sceneJson: {
      title: '完全非弹性碰撞',
      topic: 'elastic_collision',
      objects: [
        { id: '物体A', type: 'ball', mass: 2, radius: 0.3, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 4, y: 0 } },
        { id: '物体B', type: 'ball', mass: 3, radius: 0.3, initialPosition: { x: 4, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '地面', type: 'platform', startPoint: { x: -3, y: 0 }, endPoint: { x: 12, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 12,
      particleRestitution: 0
    }
  },
  {
    id: 'collision-003',
    title: '多球连环碰撞',
    description: '三个相同质量m=1kg的小球在光滑水平面上排成一线，第一个以v=8m/s撞击静止的后两个，弹性碰撞。g=10m/s²。',
    difficulty: 'hard',
    tags: ['碰撞', '多物体'],
    sceneJson: {
      title: '连环碰撞',
      topic: 'elastic_collision',
      objects: [
        { id: '球1', type: 'ball', mass: 1, radius: 0.25, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 8, y: 0 } },
        { id: '球2', type: 'ball', mass: 1, radius: 0.25, initialPosition: { x: 3, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '球3', type: 'ball', mass: 1, radius: 0.25, initialPosition: { x: 6, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '地面', type: 'platform', startPoint: { x: -3, y: 0 }, endPoint: { x: 15, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 15
    }
  },

  // ========== 磁场类（3道）==========
  {
    id: 'magnetic-001',
    title: '带电粒子在磁场中圆周运动',
    description: '带正电粒子质量m=1e-4kg、电荷q=1e-3C，以v=10m/s垂直射入B=0.5T的匀强磁场，求圆周运动半径和周期。',
    difficulty: 'medium',
    tags: ['磁场', '圆周运动', '洛伦兹力'],
    sceneJson: {
      title: '磁场圆周运动',
      topic: 'magnetic_circle',
      objects: [
        { id: '粒子', type: 'ball', mass: 1e-4, charge: 1e-3, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 10, y: 0 } }
      ],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.5 },
      gravity: 0,
      groundY: null,
      worldWidth: 10
    }
  },
  {
    id: 'magnetic-002',
    title: '不同电荷在磁场中的偏转',
    description: '三个粒子以相同速度v=10m/s水平射入B=0.3T垂直纸面向里的磁场，分别带正电、负电、不带电，观察轨迹差异。',
    difficulty: 'medium',
    tags: ['磁场', '对比实验'],
    sceneJson: {
      title: '磁场偏转对比',
      topic: 'custom',
      objects: [
        { id: '正电粒子', type: 'ball', mass: 1e-4, charge: 1e-3, radius: 0.1, initialPosition: { x: 0, y: 8 }, initialVelocity: { x: 10, y: 0 } },
        { id: '负电粒子', type: 'ball', mass: 1e-4, charge: -1e-3, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 10, y: 0 } },
        { id: '中性粒子', type: 'ball', mass: 1e-4, charge: 0, radius: 0.1, initialPosition: { x: 0, y: 2 }, initialVelocity: { x: 10, y: 0 } }
      ],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.3 },
      gravity: 0,
      groundY: null,
      worldWidth: 10
    }
  },
  {
    id: 'magnetic-003',
    title: '磁场中带电粒子的周期',
    description: '带电粒子（m=1e-4kg，q=1e-3C）以v=5m/s射入B=0.1T的磁场，求运动周期和半径。',
    difficulty: 'hard',
    tags: ['磁场', '周期'],
    sceneJson: {
      title: '带电粒子磁场运动',
      topic: 'magnetic_circle',
      objects: [
        { id: '粒子', type: 'ball', mass: 1e-4, charge: 1e-3, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 5, y: 0 } }
      ],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.1 },
      gravity: 0,
      groundY: null,
      worldWidth: 10
    }
  },

  // ========== 电场类（3道）==========
  {
    id: 'electric-001',
    title: '带电粒子在电场中偏转',
    description: '带电粒子m=1e-4kg、q=1e-3C以v=20m/s水平进入E=5N/C向下的匀强电场，求偏转轨迹。g=10m/s²。',
    difficulty: 'medium',
    tags: ['电场', '偏转', '类平抛'],
    sceneJson: {
      title: '电场偏转',
      topic: 'electric_deflection',
      objects: [
        { id: '粒子', type: 'ball', mass: 1e-4, charge: 1e-3, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 20, y: 0 } }
      ],
      field: { type: 'electric', E: { x: 0, y: -5 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 10
    }
  },
  {
    id: 'electric-002',
    title: '电场加速问题',
    description: '带负电粒子（m=1e-4kg，q=-1e-3C）以v=50m/s进入偏转电场E=20N/C，求偏转量。',
    difficulty: 'hard',
    tags: ['电场', '偏转'],
    sceneJson: {
      title: '电场偏转',
      topic: 'electric_deflection',
      objects: [
        { id: '粒子', type: 'ball', mass: 1e-4, charge: -1e-3, radius: 0.1, initialPosition: { x: 0, y: 5 }, initialVelocity: { x: 50, y: 0 } }
      ],
      field: { type: 'electric', E: { x: 0, y: -20 }, B: 0 },
      gravity: 0,
      groundY: null,
      worldWidth: 10
    }
  },
  {
    id: 'electric-003',
    title: '电场力与重力平衡',
    description: '质量m=1e-6kg、电荷q=1e-7C的带电液滴在E=100N/C向上的匀强电场中处于静止状态，验证mg=qE。g=10m/s²。',
    difficulty: 'easy',
    tags: ['电场', '受力平衡'],
    sceneJson: {
      title: '电场力平衡',
      topic: 'custom',
      objects: [
        { id: '液滴', type: 'ball', mass: 1e-6, charge: 1e-7, radius: 0.15, initialPosition: { x: 5, y: 3 }, initialVelocity: { x: 0, y: 0 } }
      ],
      field: { type: 'electric', E: { x: 0, y: 100 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 10
    }
  },

  // ========== 弹簧/振动（2道）==========
  {
    id: 'spring-001',
    title: '弹簧振子简谐运动',
    description: '质量m=0.5kg物体挂在劲度系数k=10N/m弹簧下端，静止平衡后向下拉0.1m释放，求振动周期和最大速度。g=10m/s²。',
    difficulty: 'medium',
    tags: ['弹簧', '简谐运动', '振动'],
    sceneJson: {
      title: '弹簧振子',
      topic: 'custom',
      objects: [
        { id: '物体', type: 'ball', mass: 0.5, radius: 0.2, initialPosition: { x: 5, y: 0.2 }, initialVelocity: { x: 0, y: 0 } },
        { id: '弹簧', type: 'spring', anchor: { x: 5, y: 4 }, ballId: '物体', naturalLength: 3, k: 10 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: null,
      worldWidth: 10
    }
  },
  {
    id: 'spring-002',
    title: '弹簧碰撞问题',
    description: '质量m=1kg滑块以v=4m/s水平撞上固定在墙上的弹簧（k=20N/m），求弹簧最大压缩量和滑块反弹速度。g=10m/s²。',
    difficulty: 'hard',
    tags: ['弹簧', '能量守恒', '碰撞'],
    sceneJson: {
      title: '弹簧碰撞',
      topic: 'custom',
      objects: [
        { id: '滑块', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 4, y: 0 } },
        { id: '地面', type: 'platform', startPoint: { x: -3, y: 0 }, endPoint: { x: 10, y: 0 }, friction: 0 },
        { id: '弹簧', type: 'spring', anchor: { x: 8, y: 0.3 }, ballId: '滑块', naturalLength: 8, k: 20 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 12
    }
  },

  // ========== 传送带/板块（2道）==========
  {
    id: 'conveyor-001',
    title: '水平传送带问题',
    description: '质量m=2kg物体轻放在v=3m/s的水平传送带上，物体与传送带动摩擦因数μ=0.2，求物体加速到与传送带共速的时间和距离。g=10m/s²。',
    difficulty: 'medium',
    tags: ['传送带', '摩擦力'],
    sceneJson: {
      title: '传送带问题',
      topic: 'custom',
      objects: [
        { id: '物体', type: 'ball', mass: 2, radius: 0.2, initialPosition: { x: 0, y: 0 }, initialVelocity: { x: 0, y: 0 } },
        { id: '传送带', type: 'platform', startPoint: { x: -2, y: 0 }, endPoint: { x: 8, y: 0 }, friction: 0.2, beltVelocity: { x: 3, y: 0 } }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 10
    }
  },
  {
    id: 'plate-001',
    title: '板块模型相对滑动',
    description: '质量m=1kg滑块以v0=4m/s滑上静止在光滑地面上的M=3kg木板（长L=2m），滑块与木板μ=0.3。判断滑块是否滑离木板。g=10m/s²。',
    difficulty: 'hard',
    tags: ['板块模型', '相对滑动', '摩擦力'],
    sceneJson: {
      title: '板块模型',
      topic: 'custom',
      objects: [
        { id: '滑块', type: 'ball', mass: 1, radius: 0.2, initialPosition: { x: -0.5, y: 0.2 }, initialVelocity: { x: 4, y: 0 } },
        { id: '木板', type: 'platform', startPoint: { x: -1, y: 0.2 }, endPoint: { x: 1, y: 0.2 }, friction: 0.3, movable: true, mass: 3 },
        { id: '地面', type: 'platform', startPoint: { x: -5, y: 0 }, endPoint: { x: 5, y: 0 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 10
    }
  }
]
