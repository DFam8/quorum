<template>
  <div class="profile-page">
    <div class="page-header">
      <h1 class="page-title">My profile</h1>
    </div>

    <div class="sections">
      <!-- Contact info -->
      <section class="card">
        <h2 class="section-title">Contact information</h2>
        <form class="form" @submit.prevent="saveProfile">
          <div class="form-row">
            <BaseInput
              v-model="form.firstName"
              label="First name"
              :error="errors.firstName"
              :disabled="saving"
              required
            />
            <BaseInput
              v-model="form.lastName"
              label="Last name"
              :error="errors.lastName"
              :disabled="saving"
              required
            />
          </div>
          <BaseInput
            v-model="form.email"
            label="Email address"
            type="email"
            hint="Your email is managed via your sign-in link and cannot be changed here."
            :disabled="true"
          />
          <BaseInput
            v-model="form.phone"
            label="Phone number"
            type="tel"
            placeholder="(555) 000-0000"
            hint="Used for SMS notifications if you opt in."
            :disabled="saving"
          />

          <p v-if="saveError" class="form-error" role="alert">{{ saveError }}</p>

          <div class="form-actions">
            <BaseButton type="submit" variant="primary" :loading="saving">Save changes</BaseButton>
          </div>
        </form>
      </section>

      <!-- Unit details -->
      <section class="card">
        <h2 class="section-title">Your unit</h2>
        <div v-if="user?.household?.unit" class="unit-details">
          <div class="detail-row">
            <span class="detail-label">Address / unit</span>
            <span class="detail-value">{{ unitDisplay }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">{{ typeLabel }}</span>
          </div>
          <div v-if="user.household.unit.building && user.household.unit.unitType !== 'sfh'" class="detail-row">
            <span class="detail-label">Building</span>
            <span class="detail-value">{{ user.household.unit.building }}</span>
          </div>
          <div v-if="user.residentType" class="detail-row">
            <span class="detail-label">Resident type</span>
            <span class="detail-value">{{ user.residentType === 'owner' ? 'Owner' : 'Renter' }}</span>
          </div>
        </div>
        <p v-else class="no-unit">No unit assigned. Contact an administrator.</p>
      </section>

      <!-- Sign-in & security -->
      <section class="card">
        <h2 class="section-title">Sign-in &amp; security</h2>
        <p class="section-desc">
          Set up Face ID or your fingerprint to sign in instantly — no email link needed.
        </p>

        <div v-if="passkeySupported === false" class="passkey-unsupported">
          Your device doesn't support biometric sign-in.
        </div>

        <template v-else>
          <!-- Enrolled passkeys -->
          <div v-if="passkeys.length" class="passkey-list">
            <div v-for="pk in passkeys" :key="pk.id" class="passkey-row">
              <div class="passkey-info">
                <span class="passkey-name">
                  {{ pk.deviceType === 'multiDevice' ? 'Synced passkey (e.g. iCloud Keychain)' : 'This device' }}
                </span>
                <span class="passkey-meta">
                  Added {{ formatDate(pk.createdAt) }}
                  <template v-if="pk.lastUsedAt"> · Last used {{ formatDate(pk.lastUsedAt) }}</template>
                </span>
              </div>
              <button
                class="passkey-remove"
                :disabled="removingId === pk.id"
                @click="removePasskey(pk.id)"
              >
                {{ removingId === pk.id ? 'Removing…' : 'Remove' }}
              </button>
            </div>
          </div>

          <!-- Add passkey -->
          <div v-if="passkeySupported" class="passkey-add">
            <BaseButton
              variant="secondary"
              :loading="enrolling"
              @click="enroll"
            >
              {{ passkeys.length ? 'Add another device' : 'Set up Face ID / Touch ID' }}
            </BaseButton>
          </div>
        </template>
      </section>

      <!-- Connected providers -->
      <section class="card">
        <h2 class="section-title">Connected accounts</h2>
        <p class="section-desc">
          Sign-in methods linked to your account. You must keep at least one.
        </p>
        <div class="provider-list">
          <div v-for="identity in identities" :key="identity.id" class="provider-row">
            <div class="provider-info">
              <FaIcon :icon="providerIcon(identity.provider)" class="provider-icon" aria-hidden="true" />
              <div>
                <p class="provider-name">{{ providerLabel(identity.provider) }}</p>
                <p class="provider-meta">Connected {{ formatDate(identity.createdAt) }}</p>
              </div>
            </div>
            <button
              v-if="identities.length > 1"
              class="provider-remove"
              :disabled="unlinkingId === identity.id"
              @click="unlinkIdentity(identity.id)"
            >
              {{ unlinkingId === identity.id ? 'Removing…' : 'Remove' }}
            </button>
          </div>
          <div v-if="!identities.length" class="provider-empty">
            No linked accounts found.
          </div>
        </div>
        <div class="provider-add-row">
          <BaseButton variant="secondary" size="sm" @click="linkGoogle">
            <FaIcon :icon="['fab', 'google']" /> Link Google account
          </BaseButton>
        </div>
      </section>

      <!-- Directory preference -->
      <section class="card">
        <h2 class="section-title">Directory listing</h2>
        <p class="section-desc">
          By default, your name appears in the resident directory. You can opt out at any time.
        </p>
        <label class="toggle-row">
          <span class="toggle-label">Remove me from the resident directory</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :aria-checked="form.directoryOptOut"
            :class="{ 'toggle--on': form.directoryOptOut }"
            :disabled="savingPrefs"
            @click="toggleOptOut"
          />
        </label>
        <p v-if="prefsError" class="form-error" role="alert">{{ prefsError }}</p>
      </section>

      <!-- Messaging preference -->
      <section class="card">
        <h2 class="section-title">Direct messages</h2>
        <p class="section-desc">
          Control whether other residents can message you directly. Board members can always contact you regardless of this setting.
        </p>
        <label class="toggle-row">
          <span class="toggle-label">Allow direct messages from other residents</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :aria-checked="form.allowDirectMessages"
            :class="{ 'toggle--on': form.allowDirectMessages }"
            :disabled="savingPrefs"
            @click="toggleDirectMessages"
          />
        </label>
      </section>

      <!-- Bottom nav customisation (mobile-relevant) -->
      <section class="card">
        <h2 class="section-title">Mobile navigation</h2>
        <p class="section-desc">
          Choose the three shortcuts that appear in your mobile nav bar. "More" is always the fourth.
        </p>
        <div class="nav-picker">
          <button
            v-for="item in availableItems"
            :key="item.path"
            type="button"
            class="nav-pick-btn"
            :class="{
              'nav-pick-btn--selected': selectedNav.includes(item.path),
              'nav-pick-btn--disabled': !selectedNav.includes(item.path) && selectedNav.length >= 3,
            }"
            :disabled="savingNav || (!selectedNav.includes(item.path) && selectedNav.length >= 3)"
            @click="toggleNavItem(item.path)"
          >
            <FaIcon :icon="['fajr', item.icon]" class="pick-icon" aria-hidden="true" />
            <span class="pick-label">{{ item.label }}</span>
            <span v-if="selectedNav.includes(item.path)" class="pick-check" aria-hidden="true">
              <FaIcon :icon="['fajr', 'check']" />
            </span>
          </button>
        </div>
        <p class="nav-pick-hint">{{ selectedNav.length }}/3 selected</p>
      </section>

      <!-- Appearance -->
      <section class="card">
        <h2 class="section-title">Appearance</h2>
        <p class="section-desc">Choose how Quorum looks for you.</p>
        <div class="theme-options">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="theme-btn"
            :class="{ 'theme-btn--active': currentTheme === opt.value }"
            @click="setTheme(opt.value as 'light' | 'dark' | 'system')"
          >
            <FaIcon :icon="['fajr', opt.icon]" class="theme-icon" aria-hidden="true" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </section>

      <!-- Notification preferences -->
      <section class="card">
        <h2 class="section-title">Email notifications</h2>
        <p class="section-desc">
          Choose which emails you receive from Quorum. You'll always receive invite and security emails.
        </p>
        <div class="toggle-list">
          <label class="toggle-row">
            <div class="toggle-text">
              <span class="toggle-label">Announcements</span>
              <span class="toggle-hint">New posts from your board</span>
            </div>
            <button
              type="button"
              role="switch"
              class="toggle"
              :aria-checked="notifSettings.emailAnnouncements"
              :class="{ 'toggle--on': notifSettings.emailAnnouncements }"
              :disabled="savingNotif"
              @click="toggleNotif('emailAnnouncements')"
            />
          </label>
          <label class="toggle-row">
            <div class="toggle-text">
              <span class="toggle-label">Meetings</span>
              <span class="toggle-hint">Agenda published, minutes published</span>
            </div>
            <button
              type="button"
              role="switch"
              class="toggle"
              :aria-checked="notifSettings.emailMeetings"
              :class="{ 'toggle--on': notifSettings.emailMeetings }"
              :disabled="savingNotif"
              @click="toggleNotif('emailMeetings')"
            />
          </label>
          <label class="toggle-row">
            <div class="toggle-text">
              <span class="toggle-label">Messages</span>
              <span class="toggle-hint">New direct messages from the board</span>
            </div>
            <button
              type="button"
              role="switch"
              class="toggle"
              :aria-checked="notifSettings.emailMessages"
              :class="{ 'toggle--on': notifSettings.emailMessages }"
              :disabled="savingNotif"
              @click="toggleNotif('emailMessages')"
            />
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_BOTTOM_NAV } from '~/composables/useNavItems'

