<template>
  <div class="polls-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Polls</h1>
        <p class="page-subtitle">{{ openCount }} active</p>
      </div>
      <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Create poll</BaseButton>
    </div>

    <div v-if="loading" class="polls-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <template v-else>
      <!-- Drafts (board only) -->
      <section v-if="isBoard && drafts.length" class="poll-group">
        <h2 class="group-label">Drafts</h2>
        <ul class="poll-list">
          <li v-for="p in drafts" :key="p.id" class="poll-card">
            <NuxtLink :to="`/polls/${p.id}`" class="poll-link">
              <div class="poll-info">
                <div class="poll-title-row">
                  <span class="poll-title">{{ p.title }}</span>
                  <span class="status-badge status-badge--draft">Draft</span>
                  <span v-if="p.eligibility === 'owners_only'" class="eligibility-badge">Owners only</span>
                </div>
                <p class="poll-meta">{{ p.optionCount }} options</p>
              </div>
            </NuxtLink>
            <div class="poll-actions">
              <button class="action-btn" @click.stop="openEdit(p)">Edit</button>
              <button class="action-btn action-btn--primary" @click.stop="confirmOpen(p)">Open poll</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Active -->
      <section v-if="active.length" class="poll-group">
        <h2 class="group-label">Active</h2>
        <ul class="poll-list">
          <li v-for="p in active" :key="p.id" class="poll-card">
            <NuxtLink :to="`/polls/${p.id}`" class="poll-link">
              <div class="poll-info">
                <div class="poll-title-row">
                  <span class="poll-title">{{ p.title }}</span>
                  <span v-if="p.hasVoted" class="voted-badge">Voted</span>
                  <span v-if="p.eligibility === 'owners_only'" class="eligibility-badge">Owners only</span>
                </div>
                <p class="poll-meta">
                  <template v-if="p.closesAt">Closes {{ formatShort(p.closesAt) }} · </template>
                  {{ p.responseCount }} {{ p.responseCount === 1 ? 'response' : 'responses' }}
                </p>
              </div>
              <span v-if="!p.hasVoted" class="vote-cta">Vote →</span>
            </NuxtLink>
            <div v-if="isBoard" class="poll-actions">
              <button class="action-btn action-btn--danger" @click.stop="confirmClose(p)">Close poll</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Closed -->
      <section v-if="closed.length" class="poll-group">
        <h2 class="group-label">Past polls</h2>
        <ul class="poll-list">
          <li v-for="p in closed" :key="p.id" class="poll-card poll-card--past">
            <NuxtLink :to="`/polls/${p.id}`" class="poll-link">
              <div class="poll-info">
                <div class="poll-title-row">
                  <span class="poll-title">{{ p.title }}</span>
                  <span v-if="p.eligibility === 'owners_only'" class="eligibility-badge">Owners only</span>
                </div>
                <p class="poll-meta">
                  Closed {{ formatShort(p.closedAt) }} ·
                  {{ p.responseCount }} {{ p.responseCount === 1 ? 'response' : 'responses' }}
                </p>
              </div>
              <span class="results-cta">Results →</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <div v-if="!drafts.length && !active.length && !closed.length" class="polls-empty">
        <p class="empty-title">No polls yet</p>
        <p class="empty-desc">
          <template v-if="isBoard">Create a poll to get feedback from your community.</template>
          <template v-else>Your board hasn't created any polls yet.</template>
        </p>
        <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Create poll</BaseButton>
      </div>
    </template>

    <!-- Create / Edit modal -->
    <BaseModal :open="showForm" :title="editTarget ? 'Edit poll' : 'Create poll'" @close="closeForm">
      <form class="modal-body" @submit.prevent="submitForm">
        <div class="field">
          <label class="label" for="p-title">Question</label>
          <input
            id="p-title"
            v-model="form.title"
            class="input"
            type="text"
            placeholder="e.g. Should we repaint the lobby?"
            maxlength="255"
            required
          />
        </div>

        <div class="field">
          <label class="label" for="p-desc">Description <span class="label-opt">(optional)</span></label>
          <textarea
            id="p-desc"
            v-model="form.description"
            class="input input--textarea"
            placeholder="Add context or background for residents…"
            rows="3"
            maxlength="2000"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="label" for="p-elig">Eligibility</label>
            <select id="p-elig" v-model="form.eligibility" class="input">
              <option value="all">All residents</option>
              <option value="owners_only">Owners only</option>
            </select>
          </div>
          <div class="field">
            <label class="label" for="p-closes">Closes at <span class="label-opt">(optional)</span></label>
            <BaseDateTimePicker id="p-closes" v-model="form.closesAt" />
          </div>
        </div>

        <label class="toggle-row">
          <span class="label">Anonymous responses</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :aria-checked="form.anonymous"
            :class="{ 'toggle--on': form.anonymous }"
            @click="form.anonymous = !form.anonymous"
          />
        </label>

        <!-- Options builder -->
        <div class="field">
          <span class="label">Answer options</span>
          <div class="options-list">
            <div v-for="(opt, i) in form.options" :key="i" class="option-row">
              <input
                v-model="opt.label"
                class="input option-input"
                type="text"
                :placeholder="`Option ${i + 1}`"
                maxlength="255"
                required
              />
              <button
                v-if="form.options.length > 2"
                type="button"
                class="option-remove"
                aria-label="Remove option"
                @click="removeOption(i)"
              >✕</button>
            </div>
          </div>
          <button
            v-if="form.options.length < 10"
            type="button"
            class="add-option-btn"
            @click="addOption"
          >+ Add option</button>
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="closeForm">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="submitting">
            {{ editTarget ? 'Save changes' : 'Save as draft' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Confirm open -->
    <BaseModal :open="!!openTarget" title="Open poll" size="sm" @close="openTarget = null">
      <div class="modal-body">
        <p class="modal-desc">
          Open <strong>{{ openTarget?.title }}</strong>? Residents will be able to vote immediately.
          You can close it manually at any time.
        </p>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" @click="openTarget = null">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="submitting" @click="submitOpen">Open poll</BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Confirm close -->
    <BaseModal :open="!!closeTarget" title="Close poll" size="sm" @close="closeTarget = null">
      <div class="modal-body">
        <p class="modal-desc">
          Close <strong>{{ closeTarget?.title }}</strong>? Results will be visible to all residents.
          This cannot be undone.
        </p>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" @click="closeTarget = null">Cancel</BaseButton>
          <BaseButton variant="danger" :loading="submitting" @click="submitClose">Close poll</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const api = useApi()
const toast = useToast()

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

type Poll = Awaited<ReturnType<typeof api.polls.list.query>>[number]

const polls = ref<Poll[]>([])
const loading = ref(true)

const drafts = computed(() => polls.value.filter(p => p.status === 'draft'))
const active = computed(() => polls.value.filter(p => p.status === 'open'))
const closed = computed(() => polls.value.filter(p => p.status === 'closed'))
const openCount = computed(() => active.value.length)

async function load(): Promise<void> {
  loading.value = true
  try {
    polls.value = await api.polls.list.query()
  } catch {
    toast.error('Failed to load polls')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Form ───────────────────────────────────────────────────────────────────────
const showForm = ref(false)
const editTarget = ref<Poll | null>(null)
const submitting = ref(false)
const formError = ref('')
const openTarget = ref<Poll | null>(null)
const closeTarget = ref<Poll | null>(null)

const form = reactive({
  title: '',
  description: '',
  eligibility: 'all' as 'all' | 'owners_only',
  anonymous: false,
  closesAt: '',
  options: [{ label: '' }, { label: '' }],
})

function resetForm(): void {
  form.title = ''
  form.description = ''
  form.eligibility = 'all'
  form.anonymous = false
  form.closesAt = ''
  form.options = [{ label: '' }, { label: '' }]
  formError.value = ''
}

function openCreate(): void {
  editTarget.value = null
  resetForm()
  showForm.value = true
}

function openEdit(p: Poll): void {
  editTarget.value = p
  formError.value = ''
  showForm.value = true
  // Reload full options from API when editing
  api.polls.get.query({ id: p.id }).then(full => {
    form.title = full.title
    form.description = full.description ?? ''
    form.eligibility = full.eligibility as 'all' | 'owners_only'
    form.anonymous = full.anonymous
    form.closesAt = full.closesAt ? new Date(full.closesAt).toISOString() : ''
    form.options = full.options.map(o => ({ label: o.label }))
  }).catch(() => {})
}

function closeForm(): void {
  showForm.value = false
  editTarget.value = null
}

function addOption(): void {
  form.options.push({ label: '' })
}

function removeOption(i: number): void {
  form.options.splice(i, 1)
}

async function submitForm(): Promise<void> {
  formError.value = ''
  const options = form.options.filter(o => o.label.trim())
  if (options.length < 2) {
    formError.value = 'Please add at least 2 answer options.'
    return
  }
  submitting.value = true
  try {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      eligibility: form.eligibility,
      anonymous: form.anonymous,
      closesAt: form.closesAt || undefined,
      options,
    }
    if (editTarget.value) {
      await api.polls.update.mutate({ id: editTarget.value.id, ...payload })
      toast.success('Poll updated')
    } else {
      await api.polls.create.mutate(payload)
      toast.success('Poll saved as draft')
    }
    closeForm()
    await load()
  } catch {
    formError.value = 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}

function confirmOpen(p: Poll): void {
  openTarget.value = p
  formError.value = ''
}

async function submitOpen(): Promise<void> {
  if (!openTarget.value) return
  submitting.value = true
  try {
    await api.polls.open.mutate({ id: openTarget.value.id })
    openTarget.value = null
    toast.success('Poll is now open')
    await load()
  } catch {
    formError.value = 'Failed to open poll.'
  } finally {
    submitting.value = false
  }
}

function confirmClose(p: Poll): void {
  closeTarget.value = p
  formError.value = ''
}

async function submitClose(): Promise<void> {
  if (!closeTarget.value) return
  submitting.value = true
  try {
    await api.polls.close.mutate({ id: closeTarget.value.id })
    closeTarget.value = null
    toast.success('Poll closed')
    await load()
  } catch {
    formError.value = 'Failed to close poll.'
  } finally {
    submitting.value = false
  }
}

function formatShort(raw: string | Date | null | undefined): string {
  if (!raw) return ''
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.polls-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);

  @media (min-width: 768px) {
    padding: var(--space-8) var(--space-6);
  }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Loading / empty ──────────────────────────────────────────── */
.polls-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-8);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.polls-empty {
  text-align: center;
  padding: var(--space-16) var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-2);
}

/* ── Groups ───────────────────────────────────────────────────── */
.poll-group {
  margin-bottom: var(--space-8);
}

.group-label {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin: 0 0 var(--space-3);
}

/* ── Poll cards ───────────────────────────────────────────────── */
.poll-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.poll-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color var(--transition-fast);

  &:has(.poll-link:hover) { border-color: var(--border-strong); }
  &.poll-card--past { opacity: 0.7; }

  @media (min-width: 30rem) {
    flex-direction: row;
    align-items: center;
    padding: var(--space-4) var(--space-5);
  }
}

.poll-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.poll-info {
  flex: 1;
  min-width: 0;
}

.poll-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-1);
}

