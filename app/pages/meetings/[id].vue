<template>
  <div class="meeting-detail">
    <div v-if="loading" class="detail-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <template v-else-if="meeting">
      <!-- Header -->
      <div class="detail-header">
        <NuxtLink to="/meetings" class="back-link no-print">← Meetings</NuxtLink>
        <div class="header-row">
          <div class="header-meta">
            <div class="header-date-block">
              <span class="header-month">{{ monthLabel(meeting.scheduledAt) }}</span>
              <span class="header-day">{{ dayLabel(meeting.scheduledAt) }}</span>
            </div>
            <div>
              <h1 class="header-title">{{ meeting.title }}</h1>
              <p class="header-sub">
                <span class="type-badge">{{ typeLabel(meeting.meetingType) }}</span>
                <template v-if="meeting.location"> · {{ meeting.location }}</template>
                <span v-if="meeting.status === 'cancelled'" class="cancelled-badge">Cancelled</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs no-print" role="tablist">
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          role="tab"
          class="tab"
          :class="{ 'tab--active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </button>
      </div>

      <!-- ── Overview ─────────────────────────────────────────── -->
      <section v-if="activeTab === 'overview'" class="tab-panel no-print">
        <dl class="detail-list">
          <div class="detail-row">
            <dt>Date & time</dt>
            <dd>{{ formatDateTime(meeting.scheduledAt) }}</dd>
          </div>
          <div v-if="meeting.location" class="detail-row">
            <dt>Location</dt>
            <dd>{{ meeting.location }}</dd>
          </div>
          <div class="detail-row">
            <dt>Status</dt>
            <dd class="status-cell">
              <span class="status-pill" :class="`status-pill--${meeting.status}`">
                {{ statusLabel(meeting.status) }}
              </span>
            </dd>
          </div>
          <div class="detail-row">
            <dt>Agenda</dt>
            <dd>
              <span v-if="!meeting.agenda">Not yet created</span>
              <span v-else-if="meeting.agenda.status === 'published'" class="published-note">
                Published {{ formatShort(meeting.agenda.publishedAt) }}
              </span>
              <span v-else class="draft-note">Draft</span>
            </dd>
          </div>
          <div class="detail-row">
            <dt>Minutes</dt>
            <dd>
              <span v-if="!meeting.minutes">Not yet drafted</span>
              <span v-else class="status-pill" :class="`status-pill--${meeting.minutes.status}`">
                {{ minutesStatusLabel(meeting.minutes.status) }}
              </span>
            </dd>
          </div>
          <div class="detail-row">
            <dt>Attending</dt>
            <dd>
              <span class="rsvp-count">{{ attendingCount }} {{ attendingCount === 1 ? 'resident' : 'residents' }}</span>
            </dd>
          </div>
        </dl>

        <!-- RSVP + Calendar actions -->
        <div v-if="meeting.status === 'scheduled'" class="overview-actions">
          <div class="rsvp-group">
            <button
              type="button"
              class="rsvp-btn"
              :class="{ 'rsvp-btn--active': myRsvp === 'attending' }"
              :disabled="rsvpSaving"
              @click="setRsvp('attending')"
            >
              <FaIcon :icon="['fajr', 'circle-check']" />
              I'll be there
            </button>
            <button
              type="button"
              class="rsvp-btn rsvp-btn--no"
              :class="{ 'rsvp-btn--active-no': myRsvp === 'not_attending' }"
              :disabled="rsvpSaving"
              @click="setRsvp('not_attending')"
            >
              <FaIcon :icon="['fajr', 'circle-xmark']" />
              Can't make it
            </button>
            <button
              v-if="myRsvp"
              type="button"
              class="rsvp-clear"
              :disabled="rsvpSaving"
              @click="clearRsvp"
            >
              Clear
            </button>
          </div>
          <a :href="`/api/meetings/${meeting.id}.ics`" class="calendar-btn" download>
            <FaIcon :icon="['fajr', 'calendar-plus']" />
            Add to calendar
          </a>
        </div>

        <!-- Board: attendee list -->
        <div v-if="isBoard && attendingRsvps.length" class="attendee-list">
          <p class="attendee-list-label">Attending</p>
          <ul>
            <li v-for="r in attendingRsvps" :key="r.id" class="attendee-item">
              {{ r.resident.firstName }} {{ r.resident.lastName }}
            </li>
          </ul>
        </div>
      </section>

      <!-- ── Agenda ───────────────────────────────────────────── -->
      <section v-else-if="activeTab === 'agenda'" class="tab-panel">
        <!-- Resident view: published agenda only -->
        <template v-if="!isBoard">
          <div v-if="!meeting.agenda || meeting.agenda.status !== 'published'" class="empty-state">
            <p class="empty-title">Agenda not published yet</p>
            <p class="empty-desc">The board will publish the agenda before the meeting.</p>
          </div>
          <template v-else>
            <div class="agenda-toolbar no-print">
              <button type="button" class="print-btn" @click="printAgenda">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 6V1h8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <rect x="1" y="6" width="14" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M4 10h8M4 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Print agenda
              </button>
            </div>
            <div class="print-header print-only">
              <p class="print-community">Quorum</p>
              <h1 class="print-title">{{ meeting.title }}</h1>
              <p class="print-meta">{{ formatDateTime(meeting.scheduledAt) }}<template v-if="meeting.location"> · {{ meeting.location }}</template></p>
              <p class="print-label">Meeting Agenda</p>
            </div>
            <ol class="agenda-list agenda-list--readonly">
              <li
                v-for="(item, i) in agendaItems"
                :key="item.id"
                class="agenda-item agenda-item--readonly"
              >
                <span class="item-num">{{ i + 1 }}</span>
                <div class="item-content">
                  <p class="item-title">{{ item.title }}</p>
                  <p v-if="item.description" class="item-desc">{{ item.description }}</p>
                  <p v-if="item.duration" class="item-duration">{{ item.duration }} min</p>
                </div>
              </li>
            </ol>
          </template>
        </template>

        <!-- Board view: editable builder -->
        <template v-else>
          <template v-if="meeting.agenda?.status === 'published'">
            <div class="published-banner no-print">
              <div class="published-banner-row">
                <p>Agenda published {{ formatShort(meeting.agenda.publishedAt) }}. Items are locked.</p>
                <button type="button" class="print-btn" @click="printAgenda">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 6V1h8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="1" y="6" width="14" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M4 10h8M4 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  Print
                </button>
              </div>
            </div>
            <div class="print-header print-only">
              <p class="print-community">Quorum</p>
              <h1 class="print-title">{{ meeting.title }}</h1>
              <p class="print-meta">{{ formatDateTime(meeting.scheduledAt) }}<template v-if="meeting.location"> · {{ meeting.location }}</template></p>
              <p class="print-label">Meeting Agenda</p>
            </div>
            <!-- Published agenda items — visible to board too -->
            <ol class="agenda-list agenda-list--readonly">
              <li
                v-for="(item, i) in agendaItems"
                :key="item.id"
                class="agenda-item agenda-item--readonly"
              >
                <span class="item-num">{{ i + 1 }}</span>
                <div class="item-content">
                  <p class="item-title">{{ item.title }}</p>
                  <p v-if="item.description" class="item-desc">{{ item.description }}</p>
                  <p v-if="item.duration" class="item-duration">{{ item.duration }} min</p>
                </div>
              </li>
            </ol>
          </template>

          <div v-else-if="isMeetingPast && !meeting.agenda" class="empty-state">
            <p class="empty-title">No agenda was created</p>
            <p class="empty-desc">This meeting has already taken place.</p>
          </div>

          <div v-else class="agenda-builder">
            <ol v-if="agendaItems.length" class="agenda-list">
              <li v-for="(item, i) in agendaItems" :key="item.id" class="agenda-item">
                <span class="item-num">{{ i + 1 }}</span>
                <div class="item-fields">
                  <input
                    v-model="item.title"
                    class="item-input"
                    type="text"
                    placeholder="Agenda item title"
                    maxlength="255"
                    @change="saveAgenda"
                  />
                  <input
                    v-model="item.description"
                    class="item-input item-input--desc"
                    type="text"
                    placeholder="Description (optional)"
                    maxlength="500"
                    @change="saveAgenda"
                  />
                </div>
                <div class="item-controls">
                  <button
                    type="button"
                    class="ctrl-btn"
                    :disabled="i === 0"
                    aria-label="Move up"
                    @click="moveItem(i, -1)"
                  >↑</button>
                  <button
                    type="button"
                    class="ctrl-btn"
                    :disabled="i === agendaItems.length - 1"
                    aria-label="Move down"
                    @click="moveItem(i, 1)"
                  >↓</button>
                  <button
                    type="button"
                    class="ctrl-btn ctrl-btn--danger"
                    aria-label="Remove"
                    @click="removeItem(i)"
                  >✕</button>
                </div>
              </li>
            </ol>

            <button type="button" class="add-item-btn" @click="addItem">
              + Add agenda item
            </button>

            <p v-if="agendaSaving" class="save-note">Saving…</p>
            <p v-else-if="agendaSaved" class="save-note save-note--saved">Saved</p>
          </div>

          <div v-if="meeting.agenda?.status !== 'published' && agendaItems.length" class="agenda-footer">
            <BaseButton variant="primary" :loading="publishing" @click="publishAgenda">
              Publish agenda
            </BaseButton>
          </div>
        </template>
      </section>

      <!-- ── Minutes ──────────────────────────────────────────── -->
      <section v-else-if="activeTab === 'minutes'" class="tab-panel no-print">
        <!-- Resident view: published minutes only -->
        <template v-if="!isBoard">
          <div v-if="!meeting.minutes || meeting.minutes.status !== 'published'" class="empty-state">
            <p class="empty-title">Minutes not yet published</p>
            <p class="empty-desc">The board will publish minutes after the meeting.</p>
          </div>
          <div v-else class="minutes-body">
            <p class="minutes-published-note">
              Published {{ formatShort(meeting.minutes.publishedAt) }}
            </p>
            <div class="minutes-text">{{ meeting.minutes.body }}</div>
          </div>
        </template>

        <!-- Board view: full workflow -->
        <template v-else>
          <div class="minutes-workflow">
            <!-- Status banner -->
            <div v-if="minutesRecord" class="workflow-status">
              <span class="status-pill" :class="`status-pill--${minutesRecord.status}`">
                {{ minutesStatusLabel(minutesRecord.status) }}
              </span>
              <span v-if="minutesRecord.lastEditedAt" class="status-note">
                Last saved {{ formatShort(minutesRecord.lastEditedAt) }}
              </span>
            </div>

            <!-- Editor -->
            <div v-if="!minutesRecord || ['drafting', 'in_review'].includes(minutesRecord.status)" class="minutes-editor-wrap">
              <textarea
                v-model="minutesDraft"
                class="minutes-editor"
                placeholder="Write meeting minutes here…&#10;&#10;Note what was discussed, decisions made, and any action items."
                :readonly="minutesRecord?.status === 'published'"
                @input="scheduleSave"
              />
              <p v-if="minutesSaving" class="save-note">Saving…</p>
              <p v-else-if="minutesSaved" class="save-note save-note--saved">Saved</p>
            </div>

            <!-- Published view -->
            <div v-else class="minutes-body">
              <div class="minutes-text">{{ minutesRecord.body }}</div>
            </div>

            <!-- Approval section -->
            <div v-if="minutesRecord?.status === 'in_review' || minutesRecord?.status === 'approved'" class="approval-section">
              <h3 class="approval-title">Board approval</h3>
              <ul v-if="minutesRecord.approvals?.length" class="approval-list">
                <li v-for="a in currentRoundApprovals" :key="a.id" class="approval-row">
                  <span class="approval-name">{{ a.resident.firstName }} {{ a.resident.lastName }}</span>
                  <span class="approval-decision" :class="`approval-decision--${a.decision}`">
                    {{ a.decision === 'approved' ? 'Approved' : 'Changes requested' }}
                  </span>
                </li>
              </ul>

              <div v-if="!myApproval && minutesRecord.status === 'in_review'" class="approval-actions">
                <p class="approval-prompt">Review the minutes above and submit your decision.</p>
                <div v-if="approvalNoteOpen" class="field">
                  <textarea
                    v-model="approvalNote"
                    class="note-input"
                    placeholder="Note for the board (optional)…"
                    rows="2"
                    maxlength="500"
                  />
                </div>
                <div class="approval-btns">
                  <BaseButton
                    variant="ghost"
                    @click="approvalNoteOpen = !approvalNoteOpen"
                  >
                    {{ approvalNoteOpen ? 'Hide note' : 'Add note' }}
                  </BaseButton>
                  <BaseButton variant="danger" :loading="approving" @click="submitApproval('changes_requested')">
                    Request changes
                  </BaseButton>
                  <BaseButton variant="primary" :loading="approving" @click="submitApproval('approved')">
                    Approve
                  </BaseButton>
                </div>
              </div>
            </div>

            <!-- Action bar -->
            <div class="minutes-actions">
              <template v-if="!minutesRecord || minutesRecord.status === 'drafting'">
                <BaseButton
                  variant="primary"
                  :disabled="!minutesDraft.trim()"
                  :loading="finalizing"
                  @click="finalizeMinutes"
                >
                  Submit for board review
                </BaseButton>
              </template>

              <template v-else-if="minutesRecord.status === 'in_review'">
                <BaseButton variant="ghost" :loading="finalizing" @click="finalizeMinutes">
                  Re-submit after edits
                </BaseButton>
              </template>

              <template v-else-if="minutesRecord.status === 'approved'">
                <BaseButton variant="primary" :loading="publishing" @click="publishMinutes">
                  Publish minutes
                </BaseButton>
              </template>
            </div>
          </div>
        </template>
      </section>
    </template>

    <div v-else class="not-found">
      <p>Meeting not found.</p>
      <NuxtLink to="/meetings" class="back-link">← Back to meetings</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { user } = useAuth()
