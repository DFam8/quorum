<template>
  <label class="checkbox-wrap" :class="{ 'checkbox-wrap--disabled': disabled }">
    <input
      type="checkbox"
      class="checkbox-input"
      :checked="modelValue"
      :disabled="disabled"
      v-bind="$attrs"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="checkbox-box" :class="{ 'checkbox-box--checked': modelValue }" aria-hidden="true">
      <svg v-if="modelValue" class="checkbox-check" viewBox="0 0 10 8" fill="none">
        <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span v-if="$slots.default" class="checkbox-label"><slot /></span>
  </label>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.checkbox-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;

  &.checkbox-wrap--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;

  &:focus-visible + .checkbox-box {
    box-shadow: var(--shadow-focus);
  }
}

.checkbox-box {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast), border-color var(--transition-fast);

  .checkbox-wrap:hover & {
    border-color: var(--blue-400);
  }

  &.checkbox-box--checked {
    background: var(--blue-400);
    border-color: var(--blue-400);
    color: #fff;
  }
}

.checkbox-check {
  width: 10px;
  height: 10px;
}

.checkbox-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.4;
}
</style>
