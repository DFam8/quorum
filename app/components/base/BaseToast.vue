<template>
  <div :class="['toast', `toast-${variant}`]" role="alert">
    <span class="toast-message">{{ message }}</span>
    <button class="toast-close" @click="emit('dismiss')" aria-label="Dismiss notification">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
type Props = {
  message: string
  variant: 'success' | 'error' | 'info' | 'warning'
}

defineProps<Props>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border: 0.5px solid transparent;
  min-width: 280px;
  max-width: 420px;
}

.toast-success {
  background: var(--success-bg);
  color: var(--success-text);
  border-color: var(--success-mid);
}

.toast-error {
  background: var(--danger-bg);
  color: var(--danger-text);
  border-color: var(--danger-mid);
}

.toast-warning {
  background: var(--warning-bg);
  color: var(--warning-text);
  border-color: var(--warning-mid);
}

.toast-info {
  background: var(--info-bg);
  color: var(--info-text);
  border-color: var(--info-mid);
}

.toast-message {
  flex: 1;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: inherit;
  opacity: 0.7;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }
}
</style>
