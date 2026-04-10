<template>
  <div class="admin-residents">
    <div class="page-header">
      <div>
        <h1 class="page-title">Residents</h1>
        <p class="page-subtitle">{{ residents?.length ?? 0 }} resident{{ residents?.length === 1 ? '' : 's' }} on record</p>
      </div>
    </div>

    <div v-if="loading" class="list-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!residents.length" class="list-empty">
      <p>No residents yet. Add units and send invites to get started.</p>
    </div>

    <div v-else class="table-wrap">
      <table class="residents-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Unit</th>
            <th>Type</th>
            <th>Role</th>
            <th>Status</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in residents" :key="r.id" class="resident-row">
            <td class="col-name">
              <span class="name">{{ r.firstName }} {{ r.lastName }}</span>
              <span class="email">{{ r.email }}</span>
            </td>
            <td class="col-unit">{{ unitDisplay(r) }}</td>
            <td class="col-type">{{ r.residentType === 'owner' ? 'Owner' : 'Renter' }}</td>
            <td class="col-role">
              <span v-if="residentBoardRole(r)" class="role-badge role-badge--board">
                {{ residentBoardRole(r) }}
              </span>
              <span v-else class="role-badge role-badge--resident">Resident</span>
            </td>
            <td class="col-status">
              <span class="status-dot" :class="`status-dot--${r.inviteStatus}`" />
              {{ statusLabel(r.inviteStatus) }}
            </td>
            <td class="col-actions">
              <BaseButton
                v-if="r.inviteStatus !== 'accepted'"
                variant="ghost"
                :loading="resendingId === r.id"
                @click="resendInvite(r)"
              >
                Resend invite
              </BaseButton>
              <BaseButton v-if="isSuperAdminUser" variant="ghost" @click="openRole(r)">Manage role</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Role management modal -->
    <BaseModal :open="!!managingResident" :title="`Manage role — ${managingResident?.firstName} ${managingResident?.lastName}`" size="sm" @close="managingResident = null">
      <div class="modal-body">
        <div class="current-role">
          <span class="current-label">Current role:</span>
          <span class="current-value">{{ residentBoardRole(managingResident!) ?? 'Resident (no board role)' }}</span>
        </div>

        <form class="modal-form" @submit.prevent="saveRole">
          <div class="field">
            <label class="field-label" for="role-select">Assign role</label>
            <select id="role-select" v-model="roleForm.role" class="field-select" :disabled="savingRole">
              <option value="">No board role</option>
              <option value="board_member">Board member</option>
              <option value="super_admin">Super admin (President)</option>
            </select>
          </div>

          <div v-if="roleForm.role === 'board_member'" class="field">
            <label class="field-label" for="rank-select">Rank</label>
            <select id="rank-select" v-model="roleForm.rank" class="field-select" :disabled="savingRole">
              <option :value="1">1 — President</option>
              <option :value="2">2 — Vice President</option>
              <option :value="3">3 — Officer</option>
              <option :value="4">4 — Board member</option>
            </select>
          </div>

          <BaseInput
            v-if="roleForm.role"
            v-model="roleForm.title"
            label="Title (optional)"
            placeholder="e.g. Treasurer, Secretary"
            :disabled="savingRole"
          />

          <p v-if="roleError" class="form-error" role="alert">{{ roleError }}</p>

          <div class="modal-actions">
            <BaseButton
              v-if="managingResident && hasExistingBoardRole(managingResident)"
              type="button"
              variant="ghost"
              class="revoke-btn"
              :loading="savingRole"
              @click="revokeRole"
            >
              Revoke current role
            </BaseButton>
            <BaseButton variant="ghost" type="button" :disabled="savingRole" @click="managingResident = null">
              Cancel
            </BaseButton>
            <BaseButton v-if="roleForm.role" variant="primary" type="submit" :loading="savingRole">
              Save role
            </BaseButton>
          </div>
        </form>
      </div>
    </BaseModal>

    <!-- Invite link modal -->
    <BaseModal :open="!!inviteLink" title="Invite link ready" size="sm" @close="inviteLink = ''">
      <div class="modal-body">
        <p class="invite-desc">Share this link with the resident. It expires in 30 days.</p>
        <div class="invite-link-row">
          <input :value="inviteLink" class="invite-link-input" readonly @click="($event.target as HTMLInputElement).select()" />
          <button type="button" class="copy-btn" @click="copyInviteLink">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <div class="modal-actions">
          <BaseButton variant="primary" @click="inviteLink = ''">Done</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { isSuperAdmin, isBoardMember } from '../../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const { success: toastSuccess, error: toastError } = useToast()

type ResidentRow = Awaited<ReturnType<typeof api.residents.list.query>>[number]

const loading = ref(true)
const residents = ref<ResidentRow[]>([])
const managingResident = ref<ResidentRow | null>(null)
const savingRole = ref(false)
const roleError = ref('')
const resendingId = ref<string | null>(null)
const inviteLink = ref('')
const copied = ref(false)

const roleForm = reactive<{ role: string; rank: number; title: string }>({
  role: '',
  rank: 4,
  title: '',
})

