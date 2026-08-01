<template>
  <div class="object-list">
    <div class="panel-title">物体列表</div>
    <div class="list">
      <template
        v-for="item in groupedItems"
        :key="item.type === 'single' ? item.obj.id : item.groupId"
      >
        <!-- 单个物体（质点/刚体/弹簧/普通线段） -->
        <div
          v-if="item.type === 'single'"
          class="item"
          :class="{
            selected: item.obj.id === selectedId,
            'multi-selected': selectedIds.includes(item.obj.id)
          }"
          @click="$emit('select', item.obj.id)"
        >
          <span class="name">{{ item.name }}</span>
          <div class="item-right">
            <span class="type">{{ item.subtype }}</span>
            <button
              v-if="removable"
              class="del-btn"
              title="删除"
              @click.stop="$emit('remove', item.obj.id)"
            >
              ✕
            </button>
          </div>
        </div>
        <!-- 弧线分组条目（同 groupId 的线段合并） -->
        <div v-else class="group-wrap">
          <div
            class="item group-item"
            :class="{
              selected: item.groupItems.some((o) => o.id === selectedId),
              'multi-selected': item.groupItems.some((o) => selectedIds.includes(o.id))
            }"
            @click="
              $emit(
                'select-group',
                item.groupItems.map((o) => o.id)
              )
            "
          >
            <button
              class="expand-btn"
              :title="isExpanded(item.groupId) ? '收起' : '展开'"
              @click.stop="toggleExpand(item.groupId)"
            >
              {{ isExpanded(item.groupId) ? '▼' : '▶' }}
            </button>
            <span class="name">{{ item.name }}</span>
            <div class="item-right">
              <span class="type">{{ item.subtype }}</span>
              <button
                v-if="removable"
                class="del-btn"
                title="删除整组"
                @click.stop="$emit('remove', item.groupItems[0].id)"
              >
                ✕
              </button>
            </div>
          </div>
          <!-- 展开后显示子线段列表 -->
          <div v-if="isExpanded(item.groupId)" class="child-list">
            <div
              v-for="(child, idx) in item.groupItems"
              :key="child.id"
              class="item child-item"
              :class="{ selected: child.id === selectedId }"
              @click="$emit('select', child.id)"
            >
              <span class="name">段 {{ idx + 1 }}</span>
              <span class="type">{{ child.type }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  objects: { type: Array, required: true },
  selectedId: { type: Number, default: null },
  selectedIds: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false }
})

defineEmits(['select', 'select-group', 'remove'])

// 展开的弧线分组 groupId 列表
const expandedGroups = ref([])

/**
 * 根据物体属性返回语义化子类型名（贴近物理题用语）
 * - 质点 → 小球（真题库中所有 ball 均可视为质点）
 * - 刚体 → 滑块
 * - line_segment 按 velocity/movable/arc 细分为 传送带/板块/弧线/线段
 * - spring → 弹簧
 */
function getSemanticSubtype(obj) {
  if (obj.type === '质点') return '小球'
  if (obj.type === '刚体') return '滑块'
  if (obj.type === 'spring') return '弹簧'
  if (obj.type === 'line_segment') {
    if (obj.velocity) return '传送带'
    if (obj.movable) return '板块'
    if (obj.arc) return '弧线'
    return '线段'
  }
  return obj.type
}

/**
 * 将 objects 按 groupId 分组：
 * - 无 groupId 的物体（质点/刚体/弹簧/普通线段）→ single 条目
 * - 有 groupId 的线段（弧线子段）→ group 条目，包含所有同组子段
 * 同一 groupId 只生成一个分组条目，按首次出现顺序排列
 */
const groupedItems = computed(() => {
  const items = []
  const seenGroups = new Map()
  for (const obj of props.objects) {
    const seg = obj
    if (seg.groupId !== undefined && seg.groupId !== null) {
      if (!seenGroups.has(seg.groupId)) {
        const groupItem = {
          type: 'group',
          groupId: seg.groupId,
          name: seg.name || '弧线',
          subtype: '弧线',
          groupItems: [obj]
        }
        seenGroups.set(seg.groupId, groupItem)
        items.push(groupItem)
      } else {
        seenGroups.get(seg.groupId).groupItems.push(obj)
      }
    } else {
      items.push({
        type: 'single',
        obj,
        name: obj.name,
        subtype: getSemanticSubtype(obj)
      })
    }
  }
  return items
})

/** 切换分组展开/收起 */
function toggleExpand(groupId) {
  const idx = expandedGroups.value.indexOf(groupId)
  if (idx === -1) {
    expandedGroups.value.push(groupId)
  } else {
    expandedGroups.value.splice(idx, 1)
  }
}

/** 判断分组是否展开 */
function isExpanded(groupId) {
  return expandedGroups.value.includes(groupId)
}
</script>

<style scoped>
.object-list {
  padding: 1rem;
  border-bottom: 1px solid rgba(var(--vsd-blue-rgb), 0.15);
}

.panel-title {
  font-size: 0.75rem;
  color: var(--vsd-info);
  margin-bottom: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 200px;
  overflow-y: auto;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  background: rgba(var(--vsd-panel-rgb), 0.4);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.item:hover {
  background: var(--vsd-hover);
  border-color: rgba(var(--vsd-blue-rgb), 0.3);
}

.item.selected {
  background: var(--vsd-selection);
  border-color: rgba(var(--vsd-blue-rgb), 0.5);
}

.item.multi-selected {
  background: linear-gradient(
    135deg,
    rgba(var(--vsd-info-rgb), 0.22),
    rgba(var(--vsd-purple-rgb), 0.12)
  );
  border-color: rgba(var(--vsd-purple-rgb), 0.8);
  border-left: 3px solid rgba(var(--vsd-purple-rgb), 0.95);
}

.item.multi-selected .name {
  font-weight: 600;
  color: var(--vsd-purple);
}

.name {
  color: var(--vsd-text);
  font-size: 0.9rem;
}

.type {
  color: var(--vsd-text-dim);
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(var(--vsd-blue-rgb), 0.08);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.del-btn {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(var(--vsd-red-rgb), 0.3);
  border-radius: 4px;
  background: transparent;
  color: var(--vsd-red);
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.del-btn:hover {
  background: rgba(var(--vsd-red-rgb), 0.15);
  border-color: rgba(var(--vsd-red-rgb), 0.6);
}

/* 弧线分组条目 */
.group-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.group-item {
  /* 复用 .item 样式，展开按钮占据左侧 */
}

.expand-btn {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vsd-text-muted);
  cursor: pointer;
  font-size: 0.65rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.expand-btn:hover {
  background: rgba(var(--vsd-purple-rgb), 0.15);
  color: var(--vsd-purple);
}

/* 子线段列表（展开后） */
.child-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-left: 1.6rem;
}

.child-item {
  padding: 0.4rem 0.6rem;
  background: rgba(var(--vsd-panel-rgb), 0.25);
  font-size: 0.8rem;
}

.child-item .name {
  font-size: 0.8rem;
  color: var(--vsd-text-muted);
}

.child-item .type {
  font-size: 0.65rem;
}

.child-item:hover {
  background: rgba(var(--vsd-blue-rgb), 0.06);
}
</style>
