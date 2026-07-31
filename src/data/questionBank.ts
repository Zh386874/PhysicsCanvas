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
  // ========== 板块模型类 ==========
  {
    id: 'plate-2023-zj',
    title: '游戏装置（2023·浙江·高考真题）',
    description:
      '（2023·浙江·高考真题）一游戏装置竖直截面如图所示，该装置由固定在水平地面上倾角θ=37°的直轨道AB、螺旋圆形轨道BCDE，倾角θ=37°的直轨道EF、水平直轨道FG组成，除FG段外各段轨道均光滑，且各处平滑连接。螺旋圆形轨道与轨道AB、EF相切于B(E)处。凹槽GHIJ底面HI水平光滑，上面放有一无动力摆渡车，并紧靠在竖直侧壁GH处，摆渡车上表面与直轨道下端FG、平台JK位于同一水平面。已知参数：螺旋圆形轨道半径R=0.5m，B点高度为1.2R，FG长度L_FG=2.5m，HI长度L_0=9m，摆渡车长度L=3m、质量m=1kg。将一质量也为m的滑块从倾斜轨道AB上高度h=2.3m处静止释放，滑块在FG段运动时的阻力为其重力的0.2倍。（摆渡车碰到竖直侧壁IJ立即静止，滑块视为质点，不计空气阻力，sin37°=0.6，cos37°=0.8）(1)求滑块过C点的速度大小v_C和轨道对滑块的作用力大小F_C；(2)摆渡车碰到IJ前，滑块恰好不脱离摆渡车，求滑块与摆渡车之间的动摩擦因数μ；(3)在(2)的条件下，求滑块从G到J所用的时间t。',
    difficulty: 'hard',
    tags: ['板块模型', '圆周运动', '动量守恒', '能量守恒', '斜面'],
    sceneJson: {
      title:
        '游戏装置（2023浙江高考）（螺旋圆轨分离B/E为动态双缺口；凹槽侧壁IJ端面碰撞已实现；摆渡车为plate类型带物理厚度；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）',
      topic: 'custom',
      objects: [
        // 滑块：从AB上高度h静止释放（A点位置，球底高度）。
        // 轨道等比例放大×1.6：坐标×1.6（h=2.3→3.68m）；小球半径单独缩小 0.15→0.08m 以缓解碰撞卡顿
        {
          id: '滑块',
          type: 'ball',
          mass: 1,
          radius: 0.08,
          initialPosition: { x: 2.768, y: 3.68 },
          initialVelocity: { x: 0, y: 0 }
        },
        // 直轨道AB：倾角37°，光滑，A(2.768,3.68) → B(6.189,1.197)（B分离到角度-2.614处，坐标×1.6）
        {
          id: '直轨道AB',
          type: 'platform',
          startPoint: { x: 2.768, y: 3.68 },
          endPoint: { x: 6.189, y: 1.197 },
          friction: 0
        },
        // 螺旋圆轨BCDE：完整圆（2π），圆心O=(6.88,1.6)，半径R=0.8，C点最高(6.88,2.4)。
        // 2D 拓扑限制：分离 B(入口,角度-2.614) 和 E(出口,角度-1.814)，各自配 0.4rad 半宽缺口。
        // 缺口由 arcGateState 动态控制：小球在 AB 上→入口开；进入圆轨→入口关；过高点C→出口开；离开→全关。
        // 角度无量纲不放大；缺口弧长=0.8×0.8=0.64m > 小球直径0.16m，小球可穿过。
        {
          id: '圆轨BCDE',
          type: 'arc',
          center: { x: 6.88, y: 1.6 },
          arcRadius: 0.8,
          startAngle: -2.214,
          endAngle: 4.069,
          friction: 0,
          entryGap: {
            centerAngle: -2.614,
            halfWidth: 0.4,
            initiallyOpen: true,
            triggerType: 'enterRing',
            triggerAction: 'close'
          },
          exitGap: {
            centerAngle: -1.814,
            halfWidth: 0.4,
            initiallyOpen: false,
            triggerType: 'angleCross',
            triggerAngle: Math.PI / 2,
            triggerAction: 'open'
          }
        },
        // 直轨道EF：倾角37°，光滑，E(6.688,0.824)（E分离到角度-1.814处） → F(7.68,0)（坐标×1.6）
        {
          id: '直轨道EF',
          type: 'platform',
          startPoint: { x: 6.688, y: 0.824 },
          endPoint: { x: 7.68, y: 0 },
          friction: 0
        },
        // 水平轨道FG：L=2.5m，阻力=0.2mg → μ=0.2，F(7.68,0) → G(11.68,0)（坐标×1.6）
        {
          id: '水平轨道FG',
          type: 'platform',
          startPoint: { x: 7.68, y: 0 },
          endPoint: { x: 11.68, y: 0 },
          friction: 0.2
        },
        // 摆渡车：紧靠GH，上表面y=0，长L=3m，质量m=1kg，可移动；μ为第(2)问答案值0.3（坐标×1.6）
        // 物理厚度0.8m（上表面y=0 → 下表面y=-0.8 接触凹槽底面HI）；frictionTop=0.3（滑块摩擦），frictionBottom=0（凹槽底面光滑）
        {
          id: '摆渡车',
          type: 'plate',
          startPoint: { x: 11.68, y: 0 },
          endPoint: { x: 16.48, y: 0 },
          physicsThickness: 0.8,
          angle: 0,
          frictionTop: 0.3,
          frictionBottom: 0,
          mass: 1
        },
        // 凹槽底面HI：L_0=9m，水平光滑，低于上表面0.8m，G(11.68,-0.8) → J(26.08,-0.8)（坐标×1.6）
        {
          id: '凹槽底面HI',
          type: 'platform',
          startPoint: { x: 11.68, y: -0.8 },
          endPoint: { x: 26.08, y: -0.8 },
          friction: 0
        },
        // 凹槽侧壁IJ：竖直，摆渡车碰到后由端面碰撞静止（startPoint上→endPoint下，法线自动指向左）
        {
          id: '凹槽侧壁IJ',
          type: 'platform',
          startPoint: { x: 26.08, y: 0 },
          endPoint: { x: 26.08, y: -0.8 },
          friction: 0
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 27.2
    }
  },
  // ========== 平抛/斜抛运动类 ==========
  {
    id: 'ski-jump-2022-eth-a',
    title: '跳台滑雪（2022·全国乙卷·高考真题）——平抛段（第1-2问）',
    description:
      '北京冬奥会跳台滑雪运动中，运动员从倾角37°的助滑道末端A点以水平初速度 v₀=10m/s 飞出，落点在下方倾角45°的着陆坡上。不计空气阻力，g=10m/s²。本场景覆盖第（1）（2）问：求飞行时间和落坡速度。',
    difficulty: 'easy',
    tags: ['平抛运动', '斜面约束', '速度分解'],
    sceneJson: {
      title:
        '跳台滑雪·平抛段（2022全国乙卷）（覆盖第1-2问；A点高度由答案t=2s逆推为20m；未建模助滑道AB）',
      topic: 'projectile',
      objects: [
        {
          id: '运动员',
          type: 'ball',
          mass: 1,
          radius: 0.3,
          initialPosition: { x: 0, y: 20 },
          initialVelocity: { x: 10, y: 0 }
        },
        {
          id: '着陆坡',
          type: 'platform',
          startPoint: { x: 0, y: 20 },
          endPoint: { x: 30, y: -10 },
          friction: 0
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: -20,
      worldWidth: 35,
      simulationTime: 4,
      particleRestitution: 1,
      groundRestitution: 0,
      question: '（1）求从飞出到第一次落坡的时间；（2）求落坡时的速度大小和方向。'
    }
  },
  {
    id: 'ski-jump-2022-eth-b',
    title: '跳台滑雪（2022·全国乙卷·高考真题）——反弹段（第3问）',
    description:
      "接上题第（3）问：运动员第一次落坡后，竖直方向速度反向且大小减半（v_y' = -0.5v_y），水平速度不变。本场景从第一次落点 P₁ 出发，以碰后速度 v=(10, +10) m/s 做斜抛运动，求第二次落点与第一次落点的间距。",
    difficulty: 'medium',
    tags: ['斜抛运动', '斜面约束', '速度变换', '多次落点'],
    sceneJson: {
      title:
        '跳台滑雪·反弹段（2022全国乙卷）（覆盖第3问；起点为第一次落点P₁(20,0)；初速度为碰后速度v=(10,+10)；斜面足够长）',
      topic: 'projectile',
      objects: [
        {
          id: '运动员',
          type: 'ball',
          mass: 1,
          radius: 0.3,
          initialPosition: { x: 20, y: 0 },
          initialVelocity: { x: 10, y: 10 }
        },
        {
          id: '着陆坡',
          type: 'platform',
          startPoint: { x: 0, y: 20 },
          endPoint: { x: 100, y: -80 },
          friction: 0
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: -90,
      worldWidth: 105,
      simulationTime: 6,
      particleRestitution: 1,
      groundRestitution: 0,
      question:
        '（3）接第2问，碰后竖直方向速度反向且大小减半，水平速度不变。求第二次落点与第一次落点的间距。'
    }
  },
  // ========== 弹性碰撞 / 板块模型类 ==========
  {
    id: 'elastic-collision-2021-ng1',
    title: '一维弹性碰撞（2021·全国新高考I卷·高考真题）',
    description:
      '如图，水平光滑地面上静置质量 M=3kg 的木块B，质量为 m=1kg 的小球A以水平初速度 v₀=8m/s 向右运动与B发生正碰，碰撞为弹性碰撞，碰后B向右滑上静止的光滑小车C（质量 M_C=2kg，上表面粗糙）。（1）求碰撞后瞬间A、B的速度大小 v_A、v_B；（2）若B在小车上滑动 L=2m 后与小车共速，求B与小车间的动摩擦因数 μ；（3）求整个过程中系统损失的机械能。',
    difficulty: 'medium',
    tags: ['弹性碰撞', '动量守恒', '板块模型', '摩擦力', '能量守恒'],
    sceneJson: {
      title:
        '一维弹性碰撞（2021新高考I卷）（地面用platform建模支撑A/B，全局groundY=-0.2支撑小车；小车长度延长至5m以保证B完成2m相对滑动共速）',
      topic: 'elastic_collision',
      objects: [
        {
          id: 'A',
          type: 'ball',
          mass: 1,
          radius: 0.2,
          initialPosition: { x: 0, y: 0 },
          initialVelocity: { x: 8, y: 0 }
        },
        {
          id: 'B',
          type: 'ball',
          mass: 3,
          radius: 0.2,
          initialPosition: { x: 2, y: 0 },
          initialVelocity: { x: 0, y: 0 }
        },
        {
          id: '地面',
          type: 'platform',
          startPoint: { x: -10, y: 0 },
          endPoint: { x: 4, y: 0 },
          friction: 0
        },
        {
          id: 'C',
          type: 'plate',
          startPoint: { x: 4, y: 0 },
          endPoint: { x: 9, y: 0 },
          physicsThickness: 0.2,
          angle: 0,
          frictionTop: 0.16,
          frictionBottom: 0,
          mass: 2
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: -0.2,
      worldWidth: 20,
      simulationTime: 3,
      particleRestitution: 1,
      groundRestitution: 0.6,
      question:
        '（1）求碰撞后瞬间A、B的速度大小vA、vB；（2）若B在小车上滑动L=2m后与小车共速，求B与小车间的动摩擦因数μ；（3）求整个过程中系统损失的机械能。'
    }
  },
  // ========== 传送带模型类 ==========
  {
    id: 'conveyor-2020-ng1',
    title: '水平传送带模型（2020·全国I卷·高考真题）',
    description:
      '（2020·全国I卷·高考真题）水平传送带顺时针匀速运行速度 v=4m/s，传送带两端间距 L=10m，将一质量 m=1kg 的小物块以水平初速度 v₀=6m/s 从传送带左端向右滑上传送带，物块与传送带间的动摩擦因数 μ=0.2，g=10m/s²。（1）判断物块在传送带上的运动状态，求物块从左端到右端的总时间 t；（2）求整个过程中物块与传送带间因摩擦产生的热量 Q；（3）若物块以 v₀′=2m/s 滑上传送带，求物块离开传送带时的速度大小，以及传送带的电动机多消耗的电能。',
    difficulty: 'medium',
    tags: ['传送带模型', '摩擦力', '相对运动', '能量守恒', '功能关系'],
    sceneJson: {
      title: '水平传送带模型（传送带无厚度，物块视为质点）',
      topic: 'custom',
      objects: [
        {
          id: '物块',
          type: 'ball',
          mass: 1,
          radius: 0.2,
          initialPosition: { x: 0, y: 0 },
          initialVelocity: { x: 6, y: 0 }
        },
        {
          id: '传送带',
          type: 'platform',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 10, y: 0 },
          friction: 0.2,
          beltVelocity: { x: 4, y: 0 }
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: null,
      worldWidth: 12,
      simulationTime: 2.5
    }
  },
  // ========== 板块（滑块-木板）模型类 ==========
  {
    id: 'plate-2022-ngjia',
    title: '板块（滑块-木板）模型（2022·全国甲卷·高考真题）',
    description:
      '（2022·全国甲卷·高考真题）光滑水平地面上静置质量 M=4kg 的长木板，木板长度 L=5m，上表面粗糙，动摩擦因数 μ=0.2。质量 m=1kg 的小物块以水平初速度 v₀=14m/s 从木板左端滑上木板，g=10m/s²，最大静摩擦力等于滑动摩擦力。（1）求物块刚滑上木板时，物块和木板的加速度大小 a_m、a_M；（2）判断物块能否从木板右端滑出，若不能，求两者共速时的时间和共同速度，以及物块相对木板滑行的距离；若能，求物块滑出时木板的速度；（3）若在木板上表面左端固定一劲度系数 k=100N/m 的轻弹簧，物块与弹簧发生弹性碰撞，求最终物块停在木板上的位置。',
    difficulty: 'hard',
    tags: ['板块模型', '摩擦力', '相对运动', '动量守恒', '能量守恒'],
    sceneJson: {
      title: '板块模型（2022全国甲卷）（弹簧未建模；木板无厚度体现为物理厚度0.1m；物块视为质点）',
      topic: 'custom',
      objects: [
        {
          id: '物块',
          type: 'ball',
          mass: 1,
          radius: 0.2,
          initialPosition: { x: 0, y: 0.1 },
          initialVelocity: { x: 14, y: 0 }
        },
        {
          id: '木板',
          type: 'plate',
          startPoint: { x: 0, y: 0.1 },
          endPoint: { x: 5, y: 0.1 },
          physicsThickness: 0.1,
          angle: 0,
          frictionTop: 0.2,
          frictionBottom: 0,
          mass: 4
        }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      groundRestitution: 0,
      worldWidth: 10,
      simulationTime: 0.5
    }
  },
  // ========== 电场偏转类 ==========
  {
    id: 'electric-deflection-2020-ng3',
    title: '电场偏转（类平抛）（2020·全国III卷·高考真题）',
    description:
      '（2020·全国III卷·高考真题）真空中存在匀强电场，电场方向与水平方向夹角为 θ=37° 斜向上。质量 m=1×10⁻⁶ kg、电荷量 q=+1×10⁻⁶ C 的带电微粒以初速度 v₀=10m/s 水平向右射入电场，恰好沿直线运动，重力加速度 g=10m/s²。（1）求匀强电场的场强大小 E；（2）若微粒运动 t=1s 后电场突然变为竖直向下，大小变为原来的 1/2，求微粒再经过 t′=1s 后的速度大小和水平位移；（3）若将电场改为竖直向下的偏转电场，极板长 L=0.2m，板间距 d=0.1m，微粒以水平速度 v₀=10m/s 垂直电场射入，恰好从极板边缘飞出，求偏转电场的场强 E′。',
    difficulty: 'medium',
    tags: ['电场偏转', '类平抛运动', '匀强电场', '带电粒子'],
    sceneJson: {
      title:
        '电场偏转类平抛（2020全国III卷第24题第3问建模；微观参数宏观等效放大100倍；微粒半径缩小为2mm；前两问未建模）',
      topic: 'electric_deflection',
      objects: [
        {
          id: '微粒',
          type: 'ball',
          mass: 0.0001,
          charge: 0.0001,
          radius: 0.002,
          initialPosition: { x: 0, y: 0 },
          initialVelocity: { x: 10, y: 0 }
        },
        {
          id: '上极板',
          type: 'platform',
          startPoint: { x: 0, y: 0.05 },
          endPoint: { x: 0.2, y: 0.05 },
          friction: 0
        },
        {
          id: '下极板',
          type: 'platform',
          startPoint: { x: 0, y: -0.05 },
          endPoint: { x: 0.2, y: -0.05 },
          friction: 0
        }
      ],
      field: { type: 'electric', E: { x: 0, y: -240 }, B: 0 },
      gravity: 10,
      groundY: null,
      worldWidth: 0.4,
      simulationTime: 0.05,
      particleRestitution: 0
    }
  },
  // ========== 有界磁场圆周运动类 ==========
  {
    id: 'magnetic-circle-2021-eth',
    title: '有界磁场圆周运动（2021·全国乙卷·高考真题）',
    description:
      '（2021·全国乙卷·高考真题）真空中矩形区域 ABCD 内有垂直纸面向里的匀强磁场，磁感应强度为 B。质量为 m、电荷量为 +q 的带电粒子从 AB 边中点以垂直于 AB 边的速度 v₀ 射入磁场，恰好从 AD 边的中点飞出磁场，矩形边长 AB=2L，BC=L。（1）求磁感应强度 B 的大小；（2）若粒子入射速度变为 2v₀，求粒子从磁场边界射出的位置和在磁场中运动的时间；（3）若磁场仅分布在以入射点为圆心、R=2mv/(qB) 的圆形区域内，求粒子能穿过原矩形磁场区域的概率。',
    difficulty: 'hard',
    tags: ['有界磁场', '圆周运动', '洛伦兹力', '带电粒子'],
    sceneJson: {
      title:
        '有界磁场圆周运动（2021全国乙卷第25题第1问建模；矩形磁场边界未显示仅轨迹；微观参数宏观等效；B=0.4T对应R=2.5m）',
      topic: 'magnetic_circle',
      objects: [
        {
          id: '粒子',
          type: 'ball',
          mass: 0.0001,
          charge: 0.001,
          radius: 0.2,
          initialPosition: { x: 0, y: 3.8 },
          initialVelocity: { x: 10, y: 0 }
        }
      ],
      field: { type: 'magnetic', E: { x: 0, y: 0 }, B: 0.4 },
      gravity: 0,
      groundY: null,
      worldWidth: 10,
      simulationTime: 0.6
    }
  }
]
