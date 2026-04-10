<template>
  <div class="field">
    <label v-if="label" :for="inputId" class="field-label">
      {{ label }}
      <span v-if="required" class="field-required" aria-hidden="true">*</span>
    </label>
    <input
      :id="inputId"
      v-bind="$attrs"
      class="field-input"
      :class="{ 'field-input-error': !!error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :autocomplete="autocomplete"
      @input="onInput"
    />
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
type Props = {
  modelValue?: string
  label?: string
  type?: string
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  autocomplete?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const inputId = computed(() => props.id ?? `input-${useId()}`)

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.field-required {
  color: var(--danger-mid);
  margin-left: 2px;
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  min-height: 44px;
  transition: border-color var(--transition-fast);

  &::placeholder {
    color: var(--text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--surface-raised);
  }
}

.field-input-error {
  border-color: var(--danger-mid);

  &:focus {
    border-color: var(--danger-mid);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }
}

.field-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
}

.field-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
