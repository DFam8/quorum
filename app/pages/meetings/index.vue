<template>
  <div class="meetings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Meetings</h1>
        <p class="page-subtitle">{{ upcomingCount }} upcoming</p>
      </div>
      <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Schedule meeting</BaseButton>
    </div>

    <div v-if="loading" class="meetings-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <template v-else>
      <!-- Upcoming -->
      <section v-if="upcoming.length" class="meeting-group">
        <h2 class="group-label">Upcoming</h2>
        <ul class="meeting-list">
          <li v-for="m in upcoming" :key="m.id" class="meeting-card" :class="{ 'meeting-card--cancelled': m.status === 'cancelled' }">
            <NuxtLink :to="`/meetings/${m.id}`" class="meeting-link">
              <div class="meeting-date-block">
                <span class="meeting-month">{{ monthLabel(m.scheduledAt) }}</span>
                <span class="meeting-day">{{ dayLabel(m.scheduledAt) }}</span>
              </div>
              <div class="meeting-info">
                <div class="meeting-title-row">
                  <span class="meeting-title">{{ m.title }}</span>
                  <span class="meeting-type-badge">{{ typeLabel(m.meetingType) }}</span>
                  <span v-if="m.status === 'cancelled'" class="meeting-cancelled-badge">Cancelled</span>
                </div>
                <p class="meeting-meta">
                  <time>{{ formatDateTime(m.scheduledAt) }}</time>
                  <template v-if="m.location"> · {{ m.location }}</template>
                </p>
                <p v-if="m.agenda?.status === 'published'" class="meeting-agenda-note">
                  Agenda published
                </p>
              </div>
            </NuxtLink>
            <div v-if="isBoard && m.status === 'scheduled'" class="meeting-actions">
              <button type="button" class="action-btn" @click.stop="openEdit(m)">Edit</button>
              <button type="button" class="action-btn action-btn--danger" @click.stop="confirmCancel(m)">Cancel</button>
            </div>
          </li>
        </ul>
      </section>

      <div v-else-if="!past.length" class="meetings-empty">
        <p class="empty-title">No meetings scheduled</p>
        <p v-if="isBoard" class="empty-desc">Schedule your first meeting to get started.</p>
        <p v-else class="empty-desc">Your board hasn't scheduled any meetings yet.</p>
        <BaseButton v-if="isBoard" variant="primary" @click="openCreate">Schedule meeting</BaseButton>
      </div>

      <!-- Past -->
      <section v-if="past.length" class="meeting-group">
        <h2 class="group-label">Past</h2>
        <ul class="meeting-list">
          <li v-for="m in past" :key="m.id" class="meeting-card meeting-card--past">
            <NuxtLink :to="`/meetings/${m.id}`" class="meeting-link">
              <div class="meeting-date-block">
                <span class="meeting-month">{{ monthLabel(m.scheduledAt) }}</span>
                <span class="meeting-day">{{ dayLabel(m.scheduledAt) }}</span>
              </div>
              <div class="meeting-info">
                <div class="meeting-title-row">
                  <span class="meeting-title">{{ m.title }}</span>
                  <span class="meeting-type-badge">{{ typeLabel(m.meetingType) }}</span>
                  <span v-if="m.status === 'cancelled'" class="meeting-cancelled-badge">Cancelled</span>
                </div>
                <p class="meeting-meta">
                  <time>{{ formatDateTime(m.scheduledAt) }}</time>
                  <template v-if="m.location"> · {{ m.location }}</template>
                </p>
                <p v-if="m.minutes?.status === 'published'" class="meeting-minutes-note">
                  Minutes published
                </p>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>

    <!-- Schedule / Edit modal -->
    <BaseModal :open="showForm" :title="editTarget ? 'Edit meeting' : 'Schedule meeting'" @close="closeForm">
      <form class="modal-body" @submit.prevent="submitForm">
        <div class="field">
          <label class="label" for="m-title">Title</label>
          <input
            id="m-title"
            v-model="form.title"
            class="input"
            type="text"
            placeholder="e.g. Annual Homeowners Meeting"
            maxlength="255"
            required
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="label" for="m-type">Type</label>
            <select id="m-type" v-model="form.meetingType" class="input">
              <option value="annual">Annual</option>
              <option value="special">Special</option>
              <option value="board">Board</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          <div class="field">
            <label class="label">Date & time</label>
            <BaseDateTimePicker v-model="form.scheduledAt" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="m-location">Location <span class="label-optional">(optional)</span></label>
          <input
            id="m-location"
            v-model="form.location"
            class="input"
            type="text"
            placeholder="e.g. Community centre, Room B"
            maxlength="255"
          />
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="closeForm">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="submitting">
            {{ editTarget ? 'Save changes' : 'Schedule' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Cancel confirm -->
    <BaseModal :open="!!cancelTarget" title="Cancel meeting" size="sm" @close="cancelTarget = null">
      <div class="modal-body">
        <p class="modal-desc">
          Are you sure you want to cancel <strong>{{ cancelTarget?.title }}</strong>?
          Residents will need to be notified separately.
        </p>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="cancelTarget = null">Keep meeting</BaseButton>
          <BaseButton variant="danger" :loading="submitting" @click="submitCancel">Cancel meeting</BaseButton>
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

// ── Data ───────────────────────────────────────────────────────────────────
type Meeting = Awaited<ReturnType<typeof api.meetings.list.query>>[number]

const meetings = ref<Meeting[]>([])
const loading = ref(true)

const now = new Date()
const upcoming = computed(() => meetings.value.filter(m => new Date(m.scheduledAt) >= now).reverse())
const past = computed(() => meetings.value.filter(m => new Date(m.scheduledAt) < now))
const upcomingCount = computed(() => upcoming.value.filter(m => m.status !== 'cancelled').length)

async function load(): Promise<void> {
  loading.value = true
  try {
    meetings.value = await api.meetings.list.query()
  } catch {
    toast.error('Failed to load meetings')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Create / Edit form ─────────────────────────────────────────────────────
const showForm = ref(false)
const editTarget = ref<Meeting | null>(null)
const submitting = ref(false)
const formError = ref('')

const form = reactive({
  title: '',
  meetingType: 'annual' as 'annual' | 'special' | 'board' | 'emergency',
  scheduledAt: '',
  location: '',
})

function openCreate(): void {
  editTarget.value = null
  const next = new Date()
  next.setDate(next.getDate() + 14)
  next.setHours(18, 0, 0, 0)
  form.title = ''
  form.meetingType = 'annual'
  form.scheduledAt = next.toISOString()
  form.location = ''
  formError.value = ''
  showForm.value = true
}

function openEdit(m: Meeting): void {
  editTarget.value = m
  form.title = m.title
  form.meetingType = (m.meetingType ?? 'annual') as typeof form.meetingType
  form.scheduledAt = new Date(m.scheduledAt).toISOString()
  form.location = m.location ?? ''
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
    const payload = {
      title: form.title,
      meetingType: form.meetingType,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      location: form.location || undefined,
    }
    if (editTarget.value) {
      await api.meetings.update.mutate({ id: editTarget.value.id, ...payload })
      toast.success('Meeting updated')
    } else {
      await api.meetings.create.mutate(payload)
      toast.success('Meeting scheduled')
    }
    closeForm()
    await load()
  } catch {
    formError.value = 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}

// ── Cancel ─────────────────────────────────────────────────────────────────
const cancelTarget = ref<Meeting | null>(null)

function confirmCancel(m: Meeting): void {
  cancelTarget.value = m
  formError.value = ''
}

async function submitCancel(): Promise<void> {
  if (!cancelTarget.value) return
  submitting.value = true
  try {
    await api.meetings.cancel.mutate({ id: cancelTarget.value.id })
    cancelTarget.value = null
    toast.success('Meeting cancelled')
    await load()
  } catch {
    formError.value = 'Failed to cancel meeting.'
  } finally {
    submitting.value = false
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  annual: 'Annual', special: 'Special', board: 'Board', emergency: 'Emergency',
}

function typeLabel(t: string | null): string {
  return TYPE_LABELS[t ?? ''] ?? t ?? ''
}

function monthLabel(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}

function dayLabel(raw: string | Date): string {
  return String(new Date(raw).getDate())
}

function formatDateTime(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
</script>

<style scoped>
.meetings-page {
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
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Loading / empty ──────────────────────────────────────────────────── */
.meetings-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-16);
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

.meetings-empty {
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

/* ── Groups ──────────────────────────────────────────────────────────── */
.meeting-group {
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

/* ── Meeting cards ────────────────────────────────────────────────────── */
.meeting-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.meeting-link {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.meeting-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  transition: border-color 0.15s;

  &:has(.meeting-link:hover) { border-color: var(--border-strong); }

  &.meeting-card--past {
    opacity: 0.65;
  }

  &.meeting-card--cancelled {
    border-style: dashed;
  }
}

.meeting-date-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
  flex-shrink: 0;
}

.meeting-month {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--blue-400);
  letter-spacing: 0.05em;
}

.meeting-day {
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.1;
}

.meeting-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.meeting-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.meeting-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
}

.meeting-type-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
}

.meeting-cancelled-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
}

.meeting-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.meeting-agenda-note,
.meeting-minutes-note {
  font-size: var(--text-xs);
  color: var(--blue-600);
  font-weight: 500;
  margin: 0;
}

.meeting-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.action-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  min-height: 30px;
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.action-btn--danger {
    color: var(--danger-text);
    border-color: var(--danger-mid);

    &:hover { background: var(--danger-bg); }
  }
}

/* ── Modal body/footer (chrome lives in BaseModal) ────────────────────── */
.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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

/* ── Form ─────────────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.field-row {
  display: flex;
  gap: var(--space-4);
}

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.label-optional {
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

  &:focus {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-color: var(--border-focus);
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
