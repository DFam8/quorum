<template>
  <div class="dashboard">

    <header class="dashboard-header">
      <div>
        <h1 class="greeting">{{ greeting }}, {{ user?.firstName }}</h1>
        <p class="greeting-date">{{ formattedDate }}</p>
      </div>
      <NuxtLink v-if="unreadMessageCount > 0" :to="unreadMessageLink" class="msg-badge">
        <span class="msg-badge-dot" aria-hidden="true" />
        {{ unreadMessageCount }} unread {{ unreadMessageCount === 1 ? 'message' : 'messages' }}
      </NuxtLink>
    </header>

    <!-- Setup checklist -->
    <div v-if="!setupDone" class="setup-card">
      <h2 class="setup-title">Get your community set up</h2>
      <ul class="checklist">
        <li class="checklist-item done">
          <FaIcon :icon="['fajr', 'circle-check']" class="check-icon check-icon--done" />
          Community created
        </li>
        <li class="checklist-item" :class="{ done: hasUnits }">
          <FaIcon :icon="['fajr', hasUnits ? 'circle-check' : 'circle']" class="check-icon" :class="{ 'check-icon--done': hasUnits }" />
          Add your units
          <NuxtLink v-if="!hasUnits" to="/admin/units" class="checklist-link">Add units →</NuxtLink>
        </li>
        <li class="checklist-item" :class="{ done: hasResidents }">
          <FaIcon :icon="['fajr', hasResidents ? 'circle-check' : 'circle']" class="check-icon" :class="{ 'check-icon--done': hasResidents }" />
          Invite residents
          <NuxtLink v-if="!hasResidents && hasUnits" to="/admin/units" class="checklist-link">Invite →</NuxtLink>
        </li>
      </ul>
    </div>

    <!-- Stat widgets -->
    <div v-if="!statsLoading" class="stats-grid">
      <div class="stat-card">
        <FaIcon :icon="['fajr', 'building']" class="stat-icon" />
        <div>
          <p class="stat-value">{{ unitsCount }}</p>
          <p class="stat-label">Units</p>
        </div>
      </div>
      <div class="stat-card">
        <FaIcon :icon="['fajr', 'users']" class="stat-icon" />
        <div>
          <p class="stat-value">{{ residentsCount }}</p>
          <p class="stat-label">Residents</p>
        </div>
      </div>
      <div class="stat-card">
        <FaIcon :icon="['fajr', 'calendar']" class="stat-icon" />
        <div>
          <p class="stat-value">{{ upcomingMeetingCount }}</p>
          <p class="stat-label">Upcoming meetings</p>
        </div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--alert': pendingInviteCount > 0 }">
        <FaIcon :icon="['fajr', 'envelope']" class="stat-icon" />
        <div>
          <p class="stat-value">{{ pendingInviteCount }}</p>
          <p class="stat-label">Pending invites</p>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <section class="section">
      <h2 class="section-title">Quick actions</h2>
      <div class="action-grid">
        <NuxtLink to="/admin/units" class="action-card">
          <FaIcon :icon="['fajr', 'building']" class="action-icon" />
          <span class="action-label">Units &amp; Invites</span>
          <span class="action-desc">Manage units, invite residents</span>
        </NuxtLink>
        <NuxtLink to="/admin/residents" class="action-card">
          <FaIcon :icon="['fajr', 'users']" class="action-icon" />
          <span class="action-label">Residents</span>
          <span class="action-desc">View roster, assign roles</span>
        </NuxtLink>
        <NuxtLink to="/meetings" class="action-card">
          <FaIcon :icon="['fajr', 'calendar']" class="action-icon" />
          <span class="action-label">Meetings</span>
          <span class="action-desc">Schedule and manage meetings</span>
        </NuxtLink>
        <NuxtLink to="/feed" class="action-card">
          <FaIcon :icon="['fajr', 'newspaper']" class="action-icon" />
          <span class="action-label">Community feed</span>
          <span class="action-desc">Announcements and updates</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Upcoming meetings -->
    <section v-if="upcomingMeetings.length" class="section">
      <div class="section-header">
        <h2 class="section-title">Upcoming meetings</h2>
        <NuxtLink to="/meetings" class="view-all">View all →</NuxtLink>
      </div>
      <ul class="meeting-list">
        <li v-for="m in upcomingMeetings" :key="m.id" class="meeting-item">
          <NuxtLink :to="`/meetings/${m.id}`" class="meeting-link">
            <div class="meeting-date">
              <span class="meeting-month">{{ meetingMonth(m.scheduledAt) }}</span>
              <span class="meeting-day">{{ meetingDay(m.scheduledAt) }}</span>
            </div>
            <div class="meeting-info">
              <p class="meeting-title">{{ m.title }}</p>
              <p class="meeting-meta">
                <FaIcon :icon="['fajr', 'clock']" />
                {{ meetingTime(m.scheduledAt) }}
                <template v-if="m.location">
                  <span class="meta-dot">·</span>
                  {{ m.location }}
                </template>
              </p>
            </div>
            <FaIcon :icon="['fajr', 'angle-right']" class="meeting-arrow" />
          </NuxtLink>
        </li>
      </ul>
    </section>

  </div>