definePageMeta({ middleware: 'auth' })

// ── Theme ──────────────────────────────────────────────────────────────────
const { theme: currentTheme, setTheme } = useTheme()

const themeOptions = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark',  label: 'Dark',  icon: 'moon' },
  { value: 'system', label: 'System', icon: 'display' },
]

const api = useApi()
const { user, fetchProfile } = useAuth()
const { success: toastSuccess, error: toastError } = useToast()
const { registerPasskey, isAvailable: passkeySupported } = usePasskey()
const { availableItems } = useNavItems()

type PasskeyEntry = { id: string; deviceType: string; backedUp: boolean; createdAt: string; lastUsedAt: string | null }
const passkeys = ref<PasskeyEntry[]>([])
const enrolling = ref(false)
const removingId = ref<string | null>(null)

async function loadPasskeys(): Promise<void> {
  try {
    passkeys.value = await $fetch<PasskeyEntry[]>('/api/passkey/list')
  } catch { /* non-critical */ }
}

async function enroll(): Promise<void> {
  enrolling.value = true
  try {
    await registerPasskey()
    toastSuccess('Face ID / Touch ID set up successfully.')
    await loadPasskeys()
  } catch {
    toastError('Setup failed. Please try again.')
  } finally {
    enrolling.value = false
  }
}

