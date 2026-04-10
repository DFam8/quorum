<template>
  <div class="onboarding-page">
    <div class="onboarding-progress">
      <div class="progress-step" :class="{ active: step === 1, done: step > 1 }">
        <span class="step-num">1</span>
        <span class="step-label">Profile</span>
      </div>
      <div class="progress-divider" />
      <div class="progress-step" :class="{ active: step === 2, done: step > 2 }">
        <span class="step-num">2</span>
        <span class="step-label">Notifications</span>
      </div>
    </div>

    <div v-if="step === 1" class="onboarding-card">
      <div class="onboarding-intro">
        <h1 class="onboarding-title">Welcome to Quorum</h1>
        <p class="onboarding-subtitle">Let's set up your profile so your neighbours can get in touch.</p>
      </div>

      <form class="onboarding-form" @submit.prevent="saveProfile">
        <div class="name-row">
          <BaseInput
            v-model="form.firstName"
            label="First name"
            placeholder="Jane"
            :error="errors.firstName"
            :disabled="saving"
            required
          />
          <BaseInput
            v-model="form.lastName"
            label="Last name"
            placeholder="Smith"
            :error="errors.lastName"
            :disabled="saving"
            required
          />
        </div>

        <BaseInput
          v-model="form.phone"
          label="Phone number"
          type="tel"
          placeholder="+1 (555) 000-0000"
          hint="Optional. Used for SMS notifications if you enable them."
          :error="errors.phone"
          :disabled="saving"
          autocomplete="tel"
        />

        <BaseButton type="submit" variant="primary" :loading="saving" class="onboarding-btn">
          Continue
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const api = useApi()
const { user, fetchProfile } = useAuth()
const { success: toastSuccess, error: toastError } = useToast()
const router = useRouter()

const step = ref(1)
const saving = ref(false)

const form = reactive({
  firstName: '',
  lastName: '',
  phone: '',
})

const errors = reactive({
  firstName: '',
  lastName: '',
  phone: '',
})

onMounted(() => {
  if (user.value) {
    form.firstName = user.value.firstName
    form.lastName = user.value.lastName
    form.phone = user.value.phone ?? ''
  }
})

function validate(): boolean {
  errors.firstName = ''
  errors.lastName = ''
  errors.phone = ''

  let valid = true

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required.'
    valid = false
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required.'
    valid = false
  }

  return valid
}

async function saveProfile(): Promise<void> {
  if (!validate()) return

  saving.value = true
  try {
    await api.residents.completeOnboarding.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
    })

    await fetchProfile()
    toastSuccess('Profile saved!')
    await router.push('/onboarding/notifications')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save profile.'
    toastError(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.onboarding-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}

.onboarding-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.progress-step {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-tertiary);

  &.active {
    color: var(--text-link);

    .step-num {
      background: var(--blue-400);
      color: var(--text-inverse);
      border-color: var(--blue-400);
    }
  }

  &.done {
    color: var(--success-text);

    .step-num {
      background: var(--success-bg);
      color: var(--success-text);
      border-color: var(--success-mid);
    }
  }
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 0.5px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--surface-card);
  flex-shrink: 0;
}

.step-label {
  font-size: var(--text-sm);
}

.progress-divider {
  width: 48px;
  height: 0.5px;
  background: var(--border-default);
}

.onboarding-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);

  @media (min-width: 48rem) {
    padding: var(--space-6);
  }
}

.onboarding-intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.onboarding-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.onboarding-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.onboarding-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.name-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.onboarding-btn {
  width: 100%;
  margin-top: var(--space-2);
}
</style>
