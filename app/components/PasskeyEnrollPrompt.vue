<template>
  <Teleport to="body">
    <Transition name="prompt">
      <div v-if="visible" class="prompt-backdrop" @click.self="dismiss">
        <div class="prompt-card" role="dialog" aria-modal="true" aria-labelledby="passkey-prompt-title">
          <div class="prompt-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z"/>
              <path d="M7 7a5 5 0 0 0 9.9-1"/>
              <path d="M2 21v-1a7 7 0 0 1 7-7h2"/>
              <path d="M16 19h6M19 16v6"/>
            </svg>
          </div>

          <div class="prompt-body">
            <h2 id="passkey-prompt-title" class="prompt-title">
              Sign in faster next time
            </h2>
            <p class="prompt-desc">
              Use Face ID or your fingerprint to sign in instantly — no email link needed.
            </p>
          </div>

          <div class="prompt-actions">
            <BaseButton variant="primary" :loading="loading" class="prompt-setup-btn" @click="setup">
              Set up Face ID / Touch ID
            </BaseButton>
            <button class="prompt-skip" @click="dismiss">
              Not now
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { shouldPromptEnrollment, registerPasskey } = usePasskey()
const { error: toastError, success: toastSuccess } = useToast()

const visible = ref(false)
const loading = ref(false)

// Show after a short delay so the dashboard has time to settle
onMounted(() => {
  if (shouldPromptEnrollment.value) {
    setTimeout(() => { visible.value = true }, 1200)
  }
})

async function setup(): Promise<void> {
  loading.value = true
  try {
    await registerPasskey()
    toastSuccess('Face ID / Touch ID set up — you\'re all set!')
    visible.value = false
  } catch {
    toastError('Setup failed. You can try again later in your profile.')
    visible.value = false
  } finally {
    loading.value = false
  }
}

function dismiss(): void {
  // Dismiss permanently on this device — don't re-prompt
  localStorage.setItem('passkey_enrolled', 'dismissed')
  visible.value = false
}
</script>

<style scoped>
.prompt-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);

  @media (min-width: 480px) {
    align-items: center;
  }
}

.prompt-card {
  background: var(--surface-card);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
}

.prompt-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--blue-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--blue-600);
  flex-shrink: 0;

  svg {
    width: 28px;
    height: 28px;
  }
}

.prompt-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.prompt-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.prompt-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.prompt-setup-btn {
  width: 100%;
  min-height: 52px;
  font-size: var(--text-base);
}

.prompt-skip {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  min-height: 44px;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  transition: color var(--transition-fast);

  &:hover {
    color: var(--text-secondary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

/* ── Transition ───────────────────────────────────────────────── */
.prompt-enter-active,
.prompt-leave-active {
  transition: opacity var(--transition-normal);

  .prompt-card {
    transition: transform var(--transition-normal);
  }
}

.prompt-enter-from,
.prompt-leave-to {
  opacity: 0;

  .prompt-card {
    transform: translateY(16px);
  }
}
</style>
