<template>
  <div class="feed-page">

    <!-- Header -->
    <header class="feed-header">
      <h1 class="feed-title">Feed</h1>
      <div class="feed-header-actions">
        <NuxtLink v-if="unreadMessageCount > 0" :to="unreadMessageLink" class="msg-badge">
          <span class="msg-badge-dot" aria-hidden="true" />
          {{ unreadMessageCount }} unread
        </NuxtLink>
        <div v-if="isBoard" class="view-toggle" role="group" aria-label="View as">
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'view-toggle-btn--active': !previewAsResident }"
            @click="previewAsResident = false"
          >Board</button>
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ 'view-toggle-btn--active': previewAsResident }"
            @click="previewAsResident = true"
          >Resident</button>
        </div>
      </div>
    </header>

    <!-- Inline composer (board only, not in resident preview) -->
    <div v-if="isBoard && !previewAsResident" class="composer-card">
      <!-- Collapsed prompt -->
      <div v-if="!composerOpen" class="composer-prompt" @click="openComposer">
        <span class="composer-avatar" aria-hidden="true">
          {{ user?.firstName?.[0] }}{{ user?.lastName?.[0] }}
        </span>
        <span class="composer-placeholder">Share an announcement…</span>
        <button type="button" class="composer-schedule-btn" @click.stop="openSchedule">
          <FaIcon :icon="['fajr', 'calendar']" />
          Schedule meeting
        </button>
      </div>

      <!-- Expanded form -->
      <form v-else class="composer-form" @submit.prevent="submitForm">
        <input
          ref="composerTitleEl"
          v-model="form.title"
          class="composer-input"
          type="text"
          placeholder="Announcement title"
          maxlength="255"
          required
        />
        <textarea
          v-model="form.body"
          class="composer-input composer-input--body"
          placeholder="Write your announcement…"
          rows="3"
          required
        />

        <!-- Image attachment -->
        <div v-if="imagePreview" class="composer-image-preview">
          <img :src="imagePreview" alt="Attachment preview" class="preview-img" />
          <button type="button" class="preview-remove" aria-label="Remove image" @click="removeImage">
            <FaIcon :icon="['fajr', 'xmark']" />
          </button>
        </div>

        <div class="composer-options">
          <select v-model="form.priority" class="composer-select">
            <option value="general">General</option>
            <option value="urgent">Urgent</option>
          </select>
          <BaseCheckbox v-model="form.pinned">Pin to top</BaseCheckbox>
          <label class="composer-img-btn" :class="{ 'composer-img-btn--active': !!imagePreview }">
            <FaIcon :icon="['fajr', 'image']" />
            <span>{{ imagePreview ? 'Change photo' : 'Add photo' }}</span>
            <input
              ref="imageFileEl"
              type="file"
              accept="image/*"
              class="visually-hidden"
              @change="onImagePicked"
            />
          </label>
        </div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="composer-footer">
          <button type="button" class="composer-cancel" @click="closeComposer">Cancel</button>
          <BaseButton variant="primary" type="submit" :loading="submitting || imageUploading">
            {{ imageUploading ? 'Uploading…' : 'Post' }}
          </BaseButton>
        </div>
      </form>
    </div>

    <!-- Filter tabs -->
    <div class="filter-tabs" role="tablist" aria-label="Filter feed">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        <FaIcon :icon="['fajr', tab.icon]" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Feed -->
    <div v-if="loading" class="feed-loading">
      <div class="spinner" />
    </div>

    <div v-else-if="!filteredItems.length" class="feed-empty">
      <FaIcon :icon="['fajr', emptyState.icon]" class="empty-icon" />
      <p class="empty-title">{{ emptyState.title }}</p>
      <p class="empty-desc">{{ emptyState.desc }}</p>
    </div>

    <div v-else class="feed">
      <template v-for="item in filteredItems" :key="item.id">

        <!-- Announcement -->
        <article
          v-if="item.type === 'announcement'"
          class="feed-card"
          :class="{
            'feed-card--urgent': item.data.priority === 'urgent',
            'feed-card--pinned': item.data.pinned,
          }"
        >
          <div class="card-top">
            <div class="card-badges">
              <span v-if="item.data.pinned" class="badge badge--pinned">
                <FaIcon :icon="['fajr', 'thumbtack']" /> Pinned
              </span>
              <span v-if="item.data.priority === 'urgent'" class="badge badge--urgent">Urgent</span>
              <span v-if="isUnread(item.data)" class="badge badge--new">New</span>
            </div>
            <div v-if="isBoard && !previewAsResident" class="card-actions">
              <button type="button" class="icon-btn" :class="{ 'icon-btn--active': item.data.pinned }" :title="item.data.pinned ? 'Unpin' : 'Pin'" @click="togglePin(item.data)">
                <FaIcon :icon="['fajr', 'thumbtack']" />
              </button>
              <button type="button" class="icon-btn" title="Edit" @click="openEdit(item.data)">
                <FaIcon :icon="['fajr', 'pencil']" />
              </button>
              <button type="button" class="icon-btn icon-btn--danger" title="Hide" @click="openHide(item.data)">
                <FaIcon :icon="['fajr', 'eye-slash']" />
              </button>
            </div>
          </div>

          <h2 class="card-title">{{ item.data.title }}</h2>
          <p class="card-body" :class="{ 'card-body--expanded': expandedId === item.id }">{{ item.data.body }}</p>
          <button v-if="item.data.body.length > 240" type="button" class="expand-btn" @click="toggleExpand(item.id)">
            {{ expandedId === item.id ? 'Show less' : 'Read more' }}
          </button>
          <img v-if="item.data.imageUrl" :src="item.data.imageUrl" alt="" class="card-image" />
          <div class="card-meta">
            <span v-if="item.data.createdByResident" class="meta-author">
              {{ item.data.createdByResident.firstName }} {{ item.data.createdByResident.lastName }}
            </span>
            <span class="meta-dot">·</span>
            <time :datetime="String(item.data.createdAt)">{{ formatDate(item.data.createdAt) }}</time>
          </div>
        </article>

        <!-- Poll -->
        <article v-else-if="item.type === 'poll'" class="feed-card feed-card--poll">
          <div class="poll-body">
            <div class="poll-top">
              <span class="poll-badge"><FaIcon :icon="['fajr', 'chart-bar']" /> Poll</span>
              <span v-if="item.data.hasVoted" class="poll-voted"><FaIcon :icon="['fajr', 'check']" /> Voted</span>
            </div>

            <p class="poll-title">{{ item.data.title }}</p>

            <!-- Voting options -->
            <div v-if="item.data.canVote" class="poll-options">
              <BaseRadio
                v-for="opt in item.data.options"
                :key="opt.id"
                :model-value="pollSelections[item.data.id]"
                :value="opt.id"
                :name="`poll-${item.data.id}`"
                :wrap-class="['poll-option', { 'poll-option--selected': pollSelections[item.data.id] === opt.id }]"
                @update:model-value="pollSelections[item.data.id] = opt.id"
              >{{ opt.label }}</BaseRadio>
              <div class="poll-vote-row">
                <BaseButton
                  variant="primary"
                  size="sm"
                  :disabled="!pollSelections[item.data.id]"
                  :loading="pollSubmitting[item.data.id]"
                  @click="submitPollVote(item.data)"
                >Submit vote</BaseButton>
                <NuxtLink :to="`/polls/${item.data.id}`" class="poll-detail-link">View details</NuxtLink>
              </div>
            </div>

            <!-- Results (voted, closed, or board preview) -->
            <div v-else-if="item.data.hasVoted || item.data.status === 'closed' || item.data.options[0]?.responseCount !== null" class="poll-results">
              <div v-for="opt in item.data.options" :key="opt.id" class="poll-result-row">
                <div class="poll-result-header">
                  <span class="poll-result-label" :class="{ 'poll-result-label--my-vote': opt.id === item.data.myVotedOptionId }">
                    {{ opt.label }}
                  </span>
                  <span class="poll-result-pct">{{ pollPct(opt.responseCount, item.data.responseCount) }}%</span>
                </div>
                <div class="poll-result-bar-wrap">
                  <div
                    class="poll-result-bar"
                    :class="{ 'poll-result-bar--my-vote': opt.id === item.data.myVotedOptionId }"
                    :style="{ width: pollPct(opt.responseCount, item.data.responseCount) + '%' }"
                  />
                </div>
              </div>
              <NuxtLink :to="`/polls/${item.data.id}`" class="poll-detail-link">View full results</NuxtLink>
            </div>

            <!-- Ineligible (owners-only, user is renter) -->
            <p v-else class="poll-ineligible">This poll is open to owners only.</p>

            <p class="poll-meta">
              <FaIcon :icon="['fajr', 'users']" />
              {{ item.data.responseCount }} response{{ item.data.responseCount === 1 ? '' : 's' }}
              <template v-if="item.data.closesAt">
                <span class="meta-dot">·</span>
                <FaIcon :icon="['fajr', 'clock']" />
                Closes {{ formatDate(item.data.closesAt) }}
              </template>
            </p>
          </div>
        </article>

        <!-- Meeting -->
        <article v-else-if="item.type === 'meeting'" class="feed-card feed-card--meeting">
          <NuxtLink :to="`/meetings/${item.data.id}`" class="meeting-link">
            <div class="meeting-date">
              <span class="meeting-month">{{ meetingMonth(item.data.scheduledAt) }}</span>
              <span class="meeting-day">{{ meetingDay(item.data.scheduledAt) }}</span>
            </div>
            <div class="meeting-info">
              <span class="meeting-type-pill">{{ typeLabel(item.data.meetingType) }}</span>
              <p class="meeting-title">{{ item.data.title }}</p>
              <p class="meeting-meta">
                <FaIcon :icon="['fajr', 'clock']" />
                {{ meetingTime(item.data.scheduledAt) }}
                <template v-if="item.data.location">
                  <span class="meta-dot">·</span>
                  <FaIcon :icon="['fajr', 'location-dot']" />
                  {{ item.data.location }}
                </template>
                <template v-if="item.data.rsvps?.length">
                  <span class="meta-dot">·</span>
                  <FaIcon :icon="['fajr', 'circle-check']" />
                  {{ item.data.rsvps.filter((r: { status: string }) => r.status === 'attending').length }} attending
                </template>
              </p>
            </div>
            <FaIcon :icon="['fajr', 'angle-right']" class="meeting-arrow" />
          </NuxtLink>
          <div class="meeting-rsvp-row">
            <button
              class="rsvp-inline-btn"
              :class="{ 'rsvp-inline-btn--yes': meetingRsvpStates[item.data.id] === 'attending' }"
              :disabled="meetingRsvpSaving[item.data.id]"
              type="button"
              @click="toggleMeetingRsvp(item.data.id, 'attending')"
            >
              <FaIcon :icon="['fajr', 'circle-check']" />
              {{ meetingRsvpStates[item.data.id] === 'attending' ? 'Going' : 'I\'ll be there' }}
            </button>
            <button
              class="rsvp-inline-btn"
              :class="{ 'rsvp-inline-btn--no': meetingRsvpStates[item.data.id] === 'not_attending' }"
              :disabled="meetingRsvpSaving[item.data.id]"
              type="button"
              @click="toggleMeetingRsvp(item.data.id, 'not_attending')"
            >
              <FaIcon :icon="['fajr', 'circle-xmark']" />
              {{ meetingRsvpStates[item.data.id] === 'not_attending' ? 'Can\'t go' : 'Can\'t make it' }}
            </button>
          </div>
        </article>

      </template>
    </div>

    <!-- Edit modal -->
    <BaseModal :open="showForm" title="Edit announcement" @close="closeForm">
      <form class="modal-form" @submit.prevent="submitForm">
        <div class="field">
          <label class="label" for="ann-title">Title</label>
          <input id="ann-title" v-model="form.title" class="input" type="text" placeholder="Announcement title" maxlength="255" required />
        </div>
        <div class="field">
          <label class="label" for="ann-body">Message</label>
          <textarea id="ann-body" v-model="form.body" class="input input--textarea" placeholder="Write your announcement…" rows="5" required />
        </div>
        <div class="field">
          <label class="label">Photo <span class="label-optional">(optional)</span></label>
          <div v-if="imagePreview" class="modal-image-preview">
            <img :src="imagePreview" alt="Attachment preview" class="preview-img" />
            <button type="button" class="preview-remove" aria-label="Remove image" @click="removeImage">
              <FaIcon :icon="['fajr', 'xmark']" />
            </button>
          </div>
          <label v-else class="img-upload-label">
            <FaIcon :icon="['fajr', 'image']" />
            Choose a photo
            <input
              type="file"
              accept="image/*"
              class="visually-hidden"
              @change="onImagePicked"
            />
          </label>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label" for="ann-priority">Priority</label>
            <select id="ann-priority" v-model="form.priority" class="input">
              <option value="general">General</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <BaseCheckbox v-model="form.pinned">Pin to top</BaseCheckbox>
        </div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="closeForm">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="submitting || imageUploading">
            {{ imageUploading ? 'Uploading…' : 'Save changes' }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Hide modal -->
    <BaseModal :open="!!hideTarget" title="Hide announcement" size="sm" @close="hideTarget = null">
      <form class="modal-form" @submit.prevent="submitHide">
        <p class="modal-desc">This announcement will be hidden from residents.</p>
        <div class="field">
          <label class="label" for="hide-reason">Reason</label>
          <textarea id="hide-reason" v-model="hideReason" class="input input--textarea" placeholder="Explain why…" rows="3" maxlength="500" required />
        </div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="hideTarget = null">Cancel</BaseButton>
          <BaseButton variant="danger" type="submit" :loading="submitting">Hide post</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Schedule meeting modal -->
    <BaseModal :open="showMeetingForm" title="Schedule meeting" @close="showMeetingForm = false">
      <form class="modal-form" @submit.prevent="submitMeeting">
        <div class="field">
          <label class="label" for="m-title">Title</label>
          <input id="m-title" v-model="meetingForm.title" class="input" type="text" placeholder="e.g. Annual Homeowners Meeting" maxlength="255" required />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label" for="m-type">Type</label>
            <select id="m-type" v-model="meetingForm.meetingType" class="input">
              <option value="annual">Annual</option>
              <option value="special">Special</option>
              <option value="board">Board</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div class="field">
            <label class="label">Date &amp; time</label>
            <BaseDateTimePicker v-model="meetingForm.scheduledAt" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="m-location">Location <span class="label-optional">(optional)</span></label>
          <input id="m-location" v-model="meetingForm.location" class="input" type="text" placeholder="e.g. Community Centre, Room B" maxlength="255" />
        </div>
        <div v-if="meetingError" class="form-error" role="alert">{{ meetingError }}</div>
        <div class="modal-footer">
          <BaseButton variant="ghost" type="button" @click="showMeetingForm = false">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="meetingSubmitting">Schedule</BaseButton>
        </div>
      </form>
    </BaseModal>

  </div>
</template>

<script setup lang="ts">
import { isBoardMember as checkBoardMember } from '../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const toast = useToast()
const { isUnread, markAllRead, hydrate } = useAnnouncementRead()

const isBoard = computed(() => !!user.value && checkBoardMember(user.value))
const previewAsResident = ref(false)

// ── Types ──────────────────────────────────────────────────────────────────
type Announcement = Awaited<ReturnType<typeof api.announcements.list.query>>[number]
type Thread = Awaited<ReturnType<typeof api.messages.list.query>>[number]
type Meeting = Awaited<ReturnType<typeof api.meetings.list.query>>[number]
type Poll = Awaited<ReturnType<typeof api.polls.list.query>>[number]
type FeedItem =
  | { id: string; type: 'announcement'; data: Announcement; sortKey: number }
  | { id: string; type: 'meeting'; data: Meeting; sortKey: number }
  | { id: string; type: 'poll'; data: Poll; sortKey: number }

// ── Data ───────────────────────────────────────────────────────────────────
const allAnnouncements = ref<Announcement[]>([])
const allThreads = ref<Thread[]>([])
const allMeetings = ref<Meeting[]>([])
const allPolls = ref<Poll[]>([])
const loading = ref(true)

const unreadThreads = computed(() =>
  allThreads.value.filter(t => t.lastMessage && t.lastMessage.senderId !== user.value?.id && !t.lastMessage.readAt)
)
const unreadMessageCount = computed(() => unreadThreads.value.length)
const unreadMessageLink = computed(() =>
  unreadThreads.value.length === 1 ? `/messages?thread=${unreadThreads.value[0]!.id}` : '/messages'
)

const MEETING_WINDOW_MS = 60 * 24 * 60 * 60 * 1000

const feedItems = computed((): FeedItem[] => {
  const items: FeedItem[] = []
  const now = Date.now()

  for (const a of allAnnouncements.value) {
    if (a.hidden) continue
    items.push({
      id: `ann-${a.id}`,
      type: 'announcement',
      data: a,
      sortKey: a.pinned ? Number.MAX_SAFE_INTEGER : new Date(a.createdAt).getTime(),
    })
  }

  for (const m of allMeetings.value) {
    const t = new Date(m.scheduledAt).getTime()
    if (m.status === 'cancelled' || t <= now || t > now + MEETING_WINDOW_MS) continue
    items.push({ id: `mtg-${m.id}`, type: 'meeting', data: m, sortKey: t })
  }

  for (const p of allPolls.value) {
    if (p.status !== 'open') continue
    items.push({
      id: `poll-${p.id}`,
      type: 'poll',
      data: p,
      sortKey: p.openedAt ? new Date(p.openedAt).getTime() : new Date(p.createdAt).getTime(),
    })
  }

  return items.sort((a, b) => b.sortKey - a.sortKey)
})

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'all',           label: 'All',           icon: 'list' },
  { id: 'announcements', label: 'Announcements', icon: 'bell' },
  { id: 'meetings',      label: 'Meetings',      icon: 'calendar' },
  { id: 'polls',         label: 'Polls',         icon: 'chart-bar' },
] as const