async function removePasskey(id: string): Promise<void> {
  removingId.value = id
  try {
    await $fetch(`/api/passkey/${id}`, { method: 'DELETE' })
    passkeys.value = passkeys.value.filter(p => p.id !== id)
    if (!passkeys.value.length) localStorage.removeItem('passkey_enrolled')
    toastSuccess('Passkey removed.')
  } catch {
    toastError('Failed to remove. Please try again.')
  } finally {
    removingId.value = null
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Connected providers ────────────────────────────────────────────────────
type Identity = { id: string; provider: string; createdAt: string }
const identities = ref<Identity[]>([])
const unlinkingId = ref<string | null>(null)

async function loadIdentities(): Promise<void> {
  try {
    identities.value = await $fetch<Identity[]>('/api/auth/identities')
  } catch { /* non-critical */ }
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    google: 'Google',
    email: 'Email (magic link)',
    github: 'GitHub',
  }
  return labels[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

function providerIcon(provider: string): [string, string] {
  if (provider === 'google') return ['fab', 'google']
  if (provider === 'github') return ['fab', 'github']
  return ['fajr', 'envelope']
}

async function unlinkIdentity(identityId: string): Promise<void> {
  unlinkingId.value = identityId
  try {
    await $fetch('/api/auth/unlink', { method: 'POST', body: { identityId } })
    identities.value = identities.value.filter(i => i.id !== identityId)
    toastSuccess('Sign-in method removed.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to remove.')
  } finally {
    unlinkingId.value = null
  }
}

const supabase = useSupabaseClient()

async function linkGoogle(): Promise<void> {
  await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

onMounted(() => {
  loadPasskeys()
  loadIdentities()
})

const saving = ref(false)
const savingPrefs = ref(false)
const savingNotif = ref(false)
const saveError = ref('')
const prefsError = ref('')
const errors = reactive({ firstName: '', lastName: '' })

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  directoryOptOut: false,
  allowDirectMessages: true,
})

type NotifKey = 'emailAnnouncements' | 'emailMeetings' | 'emailMessages'

const notifSettings = reactive<Record<NotifKey, boolean>>({
  emailAnnouncements: true,
  emailMeetings: true,
  emailMessages: true,
})

const savingNav = ref(false)
const selectedNav = ref<string[]>([...DEFAULT_BOTTOM_NAV])

watch(user, (u) => {
  if (!u) return
  form.firstName = u.firstName
  form.lastName = u.lastName
  form.email = u.email
  form.phone = u.phone ?? ''
  form.directoryOptOut = u.directoryOptOut
  form.allowDirectMessages = u.allowDirectMessages ?? true
  const s = u.notificationSettings ?? {}
  notifSettings.emailAnnouncements = s.emailAnnouncements !== false
  notifSettings.emailMeetings = s.emailMeetings !== false
  notifSettings.emailMessages = s.emailMessages !== false
  if (s.bottomNav && s.bottomNav.length === 3) {
    selectedNav.value = [...s.bottomNav]
  } else {
    selectedNav.value = [...DEFAULT_BOTTOM_NAV]
  }
}, { immediate: true })

const unitDisplay = computed(() => {
  const u = user.value?.household?.unit
  if (!u) return '—'
  return u.unitType === 'sfh' ? u.unitNumber : `Unit ${u.unitNumber}`
})

const typeLabel = computed(() => {
  const t = user.value?.household?.unit?.unitType
  return t === 'sfh' ? 'Single Family Home' : t === 'condo' ? 'Condo' : t === 'apartment' ? 'Apartment' : '—'
})

async function saveProfile(): Promise<void> {
  errors.firstName = ''
  errors.lastName = ''
  saveError.value = ''

  if (!form.firstName.trim()) { errors.firstName = 'Required.'; return }
  if (!form.lastName.trim()) { errors.lastName = 'Required.'; return }

  saving.value = true
  try {
    await api.residents.update.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
    })
    await fetchProfile()
    toastSuccess('Profile saved.')
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save.'
  } finally {
    saving.value = false
  }
}