.poll-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
}

.poll-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.status-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);

  &--draft { background: var(--surface-raised); color: var(--text-secondary); border: 1px solid var(--border-default); }
}

.voted-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
  background: var(--success-bg);
  color: var(--success-text);
}

.eligibility-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
  background: var(--warning-bg);
  color: var(--warning-text);
}

.vote-cta,
.results-cta {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--blue-400);
  flex-shrink: 0;
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.poll-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  flex-shrink: 0;
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);

  @media (min-width: 30rem) {
    padding-top: 0;
    border-top: none;
  }
}

.action-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  min-height: 44px;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &--primary {
    color: var(--blue-600);
    border-color: var(--blue-200);
    &:hover { background: var(--blue-50); }
  }

  &--danger {
    color: var(--danger-text);
    border-color: var(--danger-mid);
    &:hover { background: var(--danger-bg); }
  }
}

/* ── Modal ────────────────────────────────────────────────────── */
.modal-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  @media (min-width: 30rem) {
    padding: var(--space-6);
  }
}

.modal-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  @media (min-width: 30rem) {
    flex-direction: row;
  }
}

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.label-opt {
  font-weight: 400;
  color: var(--text-tertiary);
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  box-sizing: border-box;
  font-family: inherit;
  min-height: 44px;

  &:focus { outline: none; box-shadow: var(--shadow-focus); border-color: var(--border-focus); }

  &--textarea {
    resize: vertical;
    line-height: 1.6;
    min-height: 72px;
  }
}

/* ── Toggle ───────────────────────────────────────────────────── */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  cursor: pointer;
  min-height: 44px;
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

  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Options builder ──────────────────────────────────────────── */
.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-row {
  display: flex;
  gap: var(--space-2);
}

.option-input { flex: 1; }

.option-remove {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--danger-text);
  cursor: pointer;

  &:hover { background: var(--danger-bg); border-color: var(--danger-mid); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.add-option-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 44px;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);
  margin-top: var(--space-1);

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 1px solid var(--danger-mid);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}
</style>
