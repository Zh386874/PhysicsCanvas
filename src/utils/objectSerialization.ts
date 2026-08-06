import type { PhysicsObject } from '../composables/usePhysics'

/**
 * 运行时字段：物理引擎运行期产生、不参与序列化的字段清单。
 * 新增运行时字段时只需在此清单追加，deepCopyObjects / snapshotFromState 自动生效。
 */
const RUNTIME_FIELDS = ['trail', 'prevX', 'prevY', 'arcGateState', 'constrainedArcGroupId'] as const

/**
 * 剥离运行时字段，返回新对象（不修改入参）。
 * 用于 deepCopyObjects（导出/保存）与 snapshotFromState（撤销/重做快照）。
 */
export function stripRuntimeFields<T extends PhysicsObject>(obj: T): T {
  const rest = { ...obj } as Record<string, unknown>
  for (const k of RUNTIME_FIELDS) delete rest[k]
  return rest as T
}
