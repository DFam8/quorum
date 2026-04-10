<template>
  <div class="poll-detail">
    <div v-if="loading" class="detail-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <template v-else-if="poll">
      <!-- Header -->
      <div class="detail-header">
        <NuxtLink to="/polls" class="back-link">← Polls</NuxtLink>
        <div class="header-content">
          <div class="header-badges">
            <span class="status-pill" :class="`status-pill--${poll.status}`">{{ statusLabel(poll.status) }}</span>
            <span v-if="poll.eligibility === 'owners_only'" class="elig-pill">Owners only</span>
            <span v-if="poll.anonymous" class="anon-pill">Anonymous</span>
          </div>
          <h1 class="poll-title">{{ poll.title }}</h1>
          <p v-if="poll.description" class="poll-desc">{{ poll.description }}</p>
          <p class="poll-meta">
            <template v-if="poll.status === 'open' && poll.closesAt">Closes {{ formatDateTime(poll.closesAt) }}</template>
            <template v-else-if="poll.status === 'closed' && poll.closedAt">Closed {{ formatShort(poll.closedAt) }}</template>
            <template v-else-if="poll.status === 'draft'">Draft — not yet open for voting</template>
          </p>
        </div>

        <!-- Board actions -->
        <div v-if="isBoard" class="header-actions">
          <BaseButton v-if="poll.status === 'draft'" variant="primary" :loading="transitioning" @click="openPoll">Open poll</BaseButton>
          <BaseButton v-if="poll.status === 'open'" variant="ghost" :loading="transitioning" @click="closePoll">Close poll</BaseButton>
        </div>
      </div>

      <!-- Participation bar (board or closed) -->
      <div v-if="poll.showResults && poll.eligibleCount > 0" class="participation-bar">
        <div class="participation-track">
          <div
            class="participation-fill"
            :style="{ width: `${participationPct}%` }"
          />
        </div>
        <p class="participation-label">
          {{ poll.totalResponses }} of {{ poll.eligibleCount }}
          {{ poll.eligibility === 'owners_only' ? 'eligible owners' : 'residents' }} voted
          ({{ participationPct }}%)
        </p>
      </div>

      <!-- ── Voting view ──────────────────────────────────────────── -->
      <div v-if="poll.canVote" class="voting-panel">
        <p class="voting-prompt">Choose one option:</p>
        <fieldset class="options-fieldset">
          <legend class="sr-only">{{ poll.title }}</legend>
          <BaseRadio
            v-for="opt in poll.options"
            :key="opt.id"
            v-model="selectedOption"
            :value="opt.id"
            :name="`poll-${poll.id}`"
            :wrap-class="['option-label', { 'option-label--selected': selectedOption === opt.id }]"
          >{{ opt.label }}</BaseRadio>
        </fieldset>

        <div v-if="voteError" class="vote-error" role="alert">{{ voteError }}</div>

        <BaseButton
          variant="primary"
          :disabled="!selectedOption"
          :loading="voting"
          class="vote-btn"
          @click="castVote"
        >
          Submit vote
        </BaseButton>
      </div>

      <!-- ── Results view ────────────────────────────────────────── -->
      <div v-else-if="poll.showResults" class="results-panel">
        <ul class="results-list">
          <li v-for="opt in poll.options" :key="opt.id" class="result-row">
            <div class="result-header">
              <span class="result-label">
                {{ opt.label }}
                <span v-if="poll.myResponse?.optionId === opt.id" class="your-vote-dot" title="Your vote" />
              </span>
              <span class="result-count">{{ opt.responseCount }} ({{ optionPct(opt.responseCount) }}%)</span>
            </div>
            <div class="result-track">
              <div
                class="result-fill"
                :class="{ 'result-fill--winner': isWinner(opt) }"
                :style="{ width: `${optionPct(opt.responseCount)}%` }"
              />
            </div>
          </li>
        </ul>
        <p v-if="poll.myResponse" class="voted-note">
          You voted for: <strong>{{ votedLabel }}</strong>
        </p>
      </div>

      <!-- ── Draft / ineligible / board view (no results yet) ───── -->
      <div v-else class="no-results-panel">
        <p v-if="poll.status === 'draft'" class="info-note">
          This poll is a draft. Open it to start collecting votes.
        </p>
        <p v-else-if="!isEligible" class="info-note">
          This poll is open to owners only.
        </p>
        <p v-else class="info-note">
          Results will be available once the poll closes.
        </p>
      </div>
    </template>

    <div v-else class="not-found">
      <p>Poll not found.</p>
      <NuxtLink to="/polls" class="back-link">← Back to polls</NuxtLink>
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

type Poll = Awaited<ReturnType<typeof api.polls.get.query>>