type TabId = typeof tabs[number]['id']
const activeTab = ref<TabId>('all')

const filteredItems = computed(() => {
  if (activeTab.value === 'announcements') return feedItems.value.filter(i => i.type === 'announcement')
  if (activeTab.value === 'meetings')      return feedItems.value.filter(i => i.type === 'meeting')
  if (activeTab.value === 'polls')         return feedItems.value.filter(i => i.type === 'poll')
  return feedItems.value
})

const emptyState = computed(() => {
  const tab = activeTab.value
  if (tab === 'announcements') return { icon: 'newspaper', title: 'No announcements yet', desc: 'Your board hasn\'t posted anything yet. Check back soon.' }
  if (tab === 'meetings') return { icon: 'calendar', title: 'No upcoming meetings', desc: 'No meetings are scheduled in the next 90 days.' }
  if (tab === 'polls') return { icon: 'chart-bar', title: 'No open polls', desc: 'Your board hasn\'t opened any polls yet.' }
  return { icon: 'newspaper', title: 'Nothing here yet', desc: 'New announcements, meetings, and polls will appear here.' }
})

// ── Expand ─────────────────────────────────────────────────────────────────
const expandedId = ref<string | null>(null)

function toggleExpand(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}

// ── Poll voting ─────────────────────────────────────────────────────────────
const pollSelections = ref<Record<string, string>>({})
const pollSubmitting = ref<Record<string, boolean>>({})