async function toggleOptOut(): Promise<void> {
  prefsError.value = ''
  savingPrefs.value = true
  const next = !form.directoryOptOut
  try {
    await api.residents.update.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      directoryOptOut: next,
    })
    form.directoryOptOut = next
    await fetchProfile()
    toastSuccess(next ? 'Removed from directory.' : 'Added back to directory.')
  } catch (err) {
    prefsError.value = err instanceof Error ? err.message : 'Failed to update preference.'
  } finally {
    savingPrefs.value = false
  }
}

async function toggleDirectMessages(): Promise<void> {
  savingPrefs.value = true
  const next = !form.allowDirectMessages
  try {
    await api.residents.update.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      allowDirectMessages: next,
    })
    form.allowDirectMessages = next
    await fetchProfile()
    toastSuccess(next ? 'Direct messages enabled.' : 'Direct messages from residents disabled.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to update preference.')
  } finally {
    savingPrefs.value = false
  }
}

async function toggleNavItem(path: string): Promise<void> {
  const idx = selectedNav.value.indexOf(path)
  if (idx !== -1) {
    if (selectedNav.value.length <= 1) return // always keep at least 1
    selectedNav.value = selectedNav.value.filter(p => p !== path)
  } else {
    if (selectedNav.value.length >= 3) return
    selectedNav.value = [...selectedNav.value, path]
  }
  if (selectedNav.value.length !== 3) return // only save when a full set is chosen

  savingNav.value = true
  try {
    await api.residents.update.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      notificationSettings: { ...notifSettings, bottomNav: selectedNav.value },
    })
    await fetchProfile()
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to save.')
  } finally {
    savingNav.value = false
  }
}

