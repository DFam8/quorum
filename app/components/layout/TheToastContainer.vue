<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <BaseToast
          v-for="toast in toasts"
          :key="toast.id"
          :message="toast.message"
          :variant="toast.variant"
          @dismiss="dismiss(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  @media (max-width: 47.999rem) {
    left: var(--space-4);
    right: var(--space-4);
    bottom: 72px;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all var(--transition-normal);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