// ── Meeting RSVP ───────────────────────────────────────────────────────────
const meetingRsvpStates = ref<Record<string, 'attending' | 'not_attending' | null>>({})
const meetingRsvpSaving = ref<Record<string, boolean>>({})

watch(allMeetings, (meetings) => {
  for (const m of meetings) {
    const mine = m.rsvps?.find((r: { residentId: string }) => r.residentId === user.value?.id)
    meetingRsvpStates.value[m.id] = (mine?.status as 'attending' | 'not_attending') ?? null
  }
}, { immediate: true })

async function toggleMeetingRsvp(meetingId: string, status: 'attending' | 'not_attending'): Promise<void> {
  const current = meetingRsvpStates.value[meetingId]
  meetingRsvpSaving.value[meetingId] = true
  try {
    if (current === status) {
      await api.meetings.removeRsvp.mutate({ meetingId })
      meetingRsvpStates.value[meetingId] = null
      const m = allMeetings.value.find(x => x.id === meetingId)
      if (m) m.rsvps = m.rsvps?.filter((r: { residentId: string }) => r.residentId !== user.value?.id) ?? []
    } else {
      await api.meetings.rsvp.mutate({ meetingId, status })
      meetingRsvpStates.value[meetingId] = status
      const m = allMeetings.value.find(x => x.id === meetingId)
      if (m) {
        const filtered = m.rsvps?.filter((r: { residentId: string }) => r.residentId !== user.value?.id) ?? []
        m.rsvps = [...filtered, { id: '', residentId: user.value?.id ?? '', status }]
      }
    }
  } catch {
    // silently ignore — the detail page will reflect truth
  } finally {
    meetingRsvpSaving.value[meetingId] = false
  }
}

