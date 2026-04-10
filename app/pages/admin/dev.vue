<template>
  <div class="dev-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Dev tools</h1>
        <p class="page-subtitle">Testing utilities — super admin only</p>
      </div>
      <span class="dev-badge">DEV</span>
    </div>

    <div class="tools-grid">

      <!-- Seed -->
      <section class="tool-card">
        <div class="tool-header">
          <h2 class="tool-title">Seed test data</h2>
          <span class="tool-tag tool-tag--safe">Safe to repeat</span>
        </div>
        <p class="tool-desc">
          Creates 10 test units (4 condos, 3 apartments, 3 SFHs) and 12 residents.
          10 residents are fully onboarded with realistic last-login dates. 2 are left
          pending so you can test the invite flow. Skips anything that already exists.
        </p>

        <div class="unit-preview">
          <p class="preview-label">Will create</p>
          <ul class="preview-list">
            <li>Units 101, 102, 201, 202 — Condo, Building A</li>
            <li>Units 10, 11, 20 — Apartment, Building B</li>
            <li>123 Oak Street, 456 Elm Ave, 789 Maple Drive — SFH</li>
            <li>10 accepted residents + 2 pending (julia.m / marcus.m @example.com)</li>
            <li>Board roles: Alice Chen (VP), Carlos Rivera (Treasurer), Fatima Hassan (Board member)</li>
          </ul>
        </div>

        <div v-if="seedResult" class="result-box result-box--success">
          <span class="result-num">{{ seedResult.unitsCreated }}</span> units ·
          <span class="result-num">{{ seedResult.residentsCreated }}</span> residents ·
          <span class="result-num">{{ seedResult.pollsCreated }}</span> polls ·
          <span class="result-num">{{ seedResult.maintenanceCreated }}</span> maintenance requests ·
          <span class="result-num">{{ seedResult.skipped }}</span> skipped
        </div>

        <div class="tool-actions">
          <BaseButton variant="primary" :loading="seeding" :disabled="resetSeeding" @click="runSeed">
            Seed data
          </BaseButton>
        </div>
      </section>

      <!-- Reset -->
      <section class="tool-card tool-card--danger">
        <div class="tool-header">
          <h2 class="tool-title">Reset all data</h2>
          <span class="tool-tag tool-tag--danger">Destructive</span>
        </div>
        <p class="tool-desc">
          Deletes all units, households, residents, documents, and announcements.
          <strong>Your own account is preserved</strong> so you can log back in and re-seed.
        </p>

        <div class="reset-confirm-field">
          <label class="field-label" for="reset-confirm">Type <strong>RESET</strong> to enable</label>
          <input
            id="reset-confirm"
            v-model="resetConfirm"
            type="text"
            class="field-input"
            placeholder="RESET"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div v-if="resetResult" class="result-box result-box--warn">
          Deleted:
          <span v-for="(count, key) in resetResult.deleted" :key="key" class="result-item">
            {{ count }} {{ key }}
          </span>
        </div>

        <div class="tool-actions">
          <BaseButton
            variant="secondary"
            :loading="resetSeeding"
            :disabled="resetConfirm !== 'RESET' || resetting"
            @click="runResetAndSeed"
          >
            Reset &amp; seed
          </BaseButton>
          <BaseButton
            variant="danger"
            :loading="resetting"
            :disabled="resetConfirm !== 'RESET' || resetSeeding"
            @click="runReset"
          >
            Reset only
          </BaseButton>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { success: toastSuccess, error: toastError } = useToast()

const seeding = ref(false)
const resetting = ref(false)
const resetSeeding = ref(false)
const resetConfirm = ref('')
const seedResult = ref<{ unitsCreated: number; residentsCreated: number; skipped: number } | null>(null)
const resetResult = ref<{ deleted: Record<string, number> } | null>(null)

async function runSeed(): Promise<void> {
  seedResult.value = null
  seeding.value = true
  try {
    seedResult.value = await api.dev.seed.mutate()
    toastSuccess(`Seeded ${seedResult.value.unitsCreated} units, ${seedResult.value.residentsCreated} residents, ${seedResult.value.pollsCreated} polls, ${seedResult.value.maintenanceCreated} maintenance requests.`)
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Seed failed.')
  } finally {
    seeding.value = false
  }
}

async function runReset(): Promise<void> {
  if (resetConfirm.value !== 'RESET') return
  resetResult.value = null
  resetting.value = true
  try {
    resetResult.value = await api.dev.reset.mutate({ confirm: 'RESET' })
    resetConfirm.value = ''
    toastSuccess('Data reset. Your account is intact.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Reset failed.')
  } finally {
    resetting.value = false
  }
}

async function runResetAndSeed(): Promise<void> {
  if (resetConfirm.value !== 'RESET') return
  resetResult.value = null
  seedResult.value = null
  resetSeeding.value = true
  try {
    resetResult.value = await api.dev.reset.mutate({ confirm: 'RESET' })
    resetConfirm.value = ''
    seedResult.value = await api.dev.seed.mutate()
    toastSuccess(`Reset & seeded — ${seedResult.value.unitsCreated} units, ${seedResult.value.residentsCreated} residents, ${seedResult.value.pollsCreated} polls, ${seedResult.value.maintenanceCreated} maintenance requests.`)
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Reset & seed failed.')
  } finally {
    resetSeeding.value = false
  }
}
</script>

<style scoped>
.dev-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 800px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.dev-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--warning-text);
  background: var(--warning-bg);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  letter-spacing: 0.08em;
}

.tools-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);

  @media (min-width: 48rem) {
    grid-template-columns: 1fr 1fr;
  }
}

.tool-card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &.tool-card--danger {
    border-color: var(--danger-border, var(--border-default));
  }
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.tool-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
}

.tool-tag {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);

  &.tool-tag--safe {
    color: var(--success-text);
    background: var(--success-bg);
  }

  &.tool-tag--danger {
    color: var(--danger-text);
    background: var(--danger-bg);
  }
}

.tool-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.unit-preview {
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-4);

  li {
    font-size: var(--text-xs);
    color: var(--text-primary);
    list-style: disc;
  }
}

.result-box {
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  line-height: 1.8;

  &.result-box--success {
    color: var(--success-text);
    background: var(--success-bg);
  }

  &.result-box--warn {
    color: var(--text-secondary);
    background: var(--surface-raised);
  }
}

.result-num {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.result-item {
  display: inline-block;
  margin-right: var(--space-3);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.reset-confirm-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);

  strong {
    font-weight: var(--font-medium);
    font-family: monospace;
  }
}

.field-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  font-family: monospace;
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  min-height: 44px;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.tool-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
  margin-top: auto;
}
</style>
