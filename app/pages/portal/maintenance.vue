<template>
  <div class="maintenance-page">
    <div class="page-header">
      <h1 class="page-title">Maintenance requests</h1>
      <BaseButton variant="primary" @click="openForm">New request</BaseButton>
    </div>

    <div v-if="loading" class="page-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!requests.length" class="page-empty">
      <FaIcon :icon="['fajr', 'wrench']" class="empty-icon" />
      <p class="empty-title">No requests yet</p>
      <p class="empty-desc">Submit a maintenance request and the board will follow up.</p>
      <BaseButton variant="primary" @click="openForm">New request</BaseButton>
    </div>

    <div v-else class="request-list">
      <div v-for="req in requests" :key="req.id" class="request-card">
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
        <p class="request-title">{{ req.title }}</p>
        <p v-if="req.description" class="request-desc">{{ req.description }}</p>
        <div v-if="req.boardNotes" class="board-notes">
          <FaIcon :icon="['fajr', 'message']" />
          <p>{{ req.boardNotes }}</p>
        </div>
        <div v-if="req.status === 'open'" class="request-actions">
          <button class="delete-btn" @click="deleteRequest(req.id)">Delete</button>
        </div>
      </div>
    </div>

    <BaseModal :open="showForm" title="New maintenance request" @close="closeForm">
      <form class="modal-form" @submit.prevent="submitRequest">
        <div class="field">
          <label class="label" for="req-title">What needs attention?</label>
          <input
            id="req-title"
            v-model="form.title"
            class="input"
            type="text"
            placeholder="e.g. Leaky faucet in kitchen"
            maxlength="255"
            required
          />
        </div>
        <div class="field">
          <label class="label" for="req-desc">Details <span class="label-optional">(optional)</span></label>
          <textarea
            id="req-desc"
            v-model="form.description"
            class="input input--textarea"
            placeholder="Describe the issue, location, when it started…"
            rows="4"
            maxlength="2000"
          />
        </div>
        <div class="field">
          <label class="label">Priority</label>
          <div class="priority-options">
            <BaseRadio v-model="form.priority" value="routine" name="priority" wrap-class="priority-radio">
              Routine
            </BaseRadio>
            <BaseRadio v-model="form.priority" value="urgent" name="priority" wrap-class="priority-radio">
              Urgent — safety or habitability issue
            </BaseRadio>
          </div>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="closeForm">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="submitting">Submit</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { success: toastSuccess, error: toastError } = useToast()

type Request = Awaited<ReturnType<typeof api.maintenance.myList.query>>[number]
const requests = ref<Request[]>([])
const loading = ref(true)
const showForm = ref(false)
const submitting = ref(false)
const formError = ref('')

const form = reactive({
  title: '',
  description: '',
  priority: 'routine' as 'routine' | 'urgent',
})

async function load(): Promise<void> {
  loading.value = true
  try {
    requests.value = await api.maintenance.myList.query()
  } catch {
    toastError('Failed to load requests.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openForm(): void {
  form.title = ''
  form.description = ''
  form.priority = 'routine'
  formError.value = ''
  showForm.value = true
}

function closeForm(): void {
  showForm.value = false
}

async function submitRequest(): Promise<void> {
  formError.value = ''
  submitting.value = true
  try {
    await api.maintenance.submit.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
    })
    await load()
    closeForm()
    toastSuccess('Request submitted. The board will follow up.')
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Failed to submit.'
  } finally {
    submitting.value = false
  }
}

async function deleteRequest(id: string): Promise<void> {
  try {
    await api.maintenance.delete.mutate({ id })
    requests.value = requests.value.filter(r => r.id !== id)
    toastSuccess('Request deleted.')
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Failed to delete.')
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
  max-width: 640px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
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

.empty-icon {
  font-size: 2rem;
  color: var(--text-tertiary);
}

.empty-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

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
  flex-wrap: wrap;
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

.board-notes {
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

.request-actions {
  display: flex;
  justify-content: flex-end;
  border-top: 0.5px solid var(--border-subtle);
  padding-top: var(--space-2);
}

.delete-btn {
  font-size: var(--text-sm);
  color: var(--danger-text);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 36px;
  transition: background var(--transition-fast);

  &:hover { background: var(--danger-bg); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Form ─────────────────────────────────────────────────────── */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.label-optional {
  font-weight: var(--font-normal);
  color: var(--text-tertiary);
}

.input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  font-size: var(--text-sm);
  color: var(--text-primary);
  min-height: 44px;
  width: 100%;
  transition: border-color var(--transition-fast);

  &:focus { outline: none; border-color: var(--border-focus); box-shadow: var(--shadow-focus); }
  &--textarea { resize: vertical; min-height: 96px; }
}

.priority-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

:deep(.priority-radio) {
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
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