type PollFeedData = Extract<FeedItem, { type: 'poll' }>['data']

function pollPct(count: number | null, total: number): number {
  if (!count || !total) return 0
  return Math.round((count / total) * 100)
}

async function submitPollVote(pollData: PollFeedData): Promise<void> {
  const optionId = pollSelections.value[pollData.id]
  if (!optionId) return
  pollSubmitting.value[pollData.id] = true
  try {
    await api.polls.respond.mutate({ pollId: pollData.id, optionId })
    // Update local state so results render immediately
    const idx = allPolls.value.findIndex(p => p.id === pollData.id)
    if (idx !== -1) {
      const p = allPolls.value[idx]!
      allPolls.value[idx] = {
        ...p,
        hasVoted: true,
        canVote: false,
        myVotedOptionId: optionId,
        responseCount: p.responseCount + 1,
        options: p.options.map(o => ({
          ...o,
          responseCount: (o.responseCount ?? 0) + (o.id === optionId ? 1 : 0),
        })),
      }
    }
    toast.success('Vote recorded.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to submit vote.')
  } finally {
    pollSubmitting.value[pollData.id] = false
  }
}

// ── Load ───────────────────────────────────────────────────────────────────
async function load(): Promise<void> {
  loading.value = true
  await Promise.all([
    api.announcements.list.query().then(d => {
      allAnnouncements.value = d
      hydrate(d)
      setTimeout(() => markAllRead(d), 1500)
    }).catch(() => {}),
    api.messages.list.query().then(d => { allThreads.value = d }).catch(() => {}),
    api.meetings.list.query().then(d => { allMeetings.value = d }).catch(() => {}),
    api.polls.list.query().then(d => { allPolls.value = d }).catch(() => {}),
  ])
  loading.value = false
}

