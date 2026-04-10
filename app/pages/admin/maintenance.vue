<template>
  <div class="maintenance-page">
    <div class="page-header">
      <h1 class="page-title">Maintenance requests</h1>
      <div class="header-filters">
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          class="filter-btn"
          :class="{ 'filter-btn--active': activeFilter === f.value }"
          @click="activeFilter = f.value"
        >
          {{ f.label }}
          <span v-if="countByStatus[f.value]" class="filter-count">{{ countByStatus[f.value] }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="page-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!filtered.length" class="page-empty">
      <FaIcon :icon="['fajr', 'check-circle']" class="empty-icon" />
      <p class="empty-title">No {{ activeFilter === 'all' ? '' : activeFilter }} requests</p>
    </div>

    <div v-else class="request-list">
      <div v-for="req in filtered" :key="req.id" class="request-card">
        <div class="request-top">
          <div class="request-meta">
            <span class="status-badge" :class="`status-badge--${req.status}`">
              {{ statusLabel(req.status) }}
            </span>
            <span class="priority-badge" :class="`priority-badge--${req.priority}`">
              {{ req.priority === 'urgent' ? 'Urgent' : 'Routine' }}
            </span>
          </div>
          <span class="request-date">{{ formatDate(req.createdAt) }}</span>
        </div>

        <div class="request-who">
          <FaIcon :icon="['fajr', 'user']" />
          {{ req.submittedByResident.firstName }} {{ req.submittedByResident.lastName }}
          <span class="meta-dot">·</span>
          Unit {{ req.unit.unitNumber }}
          <template v-if="req.unit.building">· {{ req.unit.building }}</template>
        </div>

        <p class="request-title">{{ req.title }}</p>
        <p v-if="req.description" class="request-desc">{{ req.description }}</p>

        <div v-if="req.boardNotes" class="board-notes-display">
          <FaIcon :icon="['fajr', 'message']" />
          <p>{{ req.boardNotes }}</p>
        </div>

        <!-- Board actions -->
        <div class="board-actions" :class="{ 'board-actions--open': expandedId === req.id }">
          <button
            v-if="expandedId !== req.id"
            class="update-btn"
            type="button"
            @click="expandedId = req.id; editNotes = req.boardNotes ?? ''; editStatus = req.status"
          >
            Update status
          </button>

          <div v-else class="update-form">
            <div class="status-options">
              <button
                v-for="s in statusOptions"
                :key="s.value"
                type="button"
                class="status-option"
                :class="{ 'status-option--active': editStatus === s.value }"
                @click="editStatus = s.value"
              >
                {{ s.label }}
              </button>
            </div>
            <textarea
              v-model="editNotes"
              class="notes-input"
              placeholder="Add a note for the resident (optional)…"
              rows="3"
              maxlength="2000"
            />
            <div class="update-actions">
              <button class="cancel-btn" type="button" @click="expandedId = null">Cancel</button>
              <BaseButton
                variant="primary"
                size="sm"
                :loading="savingId === req.id"
                @click="saveStatus(req.id)"
              >
                Save
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../../utils/permissions'
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const { success: toastSuccess, error: toastError } = useToast()

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

if (!isBoard.value) await navigateTo('/feed')

type Request = Awaited<ReturnType<typeof api.maintenance.list.query>>[number]
const requests = ref<Request[]>([])
const loading = ref(true)
const expandedId = ref<string | null>(null)
const savingId = ref<string | null>(null)
const editNotes = ref('')
const editStatus = ref<'open' | 'in_progress' | 'resolved'>('open')

const activeFilter = ref('open')

const filters = [
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: 'all' },
]

const statusOptions = [
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
] as const

const filtered = computed(() =>
  activeFilter.value === 'all'
    ? requests.value
    : requests.value.filter(r => r.status === activeFilter.value)
)

const countByStatus = computed(() => ({
  open: requests.value.filter(r => r.status === 'open').length,
  in_progress: requests.value.filter(r => r.status === 'in_progress').length,
  resolved: requests.value.filter(r => r.status === 'resolved').length,
  all: requests.value.length,
}))

async function load(): Promise<void> {
  loading.value = true
  try {
    requests.value = await api.maintenance.list.query()
  } catch {
    toastError('Failed to load requests.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function saveStatus(id: string): Promise<void> {
  savingId.value = id
  try {
    await api.maintenance.updateStatus.mutate({
      id,
      status: editStatus.value,
      boardNotes: editNotes.value.trim() || undefined,
    })
    await load()
    expandedId.value = null
    toastSuccess('Request updated.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to update.')
  } finally {
    savingId.value = null
  }
}

function statusLabel(status: string): string {
  return { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }[status] ?? status
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.maintenance-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.header-filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--surface-card);
  cursor: pointer;
  min-height: 36px;
  transition: border-color var(--transition-fast), color var(--transition-fast);

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
  &--active { border-color: var(--blue-400); color: var(--blue-400); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.filter-count {
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  padding: 0 6px;
  min-width: 20px;
  text-align: center;
}

.page-loading,
.page-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-icon { font-size: 2rem; color: var(--text-tertiary); }
.empty-title { font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-primary); margin: 0; }

.request-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.request-card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.request-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.request-meta {
  display: flex;
  gap: var(--space-2);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);

  &--open { background: var(--info-bg); color: var(--info-text); }
  &--in_progress { background: var(--warning-bg); color: var(--warning-text); }
  &--resolved { background: var(--success-bg); color: var(--success-text); }
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);

  &--urgent { background: var(--danger-bg); color: var(--danger-text); }
  &--routine { background: var(--surface-raised); color: var(--text-secondary); }
}

.request-date {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.request-who {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.meta-dot { color: var(--text-tertiary); }

.request-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.request-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: var(--line-height-normal);
}

.board-notes-display {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--info-bg);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--info-text);
  line-height: var(--line-height-normal);

  p { margin: 0; }
}

.board-actions {
  border-top: 0.5px solid var(--border-subtle);
  padding-top: var(--space-3);
}

.update-btn {
  font-size: var(--text-sm);
  color: var(--text-link);
  padding: var(--space-1) 0;
  min-height: 36px;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.update-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.status-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-option {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 36px;
  transition: border-color var(--transition-fast), color var(--transition-fast);

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
  &--active { border-color: var(--blue-400); color: var(--blue-400); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.notes-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  font-size: var(--text-sm);
  color: var(--text-primary);
  resize: vertical;
  min-height: 72px;
  width: 100%;

  &:focus { outline: none; border-color: var(--border-focus); box-shadow: var(--shadow-focus); }
}

.update-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.cancel-btn {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 36px;
  transition: color var(--transition-fast);

  &:hover { color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
