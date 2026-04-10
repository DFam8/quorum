<template>
  <div class="invite-page">
    <div v-if="status === 'loading'" class="invite-loading">
      <div class="spinner" aria-label="Loading invite details" />
    </div>

    <div v-else-if="status === 'error'" class="invite-card">
      <div class="invite-status-icon invite-status-error" aria-hidden="true">✕</div>
      <h1 class="invite-title">Invite not found</h1>
      <p class="invite-subtitle">{{ errorMessage }}</p>
      <p class="invite-help">Contact your community board if you believe this is a mistake.</p>
    </div>

    <div v-else-if="status === 'sent'" class="invite-card">
      <div class="sent-icon" aria-hidden="true">✉️</div>
      <h1 class="invite-title">Check your email</h1>
      <p class="invite-subtitle">
        We sent a sign-in link to <strong>{{ inviteData?.email }}</strong>.
        Click the link in that email to set up your account.
      </p>
      <p class="invite-note">
        The link expires in 24 hours. Check your spam folder if you don't see it.
      </p>
    </div>

    <div v-else-if="status === 'ready' && inviteData" class="invite-card">
      <div class="invite-community">
        <div class="community-icon" aria-hidden="true">🏠</div>
        <p class="community-label">You've been invited to join</p>
        <h1 class="invite-title">{{ inviteData.communityName }}</h1>
      </div>

      <div class="invite-unit-badge">
        <span class="unit-label">Unit</span>
        <span class="unit-number">{{ inviteData.unitNumber }}</span>
        <span v-if="inviteData.building" class="unit-building">· {{ inviteData.building }}</span>
        <span class="unit-type">{{ unitTypeLabel(inviteData.unitType) }}</span>
      </div>

      <p class="invite-subtitle">
        Your access link will be sent to <strong>{{ inviteData.email }}</strong>.
      </p>

      <BaseButton
        variant="primary"
        :loading="sending"
        class="invite-btn"
        @click="sendMagicLink"
      >
        Get my access link
      </BaseButton>

      <p class="invite-help">
        Wrong email address? Contact your community board.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const api = useApi()
const supabase = useSupabaseClient()
const { error: toastError } = useToast()

type InviteData = {
  email: string
  unitNumber: string
  unitType: string
  building: string | null
  communityName: string
}

type Status = 'loading' | 'ready' | 'sent' | 'error'

const status = ref<Status>('loading')
const inviteData = ref<InviteData | null>(null)
const errorMessage = ref('')
const sending = ref(false)

const token = computed(() => route.query.token as string | undefined)

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = 'This invite link is missing a token.'
    status.value = 'error'
    return
  }

  try {
    const result = await api.residents.validateInvite.query({ token: token.value })
    inviteData.value = result
    status.value = 'ready'
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invite not found or expired.'
    errorMessage.value = message
    status.value = 'error'
  }
})

async function sendMagicLink(): Promise<void> {
  if (!inviteData.value) return

  sending.value = true
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteData.value.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error
    status.value = 'sent'
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send sign-in link.'
    toastError(message)
  } finally {
    sending.value = false
  }
}

function unitTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    condo: 'Condo',
    apartment: 'Apartment',
    sfh: 'Single Family Home',
  }
  return labels[type] ?? type
}
</script>

<style scoped>
.invite-page {
  padding: var(--space-4) 0;
  min-height: 60dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.invite-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.invite-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}

.invite-community {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.community-icon {
  font-size: 48px;
  line-height: 1;
}

.sent-icon {
  font-size: 48px;
  line-height: 1;
}

.invite-status-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.invite-status-error {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.community-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.invite-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}

.invite-unit-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--info-bg);
  color: var(--info-text);
  border: 0.5px solid var(--info-mid);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-4);
  font-size: var(--text-sm);

  .unit-label {
    font-weight: var(--font-medium);
    opacity: 0.7;
  }

  .unit-number {
    font-weight: var(--font-medium);
    font-size: var(--text-base);
  }

  .unit-building,
  .unit-type {
    opacity: 0.7;
  }
}

.invite-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  max-width: 340px;
}

.invite-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.invite-btn {
  width: 100%;
  max-width: 280px;
}

.invite-help {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