onMounted(load)

// ── Pin ────────────────────────────────────────────────────────────────────
async function togglePin(item: Announcement): Promise<void> {
  try {
    const updated = await api.announcements.pin.mutate({ id: item.id, pinned: !item.pinned })
    const idx = allAnnouncements.value.findIndex(a => a.id === item.id)
    if (idx !== -1) allAnnouncements.value[idx] = { ...allAnnouncements.value[idx]!, ...updated }
  } catch {
    toast.error('Failed to update pin')
  }
}

// ── Image upload ───────────────────────────────────────────────────────────
const imageFileEl = ref<HTMLInputElement | null>(null)
const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)
const imageUploading = ref(false)

function resizeImage(file: File, maxPx = 1200, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
    img.src = objectUrl
  })
}

async function onImagePicked(e: Event): Promise<void> {
  const raw = (e.target as HTMLInputElement).files?.[0]
  if (!raw) return
  try {
    const resized = await resizeImage(raw)
    imageFile.value = resized
    imagePreview.value = URL.createObjectURL(resized)
  } catch {
    toast.error('Could not process image. Please try another file.')
  }
}

function removeImage(): void {
  imagePreview.value = null
  imageFile.value = null
  if (imageFileEl.value) imageFileEl.value.value = ''
}

async function uploadImageIfNeeded(): Promise<string | null> {
  if (!imageFile.value) return imagePreview.value?.startsWith('http') ? imagePreview.value : null
  imageUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', imageFile.value)
    const res = await $fetch<{ url: string }>('/api/upload/announcement-image', { method: 'POST', body: fd })
    return res.url
  } finally {
    imageUploading.value = false
  }
}

