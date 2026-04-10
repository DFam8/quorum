<template>
  <div class="announcements-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Announcements</h1>
        <p class="page-subtitle">{{ visibleCount }} announcement{{ visibleCount === 1 ? '' : 's' }}</p>
      </div>
      <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Post announcement</BaseButton>
    </div>

    <div v-if="loading" class="feed-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!announcements.length" class="feed-empty">
      <p class="empty-title">No announcements yet</p>
      <p v-if="isBoard" class="empty-desc">Share updates with the community by posting the first announcement.</p>
      <p v-else class="empty-desc">Your board hasn't posted any announcements yet.</p>
      <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Post first announcement</BaseButton>
    </div>

    <ul v-else class="feed">
      <AnnouncementCard
        v-for="item in announcements"
        :key="item.id"
        :announcement="item"
        :is-unread="isUnread(item)"
        :show-actions="isBoard"
        @edit="openEdit"
        @pin="togglePin"
        @hide="openHide"
      />
    </ul>

    <!-- Create / Edit modal -->
    <BaseModal :open="showForm" :title="editTarget ? 'Edit announcement' : 'Post announcement'" @close="closeForm">
      <form class="modal-body" @submit.prevent="submitForm">
        <div class="field">
          <label class="label" for="ann-title">Title</label>
          <input
            id="ann-title"
            v-model="form.title"
            class="input"
            type="text"
            placeholder="Announcement title"
            maxlength="255"
            required
          />
        </div>

        <div class="field">
          <label class="label" for="ann-body">Message</label>
          <textarea
            id="ann-body"
            v-model="form.body"
            class="input textarea"
            placeholder="Write your announcement here…"
            rows="6"
            required
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="label" for="ann-priority">Priority</label>
            <select id="ann-priority" v-model="form.priority" class="input">
              <option value="general">General</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <BaseCheckbox v-model="form.pinned">Pin to top of feed</BaseCheckbox>
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="closeForm">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="submitting">
            {{ editTarget ? 'Save changes' : 'Post' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Hide modal -->
    <BaseModal :open="!!hideTarget" title="Hide announcement" size="sm" @close="hideTarget = null">
      <form class="modal-body" @submit.prevent="submitHide">
        <p class="modal-desc">This announcement will be hidden from residents. You must provide a reason.</p>
        <div class="field">
          <label class="label" for="hide-reason">Reason</label>
          <textarea
            id="hide-reason"
            v-model="hideReason"
            class="input textarea"
            placeholder="Explain why this post is being hidden…"
            rows="3"
            maxlength="500"
            required
          />
        </div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="hideTarget = null">Cancel</BaseButton>
          <BaseButton variant="danger" type="submit" :loading="submitting">Hide post</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../utils/permissions'

const { user } = useAuth()
const api = useApi()
const toast = useToast()
const { isUnread, markAllRead, hydrate } = useAnnouncementRead()

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

// ── Feed ───────────────────────────────────────────────────────────────────
type Announcement = Awaited<ReturnType<typeof api.announcements.list.query>>[number]

const announcements = ref<Announcement[]>([])
const loading = ref(true)

const visibleCount = computed(() => announcements.value.filter(a => !a.hidden).length)

async function loadAnnouncements(): Promise<void> {
  loading.value = true
  try {
    const data = await api.announcements.list.query()
    announcements.value = data
    hydrate(data)
    setTimeout(() => markAllRead(data), 1500)
  } catch {
    toast.error('Failed to load announcements')
  } finally {
    loading.value = false
  }
}

onMounted(loadAnnouncements)

// ── Pin toggle ─────────────────────────────────────────────────────────────
async function togglePin(item: Announcement): Promise<void> {
  try {
    const updated = await api.announcements.pin.mutate({ id: item.id, pinned: !item.pinned })
    const idx = announcements.value.findIndex(a => a.id === item.id)
    if (idx !== -1) announcements.value[idx] = { ...announcements.value[idx], ...updated }
    // Re-sort: pinned first
    announcements.value.sort((a, b) => {
      if (a.pinned === b.pinned) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return a.pinned ? -1 : 1
    })
  } catch {
    toast.error('Failed to update pin')
  }
}

// ── Create / Edit form ─────────────────────────────────────────────────────
const showForm = ref(false)
const editTarget = ref<Announcement | null>(null)
const submitting = ref(false)
const formError = ref('')

const form = reactive({
  title: '',
  body: '',
  priority: 'general' as 'general' | 'urgent',
  pinned: false,
})

function openCreate(): void {
  editTarget.value = null
  form.title = ''
  form.body = ''
  form.priority = 'general'
  form.pinned = false
  formError.value = ''
  showForm.value = true
}

function openEdit(item: Announcement): void {
  editTarget.value = item
  form.title = item.title
  form.body = item.body
  form.priority = item.priority as 'general' | 'urgent'
  form.pinned = item.pinned
  formError.value = ''
  showForm.value = true
}

function closeForm(): void {
  showForm.value = false
  editTarget.value = null
}

async function submitForm(): Promise<void> {
  formError.value = ''
  submitting.value = true
  try {
    if (editTarget.value) {
      const updated = await api.announcements.update.mutate({
        id: editTarget.value.id,
        title: form.title,
        body: form.body,
        priority: form.priority,
      })
      const idx = announcements.value.findIndex(a => a.id === updated.id)
      if (idx !== -1) announcements.value[idx] = { ...announcements.value[idx], ...updated }
      toast.success('Announcement updated')
    } else {
      await api.announcements.create.mutate({ ...form })
      await loadAnnouncements()
      toast.success('Announcement posted')
    }
    closeForm()
  } catch {
    formError.value = 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}

// ── Hide ───────────────────────────────────────────────────────────────────
const hideTarget = ref<Announcement | null>(null)
const hideReason = ref('')

function openHide(item: Announcement): void {
  hideTarget.value = item
  hideReason.value = ''
  formError.value = ''
}

async function submitHide(): Promise<void> {
  if (!hideTarget.value) return
  formError.value = ''
  submitting.value = true
  try {
    const updated = await api.announcements.hide.mutate({ id: hideTarget.value.id, reason: hideReason.value })
    const idx = announcements.value.findIndex(a => a.id === updated.id)
    if (idx !== -1) announcements.value[idx] = { ...announcements.value[idx], ...updated }
    hideTarget.value = null
    toast.success('Announcement hidden')
  } catch {
    formError.value = 'Failed to hide announcement. Please try again.'
  } finally {
    submitting.value = false
  }
}

</script>

<style scoped>
.announcements-page {
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
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Loading / empty ─────────────────────────────────────────── */
.feed-loading {
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

.feed-empty {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.empty-desc {
  font-size: var(--text-sm);
  margin: 0 0 var(--space-2);
}

/* ── Feed ──────────────────────────────────────────────────────── */
.feed {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Modal body/footer (chrome lives in BaseModal) ────────────────────── */
.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.modal-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

/* ── Form fields ───────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-row {
  display: flex;
  gap: var(--space-4);
  align-items: flex-end;
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
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
  min-height: 44px;

  &:focus {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-color: var(--border-focus);
  }

  &.textarea {
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
    line-height: var(--line-height-normal);
  }
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
