<template>
  <div class="callback-page">
    <!-- ── Not invited ─────────────────────────────────────────── -->
    <div v-if="error === 'not_invited'" class="callback-error">
      <div class="error-icon" aria-hidden="true">🏠</div>
      <h1 class="callback-title">Account not found</h1>
      <p class="callback-message">
        This email address isn't linked to a resident record.
        Contact your community board to receive an invite.
      </p>
      <NuxtLink to="/login" class="callback-link">Back to sign-in</NuxtLink>
    </div>

    <!-- ── Expired link ────────────────────────────────────────── -->
    <div v-else-if="error === 'expired'" class="callback-error">
      <div class="error-icon" aria-hidden="true">⏱️</div>
      <h1 class="callback-title">That link has expired</h1>
      <p class="callback-message">
        Sign-in links expire after 24 hours. Enter your email below and we'll send you a fresh one.
      </p>
      <form class="expired-form" @submit.prevent="resend">
        <BaseInput
          v-model="resendEmail"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          :error="resendError"
          :disabled="resendLoading || resendSent"
          autocomplete="email"
          required
        />
        <BaseButton
          v-if="!resendSent"
          type="submit"
          variant="primary"
          :loading="resendLoading"
          class="resend-btn"
        >
          Send a new link
        </BaseButton>
        <p v-else class="resend-sent">
          Link sent — check your email.
        </p>
      </form>
    </div>

    <!-- ── Generic error ──────────────────────────────────────── -->
    <div v-else-if="error" class="callback-error">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h1 class="callback-title">Sign-in failed</h1>
      <p class="callback-message">{{ error }}</p>
      <NuxtLink to="/login" class="callback-link">Try again</NuxtLink>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-else class="callback-loading">
      <div class="spinner" aria-label="Completing sign-in…" />
      <p class="callback-message">Signing you in…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const router = useRouter()
const supabase = useSupabaseClient()
const supabaseUser = useSupabaseUser()
const { fetchProfile, needsOnboarding, user } = useAuth()

const error = ref<string | null>(null)
const resendEmail = ref('')
const resendError = ref('')
const resendLoading = ref(false)
const resendSent = ref(false)

watchEffect(async () => {
  if (!supabaseUser.value) return

  try {
    await fetchProfile()

    if (!user.value) {
      error.value = 'not_invited'
      return
    }

    if (needsOnboarding.value) {
      await router.replace('/onboarding')
    } else {
      await router.replace('/dashboard')
    }
  } catch {
    error.value = 'Something went wrong loading your profile. Please try again.'
  }
})

onMounted(() => {
  // Detect Supabase error codes in the URL hash (implicit flow)
  const hash = window.location.hash
  if (hash.includes('error=')) {
    const params = new URLSearchParams(hash.slice(1))
    const code = params.get('error_code')
    const desc = params.get('error_description') ?? ''

    if (code === 'otp_expired' || desc.toLowerCase().includes('expired')) {
      error.value = 'expired'
    } else if (code === 'access_denied') {
      error.value = 'not_invited'
    } else {
      error.value = desc || 'Sign-in failed. Please try again.'
    }
    return
  }

  // Timeout fallback — if Supabase never resolves
  setTimeout(() => {
    if (!supabaseUser.value && !error.value) {
      error.value = 'expired'
    }
  }, 8000)
})

async function resend(): Promise<void> {
  resendError.value = ''

  if (!resendEmail.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.value)) {
    resendError.value = 'Please enter a valid email address.'
    return
  }

  resendLoading.value = true
  try {
    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email: resendEmail.value,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (supabaseError) throw supabaseError
    resendSent.value = true
  } catch {
    resendError.value = 'Failed to send — check your email address and try again.'
  } finally {
    resendLoading.value = false
  }
}
</script>

<style scoped>
.callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60dvh;
}

.callback-loading,
.callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
  max-width: 380px;
  width: 100%;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  line-height: 1;
}

.callback-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.callback-message {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.callback-link {
  font-size: var(--text-sm);
  color: var(--text-link);
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border-default);

  &:hover {
    background: var(--surface-raised);
    text-decoration: none;
  }

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }
}

/* ── Expired form ─────────────────────────────────────────────── */
.expired-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  text-align: left;
}

.resend-btn {
  width: 100%;
}

.resend-sent {
  font-size: var(--text-base);
  color: var(--success-text);
  text-align: center;
  background: var(--success-bg);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
}
</style>
