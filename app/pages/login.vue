<template>
  <div class="login-page">
    <!-- ── Sent state ──────────────────────────────────────────── -->
    <div v-if="sent" class="login-sent">
      <div class="sent-icon" aria-hidden="true">✉️</div>
      <h1 class="login-title">Check your email</h1>
      <p class="login-subtitle">
        We sent a sign-in link to <strong>{{ email }}</strong>.
        Click the link in that email to continue.
      </p>
      <p class="login-note">
        Didn't get it? Check your spam folder. The link expires in 24 hours.
      </p>
      <button class="login-resend" @click="sent = false">
        Try a different email
      </button>
    </div>

    <!-- ── Main login card ────────────────────────────────────── -->
    <div v-else class="login-card">
      <h1 class="login-title">Welcome back</h1>
      <p class="login-subtitle">Sign in to your community portal.</p>

      <!-- Passkey (shown only if available on this device) -->
      <div v-if="passkeyAvailable" class="passkey-group">
        <button
          type="button"
          class="passkey-btn"
          :disabled="passkeyLoading"
          @click="signInWithPasskey"
        >
          <span class="passkey-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C9.243 2 7 4.243 7 7s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z"/>
              <path d="M7 7a5 5 0 0 0 9.9-1"/>
              <path d="M2 21v-1a7 7 0 0 1 7-7h2"/>
              <path d="M16 19h6M19 16v6"/>
            </svg>
          </span>
          <span>{{ passkeyLoading ? 'Signing you in…' : 'Sign in with Face ID / Touch ID' }}</span>
        </button>

        <div class="divider"><span>or sign in another way</span></div>
      </div>

      <!-- Social login -->
      <div class="social-group">
        <button type="button" class="social-btn" :disabled="oauthLoading" @click="signInWith('google')">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button type="button" class="social-btn" :disabled="oauthLoading" @click="signInWith('apple')">
          <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.15.8 1.19-.24 2.33-.93 3.6-.84 1.53.12 2.68.72 3.44 1.84-3.16 1.89-2.42 6.07.81 7.23-.6 1.47-1.38 2.92-3 3.85zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      <div class="divider"><span>or sign in with email</span></div>

      <!-- Magic link -->
      <form class="login-form" @submit.prevent="requestMagicLink">
        <BaseInput
          v-model="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          :error="emailError"
          :disabled="loading"
          autocomplete="email webauthn"
          required
        />
        <BaseButton type="submit" variant="primary" :loading="loading" class="login-btn">
          Send sign-in link
        </BaseButton>
      </form>

      <!-- Facebook — tertiary -->
      <button type="button" class="facebook-btn" :disabled="oauthLoading" @click="signInWith('facebook')">
        <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.031 4.388 11.029 10.125 11.927V15.57H7.078v-3.497h3.047V9.443c0-3.02 1.791-4.688 4.532-4.688 1.313 0 2.686.235 2.686.235v2.965h-1.513c-1.491 0-1.956.928-1.956 1.88v2.238h3.328l-.532 3.497h-2.796v8.43C19.612 23.102 24 18.104 24 12.073z"/>
        </svg>
        Continue with Facebook
      </button>

      <p class="login-help">
        New to Quorum? You need an invite from your community board.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const { error: toastError } = useToast()
const { authenticateWithPasskey, isAvailable: passkeyAvailable } = usePasskey()

const email = ref('')
const emailError = ref('')
const loading = ref(false)
const oauthLoading = ref(false)
const passkeyLoading = ref(false)
const sent = ref(false)

type OAuthProvider = 'google' | 'apple' | 'facebook'

async function signInWith(provider: OAuthProvider): Promise<void> {
  oauthLoading.value = true
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  } catch (err) {
    const message = err instanceof Error ? err.message : `Failed to sign in with ${provider}.`
    toastError(message)
    oauthLoading.value = false
  }
}

async function signInWithPasskey(): Promise<void> {
  passkeyLoading.value = true
  try {
    await authenticateWithPasskey()
    // usePasskey handles session creation + redirect
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Face ID / Touch ID sign-in failed. Try another method.'
    toastError(message)
  } finally {
    passkeyLoading.value = false
  }
}

async function requestMagicLink(): Promise<void> {
  emailError.value = ''

  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailError.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
    sent.value = true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send sign-in link.'
    toastError(message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  padding: var(--space-4) 0;
}

.login-card,
.login-sent {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.login-sent {
  align-items: center;
  text-align: center;
}

.sent-icon {
  font-size: 48px;
  line-height: 1;
}

.login-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}

.login-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  margin-top: calc(-1 * var(--space-2));
}

/* ── Passkey ──────────────────────────────────────────────────── */
.passkey-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.passkey-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-3) var(--space-4);
  background: var(--gradient-brand-subtle);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-inverse);
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:hover:not(:disabled) {
    opacity: 0.92;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

.passkey-icon {
  display: flex;
  align-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;

  svg {
    width: 22px;
    height: 22px;
  }
}

/* ── Social buttons ───────────────────────────────────────────── */
.social-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.social-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 48px;
  padding: var(--space-2) var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--surface-raised);
    border-color: var(--border-strong);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

.social-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* ── Divider ──────────────────────────────────────────────────── */
.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--text-sm);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-default);
  }
}

/* ── Magic link form ──────────────────────────────────────────── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.login-btn {
  width: 100%;
  margin-top: var(--space-1);
}

/* ── Facebook (tertiary) ──────────────────────────────────────── */
.facebook-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--surface-raised);
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

/* ── Help / notes ─────────────────────────────────────────────── */
.login-help {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
}

.login-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.login-resend {
  font-size: var(--text-sm);
  color: var(--text-link);
  text-decoration: underline;
  cursor: pointer;
  min-height: 44px;
  padding: var(--space-2);

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
    border-radius: var(--radius-sm);
  }
}
</style>