async function toggleNotif(key: NotifKey): Promise<void> {
  savingNotif.value = true
  const next = !notifSettings[key]
  try {
    await api.residents.update.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      notificationSettings: { ...notifSettings, [key]: next },
    })
    notifSettings[key] = next
    await fetchProfile()
    toastSuccess('Notification preference saved.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to update preference.')
  } finally {
    savingNotif.value = false
  }
}
</script>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 640px;
}

.page-header {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.section-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: calc(var(--space-1) * -1);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);

  @media (max-width: 36rem) {
    grid-template-columns: 1fr;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.unit-details {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }
}

.detail-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.detail-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

/* ── Passkey section ──────────────────────────────────────────── */
.passkey-unsupported {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.passkey-list {
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.passkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }
}

.passkey-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.passkey-name {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.passkey-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.passkey-remove {
  font-size: var(--text-sm);
  color: var(--danger-text);
  white-space: nowrap;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 36px;
  transition: background var(--transition-fast);
  flex-shrink: 0;

  &:hover:not(:disabled) { background: var(--danger-bg); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.passkey-add {
  padding-top: var(--space-1);
}

.no-unit {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;

  .toggle-row {
    border-bottom: 0.5px solid var(--border-subtle);
    padding: var(--space-3) var(--space-4);
    border-radius: 0;

    &:last-child { border-bottom: none; }
  }
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  cursor: pointer;
}

.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.toggle-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  flex-shrink: 0;
  transition: background var(--transition-fast);
  cursor: pointer;
  min-width: 44px;
  min-height: 26px;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--surface-card);
    transition: transform var(--transition-fast);
  }

  &.toggle--on {
    background: var(--blue-400);

    &::after { transform: translateX(18px); }
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* ── Appearance ───────────────────────────────────────────────── */
.theme-options {
  display: flex;
  gap: var(--space-2);
}

.theme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-default);
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);

  &:hover:not(.theme-btn--active) {
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  &--active {
    border-color: var(--blue-400);
    background: var(--blue-50);
    color: var(--text-primary);
  }

  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.theme-icon { font-size: 18px; }

/* ── Connected providers ──────────────────────────────────────── */
.provider-list {
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.provider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }
}

.provider-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.provider-icon {
  font-size: 18px;
  color: var(--text-secondary);
  width: 20px;
  flex-shrink: 0;
}

.provider-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.provider-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.provider-empty {
  padding: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.provider-remove {
  font-size: var(--text-sm);
  color: var(--danger-text);
  white-space: nowrap;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 36px;
  transition: background var(--transition-fast);
  flex-shrink: 0;

  &:hover:not(:disabled) { background: var(--danger-bg); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.provider-add-row {
  padding-top: var(--space-1);
}

/* ── Mobile nav picker ────────────────────────────────────────── */
.nav-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);

  @media (min-width: 30rem) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.nav-pick-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-default);
  background: var(--surface-card);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  min-height: 72px;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
  cursor: pointer;

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  &.nav-pick-btn--selected {
    border-color: var(--blue-400);
    background: var(--blue-50, color-mix(in srgb, var(--blue-400) 10%, var(--surface-card)));
    color: var(--text-primary);
  }

  &.nav-pick-btn--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.pick-icon {
  font-size: 18px;
  color: inherit;
}

.pick-label {
  font-size: var(--text-xs);
  color: inherit;
}

.pick-check {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  color: var(--blue-400);
}

.nav-pick-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: calc(var(--space-1) * -1);
}
</style>
