<template>
  <div class="onboarding-page">
    <div class="onboarding-progress">
      <div class="progress-step done">
        <span class="step-num">✓</span>
        <span class="step-label">Profile</span>
      </div>
      <div class="progress-divider" />
      <div class="progress-step active">
        <span class="step-num">2</span>
        <span class="step-label">Notifications</span>
      </div>
    </div>

    <div class="onboarding-card">
      <div class="onboarding-intro">
        <h1 class="onboarding-title">Notification preferences</h1>
        <p class="onboarding-subtitle">
          Stay informed about what matters. You can change these anytime in your profile settings.
        </p>
      </div>

      <ul class="prefs-list">
        <li v-for="pref in preferences" :key="pref.id" class="pref-item">
          <div class="pref-info">
            <p class="pref-label">{{ pref.label }}</p>
            <p class="pref-desc">{{ pref.description }}</p>
          </div>
          <div class="pref-controls">
            <label class="toggle-label" :for="`email-${pref.id}`">
              <input
                :id="`email-${pref.id}`"
                v-model="pref.email"
                type="checkbox"
                class="toggle-input"
                :disabled="pref.mandatory"
              />
              <span class="toggle-track" />
              <span class="sr-only">Email</span>
            </label>
            <span class="pref-channel-label">Email</span>
          </div>
        </li>
      </ul>

      <div class="pref-notice">
        <span class="notice-icon" aria-hidden="true">ℹ</span>
        Some notifications — urgent announcements, violation notices, and direct messages from your board — cannot be turned off.
      </div>

      <div class="onboarding-actions">
        <BaseButton variant="secondary" :disabled="finishing" @click="skip">
          Skip for now
        </BaseButton>
        <BaseButton variant="primary" :loading="finishing" @click="finish">
          Done — go to dashboard
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const router = useRouter()
const { success: toastSuccess } = useToast()
const finishing = ref(false)

const preferences = reactive([
  {
    id: 'general_announcement',
    label: 'General announcements',
    description: 'News and updates from your board',
    email: true,
    mandatory: false,
  },
  {
    id: 'meeting_agenda',
    label: 'Meeting agendas & minutes',
    description: 'When a new agenda or minutes are published',
    email: true,
    mandatory: false,
  },
  {
    id: 'vote_opened',
    label: 'Community votes',
    description: 'When a vote opens or a reminder is sent',
    email: true,
    mandatory: false,
  },
  {
    id: 'dm',
    label: 'Direct messages',
    description: 'Messages from other residents',
    email: true,
    mandatory: false,
  },
  {
    id: 'urgent',
    label: 'Urgent announcements',
    description: 'Emergency and urgent notices from the board',
    email: true,
    mandatory: true,
  },
])

async function finish(): Promise<void> {
  finishing.value = true
  toastSuccess('You\'re all set! Welcome to Quorum.')
  await router.push('/dashboard')
  finishing.value = false
}

async function skip(): Promise<void> {
  await router.push('/dashboard')
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

.prefs-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pref-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child {
    border-bottom: none;
  }
}

.pref-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.pref-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.pref-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pref-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.toggle-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  justify-content: center;

  &:has(.toggle-input:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;

  &:focus-visible + .toggle-track {
    box-shadow: var(--shadow-focus);
  }
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: var(--border-strong);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: var(--radius-full);
    transition: transform var(--transition-fast);
  }
}

.toggle-input:checked + .toggle-track {
  background: var(--blue-400);

  &::after {
    transform: translateX(16px);
  }
}

.pref-channel-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.pref-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--info-bg);
  color: var(--info-text);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--line-height-normal);
}

.notice-icon {
  flex-shrink: 0;
  font-weight: var(--font-medium);
}

.onboarding-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  @media (min-width: 30rem) {
    flex-direction: row;
    justify-content: flex-end;
  }

  > * {
    @media (max-width: 29.999rem) {
      width: 100%;
    }
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
