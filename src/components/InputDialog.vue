<template>
  <div v-if="visible" class="input-dialog-overlay" @click.self="onCancel">
    <div class="input-dialog">
      <div class="dialog-header">
        <span class="dialog-title">{{ title }}</span>
        <button class="close-btn" @click="onCancel">✕</button>
      </div>
      <div class="dialog-body">
        <template v-if="message">
          <p class="dialog-message">{{ message }}</p>
        </template>
        <template v-else>
          <input
            ref="inputRef"
            v-model="inputValue"
            class="dialog-input"
            :class="{ 'has-error': errorMessage }"
            :placeholder="placeholder"
            @keydown.enter="onConfirm"
            @keydown.esc="onCancel"
          />
          <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>
        </template>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" @click="onCancel">取消</button>
        <button class="btn-confirm" @click="onConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '输入' },
  initialValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  message: { type: String, default: '' },
  errorMessage: { type: String, default: '' }
})

const emit = defineEmits(['confirm', 'cancel'])

const inputValue = ref('')
const inputRef = ref(null)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      inputValue.value = props.initialValue
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

function onConfirm() {
  emit('confirm', inputValue.value)
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.input-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.input-dialog {
  width: 380px;
  background: var(--vsd-panel);
  border: 1px solid var(--vsd-border-light);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--vsd-border);
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vsd-text);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--vsd-text-dim);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(var(--vsd-red-rgb), 0.12);
  color: var(--vsd-red);
}

.dialog-body {
  padding: 1.25rem;
}

.dialog-input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  background: var(--vsd-bg);
  border: 1px solid var(--vsd-border-light);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.dialog-input:focus {
  border-color: var(--vsd-blue);
}

.dialog-input::placeholder {
  color: var(--vsd-text-dim);
}

.dialog-input.has-error {
  border-color: var(--vsd-red);
}

.dialog-error {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: var(--vsd-red);
  line-height: 1.4;
}

.dialog-message {
  margin: 0;
  font-size: 0.9rem;
  color: var(--vsd-text);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  padding: 0 1.25rem 1rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: var(--vsd-button);
  border: 1px solid var(--vsd-border-light);
  border-radius: 6px;
  color: var(--vsd-text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--vsd-button-hover);
  border-color: var(--vsd-border-light);
}

.btn-confirm {
  padding: 0.5rem 1.2rem;
  background: linear-gradient(135deg, var(--vsd-blue), var(--vsd-blue-hover));
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-confirm:hover {
  opacity: 0.92;
}
</style>