// ── Inline composer ────────────────────────────────────────────────────────
const composerOpen = ref(false)
const composerTitleEl = ref<HTMLInputElement | null>(null)

function openComposer(): void {
  form.title = ''
  form.body = ''
  form.priority = 'general'
  form.pinned = false
  formError.value = ''
  removeImage()
  composerOpen.value = true
  nextTick(() => composerTitleEl.value?.focus())
}

function closeComposer(): void {
  composerOpen.value = false
  removeImage()
}

// ── Create / Edit ──────────────────────────────────────────────────────────
const showForm = ref(false)
const editTarget = ref<Announcement | null>(null)
const submitting = ref(false)
const formError = ref('')
const form = reactive({ title: '', body: '', priority: 'general' as 'general' | 'urgent', pinned: false })

function openEdit(item: Announcement): void {
  editTarget.value = item
  form.title = item.title
  form.body = item.body
  form.priority = item.priority as 'general' | 'urgent'
  form.pinned = item.pinned
  formError.value = ''
  imageFile.value = null
  imagePreview.value = (item as Announcement & { imageUrl?: string | null }).imageUrl ?? null
  showForm.value = true
}

function closeForm(): void {
  showForm.value = false
  editTarget.value = null
  removeImage()
}

async function submitForm(): Promise<void> {
  formError.value = ''
  submitting.value = true
  try {
    const imageUrl = await uploadImageIfNeeded().catch(() => {
      formError.value = 'Image upload failed. Please try again.'
      return undefined
    })
    if (imageUrl === undefined) return

    if (editTarget.value) {
      const updated = await api.announcements.update.mutate({ id: editTarget.value.id, ...form, imageUrl })
      const idx = allAnnouncements.value.findIndex(a => a.id === updated.id)
      if (idx !== -1) allAnnouncements.value[idx] = { ...allAnnouncements.value[idx]!, ...updated }
      toast.success('Announcement updated')
      closeForm()
    } else {
      await api.announcements.create.mutate({ ...form, imageUrl })
      closeComposer()
      await load()
      toast.success('Announcement posted')
    }
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
  submitting.value = true
  try {
    const updated = await api.announcements.hide.mutate({ id: hideTarget.value.id, reason: hideReason.value })
    const idx = allAnnouncements.value.findIndex(a => a.id === updated.id)
    if (idx !== -1) allAnnouncements.value[idx] = { ...allAnnouncements.value[idx]!, ...updated }
    hideTarget.value = null
    toast.success('Announcement hidden')
  } catch {
    formError.value = 'Failed to hide announcement.'
  } finally {
    submitting.value = false
  }
}

// ── Schedule meeting ───────────────────────────────────────────────────────
const showMeetingForm = ref(false)
const meetingSubmitting = ref(false)
const meetingError = ref('')
const meetingForm = reactive({
  title: '',
  meetingType: 'annual' as 'annual' | 'special' | 'board' | 'emergency',
  scheduledAt: '',
  location: '',
})

function openSchedule(): void {
  const next = new Date()
  next.setDate(next.getDate() + 14)
  next.setHours(18, 0, 0, 0)
  meetingForm.title = ''
  meetingForm.meetingType = 'annual'
  meetingForm.scheduledAt = next.toISOString()
  meetingForm.location = ''
  meetingError.value = ''
  showMeetingForm.value = true
}

async function submitMeeting(): Promise<void> {
  meetingError.value = ''
  meetingSubmitting.value = true
  try {
    await api.meetings.create.mutate({
      title: meetingForm.title,
      meetingType: meetingForm.meetingType,
      scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
      location: meetingForm.location || undefined,
    })
    toast.success('Meeting scheduled')
    showMeetingForm.value = false
    await load()
  } catch {
    meetingError.value = 'Something went wrong. Please try again.'
  } finally {
    meetingSubmitting.value = false
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────
function formatDate(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function meetingMonth(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function meetingDay(raw: string | Date): string {
  return String(new Date(raw).getDate())
}
function meetingTime(raw: string | Date): string {
  return new Date(raw).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function typeLabel(t: string | null): string {
  const map: Record<string, string> = { annual: 'Annual', special: 'Special', board: 'Board', emergency: 'Emergency' }
  return map[t ?? ''] ?? t ?? 'Meeting'
}
</script>

<style scoped>
.feed-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 680px;
  margin: 0 auto;
}

/* ── Header ───────────────────────────────────────────────────── */
.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.feed-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.feed-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.msg-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--blue-50);
  border: 1px solid var(--blue-100);
  color: var(--blue-600);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  text-decoration: none;
  white-space: nowrap;

  &:hover { background: var(--blue-100); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.msg-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--blue-400);
}

.view-toggle {
  display: flex;
  background: var(--surface-raised);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 3px;
  gap: 2px;
}

.view-toggle-btn {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  background: none;
  border: none;
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  min-height: 44px;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { color: var(--text-secondary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.view-toggle-btn--active {
    background: var(--surface-card);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
}

/* ── Composer ─────────────────────────────────────────────────── */
.composer-card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.composer-prompt {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: text;
  min-height: 56px;

  &:hover .composer-placeholder { color: var(--text-secondary); }
}

.composer-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--surface-raised);
  border: 0.5px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  flex-shrink: 0;
  text-transform: uppercase;
}

.composer-placeholder {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  transition: color var(--transition-fast);
}

.composer-schedule-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: none;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  min-height: 36px;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  @media (max-width: 28rem) { display: none; }
}

.composer-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.composer-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-raised);
  box-sizing: border-box;
  font-family: inherit;
  min-height: 44px;
  transition: border-color var(--transition-fast);

  &:focus { outline: none; box-shadow: var(--shadow-focus); border-color: var(--border-focus); background: var(--surface-card); }

  &--body {
    resize: none;
    line-height: 1.6;
    min-height: 80px;
  }
}

.composer-options {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.composer-select {
  padding: var(--space-1) var(--space-3);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  min-height: 36px;
  cursor: pointer;

  &:focus { outline: none; box-shadow: var(--shadow-focus); }
}


.composer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-1);
  border-top: 0.5px solid var(--border-subtle);
}

