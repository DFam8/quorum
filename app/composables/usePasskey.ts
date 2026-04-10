import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser'

// Checked once per page load; null = unknown, true/false = resolved
const isAvailable = ref<boolean | null>(null)

export function usePasskey() {
  const supabase = useSupabaseClient()

  // ── Availability detection ─────────────────────────────────────────────

  onMounted(async () => {
    if (isAvailable.value !== null) return // already resolved
    if (!browserSupportsWebAuthn()) {
      isAvailable.value = false
      return
    }
    // Check if this device has a platform authenticator (Face ID, Touch ID, Windows Hello)
    // AND if conditional mediation is available (passkeys exist for this origin on this device)
    const [hasPlatformAuth, hasConditionalUI] = await Promise.all([
      platformAuthenticatorIsAvailable(),
      PublicKeyCredential.isConditionalMediationAvailable?.() ?? Promise.resolve(false),
    ])
    isAvailable.value = hasPlatformAuth && hasConditionalUI
  })

  // ── Registration (post-login, prompted once) ────────────────────────────

  async function registerPasskey(): Promise<void> {
    // Step 1: get options from server (requires active Supabase session)
    const optionsRes = await $fetch('/api/passkey/register-options', { method: 'POST' })

    // Step 2: browser shows Face ID / Touch ID prompt
    let attestation
    try {
      attestation = await startRegistration({ optionsJSON: optionsRes as Parameters<typeof startRegistration>[0]['optionsJSON'] })
    } catch (err) {
      // User cancelled or browser rejected — not an error we surface as failure
      if (err instanceof Error && err.name === 'NotAllowedError') return
      throw err
    }

    // Step 3: verify on server and store credential
    await $fetch('/api/passkey/register', { method: 'POST', body: attestation })

    // Mark enrolled so we don't prompt again on this device
    localStorage.setItem('passkey_enrolled', '1')
  }

  // ── Authentication (login page) ────────────────────────────────────────

  async function authenticateWithPasskey(): Promise<void> {
    // Step 1: get a challenge from the server
    const optionsRes = await $fetch('/api/passkey/authenticate-options', { method: 'POST' })

    // Step 2: browser shows Face ID / Touch ID prompt
    let assertion
    try {
      assertion = await startAuthentication({ optionsJSON: optionsRes as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') return
      throw err
    }

    // Step 3: server verifies assertion and returns a one-time OTP
    const { email, token } = await $fetch<{ email: string; token: string }>(
      '/api/passkey/authenticate',
      { method: 'POST', body: assertion },
    )

    // Step 4: exchange OTP for a Supabase session (no email sent)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw new Error(error.message)

    // Hard reload so the server session cookie is written before the protected page loads
    window.location.href = '/feed'
  }

  // ── Enrollment nudge helpers ────────────────────────────────────────────

  /** True if this device has already enrolled a passkey (localStorage flag). */
  const isEnrolled = computed(() =>
    import.meta.client ? localStorage.getItem('passkey_enrolled') === '1' : false,
  )

  /** True if we should prompt the user to enroll (device supports it, not yet enrolled). */
  const shouldPromptEnrollment = computed(() =>
    isAvailable.value === true && !isEnrolled.value,
  )

  return {
    isAvailable: readonly(isAvailable),
    isEnrolled,
    shouldPromptEnrollment,
    registerPasskey,
    authenticateWithPasskey,
  }
}
