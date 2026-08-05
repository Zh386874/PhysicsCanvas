/**
 * 全局共享常量
 * 集中管理魔法数字，遵循 DRY 原则和"以定义常量为荣，以魔法数字为耻"
 * 各 composable 通过 import 使用，避免重复定义
 */

// ===== 物理引擎常量 =====

/** 全局像素-米换算比例（1 米 = 50 像素） */
export const PIXELS_PER_METER = 50

/** 重力加速度（SI 单位，m/s²） */
export const GRAVITY_SI = 9.8

/** 重力加速度（像素单位，像素/s² = 9.8 × 50 = 490） */
export const GRAVITY = GRAVITY_SI * PIXELS_PER_METER

/** 禁用地面的内部标记值（groundY >= 此值表示禁用水平地面，由线段物体接管碰撞） */
export const GROUND_DISABLED = 100000

/** 子步循环上限（防止微观粒子高速度导致计算量爆炸） */
export const MAX_SUBSTEPS = 200

/** 单步最大移动距离（像素，防止隧穿，假设最小半径约 10） */
export const MAX_STEP_DIST = 10

/** 轨迹最大长度（帧数） */
export const TRAIL_LENGTH = 80

/** 最大快照数（20秒 × 60fps） */
export const MAX_SNAPSHOTS = 1200

// ===== 画布常量 =====

/** 画布默认宽度（像素），用于自动缩放计算 */
export const DEFAULT_CANVAS_WIDTH = 800

/** 画布默认高度（像素），用于自动缩放计算 */
export const DEFAULT_CANVAS_HEIGHT = 500

/** 画布边距（像素），物体绘制区域的留白 */
export const CANVAS_MARGIN = 60

/** 画布中地面基准线（像素），AI 的 y=0 对应此位置 */
export const GROUND_BASELINE = 400

/** 平移范围限制（像素），防止场景完全移出视野 */
export const PAN_LIMIT = 3000

// ===== 物理默认值 =====

/** 地面碰撞恢复系数默认值 */
export const DEFAULT_GROUND_RESTITUTION = 0.6

/** 粒子碰撞恢复系数默认值 */
export const DEFAULT_PARTICLE_RESTITUTION = 1.0

/** 模拟时间步长（秒） */
export const DEFAULT_DT = 0.016

/** 默认粒子半径（像素），radius 缺失时的兜底值 */
export const DEFAULT_PARTICLE_RADIUS = 10

// ===== 交互检测阈值 =====

/** 线段端点命中半径（像素） */
export const HIT_RADIUS_POINT = 8

/** 线段整体命中距离（像素） */
export const HIT_RADIUS_SEGMENT = 5

// ===== 场景 IO / 提示延迟 =====

/** URL 对象释放延迟（毫秒），确保下载启动 */
export const URL_CLEANUP_DELAY = 1000

/** toast 自动消失时长（毫秒） */
export const TOAST_DURATION = 3000

// ===== 场景 IO 常量 =====

/** 场景导出 JSON 的版本号（用于后续兼容性升级） */
export const SCENE_VERSION = 2