const isSuperAdminUser = computed(() => !!user.value && isSuperAdmin(user.value))
const communityId = computed(() => user.value?.household?.unit?.communityId ?? '')

onMounted(async () => {
  await loadResidents()
})

async function loadResidents(): Promise<void> {
  loading.value = true
  try {
    residents.value = await api.residents.list.query()
  } catch {
    toastError('Failed to load residents.')
  } finally {
    loading.value = false
  }
}

function unitDisplay(r: ResidentRow): string {
  const u = r.household?.unit
  if (!u) return '—'
  return u.unitType === 'sfh' ? u.unitNumber : `Unit ${u.unitNumber}`
}

function residentBoardRole(r: ResidentRow): string | null {
  const role = r.roles.find(ro => !ro.revokedAt && (ro.role === 'super_admin' || ro.role === 'board_member'))
  if (!role) return null
  if (role.title) return role.title
  if (role.role === 'super_admin') return 'Super admin'
  const rankLabels: Record<number, string> = { 1: 'President', 2: 'VP', 3: 'Officer', 4: 'Board member' }
  return role.rank ? (rankLabels[role.rank] ?? 'Board member') : 'Board member'
}

function hasExistingBoardRole(r: ResidentRow): boolean {
  return r.roles.some(ro => !ro.revokedAt && (ro.role === 'super_admin' || ro.role === 'board_member'))
}

function statusLabel(status: string): string {
  return { pending: 'Invited', accepted: 'Active', expired: 'Expired' }[status] ?? status
}

function openRole(r: ResidentRow): void {
  managingResident.value = r
  roleError.value = ''
  const existing = r.roles.find(ro => !ro.revokedAt && (ro.role === 'super_admin' || ro.role === 'board_member'))
  roleForm.role = existing?.role ?? ''
  roleForm.rank = existing?.rank ?? 4
  roleForm.title = existing?.title ?? ''
}

async function saveRole(): Promise<void> {
  if (!managingResident.value || !roleForm.role || !communityId.value) return
  roleError.value = ''
  savingRole.value = true
  try {
    await api.residents.setRole.mutate({
      residentId: managingResident.value.id,
      role: roleForm.role as 'super_admin' | 'board_member' | 'committee_lead',
      rank: roleForm.role === 'board_member' ? roleForm.rank : undefined,
      title: roleForm.title.trim() || undefined,
      contextId: communityId.value,
      contextType: 'community',
    })
    toastSuccess('Role updated.')
    managingResident.value = null
    await loadResidents()
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : 'Failed to update role.'
  } finally {
    savingRole.value = false
  }
}

async function resendInvite(r: ResidentRow): Promise<void> {
  resendingId.value = r.id
  try {
    const { token } = await api.residents.resendInvite.mutate({ residentId: r.id })
    inviteLink.value = `${window.location.origin}/invite?token=${token}`
    copied.value = false
    await loadResidents()
  } catch {
    toastError('Failed to resend invite.')
  } finally {
    resendingId.value = null
  }
}

async function copyInviteLink(): Promise<void> {
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function revokeRole(): Promise<void> {
  if (!managingResident.value || !communityId.value) return
  roleError.value = ''
  savingRole.value = true
  try {
    await api.residents.revokeRole.mutate({
      residentId: managingResident.value.id,
      contextId: communityId.value,
    })
    toastSuccess('Role revoked.')
    managingResident.value = null
    await loadResidents()
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : 'Failed to revoke role.'
  } finally {
    savingRole.value = false
  }
}
</script>

<style scoped>
.admin-residents {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  align-items: flex-start;
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

.list-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-8);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.list-empty {
  text-align: center;
  padding: var(--space-8);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.table-wrap {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow-x: auto;
}

.residents-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 0.5px solid var(--border-subtle);
  }
}

.resident-row {
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }

  td {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    color: var(--text-primary);
    vertical-align: middle;
  }
}

.col-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: var(--font-medium);
}

.email {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.role-badge {
  display: inline-flex;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);

  &.role-badge--board {
    color: var(--info-text);
    background: var(--info-bg);
  }

  &.role-badge--resident {
    color: var(--text-secondary);
    background: var(--surface-raised);
  }
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  margin-right: var(--space-1);

  &.status-dot--accepted { background: var(--success-text); }
  &.status-dot--pending { background: var(--warning-text); }
  &.status-dot--expired { background: var(--text-tertiary); }
}

.col-actions { text-align: right; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* ── Modal body (chrome handled by BaseModal) ─────────────────── */
.modal-body {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.current-role {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-raised);
  border-radius: var(--radius-md);
}

.current-label {
  color: var(--text-secondary);
}

.current-value {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
  flex-wrap: wrap;
}

.revoke-btn {
  margin-right: auto;
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

/* ── Invite link ──────────────────────────────────────────────── */
.invite-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.invite-link-row {
  display: flex;
  gap: var(--space-2);
}

.invite-link-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--surface-raised);
  font-family: monospace;
  cursor: text;

  &:focus { outline: none; box-shadow: var(--shadow-focus); }
}

.copy-btn {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--blue-600);
  background: var(--blue-50);
  border: 0.5px solid var(--blue-100);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s;
  min-height: 36px;

  &:hover { background: var(--blue-100); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}
</style>
