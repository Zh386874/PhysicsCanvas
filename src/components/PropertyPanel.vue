<template>
  <div class="property-panel">
    <div class="panel-title">属性</div>
    <div v-if="!object" class="empty">未选中物体</div>
    <form v-else class="form">
      <div class="field">
        <label>名称</label>
        <input
          type="text"
          :value="object.name"
          @input="update('name', $event.target.value)"
        />
      </div>
      <div class="field">
        <label>类型</label>
        <input
          type="text"
          :value="object.type"
          @input="update('type', $event.target.value)"
        />
      </div>
      <div class="field">
        <label>质量 (kg)</label>
        <input
          type="number"
          step="0.1"
          :value="object.mass"
          @input="update('mass', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>位置 X (m)</label>
        <input
          type="number"
          step="0.1"
          :value="object.x"
          @input="update('x', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>位置 Y (m)</label>
        <input
          type="number"
          step="0.1"
          :value="object.y"
          @input="update('y', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>速度 Vx (m/s)</label>
        <input
          type="number"
          step="0.1"
          :value="object.vx"
          @input="update('vx', parseFloat($event.target.value))"
        />
      </div>
      <div class="field">
        <label>速度 Vy (m/s)</label>
        <input
          type="number"
          step="0.1"
          :value="object.vy"
          @input="update('vy', parseFloat($event.target.value))"
        />
      </div>
      <div v-if="object.type === '质点'" class="field">
        <label>电荷 (q)</label>
        <input
          type="number"
          step="0.1"
          :value="object.charge || 0"
          @input="update('charge', parseFloat($event.target.value))"
        />
      </div>

      <!-- 线段物体属性 -->
      <template v-if="object.type === 'line_segment'">
        <div class="field-group">
          <div class="field">
            <label>端点1 X</label>
            <input
              type="number"
              step="1"
              :value="object.x1"
              @input="update('x1', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>端点1 Y</label>
            <input
              type="number"
              step="1"
              :value="object.y1"
              @input="update('y1', parseFloat($event.target.value))"
            />
          </div>
        </div>
        <div class="field-group">
          <div class="field">
            <label>端点2 X</label>
            <input
              type="number"
              step="1"
              :value="object.x2"
              @input="update('x2', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>端点2 Y</label>
            <input
              type="number"
              step="1"
              :value="object.y2"
              @input="update('y2', parseFloat($event.target.value))"
            />
          </div>
        </div>
        <div class="field">
          <label>恢复系数</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            :value="object.restitution !== undefined ? object.restitution : 0.3"
            @input="update('restitution', parseFloat($event.target.value))"
          />
        </div>
        <!-- 传送带速度（仅当线段带 velocity 且非板块时显示） -->
        <template v-if="object.velocity && !object.movable">
          <div class="field-group">
            <div class="field">
              <label>传送带速度 Vx (m/s)</label>
              <input
                type="number"
                step="0.1"
                :value="(object.velocity.x / PIXELS_PER_METER).toFixed(2)"
                @input="updateVelocity('x', parseFloat($event.target.value) * PIXELS_PER_METER)"
              />
            </div>
            <div class="field">
              <label>传送带速度 Vy (m/s)</label>
              <input
                type="number"
                step="0.1"
                :value="(object.velocity.y / PIXELS_PER_METER).toFixed(2)"
                @input="updateVelocity('y', parseFloat($event.target.value) * PIXELS_PER_METER)"
              />
            </div>
          </div>
        </template>
        <!-- 板块属性（仅当线段 movable 为 true 时显示） -->
        <template v-if="object.movable">
          <div class="field">
            <label>板块质量 (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              :value="object.mass || 1"
              @input="update('mass', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>厚度 (像素，视觉)</label>
            <input
              type="number"
              step="1"
              min="1"
              :value="object.thickness || 20"
              @input="update('thickness', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>物理厚度 (m，参与碰撞)</label>
            <input
              type="number"
              step="0.05"
              min="0.01"
              :value="object.physicsThickness !== undefined ? (object.physicsThickness / PIXELS_PER_METER).toFixed(2) : 0.1"
              @input="update('physicsThickness', parseFloat($event.target.value) * PIXELS_PER_METER)"
            />
          </div>
          <div class="field">
            <label>倾角 (rad，静态)</label>
            <input
              type="number"
              step="0.05"
              :value="object.angle !== undefined ? object.angle : 0"
              @input="update('angle', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>上表面摩擦系数</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="2"
              :value="object.frictionTop !== undefined ? object.frictionTop : 0.5"
              @input="update('frictionTop', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>下表面摩擦系数</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="2"
              :value="object.frictionBottom !== undefined ? object.frictionBottom : 0.3"
              @input="update('frictionBottom', parseFloat($event.target.value))"
            />
          </div>
          <div class="field">
            <label>当前速度 Vx (m/s)</label>
            <input
              type="number"
              step="0.1"
              readonly
              :value="((object.velocity?.x || 0) / PIXELS_PER_METER).toFixed(2)"
            />
          </div>
        </template>
        <div class="field">
          <label>法线方向</label>
          <div class="normal-buttons">
            <button type="button" class="normal-btn" @click="setNormal(0, -1)" title="向上">↑</button>
            <button type="button" class="normal-btn" @click="setNormal(0, 1)" title="向下">↓</button>
            <button type="button" class="normal-btn" @click="setNormal(-1, 0)" title="向左">←</button>
            <button type="button" class="normal-btn" @click="setNormal(1, 0)" title="向右">→</button>
            <button type="button" class="normal-btn" @click="setNormal(-0.707, -0.707)" title="左上 45°">↖</button>
            <button type="button" class="normal-btn" @click="setNormal(0.707, -0.707)" title="右上 -45°">↗</button>
          </div>
          <div class="hint">
            当前: ({{ (object.normalX || 0).toFixed(2) }}, {{ (object.normalY || 0).toFixed(2) }})
          </div>
        </div>
        <div class="field">
          <label>法线 X</label>
          <input
            type="number"
            step="0.1"
            :value="object.normalX || 0"
            @input="update('normalX', parseFloat($event.target.value))"
          />
        </div>
        <div class="field">
          <label>法线 Y</label>
          <input
            type="number"
            step="0.1"
            :value="object.normalY || 0"
            @input="update('normalY', parseFloat($event.target.value))"
          />
        </div>
        <!-- 弧线高级选项（仅弧线段显示） -->
        <details v-if="object.arc" class="arc-advanced">
          <summary>⚙ 弧线高级选项</summary>
          <div class="field">
            <label>约束动力学</label>
            <div class="toggle-row">
              <input
                type="checkbox"
                :checked="object.constraintEnabled !== false"
                @change="update('constraintEnabled', $event.target.checked)"
              />
              <span class="hint">{{ object.constraintEnabled !== false ? '已开启' : '已关闭' }}</span>
            </div>
            <div class="hint">
              开启：小球锁定弧面，能量守恒，自然脱离（法向力=0时释放）<br/>
              关闭：使用碰撞响应（可能有能量损失）
            </div>
          </div>

          <!-- 缺口与触发器配置 -->
          <div class="hint color-legend">
            <span style="color: #f59e0b">●</span> 触发器弧线
            <span style="color: #22c55e">●</span> 允许通过
            <span style="color: #ef4444">●</span> 禁止通过
          </div>

          <!-- 入口缺口 -->
          <div class="gap-section">
            <label>入口缺口</label>
            <button v-if="!object.arc.entryGap" type="button" class="gap-btn" @click="setArcGap('entryGap', { centerAngle: 0, halfWidth: 0.3, initiallyOpen: false, triggerAngle: undefined, triggerAction: 'open' })">+ 添加</button>
            <template v-else>
              <button type="button" class="gap-btn danger" @click="setArcGap('entryGap', null)">删除</button>
              <div class="field">
                <label>中心角 (rad)</label>
                <input type="number" step="0.1" :value="object.arc.entryGap.centerAngle" @input="updateArcGap('entryGap', 'centerAngle', parseFloat($event.target.value))" />
              </div>
              <div class="field">
                <label>半宽 (rad)</label>
                <input type="number" step="0.05" min="0.01" :value="object.arc.entryGap.halfWidth" @input="updateArcGap('entryGap', 'halfWidth', parseFloat($event.target.value))" />
              </div>
              <div class="field">
                <label>初始状态</label>
                <select :value="object.arc.entryGap.initiallyOpen ? 'open' : 'closed'" @change="updateArcGap('entryGap', 'initiallyOpen', $event.target.value === 'open')">
                  <option value="closed">关闭（禁止通过）</option>
                  <option value="open">打开（允许通过）</option>
                </select>
              </div>
              <div class="field">
                <label>触发类型</label>
                <select :value="getTriggerType(object.arc.entryGap)" @change="onTriggerTypeChange('entryGap', $event.target.value)">
                  <option value="none">无触发器</option>
                  <option value="angleCross">角度穿越</option>
                  <option value="enterRing">进入圆环</option>
                </select>
              </div>
              <div v-if="getTriggerType(object.arc.entryGap) === 'angleCross'" class="field">
                <label>触发角度 (rad)</label>
                <input type="number" step="0.1" :value="object.arc.entryGap.triggerAngle" @input="updateArcGap('entryGap', 'triggerAngle', parseFloat($event.target.value))" />
              </div>
              <div v-if="getTriggerType(object.arc.entryGap) !== 'none'" class="field">
                <label>触发动作</label>
                <select :value="object.arc.entryGap.triggerAction || 'open'" @change="updateArcGap('entryGap', 'triggerAction', $event.target.value)">
                  <option value="open">打开缺口</option>
                  <option value="close">关闭缺口</option>
                </select>
              </div>
            </template>
          </div>

          <!-- 出口缺口 -->
          <div class="gap-section">
            <label>出口缺口</label>
            <button v-if="!object.arc.exitGap" type="button" class="gap-btn" @click="setArcGap('exitGap', { centerAngle: 3.14, halfWidth: 0.3, initiallyOpen: false, triggerAngle: undefined, triggerAction: 'open' })">+ 添加</button>
            <template v-else>
              <button type="button" class="gap-btn danger" @click="setArcGap('exitGap', null)">删除</button>
              <div class="field">
                <label>中心角 (rad)</label>
                <input type="number" step="0.1" :value="object.arc.exitGap.centerAngle" @input="updateArcGap('exitGap', 'centerAngle', parseFloat($event.target.value))" />
              </div>
              <div class="field">
                <label>半宽 (rad)</label>
                <input type="number" step="0.05" min="0.01" :value="object.arc.exitGap.halfWidth" @input="updateArcGap('exitGap', 'halfWidth', parseFloat($event.target.value))" />
              </div>
              <div class="field">
                <label>初始状态</label>
                <select :value="object.arc.exitGap.initiallyOpen ? 'open' : 'closed'" @change="updateArcGap('exitGap', 'initiallyOpen', $event.target.value === 'open')">
                  <option value="closed">关闭（禁止通过）</option>
                  <option value="open">打开（允许通过）</option>
                </select>
              </div>
              <div class="field">
                <label>触发类型</label>
                <select :value="getTriggerType(object.arc.exitGap)" @change="onTriggerTypeChange('exitGap', $event.target.value)">
                  <option value="none">无触发器</option>
                  <option value="angleCross">角度穿越</option>
                  <option value="enterRing">进入圆环</option>
                </select>
              </div>
              <div v-if="getTriggerType(object.arc.exitGap) === 'angleCross'" class="field">
                <label>触发角度 (rad)</label>
                <input type="number" step="0.1" :value="object.arc.exitGap.triggerAngle" @input="updateArcGap('exitGap', 'triggerAngle', parseFloat($event.target.value))" />
              </div>
              <div v-if="getTriggerType(object.arc.exitGap) !== 'none'" class="field">
                <label>触发动作</label>
                <select :value="object.arc.exitGap.triggerAction || 'open'" @change="updateArcGap('exitGap', 'triggerAction', $event.target.value)">
                  <option value="open">打开缺口</option>
                  <option value="close">关闭缺口</option>
                </select>
              </div>
            </template>
          </div>
        </details>
      </template>

      <!-- 弹簧物体属性 -->
      <template v-if="object.type === 'spring'">
        <div class="field">
          <label>劲度系数 k (N/m)</label>
          <input
            type="number"
            step="1"
            :value="object.k"
            @input="update('k', parseFloat($event.target.value))"
          />
        </div>
        <div class="field">
          <label>自然长度 (m)</label>
          <input
            type="number"
            step="0.1"
            :value="(object.naturalLength / PIXELS_PER_METER).toFixed(2)"
            @input="update('naturalLength', parseFloat($event.target.value) * PIXELS_PER_METER)"
          />
        </div>
        <div class="field">
          <label>固定端 X (px)</label>
          <input
            type="number"
            step="1"
            :value="Math.round(object.anchorX)"
            @input="update('anchorX', parseFloat($event.target.value))"
          />
        </div>
        <div class="field">
          <label>固定端 Y (px)</label>
          <input
            type="number"
            step="1"
            :value="Math.round(object.anchorY)"
            @input="update('anchorY', parseFloat($event.target.value))"
          />
        </div>
      </template>
    </form>

    <ForceEditor v-if="object" :objectId="object.id" />

    <!-- 场设置 -->
    <div class="field-section">
      <div class="section-header">
        <span class="panel-title">场景设置</span>
      </div>
      <div class="field">
        <label>重力加速度 (m/s²)</label>
        <input
          type="number"
          step="0.1"
          :value="(state.gravity / PIXELS_PER_METER).toFixed(2)"
          @input="state.gravity = parseFloat($event.target.value) * PIXELS_PER_METER"
        />
        <div class="hint">内部: {{ state.gravity.toFixed(0) }} 像素/s²</div>
      </div>
      <div class="field">
        <label>场类型</label>
        <select
          :value="state.field.type"
          @change="onFieldTypeChange($event.target.value)"
        >
          <option value="none">无场</option>
          <option value="electric">匀强电场</option>
          <option value="magnetic">匀强磁场</option>
          <option value="composite">复合场（电+磁）</option>
        </select>
      </div>
      <div v-if="state.field.type === 'electric' || state.field.type === 'composite'" class="field-group">
        <div class="field">
          <label>Ex (N/C)</label>
          <input
            type="number"
            step="1"
            :value="state.field.E.x"
            @input="state.field.E.x = parseFloat($event.target.value)"
          />
        </div>
        <div class="field">
          <label>Ey (N/C)</label>
          <input
            type="number"
            step="1"
            :value="state.field.E.y"
            @input="state.field.E.y = parseFloat($event.target.value)"
          />
        </div>
      </div>
      <div v-if="state.field.type === 'magnetic' || state.field.type === 'composite'" class="field-group">
        <div class="field">
          <label>B (T)</label>
          <input
            type="number"
            step="0.1"
            :value="state.field.B"
            @input="state.field.B = parseFloat($event.target.value)"
          />
        </div>
        <div class="hint">
          {{ state.field.B >= 0 ? '⊙ 垂直纸面向里' : '⊗ 垂直纸面向外' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ForceEditor from './ForceEditor.vue'
import { state, PIXELS_PER_METER } from '../composables/usePhysics'
import { autoComputeNormal } from '../composables/useCollision'

const props = defineProps({
  object: { type: Object, default: null }
})

const emit = defineEmits(['update:object'])

function update(key, value) {
  const newObj = { ...props.object, [key]: value }
  // 线段端点变化时自动重算法线（保留用户方向偏好）
  if (newObj.type === 'line_segment' && ['x1', 'y1', 'x2', 'y2'].includes(key)) {
    const auto = autoComputeNormal(newObj)
    newObj.normalX = auto.normalX
    newObj.normalY = auto.normalY
  }
  emit('update:object', newObj)
}

/**
 * 更新传送带速度（单轴）
 * 输入为 m/s，内部存储为像素/s（× PIXELS_PER_METER）
 */
function updateVelocity(axis, value) {
  const oldVel = props.object.velocity || { x: 0, y: 0 }
  emit('update:object', { ...props.object, velocity: { ...oldVel, [axis]: value } })
}

function onFieldTypeChange(type) {
  state.field.type = type
}

function setNormal(nx, ny) {
  emit('update:object', { ...props.object, normalX: nx, normalY: ny })
}

/**
 * 更新弧线缺口的某个字段（嵌套更新 arc.entryGap/exitGap）
 */
function updateArcGap(gapKey, key, value) {
  const arc = { ...props.object.arc }
  if (arc[gapKey]) {
    arc[gapKey] = { ...arc[gapKey], [key]: value }
  }
  emit('update:object', { ...props.object, arc })
}

/**
 * 获取缺口的触发类型（向后兼容：无 triggerType 但有 triggerAngle 视为 angleCross）
 */
function getTriggerType(gap) {
  if (!gap) return 'none'
  if (gap.triggerType === 'enterRing') return 'enterRing'
  if (gap.triggerType === 'angleCross' || gap.triggerAngle !== undefined) return 'angleCross'
  return 'none'
}

/**
 * 切换缺口触发类型，同步清理/初始化相关字段
 */
function onTriggerTypeChange(gapKey, type) {
  const arc = { ...props.object.arc }
  const newGap = { ...arc[gapKey] }
  if (type === 'none') {
    delete newGap.triggerType
    delete newGap.triggerAngle
    delete newGap.triggerAction
  } else if (type === 'angleCross') {
    newGap.triggerType = 'angleCross'
    if (newGap.triggerAngle === undefined) newGap.triggerAngle = 0
    if (!newGap.triggerAction) newGap.triggerAction = 'open'
  } else if (type === 'enterRing') {
    newGap.triggerType = 'enterRing'
    delete newGap.triggerAngle
    if (!newGap.triggerAction) newGap.triggerAction = 'open'
  }
  arc[gapKey] = newGap
  emit('update:object', { ...props.object, arc })
}

/**
 * 添加/删除弧线缺口
 */
function setArcGap(gapKey, gap) {
  const arc = { ...props.object.arc }
  if (gap === null) {
    delete arc[gapKey]
  } else {
    arc[gapKey] = gap
  }
  emit('update:object', { ...props.object, arc })
}
</script>

<style scoped>
.property-panel {
  flex-shrink: 0;
  padding: 1rem;
}

.panel-title {
  font-size: 0.8rem;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.empty {
  color: #475569;
  font-size: 0.9rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-group {
  display: flex;
  gap: 0.5rem;
}

.field-group .field {
  flex: 1;
}

.field-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(59, 130, 246, 0.15);
}

.section-header {
  margin-bottom: 0.5rem;
}

label {
  font-size: 0.75rem;
  color: #94a3b8;
}

input, select {
  padding: 0.45rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  color: #e0e6ff;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

input:focus, select:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

select {
  cursor: pointer;
}

.hint {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.normal-buttons {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
}

.normal-btn {
  padding: 0.35rem 0;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  color: #cbd5e1;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.normal-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}

.arc-advanced {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.05);
}

.arc-advanced summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: #a78bfa;
  user-select: none;
}

.arc-advanced[open] summary {
  margin-bottom: 0.5rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-row input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  cursor: pointer;
}

.color-legend {
  display: flex;
  gap: 0.75rem;
  font-size: 0.7rem;
  margin: 0.5rem 0;
}

.gap-section {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed rgba(124, 58, 237, 0.2);
}

.gap-section > label {
  display: block;
  margin-bottom: 0.3rem;
}

.gap-btn {
  padding: 0.3rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  color: #93c5fd;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.gap-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
}

.gap-btn.danger {
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

.gap-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
}
</style>