.composer-img-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  min-height: 36px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &--active { color: var(--blue-400); border-color: var(--blue-200); background: var(--blue-50); }
}

.composer-image-preview,
.modal-image-preview {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 0.5px solid var(--border-default);
}

.preview-img {
  display: block;
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}

.preview-remove {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;

  &:hover { background: rgba(0,0,0,0.75); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.img-upload-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  min-height: 44px;
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);

  &:hover { border-color: var(--border-strong); color: var(--text-primary); }
}

.card-image {
  display: block;
  width: calc(100% + var(--space-5) * 2);
  margin: var(--space-3) calc(var(--space-5) * -1) 0;
  max-height: 480px;
  object-fit: contain;
  object-position: center;
  background: var(--surface-raised);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
}

.composer-cancel {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: none;
  border: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  min-height: 36px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Filter tabs ──────────────────────────────────────────────── */
.filter-tabs {
  display: flex;
  gap: var(--space-1);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: none;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.tab--active {
    background: var(--surface-raised);
    color: var(--text-primary);
  }

  @media (min-width: 30rem) {
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    flex-shrink: 1;
  }
}

/* ── Feed ─────────────────────────────────────────────────────── */
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-16) var(--space-4);
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 2rem;
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
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
  max-width: 28rem;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ── Feed card ────────────────────────────────────────────────── */