const api = useApi()
const toast = useToast()

const id = route.params.id as string
const isBoard = computed(() => !!user.value && isBoardMember(user.value))
const isMeetingPast = computed(() => !!meeting.value && new Date(meeting.value.scheduledAt) < new Date())

// ── Data ───────────────────────────────────────────────────────────────────
type Meeting = Awaited<ReturnType<typeof api.meetings.getDetail.query>>

const meeting = ref<Meeting | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true
  try {
    meeting.value = await api.meetings.getDetail.query({ id })
    syncFromMeeting()
  } catch {
    toast.error('Failed to load meeting')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── RSVP ───────────────────────────────────────────────────────────────────
const rsvpSaving = ref(false)
const myRsvp = ref<'attending' | 'not_attending' | null>(null)

const attendingRsvps = computed(() =>
  (meeting.value?.rsvps ?? []).filter(r => r.status === 'attending')
)
const attendingCount = computed(() => attendingRsvps.value.length)

watch(meeting, (m) => {
  if (!m || !user.value) return
  const mine = m.rsvps?.find(r => r.resident.id === user.value!.id)
  myRsvp.value = mine ? (mine.status as 'attending' | 'not_attending') : null
}, { immediate: true })

async function setRsvp(status: 'attending' | 'not_attending'): Promise<void> {
  if (myRsvp.value === status) return
  rsvpSaving.value = true
  try {
    await api.meetings.rsvp.mutate({ meetingId: id, status })
    myRsvp.value = status
    // update local count without full reload
    if (meeting.value) {
      const existing = meeting.value.rsvps?.find(r => r.resident.id === user.value!.id)
      if (existing) {
        existing.status = status
      } else {
        meeting.value.rsvps = [
          ...(meeting.value.rsvps ?? []),
          { id: crypto.randomUUID(), status, resident: { id: user.value!.id, firstName: user.value!.firstName, lastName: user.value!.lastName } },
        ]
      }
    }
    toast.success(status === 'attending' ? 'RSVP saved — see you there!' : 'RSVP saved.')
  } catch {
    toast.error('Failed to save RSVP.')
  } finally {
    rsvpSaving.value = false
  }
}

async function clearRsvp(): Promise<void> {
  rsvpSaving.value = true
  try {
    await api.meetings.removeRsvp.mutate({ meetingId: id })
    myRsvp.value = null
    if (meeting.value) {
      meeting.value.rsvps = meeting.value.rsvps?.filter(r => r.resident.id !== user.value!.id) ?? []
    }
  } catch {
    toast.error('Failed to remove RSVP.')
  } finally {
    rsvpSaving.value = false
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'agenda' | 'minutes'

const activeTab = ref<TabId>('overview')

const visibleTabs = computed(() => {
  if (!meeting.value) return []
  const tabs: { id: TabId; label: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'agenda', label: 'Agenda' },
  ]
  // Only show minutes tab if meeting is past or minutes already started
  // Board always sees Minutes tab; residents only once meeting is past or minutes exist
  if (isBoard.value || isMeetingPast.value || meeting.value.minutes) {
    tabs.push({ id: 'minutes', label: 'Minutes' })
  }
  return tabs
})

// ── Agenda ─────────────────────────────────────────────────────────────────
interface AgendaItem {
  id: string
  title: string
  description?: string
  duration?: number
}

type AgendaItemsType = AgendaItem[]

const agendaItems = ref<AgendaItemsType>([])
const agendaSaving = ref(false)
const agendaSaved = ref(false)
const publishing = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function syncFromMeeting(): void {
  const raw = meeting.value?.agenda?.items
  agendaItems.value = Array.isArray(raw) ? (raw as AgendaItemsType) : []

  const body = meeting.value?.minutes?.body ?? ''
  minutesDraft.value = body
}

function addItem(): void {
  agendaItems.value.push({ id: crypto.randomUUID(), title: '', description: '' })
}

function removeItem(i: number): void {
  agendaItems.value.splice(i, 1)
  saveAgenda()
}

function moveItem(i: number, dir: -1 | 1): void {
  const arr = agendaItems.value
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  saveAgenda()
}

async function saveAgenda(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  agendaSaved.value = false
  agendaSaving.value = true
  saveTimer = setTimeout(async () => {
    try {
      const saved = await api.meetings.upsertAgenda.mutate({
        meetingId: id,
        items: agendaItems.value.filter(it => it.title.trim()),
      })
      if (meeting.value) {
        meeting.value = { ...meeting.value, agenda: saved }
      }
      agendaSaved.value = true
    } catch {
      toast.error('Failed to save agenda')
    } finally {
      agendaSaving.value = false
    }
  }, 800)
}

async function publishAgenda(): Promise<void> {
  publishing.value = true
  try {
    await saveAgenda()
    const published = await api.meetings.publishAgenda.mutate({ meetingId: id })
    if (meeting.value) meeting.value = { ...meeting.value, agenda: published }
    toast.success('Agenda published')
  } catch {
    toast.error('Failed to publish agenda')
  } finally {
    publishing.value = false
  }
}

// ── Minutes ────────────────────────────────────────────────────────────────
type MinutesRecord = NonNullable<Meeting['minutes']>

const minutesRecord = computed(() => meeting.value?.minutes ?? null)
const minutesDraft = ref('')
const minutesSaving = ref(false)
const minutesSaved = ref(false)
const finalizing = ref(false)
const approving = ref(false)
let minutesSaveTimer: ReturnType<typeof setTimeout> | null = null

const currentRoundApprovals = computed(() => {
  const approvals = minutesRecord.value?.approvals ?? []
  if (!approvals.length) return []
  const maxRound = Math.max(...approvals.map(a => a.round))
  return approvals.filter(a => a.round === maxRound)
})

const myApproval = computed(() =>
  currentRoundApprovals.value.find(a => a.resident.id === user.value?.id)
)

const approvalNoteOpen = ref(false)
const approvalNote = ref('')

function scheduleSave(): void {
  if (minutesSaveTimer) clearTimeout(minutesSaveTimer)
  minutesSaved.value = false
  minutesSaving.value = true
  minutesSaveTimer = setTimeout(async () => {
    try {
      const saved = await api.minutes.upsert.mutate({ meetingId: id, body: minutesDraft.value })
      if (meeting.value) meeting.value = { ...meeting.value, minutes: saved as MinutesRecord }
      minutesSaved.value = true
    } catch {
      toast.error('Failed to save minutes')
    } finally {
      minutesSaving.value = false
    }
  }, 1200)
}

async function finalizeMinutes(): Promise<void> {
  if (!minutesDraft.value.trim()) return
  finalizing.value = true
  try {
    // Save first, then finalize
    if (minutesSaveTimer) {
      clearTimeout(minutesSaveTimer)
      await api.minutes.upsert.mutate({ meetingId: id, body: minutesDraft.value })
    }
    await api.minutes.finalize.mutate({ meetingId: id })
    await load()
    toast.success('Minutes submitted for board review')
  } catch {
    toast.error('Failed to submit minutes')
  } finally {
    finalizing.value = false
  }
}

async function submitApproval(decision: 'approved' | 'changes_requested'): Promise<void> {
  approving.value = true
  try {
    await api.minutes.submitApproval.mutate({
      meetingId: id,
      decision,
      notes: approvalNote.value || undefined,
    })
    await load()
    approvalNote.value = ''
    approvalNoteOpen.value = false
    toast.success(decision === 'approved' ? 'Approved' : 'Changes requested')
  } catch {
    toast.error('Failed to submit approval')
  } finally {
    approving.value = false
  }
}

async function publishMinutes(): Promise<void> {
  publishing.value = true
  try {
    await api.minutes.publish.mutate({ meetingId: id })
    await load()
    toast.success('Minutes published')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to publish'
    toast.error(msg)
  } finally {
    publishing.value = false
  }
}

// ── Print ──────────────────────────────────────────────────────────────────
function printAgenda(): void {
  activeTab.value = 'agenda'
  nextTick(() => window.print())
}

// ── Formatting ─────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  annual: 'Annual', special: 'Special', board: 'Board', emergency: 'Emergency',
}

function typeLabel(t: string | null): string { return TYPE_LABELS[t ?? ''] ?? t ?? '' }
function monthLabel(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function dayLabel(raw: string | Date): string { return String(new Date(raw).getDate()) }
function formatDateTime(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
function formatShort(raw: string | Date | null | undefined): string {
  if (!raw) return ''
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function statusLabel(s: string): string {
  return { scheduled: 'Scheduled', held: 'Held', cancelled: 'Cancelled' }[s] ?? s
}
function minutesStatusLabel(s: string): string {
  return {
    drafting: 'Drafting', in_review: 'In review', approved: 'Approved', published: 'Published',
  }[s] ?? s
}
</script>

<style scoped>
.meeting-detail {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);

  @media (min-width: 768px) {
    padding: var(--space-8) var(--space-6);
  }
}

/* ── Loading ─────────────────────────────────────────────────── */
.detail-loading {
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

/* ── Header ──────────────────────────────────────────────────── */
.back-link {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-4);

  &:hover { color: var(--text-primary); }
}

.detail-header {
  margin-bottom: var(--space-6);
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.header-meta {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.header-date-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
  flex-shrink: 0;
}

.header-month {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--blue-400);
  letter-spacing: 0.05em;
  line-height: 1.2;
}

.header-day {
  font-size: var(--text-3xl);
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1;
}

.header-title {
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.header-sub {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  flex-wrap: wrap;
}

.type-badge {
  background: var(--surface-raised);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.cancelled-badge {
  background: var(--danger-bg);
  color: var(--danger-text);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
}

/* ── Tabs ─────────────────────────────────────────────────────── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: var(--space-6);
}

.tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s;

  &:hover { color: var(--text-primary); }

  &.tab--active {
    color: var(--text-primary);
    border-bottom-color: var(--blue-400);
  }

  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.tab-badge {
  font-size: var(--text-xs);
  background: var(--blue-400);
  color: #fff;
  border-radius: var(--radius-full);
  padding: 1px var(--space-1);
  min-width: 18px;
  text-align: center;
}

/* ── Tab panel ───────────────────────────────────────────────── */
.tab-panel {
  animation: fade-in 0.12s ease;
}

@keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

/* ── Overview detail list ────────────────────────────────────── */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  padding: var(--space-3) var(--space-5);
  background: var(--surface-card);
  border-bottom: 0.5px solid var(--border-default);
  font-size: var(--text-sm);

  &:last-child { border-bottom: none; }

  dt {
    color: var(--text-tertiary);
    font-weight: 500;
  }

  dd {
    color: var(--text-primary);
    margin: 0;
  }
}

.status-cell { display: flex; align-items: center; }

.status-pill {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);

  &.status-pill--scheduled { background: var(--blue-50); color: var(--blue-600); }
  &.status-pill--held { background: var(--surface-raised); color: var(--text-secondary); }
  &.status-pill--cancelled { background: var(--danger-bg); color: var(--danger-text); }
  &.status-pill--drafting { background: var(--surface-raised); color: var(--text-secondary); }
  &.status-pill--in_review { background: var(--warning-bg, #fff8e6); color: var(--warning-text, #92580a); }
  &.status-pill--approved { background: var(--success-bg, #f0fdf4); color: var(--success-text, #166534); }
  &.status-pill--published { background: var(--blue-50); color: var(--blue-600); }
}

.published-note { color: var(--blue-600); font-size: var(--text-sm); }
.draft-note { color: var(--text-tertiary); font-size: var(--text-sm); }

/* ── Empty state ──────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-4);
}

.empty-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* ── Agenda builder ───────────────────────────────────────────── */
.published-banner {
  background: var(--blue-50);
  border: 0.5px solid var(--blue-100);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--blue-600);
  margin-bottom: var(--space-4);
}

.agenda-list {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &.agenda-list--readonly {
    border: 0.5px solid var(--border-default);
    border-radius: var(--radius-lg);
    overflow: hidden;
    gap: 0;
  }
}

.agenda-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);

  &.agenda-item--readonly {
    border: none;
    border-bottom: 0.5px solid var(--border-default);
    border-radius: 0;
    padding: var(--space-3) var(--space-5);

    &:last-child { border-bottom: none; }
  }
}

.item-num {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-tertiary);
  min-width: 20px;
  padding-top: 2px;
  flex-shrink: 0;
}

.item-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.item-input {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-page);
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }

  &.item-input--desc {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.item-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0 0 var(--space-1);
}

.item-duration {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.item-controls {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.ctrl-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  background: none;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  &:hover:not(:disabled) { background: var(--surface-raised); color: var(--text-primary); }
  &:disabled { opacity: 0.3; cursor: default; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.ctrl-btn--danger {
    color: var(--danger-text);
    border-color: var(--danger-mid);
    &:hover { background: var(--danger-bg); }
  }
}

.add-item-btn {
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
  margin-bottom: var(--space-2);

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.save-note {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: var(--space-1) 0 0;

  &.save-note--saved { color: var(--success-text, #166534); }
}

.agenda-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 0.5px solid var(--border-default);
}

/* ── Minutes ──────────────────────────────────────────────────── */
.minutes-workflow {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.workflow-status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-note {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.minutes-editor-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.minutes-editor {
  width: 100%;
  min-height: 320px;
  padding: var(--space-4);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--text-primary);
  background: var(--surface-card);
  resize: vertical;
  line-height: 1.7;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.minutes-body {
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  background: var(--surface-card);
}

.minutes-published-note {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-4);
}

.minutes-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-line;
}

/* ── Approval section ────────────────────────────────────────── */
.approval-section {
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.approval-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-5);
  border-bottom: 0.5px solid var(--border-default);
  margin: 0;
  background: var(--surface-raised);
}

.approval-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.approval-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  border-bottom: 0.5px solid var(--border-default);
  font-size: var(--text-sm);

  &:last-child { border-bottom: none; }
}

.approval-name { color: var(--text-primary); }

.approval-decision {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);

  &.approval-decision--approved {
    background: var(--success-bg, #f0fdf4);
    color: var(--success-text, #166534);
  }

  &.approval-decision--changes_requested {
    background: var(--danger-bg);
    color: var(--danger-text);
  }
}

.approval-actions {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-top: 0.5px solid var(--border-default);
}

.approval-prompt {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.approval-btns {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
}

.note-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--text-primary);
  background: var(--surface-card);
  resize: none;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.minutes-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

/* ── Not found ────────────────────────────────────────────────── */
.not-found {
  text-align: center;
  padding: var(--space-16) var(--space-4);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

/* ── Print button & toolbar ──────────────────────────────────── */
.agenda-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.published-banner-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.print-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Print-only header (hidden on screen) ────────────────────── */
.print-only {
  display: none;
}

.print-header {
  margin-bottom: 24pt;
  border-bottom: 1pt solid #ccc;
  padding-bottom: 12pt;
}

.print-community {
  font-size: 9pt;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4pt;
}

.print-title {
  font-size: 18pt;
  font-weight: 500;
  margin-bottom: 4pt;
  color: #000;
}

.print-meta {
  font-size: 10pt;
  color: #555;
  margin-bottom: 6pt;
}

.print-label {
  font-size: 11pt;
  font-weight: 500;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
/* ── RSVP & Calendar ──────────────────────────────────────────── */
.rsvp-count {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.overview-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 0.5px solid var(--border-subtle);
}

.rsvp-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.rsvp-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);

  &:hover:not(:disabled) { background: var(--surface-raised); color: var(--text-primary); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &--active {
    color: var(--success-text);
    border-color: var(--success-text);
    background: var(--success-bg);
  }

  &--active-no {
    color: var(--danger-text);
    border-color: var(--danger-mid);
    background: var(--danger-bg);
  }
}

.rsvp-clear {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  min-height: 44px;

  &:hover { text-decoration: underline; color: var(--text-secondary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }
}

.calendar-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
  margin-left: auto;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  @media (max-width: 30rem) { margin-left: 0; }
}

.attendee-list {
  margin-top: var(--space-4);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.attendee-list-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-4);
  background: var(--surface-raised);
  margin: 0;
  border-bottom: 0.5px solid var(--border-subtle);
}

.attendee-item {
  font-size: var(--text-sm);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);
  list-style: none;

  &:last-child { border-bottom: none; }
}
</style>
