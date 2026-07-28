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
    title: '游戏装置（2023·浙江·高考真题）（螺旋圆轨已简化为单圆弧；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）',
    description: '（2023·浙江·高考真题）一游戏装置竖直截面如图所示，该装置由固定在水平地面上倾角θ=37°的直轨道AB、螺旋圆形轨道BCDE，倾角θ=37°的直轨道EF、水平直轨道FG组成，除FG段外各段轨道均光滑，且各处平滑连接。螺旋圆形轨道与轨道AB、EF相切于B(E)处。凹槽GHIJ底面HI水平光滑，上面放有一无动力摆渡车，并紧靠在竖直侧壁GH处，摆渡车上表面与直轨道下端FG、平台JK位于同一水平面。已知参数：螺旋圆形轨道半径R=0.5m，B点高度为1.2R，FG长度L_FG=2.5m，HI长度L_0=9m，摆渡车长度L=3m、质量m=1kg。将一质量也为m的滑块从倾斜轨道AB上高度h=2.3m处静止释放，滑块在FG段运动时的阻力为其重力的0.2倍。（摆渡车碰到竖直侧壁IJ立即静止，滑块视为质点，不计空气阻力，sin37°=0.6，cos37°=0.8）(1)求滑块过C点的速度大小v_C和轨道对滑块的作用力大小F_C；(2)摆渡车碰到IJ前，滑块恰好不脱离摆渡车，求滑块与摆渡车之间的动摩擦因数μ；(3)在(2)的条件下，求滑块从G到J所用的时间t。',
    difficulty: 'hard',
    tags: ['板块模型', '圆周运动', '动量守恒', '能量守恒', '斜面'],
    sceneJson: {
      title: '游戏装置（2023浙江高考）（螺旋圆轨分离B/E为动态双缺口；凹槽侧壁IJ碰撞未实现；轨道等比例放大×1.6，小球缩小至0.08m以缓解碰撞卡顿）',
      topic: 'custom',
      objects: [
        // 滑块：从AB上高度h静止释放（A点位置，球底高度）。
        // 轨道等比例放大×1.6：坐标×1.6（h=2.3→3.68m）；小球半径单独缩小 0.15→0.08m 以缓解碰撞卡顿
        { id: '滑块', type: 'ball', mass: 1, radius: 0.08, initialPosition: { x: 2.768, y: 3.68 }, initialVelocity: { x: 0, y: 0 } },
        // 直轨道AB：倾角37°，光滑，A(2.768,3.68) → B(6.189,1.197)（B分离到角度-2.614处，坐标×1.6）
        { id: '直轨道AB', type: 'platform', startPoint: { x: 2.768, y: 3.68 }, endPoint: { x: 6.189, y: 1.197 }, friction: 0 },
        // 螺旋圆轨BCDE：完整圆（2π），圆心O=(6.88,1.6)，半径R=0.8，C点最高(6.88,2.4)。
        // 2D 拓扑限制：分离 B(入口,角度-2.614) 和 E(出口,角度-1.814)，各自配 0.4rad 半宽缺口。
        // 缺口由 arcGateState 动态控制：小球在 AB 上→入口开；进入圆轨→入口关；过高点C→出口开；离开→全关。
        // 角度无量纲不放大；缺口弧长=0.8×0.8=0.64m > 小球直径0.16m，小球可穿过。
        { id: '圆轨BCDE', type: 'arc', center: { x: 6.88, y: 1.6 }, arcRadius: 0.8, startAngle: -2.214, endAngle: 4.069, friction: 0,
          entryGap: { centerAngle: -2.614, halfWidth: 0.4, initiallyOpen: true, triggerType: 'enterRing', triggerAction: 'close' },
          exitGap: { centerAngle: -1.814, halfWidth: 0.4, initiallyOpen: false, triggerType: 'angleCross', triggerAngle: Math.PI / 2, triggerAction: 'open' } },
        // 直轨道EF：倾角37°，光滑，E(6.688,0.824)（E分离到角度-1.814处） → F(7.68,0)（坐标×1.6）
        { id: '直轨道EF', type: 'platform', startPoint: { x: 6.688, y: 0.824 }, endPoint: { x: 7.68, y: 0 }, friction: 0 },
        // 水平轨道FG：L=2.5m，阻力=0.2mg → μ=0.2，F(7.68,0) → G(11.68,0)（坐标×1.6）
        { id: '水平轨道FG', type: 'platform', startPoint: { x: 7.68, y: 0 }, endPoint: { x: 11.68, y: 0 }, friction: 0.2 },
        // 摆渡车：紧靠GH，上表面y=0，长L=3m，质量m=1kg，可移动；μ为第(2)问答案值0.3（坐标×1.6）
        { id: '摆渡车', type: 'platform', startPoint: { x: 11.68, y: 0 }, endPoint: { x: 16.48, y: 0 }, friction: 0.3, movable: true, mass: 1 },
        // 凹槽底面HI：L_0=9m，水平光滑，低于上表面0.8m，G(11.68,-0.8) → J(26.08,-0.8)（坐标×1.6）
        { id: '凹槽底面HI', type: 'platform', startPoint: { x: 11.68, y: -0.8 }, endPoint: { x: 26.08, y: -0.8 }, friction: 0 }
      ],
      field: { type: 'none', E: { x: 0, y: 0 }, B: 0 },
      gravity: 10,
      groundY: 0,
      worldWidth: 27.2
    }
  }
]