.feed-card {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);

  &.feed-card--urgent { border-left: 3px solid var(--danger-mid); }
  &.feed-card--meeting { padding: 0; overflow: hidden; }
  &.feed-card--poll { padding: 0; overflow: hidden; }
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  min-height: 24px;
}

.card-badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);

  &.badge--new     { background: var(--blue-400); color: var(--text-inverse); }
  &.badge--pinned  { background: var(--surface-raised); color: var(--text-secondary); border: 0.5px solid var(--border-default); }
  &.badge--urgent  { background: var(--danger-mid); color: var(--text-inverse); }
}

.card-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-tertiary);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.icon-btn--active {
    color: var(--blue-400);
    border-color: var(--blue-400);
    background: var(--blue-50);
    &:hover { background: var(--blue-100); }
  }

  &.icon-btn--danger {
    color: var(--danger-text);
    border-color: var(--danger-mid);
    &:hover { background: var(--danger-bg); }
  }
}

.card-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
  line-height: var(--line-height-tight);
}

.card-body {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--line-height-loose);
  margin: 0;
  white-space: pre-line;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  &.card-body--expanded {
    display: block;
    -webkit-line-clamp: unset;
  }
}

.expand-btn {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--blue-400);
  background: none;
  border: none;
  padding: var(--space-2) 0;
  min-height: 44px;
  margin-top: var(--space-1);
  cursor: pointer;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.meta-author { font-weight: var(--font-medium); }
.meta-dot { opacity: 0.5; }

/* ── Meeting card ─────────────────────────────────────────────── */
.meeting-link {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-fast);

  &:hover { background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-lg); }
}

.meeting-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
  flex-shrink: 0;
}

.meeting-month {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--blue-400);
  letter-spacing: 0.05em;
  line-height: 1.2;
}

.meeting-day {
  font-size: var(--text-2xl);
  font-weight: var(--font-medium);
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

.meeting-type-pill {
  align-self: flex-start;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: var(--surface-raised);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
}

.meeting-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meeting-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.meeting-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: auto;
}

.meeting-rsvp-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 0.5px solid var(--border-subtle);
  flex-wrap: wrap;
}

.rsvp-inline-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);

  &:hover:not(:disabled) {
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.rsvp-inline-btn--yes {
  background: var(--success-mid) !important;
  border-color: var(--success-mid) !important;
  color: #fff !important;
}

.rsvp-inline-btn--no {
  background: var(--danger-mid) !important;
  border-color: var(--danger-mid) !important;
  color: #fff !important;
}

/* ── Poll card ────────────────────────────────────────────────── */
.poll-body {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.poll-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poll-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--blue-400);
}

.poll-voted {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
}

.poll-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.poll-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);

  &:hover { background: var(--surface-raised); }

  &.poll-option--selected {
    border-color: var(--blue-400);
    background: var(--blue-50);
  }
}

.poll-vote-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.poll-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.poll-result-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.poll-result-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
}

.poll-result-bar-wrap {
  height: 6px;
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.poll-result-bar {
  height: 100%;
  background: var(--border-default);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;

  &.poll-result-bar--my-vote { background: var(--gradient-brand); }
}

.poll-result-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);

  &.poll-result-label--my-vote {
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }
}

.poll-result-pct {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.poll-detail-link {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-link);
  text-decoration: none;
  min-height: 44px;
  align-self: flex-start;

  &:hover { text-decoration: underline; }
}

.poll-ineligible {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.poll-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
}

/* ── Modals ───────────────────────────────────────────────────── */
.modal-form {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  @media (min-width: 30rem) {
    flex-direction: row;
    align-items: flex-end;
  }
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
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  box-sizing: border-box;
  min-height: 44px;

  &:focus { outline: none; box-shadow: var(--shadow-focus); border-color: var(--border-focus); }

  &.input--textarea {
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
