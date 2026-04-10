<template>
  <div class="setup-page">

    <div v-if="checking" class="setup-loading">
      <div class="spinner" aria-label="Checking installation status" />
    </div>

    <div v-else-if="alreadyInstalled" class="setup-card">
      <div class="setup-icon setup-icon-locked" aria-hidden="true">🔒</div>
      <h1 class="setup-title">Already set up</h1>
      <p class="setup-subtitle">This community has already been configured. Please sign in.</p>
      <NuxtLink to="/login" class="setup-link-btn">Go to sign in</NuxtLink>
    </div>

    <div v-else-if="done" class="setup-card">
      <div class="setup-icon" aria-hidden="true">✉️</div>
      <h1 class="setup-title">You're all set!</h1>
      <p class="setup-subtitle">
        A sign-in link has been sent to <strong>{{ submittedEmail }}</strong>.
        Click it to log in and finish setting up your community.
      </p>
      <div class="setup-note">
        <p>After signing in you'll be taken through the profile setup. Once done, you can:</p>
        <ul class="setup-checklist">
          <li>Add units and invite residents from the Admin panel</li>
          <li>Upload your governing documents</li>
          <li>Schedule your first meeting</li>
        </ul>
      </div>
      <p class="setup-env-hint">
        Also copy your community ID from the server logs and set
        <code>COMMUNITY_ID=…</code> in your <code>.env</code> file.
      </p>
    </div>

    <div v-else class="setup-card">
      <div class="setup-header">
        <div class="logo-mark" aria-hidden="true" />
        <h1 class="setup-title">Set up Quorum</h1>
        <p class="setup-subtitle">Create your community and the first super admin account. This page is only accessible on a fresh install.</p>
      </div>

      <form class="setup-form" @submit.prevent="submit">
        <fieldset class="setup-fieldset">
          <legend class="setup-legend">Community</legend>
          <BaseInput
            v-model="form.communityName"
            label="Community name"
            placeholder="Maplewood HOA"
            :error="errors.communityName"
            :disabled="submitting"
            required
          />
          <BaseInput
            v-model="form.communityAddress"
            label="Address"
            placeholder="123 Main St, Springfield, IL"
            hint="Optional — displayed in the app header."
            :disabled="submitting"
          />
          <div class="timezone-field">
            <label class="field-label" for="timezone">Timezone</label>
            <select id="timezone" v-model="form.timezone" class="field-select" :disabled="submitting">
              <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
          </div>
        </fieldset>

        <fieldset class="setup-fieldset">
          <legend class="setup-legend">Super admin (you)</legend>
          <div class="name-row">
            <BaseInput
              v-model="form.firstName"
              label="First name"
              placeholder="Jane"
              :error="errors.firstName"
              :disabled="submitting"
              required
            />
            <BaseInput
              v-model="form.lastName"
              label="Last name"
              placeholder="Smith"
              :error="errors.lastName"
              :disabled="submitting"
              required
            />
          </div>
          <BaseInput
            v-model="form.email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            hint="Your sign-in link will be sent here."
            :error="errors.email"
            :disabled="submitting"
            autocomplete="email"
            required
          />
        </fieldset>

        <p v-if="serverError" class="setup-error" role="alert">{{ serverError }}</p>

        <BaseButton type="submit" variant="primary" :loading="submitting" class="setup-btn">
          Create community and send sign-in link
        </BaseButton>
      </form>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const api = useApi()
const supabase = useSupabaseClient()

const checking = ref(true)
const alreadyInstalled = ref(false)
const submitting = ref(false)
const done = ref(false)
const submittedEmail = ref('')
const serverError = ref('')

const form = reactive({
  communityName: '',
  communityAddress: '',
  timezone: 'America/Chicago',
  firstName: '',
  lastName: '',
  email: '',
})

const errors = reactive({
  communityName: '',
  firstName: '',
  lastName: '',
  email: '',
})

const timezones = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix',     label: 'Arizona (MT, no DST)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',        label: 'Central Europe (CET)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST)' },
]

onMounted(async () => {
  try {
    alreadyInstalled.value = await api.setup.isInstalled.query()
  } catch {
    // If the query fails, assume not installed and let submit surface any DB error
  } finally {
    checking.value = false
  }
})

function validate(): boolean {
  errors.communityName = ''
  errors.firstName = ''
  errors.lastName = ''
  errors.email = ''

  let valid = true

  if (!form.communityName.trim()) {
    errors.communityName = 'Community name is required.'
    valid = false
  }
  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required.'
    valid = false
  }
  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required.'
    valid = false
  }
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'A valid email address is required.'
    valid = false
  }

  return valid
}

async function submit(): Promise<void> {
  serverError.value = ''
  if (!validate()) return

  submitting.value = true
  try {
    const result = await api.setup.initialize.mutate({
      communityName: form.communityName.trim(),
      communityAddress: form.communityAddress.trim() || undefined,
      timezone: form.timezone,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
    })

    const { error } = await supabase.auth.signInWithOtp({
      email: result.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error

    submittedEmail.value = result.email
    done.value = true
  } catch (err) {
    serverError.value = err instanceof Error ? err.message : 'Setup failed. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.setup-page {
  padding: var(--space-4) 0;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.setup-loading {
  display: flex;
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

.setup-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  align-items: center;
  text-align: center;
}

.setup-card:has(.setup-form) {
  align-items: stretch;
  text-align: left;
}

.setup-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}

.logo-mark {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--gradient-brand);
}

.setup-icon {
  font-size: 48px;
  line-height: 1;
}

.setup-icon-locked {
  font-size: 40px;
}

.setup-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.setup-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  max-width: 380px;
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.setup-fieldset {
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.setup-legend {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  padding: 0 var(--space-2);
}

.name-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.timezone-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.field-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  min-height: 44px;
  cursor: pointer;
  transition: border-color var(--transition-fast);

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.setup-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 0.5px solid var(--danger-mid);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.setup-btn {
  width: 100%;
}

.setup-note {
  text-align: left;
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--line-height-normal);

  p {
    margin-bottom: var(--space-2);
  }
}

.setup-checklist {
  list-style: disc;
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setup-env-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  line-height: var(--line-height-normal);

  code {
    font-family: monospace;
    font-size: var(--text-xs);
    background: var(--border-default);
    padding: 1px 4px;
    border-radius: var(--radius-sm);
  }
}

.setup-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-5);
  background: var(--gradient-brand-subtle);
  color: var(--text-inverse);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-decoration: none;

  &:hover {
    opacity: 0.9;
    text-decoration: none;
  }

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }
}
</style>