const poll = ref<Poll | null>(null)
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true
  try {
    poll.value = await api.polls.get.query({ id })
  } catch {
    toast.error('Failed to load poll')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Participation ───────────────────────────────────────────────────────────
const participationPct = computed(() => {
  if (!poll.value || poll.value.eligibleCount === 0) return 0
  return Math.round((poll.value.totalResponses / poll.value.eligibleCount) * 100)
})

// ── Eligibility ─────────────────────────────────────────────────────────────
const isEligible = computed(() => {
  if (!poll.value || !user.value) return false
  return poll.value.eligibility === 'all' || user.value.residentType === 'owner'
})

// ── Results helpers ─────────────────────────────────────────────────────────
function optionPct(count: number | null): number {
  if (!poll.value || !count || poll.value.totalResponses === 0) return 0
  return Math.round((count / poll.value.totalResponses) * 100)
}

function isWinner(opt: Poll['options'][number]): boolean {
  if (!poll.value || poll.value.status !== 'closed') return false
  const max = Math.max(...poll.value.options.map(o => o.responseCount ?? 0))
  return (opt.responseCount ?? 0) === max && max > 0
}

const votedLabel = computed(() => {
  if (!poll.value?.myResponse) return ''
  return poll.value.options.find(o => o.id === poll.value!.myResponse!.optionId)?.label ?? ''
})

// ── Voting ──────────────────────────────────────────────────────────────────
const selectedOption = ref<string | null>(null)
const voting = ref(false)
const voteError = ref('')

async function castVote(): Promise<void> {
  if (!selectedOption.value || !poll.value) return
  voting.value = true
  voteError.value = ''
  try {
    await api.polls.respond.mutate({ pollId: poll.value.id, optionId: selectedOption.value })
    toast.success('Vote recorded')
    await load()
  } catch (err) {
    voteError.value = err instanceof Error ? err.message : 'Failed to record vote.'
  } finally {
    voting.value = false
  }
}

// ── Board transitions ────────────────────────────────────────────────────────
const transitioning = ref(false)

async function openPoll(): Promise<void> {
  transitioning.value = true
  try {
    await api.polls.open.mutate({ id })
    toast.success('Poll is now open')
    await load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to open poll')
  } finally {
    transitioning.value = false
  }
}

async function closePoll(): Promise<void> {
  transitioning.value = true
  try {
    await api.polls.close.mutate({ id })
    toast.success('Poll closed — results are now visible')
    await load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to close poll')
  } finally {
    transitioning.value = false
  }
}

// ── Formatting ───────────────────────────────────────────────────────────────
function statusLabel(s: string): string {
  return { draft: 'Draft', open: 'Open', closed: 'Closed' }[s] ?? s
}

function formatShort(raw: string | Date | null | undefined): string {
  if (!raw) return ''
  return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(raw: string | Date | null | undefined): string {
  if (!raw) return ''
  return new Date(raw).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
</script>

<style scoped>
.poll-detail {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);

  @media (min-width: 768px) {
    padding: var(--space-8) var(--space-6);
  }
}

/* ── Loading ──────────────────────────────────────────────────── */
.detail-loading {
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

/* ── Header ───────────────────────────────────────────────────── */
.back-link {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  margin-bottom: var(--space-3);

  &:hover { color: var(--text-primary); }
}

.detail-header {
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.header-badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-pill {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);

  &--draft { background: var(--surface-raised); color: var(--text-secondary); border: 0.5px solid var(--border-default); }
  &--open { background: var(--success-bg); color: var(--success-text); }
  &--closed { background: var(--surface-raised); color: var(--text-secondary); }
}

.elig-pill {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--warning-bg);
  color: var(--warning-text);
}

.anon-pill {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--surface-raised);
  color: var(--text-secondary);
  border: 0.5px solid var(--border-default);
}

.poll-title {
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
  line-height: var(--line-height-tight);
}

.poll-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.poll-meta {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* ── Participation ────────────────────────────────────────────── */
.participation-bar {
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.participation-track {
  height: 6px;
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.participation-fill {
  height: 100%;
  background: var(--blue-400);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}

.participation-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Voting ───────────────────────────────────────────────────── */
.voting-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.voting-prompt {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

.options-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 48px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);

  &:hover { border-color: var(--border-strong); background: var(--surface-raised); }

  &--selected {
    border-color: var(--blue-400);
    background: var(--blue-50);
  }
}

.vote-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 1px solid var(--danger-mid);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

.vote-btn {
  align-self: flex-start;

  @media (max-width: 30rem) {
    width: 100%;
  }
}

/* ── Results ──────────────────────────────────────────────────── */
.results-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.results-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.result-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.result-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.your-vote-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue-400);
  flex-shrink: 0;
}

.result-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.result-track {
  height: 8px;
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.result-fill {
  height: 100%;
  background: var(--border-default);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;

  &--winner { background: var(--gradient-brand); }
}

.voted-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* ── Info / not found ─────────────────────────────────────────── */
.no-results-panel,
.not-found {
  text-align: center;
  padding: var(--space-8) var(--space-4);
}

.info-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
