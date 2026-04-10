<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        role="presentation"
        @click.self="emit('close')"
      >
        <div
          class="modal"
          :class="size === 'sm' ? 'modal--sm' : ''"
          role="dialog"
          :aria-label="title"
          aria-modal="true"
        >
          <div class="modal-header">
            <h2 class="modal-title">{{ title }}</h2>
            <button type="button" class="modal-close" aria-label="Close" @click="emit('close')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  size?: 'sm' | 'default'
}>()

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0 0 0 / 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 200;
}

.modal {
  background: var(--surface-card);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 520px;
  overflow: hidden;

  &.modal--sm { max-width: 400px; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border-default);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 500;
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;

  &:hover { color: var(--text-primary); background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;

  .modal {
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal {
    transform: translateY(6px);
    opacity: 0;
  }
}
</style>
