<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-loading': loading }]"
    :disabled="disabled || loading"
    :type="type"
    v-bind="$attrs"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true" />
    <FaIcon v-else-if="icon" :icon="['fajr', icon]" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  icon?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  type: 'button',
  disabled: false,
  loading: false,
})
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  border: none;
  transition: opacity var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--gradient-brand-subtle);
  color: var(--text-inverse);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-secondary {
  background: var(--surface-card);
  color: var(--text-primary);
  border: 0.5px solid var(--border-strong);

  &:hover:not(:disabled) {
    background: var(--surface-raised);
  }
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);

  &:hover:not(:disabled) {
    background: var(--surface-raised);
    color: var(--text-primary);
  }
}

.btn-danger {
  background: var(--danger-bg);
  color: var(--danger-text);
  border: 0.5px solid transparent;

  &:hover:not(:disabled) {
    background: var(--danger-mid);
    color: var(--text-inverse);
  }
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
