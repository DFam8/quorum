<template>
  <label class="radio-wrap" :class="[wrapClass, { 'radio-wrap--disabled': disabled, 'radio-wrap--checked': checked }]">
    <input
      type="radio"
      class="radio-input"
      :value="value"
      :checked="checked"
      :name="name"
      :disabled="disabled"
      v-bind="$attrs"
      @change="$emit('update:modelValue', value)"
    />
    <span class="radio-box" aria-hidden="true">
      <span v-if="checked" class="radio-dot" />
    </span>
    <span v-if="$slots.default" class="radio-label"><slot /></span>
  </label>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | number | boolean
  value: string | number | boolean
  name?: string
  disabled?: boolean
  wrapClass?: string | string[] | Record<string, boolean>
}>()

defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

const checked = computed(() => props.modelValue === props.value)
</script>

<style scoped>
.radio-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;

  &.radio-wrap--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.radio-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;

  &:focus-visible + .radio-box {
    box-shadow: var(--shadow-focus);
  }
}

.radio-box {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--border-strong);
  background: var(--surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast), border-color var(--transition-fast);

  .radio-wrap:hover & {
    border-color: var(--blue-400);
  }

  .radio-wrap--checked & {
    border-color: var(--blue-400);
    background: var(--blue-400);
  }
}

.radio-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: #fff;
}

.radio-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.4;
}
</style>