</template>

<script setup lang="ts">
import { isBoardMember as checkBoardMember } from '../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const router = useRouter()

// Redirect residents to /feed
const isBoard = computed(() => !!user.value && checkBoardMember(user.value))
watch(isBoard, (val) => { if (user.value && !val) router.replace('/feed') }, { immediate: true })

// ── Types ──────────────────────────────────────────────────────────────────
type Thread = Awaited<ReturnType<typeof api.messages.list.query>>[number]
type Meeting = Awaited<ReturnType<typeof api.meetings.list.query>>[number]

// ── Data ───────────────────────────────────────────────────────────────────
const allThreads = ref<Thread[]>([])
const allMeetings = ref<Meeting[]>([])
const statsLoading = ref(true)
const unitsCount = ref(0)
const residentsCount = ref(0)
const pendingInviteCount = ref(0)

const hasUnits = computed(() => unitsCount.value > 0)
const hasResidents = computed(() => residentsCount.value > 1)
const setupDone = computed(() => hasUnits.value && hasResidents.value)

const unreadThreads = computed(() =>
  allThreads.value.filter(t => t.lastMessage && t.lastMessage.senderId !== user.value?.id && !t.lastMessage.readAt)
)
const unreadMessageCount = computed(() => unreadThreads.value.length)
const unreadMessageLink = computed(() =>
  unreadThreads.value.length === 1 ? `/messages?thread=${unreadThreads.value[0]!.id}` : '/messages'
)

const now = Date.now()
const upcomingMeetings = computed(() =>
  allMeetings.value
    .filter(m => m.status !== 'cancelled' && new Date(m.scheduledAt).getTime() > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 3)
)
const upcomingMeetingCount = computed(() => upcomingMeetings.value.length)

onMounted(async () => {
  await Promise.all([
    api.messages.list.query().then(d => { allThreads.value = d }).catch(() => {}),
    api.meetings.list.query().then(d => { allMeetings.value = d }).catch(() => {}),
    api.units.list.query().then(units => {
      unitsCount.value = units.length
      const allResidents = units.flatMap(u => u.households.flatMap(h => h.residents))
      residentsCount.value = allResidents.length
      pendingInviteCount.value = allResidents.filter(r => r.inviteStatus === 'pending').length
    }).catch(() => {}),
  ])
  statsLoading.value = false
})

// ── Formatters ─────────────────────────────────────────────────────────────
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

const formattedDate = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
)

function meetingMonth(raw: string | Date): string {
  return new Date(raw).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function meetingDay(raw: string | Date): string {
  return String(new Date(raw).getDate())
}
function meetingTime(raw: string | Date): string {
  return new Date(raw).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 860px;
}

/* ── Header ───────────────────────────────────────────────────── */
.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.greeting {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.greeting-date {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: var(--space-1) 0 0;
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
  flex-shrink: 0;

  &:hover { background: var(--blue-100); }
}

.msg-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--blue-400);
}

/* ── Setup card ───────────────────────────────────────────────── */
.setup-card {
  background: var(--info-bg);
  border: 0.5px solid var(--info-mid);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setup-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--info-text);
  margin: 0;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--info-text);

  &.done { opacity: 0.55; text-decoration: line-through; }
}

.check-icon {
  width: 14px;
  flex-shrink: 0;
  color: var(--info-mid);
  &.check-icon--done { color: var(--success-mid); }
}

.checklist-link {
  margin-left: auto;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-link);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

/* ── Stats ────────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);

  @media (min-width: 48rem) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);

  &.stat-card--alert { border-color: var(--warning-mid); background: var(--warning-bg); }
}

.stat-icon {
  font-size: var(--text-lg);
  color: var(--text-tertiary);
  flex-shrink: 0;
  width: 20px;

  .stat-card--alert & { color: var(--warning-text); }
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;

  .stat-card--alert & { color: var(--warning-text); }
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0;

  .stat-card--alert & { color: var(--warning-text); }
}

/* ── Section ──────────────────────────────────────────────────── */
.section { display: flex; flex-direction: column; gap: var(--space-3); }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0;
}

.view-all {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-link);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

/* ── Action grid ──────────────────────────────────────────────── */
.action-grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(2, 1fr);

  @media (min-width: 48rem) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);

  &:hover { border-color: var(--border-strong); background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.action-icon { font-size: var(--text-lg); color: var(--text-tertiary); width: 20px; }
.action-label { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); }
.action-desc { font-size: var(--text-xs); color: var(--text-secondary); }

/* ── Meetings list ────────────────────────────────────────────── */
.meeting-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.meeting-item {
  background: var(--surface-card);
  border-bottom: 0.5px solid var(--border-default);
  &:last-child { border-bottom: none; }
}

.meeting-link {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-fast);

  &:hover { background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.meeting-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
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
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: 1.1;
}

.meeting-info { flex: 1; min-width: 0; }

.meeting-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meeting-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.meta-dot { opacity: 0.5; }

.meeting-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: auto;
}
</style>
