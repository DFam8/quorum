<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Community configuration — super admin only</p>
    </div>

    <div v-if="loading" class="settings-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <template v-else>
      <section class="settings-section">
        <div class="section-header">
          <h2 class="section-title">Community</h2>
          <p class="section-desc">Name, contact details, and access limits.</p>
        </div>

        <form class="settings-form" @submit.prevent="save">
          <div class="fields">
            <BaseInput
              v-model="form.name"
              label="Community name"
              placeholder="Maplewood HOA"
              :error="errors.name"
              :disabled="saving"
              required
            />
            <BaseInput
              v-model="form.address"
              label="Address"
              placeholder="123 Main Street, Springfield, IL 62701"
              :disabled="saving"
            />
            <div class="field">
              <label class="field-label" for="tz-select">Timezone</label>
              <select id="tz-select" v-model="form.timezone" class="field-select" :disabled="saving">
                <optgroup label="US &amp; Canada">
                  <option value="America/New_York">Eastern — New York</option>
                  <option value="America/Chicago">Central — Chicago</option>
                  <option value="America/Denver">Mountain — Denver</option>
                  <option value="America/Phoenix">Mountain (no DST) — Phoenix</option>
                  <option value="America/Los_Angeles">Pacific — Los Angeles</option>
                  <option value="America/Anchorage">Alaska — Anchorage</option>
                  <option value="Pacific/Honolulu">Hawaii — Honolulu</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris / Berlin / Rome</option>
                  <option value="Australia/Sydney">Sydney</option>
                  <option value="Pacific/Auckland">Auckland</option>
                </optgroup>
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="max-occ">Max occupants per unit</label>
              <input
                id="max-occ"
                v-model.number="form.maxOccupantsPerUnit"
                type="number"
                class="field-input fields--narrow"
                min="1"
                max="20"
                :disabled="saving"
              />
              <p class="field-hint">Residents cannot invite more than this many people to their unit.</p>
            </div>
          </div>

          <div class="form-footer">
            <p v-if="saved" class="save-confirm" role="status">Changes saved.</p>
            <BaseButton variant="primary" type="submit" :loading="saving" :disabled="!isDirty">Save changes</BaseButton>
          </div>
        </form>
      </section>

      <!-- Danger zone -->
      <section class="settings-section settings-section--danger">
        <div class="section-header">
          <h2 class="section-title section-title--danger">Danger zone</h2>
          <p class="section-desc">Irreversible actions. Use with care.</p>
        </div>
        <div class="danger-items">
          <div class="danger-item">
            <div class="danger-item-text">
              <p class="danger-item-label">Dev tools</p>
              <p class="danger-item-desc">Reset and seed test data, or wipe everything.</p>
            </div>
            <NuxtLink to="/admin/dev" class="danger-link">Open dev tools →</NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isSuperAdmin } from '../../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const { success: toastSuccess, error: toastError } = useToast()
const { fetchCommunity } = useCommunity()

// Super admin guard
const canEdit = computed(() => !!user.value && isSuperAdmin(user.value))

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)

const form = reactive({
  name: '',
  address: '',
  timezone: 'America/Chicago',
  maxOccupantsPerUnit: 8,
})

const baseline = reactive({ ...form })
const isDirty = computed(() =>
  form.name !== baseline.name ||
  form.address !== baseline.address ||
  form.timezone !== baseline.timezone ||
  form.maxOccupantsPerUnit !== baseline.maxOccupantsPerUnit
)

const errors = reactive({ name: '' })

onMounted(async () => {
  try {
    const data = await api.setup.community.query()
    form.name = data.name
    form.address = data.address ?? ''
    form.timezone = data.timezone
    form.maxOccupantsPerUnit = data.maxOccupantsPerUnit
    Object.assign(baseline, form)
  } catch {
    toastError('Failed to load settings.')
  } finally {
    loading.value = false
  }
})

async function save(): Promise<void> {
  errors.name = ''
  if (!form.name.trim()) { errors.name = 'Community name is required.'; return }
  if (!canEdit.value) return

  saving.value = true
  saved.value = false
  try {
    await api.setup.updateCommunity.mutate({
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      timezone: form.timezone,
      maxOccupantsPerUnit: form.maxOccupantsPerUnit,
    })
    toastSuccess('Settings saved.')
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
    Object.assign(baseline, form)
    await fetchCommunity(true)
  } catch {
    toastError('Failed to save settings.')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 640px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.settings-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-8);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Sections ─────────────────────────────────────────────────── */
.settings-section {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;

  &.settings-section--danger {
    border-color: var(--danger-border, var(--border-default));
  }
}

.section-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 0.5px solid var(--border-subtle);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);

  &.section-title--danger { color: var(--danger-text); }
}

.section-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

/* ── Forms ────────────────────────────────────────────────────── */
.settings-form {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &.fields--narrow { max-width: 160px; }
}

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

.field-select,
.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  min-height: 44px;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.field-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 0.5px solid var(--border-subtle);
}

.save-confirm {
  font-size: var(--text-sm);
  color: var(--success-text);
}

/* ── Danger zone ──────────────────────────────────────────────── */
.danger-items {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.danger-item-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.danger-item-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}

.danger-link {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--danger-text);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }
}
</style>
