/**
 * 物体操作层：增删改 + 选中 + AI 参数应用 + 撤销/重做 + Delete 键
 * 从 App.vue 拆分，遵循 SRP
 * 通过 useObjectOperations 工厂接收场景管理器的状态
 */
import { computed, type Ref } from 'vue'
import {
  state, updateObjectProperty, addObject, removeObject, PIXELS_PER_METER
} from './usePhysics'
import type { PhysicsObject, ParticleObject } from './usePhysics'
import { pushHistory, undo as historyUndo, redo as historyRedo } from './useHistory'
import { deepCopyObjects } from './useSceneIO'
import { GROUND_DISABLED } from '../constants'

/** 批量更新项 */
export interface BatchUpdateItem {
  id: number
  props: Record<string, unknown>
}

/** 物体操作上下文：由 useSceneManager 组装并注入 */
export interface ObjectOpsContext {
  activeScene: Ref<string>
  mode: Ref<'live' | 'replay'>
  aiToast: Ref<string>
  selectedId: Ref<number | null>
  selectedIds: Ref<number[]>
  saveCustomScene: () => void
}

/**
 * 创建物体操作集合
 */
export function useObjectOperations(ctx: ObjectOpsContext) {
  const { activeScene, mode, aiToast, selectedId, selectedIds, saveCustomScene } = ctx

  /** 当前选中物体（基于 selectedId） */
  const selectedObject = computed(() =>
    state.objects.find(o => o.id === selectedId.value)
  )

  /** 属性面板更新物体 */
  function onObjectUpdate(updated: Partial<PhysicsObject> & { id: number }): void {
    const idx = state.objects.findIndex(o => o.id === updated.id)
    if (idx !== -1) {
      Object.assign(state.objects[idx], updated)
    }
  }

  /** 选中物体：单击时清空多选，仅选中单个 */
  function onSelectObject(id: number): void {
    selectedId.value = id
    selectedIds.value = []
  }

  /**
   * 选中物体组：点击弧线条目时选中整组（同 groupId 的所有线段）
   * 用于 ObjectList 中弧线分组条目的整组选中
   */
  function onSelectGroup(ids: number[]): void {
    if (!Array.isArray(ids) || ids.length === 0) {
      selectedIds.value = []
      selectedId.value = null
      return
    }
    selectedIds.value = ids
    selectedId.value = ids[0]
  }

  /**
   * 批量更新（框选拖拽时整体平移）
   */
  function handleBatchUpdate(updates: BatchUpdateItem[]): void {
    if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
    for (const { id, props } of updates) {
      const obj = state.objects.find(o => o.id === id)
      if (obj) Object.assign(obj, props)
    }
    saveCustomScene()
  }

  /** 添加物体（自定义场景编辑） */
  function handleAddObject(obj: PhysicsObject): void {
    if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
    addObject(obj)
    selectedId.value = obj.id
    saveCustomScene()
  }

  /**
   * 更新物体属性（拖拽时实时调用）
   * 注：拖拽过程中频繁调用，不推入历史，由调用方在拖拽结束时推入
   */
  function handleUpdateObject(payload: { id: number; props: Record<string, unknown> }): void {
    const obj = state.objects.find(o => o.id === payload.id)
    if (obj) Object.assign(obj, payload.props)
    saveCustomScene()
  }

  /**
   * 删除物体
   * 弧线由多条线段共享 groupId 组成，删除其中一条时整组删除，避免弧线断裂
   * 删除质点/刚体时级联删除连接它的弹簧，避免孤儿弹簧
   */
  function handleRemoveObject(id: number): void {
    if (activeScene.value === '自定义') pushHistory(state.objects, state.gravity, state.groundY, state.field)
    const target = state.objects.find(o => o.id === id)
    const toDelete = new Set<number>([id])
    if (target && (target as SegmentObjectLike).groupId) {
      // 弧线组：删除同 groupId 的所有线段
      const groupId = (target as SegmentObjectLike).groupId
      for (const o of state.objects) {
        const seg = o as SegmentObjectLike
        if (seg.groupId === groupId && o.id !== id) toDelete.add(o.id)
      }
    }
    // 级联删除：删除质点/刚体时，同步删除连接它的弹簧
    if (target && (target.type === '质点' || target.type === '刚体')) {
      for (const o of state.objects) {
        if (o.type === 'spring' && (o as SpringObjectLike).ballId === id) toDelete.add(o.id)
      }
    }
    for (const did of toDelete) removeObject(did)
    selectedIds.value = selectedIds.value.filter(sid => !toDelete.has(sid))
    if (selectedId.value === id) selectedId.value = null
    saveCustomScene()
  }

  /**
   * AI 解析出的参数应用到第一个质点物体
   * params 中速度为 m/s，需 ×PIXELS_PER_METER 转像素
   */
  function handleUpdateParams(params: { mass?: number; vx?: number; charge?: number }): void {
    const obj = state.objects.find(o => o.type === '质点') as ParticleObject | undefined
    if (!obj) return
    if (params.mass !== undefined) updateObjectProperty(obj.id, 'mass', params.mass)
    if (params.vx !== undefined) updateObjectProperty(obj.id, 'vx', params.vx * PIXELS_PER_METER)
    if (params.charge !== undefined) updateObjectProperty(obj.id, 'charge', params.charge)
  }

  /**
   * 删除选中物体（Delete 键）
   */
  function onDeleteKey(): void {
    if (activeScene.value !== '自定义') return
    if (mode.value === 'replay') return
    // 优先批量删除多选（弧线组整组删除，避免断裂）
    if (selectedIds.value.length > 0) {
      pushHistory(state.objects, state.gravity, state.groundY, state.field)
      const toDelete = new Set<number>()
      for (const id of selectedIds.value) {
        const target = state.objects.find(o => o.id === id)
        if (target && (target as SegmentObjectLike).groupId) {
          for (const o of state.objects) {
            const seg = o as SegmentObjectLike
            if (seg.groupId === (target as SegmentObjectLike).groupId) toDelete.add(o.id)
          }
        } else {
          toDelete.add(id)
        }
        // 级联删除：删除质点/刚体时，同步删除连接它的弹簧
        if (target && (target.type === '质点' || target.type === '刚体')) {
          for (const o of state.objects) {
            if (o.type === 'spring' && (o as SpringObjectLike).ballId === id) toDelete.add(o.id)
          }
        }
      }
      for (const id of toDelete) removeObject(id)
      selectedIds.value = []
      if (selectedId.value !== null && !state.objects.find(o => o.id === selectedId.value)) {
        selectedId.value = null
      }
      saveCustomScene()
      return
    }
    if (selectedId.value !== null) {
      handleRemoveObject(selectedId.value)
    }
  }

  /** 应用历史快照到 state */
  function applyHistorySnapshot(snap: {
    objects: PhysicsObject[]
    gravity: number
    groundY: number | null
    field: typeof state.field
  }): void {
    state.objects.splice(0, state.objects.length)
    for (const o of snap.objects) state.objects.push({ ...o, trail: [] } as PhysicsObject)
    state.gravity = snap.gravity
    state.groundY = snap.groundY === null ? GROUND_DISABLED : snap.groundY
    state.field = JSON.parse(JSON.stringify(snap.field))
    selectedId.value = snap.objects[0]?.id ?? null
    selectedIds.value = []
    saveCustomScene()
  }

  /** 撤销 */
  function onUndo(): void {
    if (activeScene.value !== '自定义') return
    if (mode.value === 'replay') return
    const prev = historyUndo(state.objects, state.gravity, state.groundY, state.field)
    if (!prev) return
    applyHistorySnapshot(prev)
    aiToast.value = '已撤销'
    setTimeout(() => { aiToast.value = '' }, 1500)
  }

  /** 重做 */
  function onRedo(): void {
    if (activeScene.value !== '自定义') return
    if (mode.value === 'replay') return
    const next = historyRedo(state.objects, state.gravity, state.groundY, state.field)
    if (!next) return
    applyHistorySnapshot(next)
    aiToast.value = '已重做'
    setTimeout(() => { aiToast.value = '' }, 1500)
  }

  return {
    selectedObject,
    onObjectUpdate,
    onSelectObject,
    onSelectGroup,
    handleBatchUpdate,
    handleAddObject,
    handleUpdateObject,
    handleRemoveObject,
    handleUpdateParams,
    onDeleteKey,
    onUndo,
    onRedo
  }
}

/** 含 groupId 的线段类型（用于弧线整组删除逻辑） */
interface SegmentObjectLike {
  groupId?: number
}

/** 弹簧类型的最小契约（用于级联删除查找 ballId） */
interface SpringObjectLike {
  ballId: number
}
